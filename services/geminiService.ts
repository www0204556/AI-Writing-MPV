import { GoogleGenAI, FunctionDeclaration, Type, Chat, Part } from "@google/genai";
import { StandardType } from "../types";
import { GRI_KNOWLEDGE_BASE } from "../data/griStandards";
import { processFile, ProcessedPart } from "./fileProcessing";

// Configuration Constants
const MODEL_ID = 'gemini-3-pro-preview'; // Unified model for both tasks
const THINKING_BUDGET = 1024; // Limited budget to ensure <10s latency while maintaining quality

// Initialize Gemini Client
// Ensure API key is present at runtime
if (!process.env.API_KEY) {
  console.error("API_KEY is missing from environment variables.");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Robust retry mechanism for API calls.
 * Handles transient network errors and rate limits (429).
 */
const callWithRetry = async <T>(
  fn: () => Promise<T>, 
  retries: number = 3, 
  initialDelay: number = 2000
): Promise<T> => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error.status || error.code;
      const message = error.message || '';
      
      // Identify retryable errors: 429 (Too Many Requests) or 5xx (Server Errors)
      const isRetryable = 
        status === 429 || 
        status === 503 || 
        status === 500 ||
        message.includes('429') || 
        message.includes('Quota') ||
        message.includes('overloaded');

      if (isRetryable && attempt < retries - 1) {
        // Exponential backoff
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`[Gemini Service] Transient error (${status}). Retrying in ${delay}ms... (Attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
        attempt++;
        continue;
      }
      
      // Stop retrying if max attempts reached or error is fatal
      throw error;
    }
  }
  throw new Error("Max retries exceeded for Gemini API call.");
};

/**
 * Simulates RAG (Retrieval) by mapping standard IDs to knowledge chunks.
 */
export const retrieveContext = (standards: StandardType | StandardType[]): string => {
  const standardArray = Array.isArray(standards) ? standards : [standards];
  
  if (standardArray.length === 0) return "";

  // Optimize: Use map/join for efficient string concatenation
  return standardArray.map(std => {
    const chunk = GRI_KNOWLEDGE_BASE[std];
    return chunk 
      ? `### [Standard: ${std}]\n${chunk.text}` 
      : `### [Standard: ${std}]\n(No standard text found in knowledge base.)`;
  }).join("\n\n");
};

/**
 * Generates the initial ESG report.
 * Uses Gemini 3 Pro with a constrained thinking budget for speed.
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
  includeCharts: boolean = false
): Promise<string> => {
  
  // 1. Construct the System Prompt
  const standardsList = standards.join(", ");
  const urlContext = urls.length > 0 
    ? `\n\n# Reference URLs\n${urls.map(u => `- ${u}`).join('\n')}`
    : '';

  // Tone Logic
  const toneMap: Record<string, string> = {
    analytical: "語氣要求：管理分析型。強調數據背後的洞察、趨勢分析、以及風險與機會評估。內容應精簡有力。",
    brand: "語氣要求：品牌溝通型。強調永續承諾與價值創造，語言通俗易懂，富有感染力，但嚴禁漂綠 (Greenwashing)。",
    professional: "語氣要求：專業合規型。強調精準度、標準依循，使用正式術語，客觀且嚴謹。"
  };
  const toneInstruction = toneMap[tone] || toneMap['professional'];

  // Format Logic
  const tableInstruction = includeTables 
      ? `3. **表格 (Tables):** 必須將關鍵數據整理為 Markdown 表格，清晰易讀。` 
      : `3. **表格 (Tables):** 請勿使用 Markdown 表格，數據請以文字敘述呈現。`;

  const chartInstruction = includeCharts
      ? `4. **圖表 (Charts):** 主動識別適合視覺化的數據並製作 Mermaid.js 圖表 (pie, xychart-beta, flowchart)。每個圖表前必須提供數據來源表格。`
      : `4. **圖表 (Charts):** 本次報告**不製作**任何 Mermaid 圖表。`;

  const systemPrompt = `
# Role
你是一名【資深 ESG 永續報告書顧問】。任務是撰寫符合 GRI Standards 2021 與 SASB 標準的草稿。
公司: ${companyName || "[公司名稱]"} | 年度: ${reportingYear} | 目標字數: 約 ${wordCount} 字 | 準則: ${standardsList}

# Context (GRI Standards)
${context}

# Instructions
${toneInstruction}

# Hard Rules
1. **No Hallucinations:** 若無數據，記在文末「### 待補充資訊清單」，絕不可捏造。
2. **Citations:** 每段落需標註依據標準 (如: 依據 GRI 305-1...)。
3. **Perspective:** 使用第三人稱客觀語氣。

# Formatting
1. **Markdown Structure:** 直接切入準則內容。
2. **UI Tags:** 標題後方必須加上 \`[GRI XXX-X]()\` 以觸發 UI 藍色標籤 (例: \`### 排放數據 [GRI 305-1]()\`)。
3. **Missing Info:** 缺漏資訊列於文末。
${tableInstruction}
${chartInstruction}
5. **Multimodal:** 整合附件與連結中的資訊。

# User Data
${rawInput}
${urlContext}
`;

  // 2. Process Files
  const fileParts: ProcessedPart[] = [];
  if (files.length > 0) {
      // Execute in parallel for speed
      const processedResults = await Promise.all(files.map(file => processFile(file)));
      fileParts.push(...processedResults);
  }

  // 3. Assemble Request Parts
  const parts: Part[] = [
    { text: systemPrompt },
    ...fileParts.map(p => p.inlineData ? { inlineData: p.inlineData } : { text: p.text || '' })
  ];

  // 4. API Call
  try {
    const response = await callWithRetry(async () => {
      return await ai.models.generateContent({
        model: MODEL_ID,
        contents: { parts },
        config: {
          thinkingConfig: { thinkingBudget: THINKING_BUDGET },
          tools: [{ googleSearch: {} }] // Enable search for URL context
        }
      });
    });

    return response.text || "No response generated.";
  } catch (error: any) {
    console.error("Report Generation Error:", error);
    if (error.status === 429 || (error.message && error.message.includes('429'))) {
       throw new Error("系統忙碌中 (Quota Exceeded)。請稍後再試。");
    }
    throw new Error("Failed to generate report: " + (error.message || "Unknown error"));
  }
};

// Tool Definition for UI Updates
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
 * Manages the persistent chat session.
 */
export class ReportAssistant {
  private chat: Chat;

  constructor(currentReport: string, standardContext: string, companyName: string) {
    // Initialize Chat with Gemini 3 Pro + Limited Thinking Budget
    this.chat = ai.chats.create({
      model: MODEL_ID, 
      config: {
        thinkingConfig: { thinkingBudget: THINKING_BUDGET }, 
        systemInstruction: `你是一名【資深 ESG 顧問】。任務是協助使用者完善 GRI/SASB 報告。
        公司: ${companyName}

        # 核心規則
        1. **拒絕幻覺:** 若無數據，請使用者提供，不可捏造。
        2. **格式:** 更新報告時，標題後方保留 \`[GRI XXX-X]()\` 標籤。
        3. **工具:** 若需修改報告內容，務必呼叫 \`updateReport\` 工具。
        
        # 你的策略 (High Priority)
        1. **檢查缺漏:** 檢視文末 '### 待補充資訊清單'。
        2. **主動引導:** 每次對話優先詢問清單中的第一個缺漏項目。
        3. **執行更新:** 收到數據後，產生完整新報告並呼叫工具。
        `,
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

  async sendMessage(message: string, files: File[] = []): Promise<{ responseText: string, updatedReport?: string }> {
    try {
      // 1. Prepare Input Parts
      const parts: Part[] = [];
      
      if (files.length > 0) {
        const processedFiles = await Promise.all(files.map(f => processFile(f)));
        for (const pf of processedFiles) {
          if (pf.inlineData) parts.push({ inlineData: pf.inlineData });
          if (pf.text) parts.push({ text: pf.text });
        }
      }
      
      parts.push({ text: message });

      // 2. Send Message with Retry
      const response = await callWithRetry(async () => {
        return await this.chat.sendMessage({ message: parts });
      });
      
      let responseText = response.text || "";
      let updatedReport: string | undefined;

      // 3. Handle Tool Calls
      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const functionResponseParts: Part[] = [];

        for (const call of functionCalls) {
          if (call.name === 'updateReport') {
            updatedReport = call.args['newContent'] as string;
            
            // Ack the tool execution
            functionResponseParts.push({
              functionResponse: {
                name: call.name,
                response: { result: "Success" },
                id: call.id
              }
            });
          }
        }

        // 4. Send Tool Response back to model (Close the loop)
        if (functionResponseParts.length > 0) {
            const toolResponse = await callWithRetry(async () => {
                return await this.chat.sendMessage({ message: functionResponseParts });
            });
            // If the model generates follow-up text after tool use, append it
            if (toolResponse.text) {
                responseText = toolResponse.text;
            } else if (!responseText) {
                responseText = "報告已更新。";
            }
        }
      }

      return { responseText, updatedReport };

    } catch (error: any) {
      console.error("Chat Interaction Error:", error);
      if (error.status === 429 || (error.message && error.message.includes('429'))) {
        return { responseText: "系統忙碌中 (Quota Exceeded)。請稍後再試。" };
      }
      return { responseText: "抱歉，處理您的請求時發生錯誤。" };
    }
  }
}