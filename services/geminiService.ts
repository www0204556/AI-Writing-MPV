import { GoogleGenAI, FunctionDeclaration, Type, Chat, Part, Tool, GenerateContentResponse } from "@google/genai";
import { StandardType } from "../types";
import { processFile, ProcessedPart } from "./fileProcessing";
import { getReportSystemPrompt, getChatAssistantSystemPrompt, getToneInstruction } from "../data/prompts";

// Configuration Constants
const MODEL_ID = 'gemini-3-pro-preview'; 
const THINKING_BUDGET = 1024; 

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Robust retry mechanism for API calls.
 */
const callWithRetry = async <T>(
  fn: () => Promise<T>, 
  retries: number = 3, 
  initialDelay: number = 3000
): Promise<T> => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error.status || error.code || error?.error?.code;
      const errorCodeStr = error?.error?.status || ""; 
      const message = error.message || error?.error?.message || "";
      const reason = error?.error?.details?.[0]?.reason || "";

      if (status === 400 && (message.includes("API key not valid") || reason === "API_KEY_INVALID")) {
          console.error("[Gemini Service] Invalid API Key.");
          throw new Error("API 金鑰無效 (Invalid API Key)。請檢查您的部署設定與環境變數 (API_KEY)。");
      }

      const isRetryable = 
        status === 429 || 
        status === 503 || 
        status === 500 ||
        errorCodeStr === "RESOURCE_EXHAUSTED" ||
        message.includes('429') || 
        message.includes('Quota') ||
        message.includes('overloaded') || 
        message.includes('RESOURCE_EXHAUSTED');

      if (isRetryable) {
        if (attempt < retries - 1) {
            const delay = initialDelay * Math.pow(2, attempt) + (Math.random() * 1000);
            console.warn(`[Gemini Service] Transient error (${status || errorCodeStr}). Retrying in ${Math.floor(delay)}ms... (Attempt ${attempt + 1}/${retries})`);
            await new Promise(r => setTimeout(r, delay));
            attempt++;
            continue;
        } else {
            console.error("[Gemini Service] Max retries exceeded for 429/Quota error.");
            throw new Error("系統目前使用量較大或已達額度上限 (Quota Exceeded)，請稍後再試。");
        }
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded for Gemini API call.");
};

/**
 * Simulates RAG (Retrieval).
 * Uses Dynamic Import for performance.
 */
export const retrieveContext = async (standards: StandardType | StandardType[]): Promise<string> => {
  const standardArray = Array.isArray(standards) ? standards : [standards];
  if (standardArray.length === 0) return "";
  const { GRI_KNOWLEDGE_BASE } = await import("../data/griStandards");
  return standardArray.map(std => {
    const chunk = GRI_KNOWLEDGE_BASE[std];
    return chunk 
      ? `### [Standard: ${std}]\n${chunk.text}` 
      : `### [Standard: ${std}]\n(No standard text found in knowledge base.)`;
  }).join("\n\n");
};

/**
 * Generates the initial ESG report with Streaming support.
 */
export const generateReport = async (
  companyName: string,
  reportingYear: string,
  standards: StandardType[],
  rawInput: string,
  context: string,
  files: File[] = [],
  urls: string[] = [],
  wordCount: number = 500,
  tone: string = 'professional',
  includeTables: boolean = false,
  includeCharts: boolean = false,
  useGoogleSearch: boolean = false,
  onStreamUpdate?: (text: string) => void
): Promise<string> => {
  
  const standardsList = standards.join(", ");
  const urlContext = urls.length > 0 
    ? `\n\n# Reference URLs\n${urls.map(u => `- ${u}`).join('\n')}`
    : '';

  const toneInstruction = getToneInstruction(tone);
  const tableInstruction = includeTables 
      ? `3. **表格 (Tables):** 必須將關鍵數據整理為 Markdown 表格，清晰易讀。` 
      : `3. **表格 (Tables):** 請勿使用 Markdown 表格，數據請以文字敘述呈現。`;

  const chartInstruction = includeCharts
      ? `4. **圖表 (Charts):** 主動識別適合視覺化的數據並製作 Mermaid.js 圖表 (pie, xychart-beta, flowchart)。每個圖表前必須提供數據來源表格。`
      : `4. **圖表 (Charts):** 本次報告**不製作**任何 Mermaid 圖表。`;

  const searchInstruction = useGoogleSearch
      ? `6. **搜尋資料:** 務必善用 Google Search 工具來補充最新的相關產業資訊、競業數據或法規動態。若有引用搜尋結果，請確保資訊準確。`
      : ``;

  const systemPrompt = getReportSystemPrompt(
    companyName, reportingYear, standardsList, wordCount, context, 
    toneInstruction, tableInstruction, chartInstruction, searchInstruction, rawInput, urlContext
  );

  const fileParts: ProcessedPart[] = [];
  if (files.length > 0) {
      const processedResults = await Promise.all(files.map(file => processFile(file)));
      fileParts.push(...processedResults);
  }

  const parts: Part[] = [
    { text: systemPrompt },
    ...fileParts.map(p => p.inlineData ? { inlineData: p.inlineData } : { text: p.text || '' })
  ];

  const tools: Tool[] = [];
  if (useGoogleSearch || urls.length > 0) {
      tools.push({ googleSearch: {} });
  }

  try {
    // STREAMING IMPLEMENTATION
    const result = await callWithRetry(async () => {
        return await ai.models.generateContentStream({
            model: MODEL_ID,
            contents: { parts },
            config: {
                thinkingConfig: { thinkingBudget: THINKING_BUDGET },
                tools: tools.length > 0 ? tools : undefined
            }
        });
    });

    let fullText = "";
    let finalGroundingMetadata: any = null;

    for await (const chunk of result) {
        const chunkText = chunk.text;
        if (chunkText) {
            fullText += chunkText;
            if (onStreamUpdate) {
                onStreamUpdate(fullText);
            }
        }
        
        // Capture grounding metadata from the last chunk(s) if available
        if (chunk.candidates?.[0]?.groundingMetadata) {
             finalGroundingMetadata = chunk.candidates[0].groundingMetadata;
        }
    }

    // Process Grounding Metadata (Google Search Sources)
    if (finalGroundingMetadata?.groundingChunks) {
        const uniqueSources = new Set<string>();
        const sourceList: string[] = [];

        finalGroundingMetadata.groundingChunks.forEach((chunk: any) => {
            if (chunk.web?.uri && chunk.web?.title) {
                const sourceEntry = `- [${chunk.web.title}](${chunk.web.uri})`;
                if (!uniqueSources.has(chunk.web.uri)) {
                    uniqueSources.add(chunk.web.uri);
                    sourceList.push(sourceEntry);
                }
            }
        });

        if (sourceList.length > 0) {
            const sourceText = `\n\n### Google Search Sources (資料來源)\n${sourceList.join('\n')}`;
            fullText += sourceText;
            if (onStreamUpdate) {
                onStreamUpdate(fullText);
            }
        }
    }

    return fullText;

  } catch (error: any) {
    console.error("Report Generation Error:", error);
    if (error.message.includes("API 金鑰無效")) throw error;
    if (error.message.includes("Quota")) throw error;
    throw new Error("Failed to generate report: " + (error.message || "Unknown error"));
  }
};

// Tool Definition
const updateReportTool: FunctionDeclaration = {
  name: 'updateReport',
  description: 'Overwrites the current report with new content. Use when modifying, editing, or adding data to the report.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      newContent: {
        type: Type.STRING,
        description: 'The full, updated markdown content.',
      },
    },
    required: ['newContent'],
  },
};

/**
 * Manages the persistent chat session with Streaming support.
 */
export class ReportAssistant {
  private chat: Chat;

  constructor(currentReport: string, standardContext: string, companyName: string) {
    const systemInstruction = getChatAssistantSystemPrompt(companyName);
    
    this.chat = ai.chats.create({
      model: MODEL_ID, 
      config: {
        thinkingConfig: { thinkingBudget: THINKING_BUDGET }, 
        systemInstruction: systemInstruction,
        tools: [{ functionDeclarations: [updateReportTool] }],
      },
      history: [
        {
          role: 'user',
          parts: [{ text: `這是目前的報告初稿:\n\n${currentReport}` }],
        },
        {
          role: 'model',
          parts: [{ text: "收到。我已經檢視了初稿，隨時準備協助您補充缺失資訊或修潤內容。" }], 
        }
      ]
    });
  }

  async sendMessage(
      message: string, 
      files: File[] = [], 
      onStreamUpdate?: (text: string) => void
  ): Promise<{ responseText: string, updatedReport?: string }> {
    try {
      const parts: Part[] = [];
      
      if (files.length > 0) {
        const processedFiles = await Promise.all(files.map(f => processFile(f)));
        for (const pf of processedFiles) {
          if (pf.inlineData) parts.push({ inlineData: pf.inlineData });
          if (pf.text) parts.push({ text: pf.text });
        }
      }
      
      parts.push({ text: message });

      const streamResult = await callWithRetry(async () => {
        return await this.chat.sendMessageStream({ message: parts });
      });

      let responseText = "";
      let functionCall: any = null;
      let updatedReport: string | undefined;

      for await (const chunk of streamResult) {
          const text = chunk.text;
          if (text) {
              responseText += text;
              if (onStreamUpdate) onStreamUpdate(responseText);
          }
          // Check for function calls in chunks (usually in the first or last chunks depending on model)
          if (chunk.functionCalls && chunk.functionCalls.length > 0) {
             functionCall = chunk.functionCalls[0];
          }
      }

      // Handle Function Call (Tool Use)
      // Note: Function calling with streaming requires collecting the call, executing it, 
      // and then sending the tool response back to get the final model response.
      if (functionCall && functionCall.name === 'updateReport') {
        updatedReport = functionCall.args['newContent'] as string;
        
        // Send tool response back
        const toolResponseParts: Part[] = [{
            functionResponse: {
                name: functionCall.name,
                response: { result: "Success" },
                id: functionCall.id
            }
        }];

        const toolStreamResult = await callWithRetry(async () => {
            return await this.chat.sendMessageStream({ message: toolResponseParts });
        });
        
        // Reset response text for the final user-facing message
        responseText = ""; 
        if (onStreamUpdate) onStreamUpdate(""); // clear loading or previous text

        for await (const chunk of toolStreamResult) {
            const text = chunk.text;
            if (text) {
                responseText += text;
                if (onStreamUpdate) onStreamUpdate(responseText);
            }
        }
        
        if (!responseText) responseText = "報告已更新。";
      }

      return { responseText, updatedReport };

    } catch (error: any) {
      console.error("Chat Interaction Error:", error);
      if (error.message && (error.message.includes('Quota') || error.message.includes('API 金鑰無效') || error.message.includes('系統'))) {
         return { responseText: error.message };
      }
      return { responseText: "抱歉，處理您的請求時發生錯誤。" };
    }
  }
}
