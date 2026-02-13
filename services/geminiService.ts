import { GoogleGenAI, FunctionDeclaration, Type, Chat } from "@google/genai";
import { StandardType } from "../types";
import { GRI_KNOWLEDGE_BASE } from "../data/griStandards";
import { processFile, ProcessedPart } from "./fileProcessing";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Helper function to retry API calls on 429 errors
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
      // Check for 429 (Resource Exhausted / Quota Exceeded)
      const isQuotaError = 
        error.status === 429 || 
        error.code === 429 || 
        (error.message && (error.message.includes('429') || error.message.includes('Quota')));

      if (isQuotaError && attempt < retries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`Gemini API 429 Error. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
        attempt++;
        continue;
      }
      
      // If it's the last attempt or not a retryable error, throw it
      if (attempt === retries - 1 || !isQuotaError) {
        throw error;
      }
    }
  }
  throw new Error("Max retries exceeded");
};

/**
 * Simulates the RAG (Retrieval) step.
 * Now handles an array of standards.
 */
export const retrieveContext = (standards: StandardType | StandardType[]): string => {
  const standardArray = Array.isArray(standards) ? standards : [standards];
  
  const contexts = standardArray.map(std => {
    const chunk = GRI_KNOWLEDGE_BASE[std];
    return chunk 
      ? `### [Standard: ${std}]\n${chunk.text}` 
      : `### [Standard: ${std}]\nNo standard text found.`;
  });

  return contexts.join("\n\n");
};

/**
 * Generates the initial report.
 */
export const generateReport = async (
  companyName: string,
  reportingYear: string,
  standards: StandardType[],
  rawInput: string,
  context: string,
  files: File[] = [],
  urls: string[] = [],
  wordCount: number = 800,
  includeTables: boolean = true
): Promise<string> => {
  
  if (!process.env.API_KEY) {
    throw new Error("Missing API Key. Please ensure process.env.API_KEY is set.");
  }

  // Construct URL section for the prompt
  const urlContext = urls.length > 0 
    ? `\n\n# Reference URLs (參考網址)\nThe user has provided the following links as reference material. Please use the Google Search tool or your internal knowledge to retrieve relevant information from these links if possible to support the report generation:\n${urls.map(u => `- ${u}`).join('\n')}`
    : '';

  const standardsList = standards.join(", ");

  const systemPrompt = `
# Role (角色設定)
你是一位專業的 ESG 永續報告書資深顧問與稽核員。你的任務是協助企業 (${companyName || "公司名稱未提供"}) 依據 GRI 標準 (${standardsList}) 撰寫合規的揭露報告。

# Context (檢索到的標準內容)
${context}

# Task (任務)
請根據 [Context] 中的具體要求，將 [User Data] (包含文字輸入、附件檔案與參考網址) 改寫為一段正式的永續報告揭露文字。
公司名稱: ${companyName || "[公司名稱]"}
報告年度: ${reportingYear} (資料應主要涵蓋此年份，若有跨年度比較請註明)
預計總字數: 約 ${wordCount} 個中文字。

# Constraints (Strict)
1. **NO SUMMARY:** Do NOT provide an executive summary, introduction, or overview at the beginning. Start directly with the content for the first selected GRI standard.
2. **Data Filtering & Synthesis:** The user may provide large amounts of text, files, or links. Your core task is to **filter** this noise. Only extract facts, figures, and descriptions that specifically answer the requirements of the selected GRI Standards (${standardsList}) for the reporting year ${reportingYear}. Discard irrelevant marketing fluff or general company history unless required by a specific standard (like GRI 2-1).
3. **合規性檢查 & 缺漏標示:** 如果使用者數據缺少標準要求的關鍵項目，請在輸出中以粗體標示 **[敬請增補：缺少 XXX 資訊]**，並在文末的清單中列出。
4. **語氣風格:** 專業、客觀、第三人稱（使用「${companyName}」或「本公司」）。嚴禁使用行銷用語。
5. **結構與格式:**
   - 使用 Markdown 格式。
   - **GRI 標準標示位置 (極重要規定):** 
     - **僅限標題:** GRI 揭露項目編號（如 GRI 2-1, GRI 305-1）**必須且只能** 標示在 Markdown 標題（#、##、###）的**最後方**。
     - **內文禁止:** **嚴格禁止** 將 GRI 編號（如 \`[GRI 305-1]()\`）嵌入在一般的段落內文、句子或表格說明中。內文請專注於描述內容，完全不要提及標準編號。
     - **格式:** 標示時請務必使用 Markdown 連結格式但不帶網址，例如 \`[GRI 305-1]()\`，以便系統將其渲染為藍色標籤。
     - **正確範例:** \`### 能源消耗總量 [GRI 302-1]()\`
     - **錯誤範例:** \`本公司依據 [GRI 302-1]() 進行計算...\` (錯誤：內文不可出現)
   - **禁止章節:** **絕對不要**包含「顧問建議」、「改善建議」或「揭露項目摘要」等章節。
   - **待補充資訊:** 所有需要編輯者自行補充的資訊，請**統一整理在文末**的一個獨立區塊，標題為「### 待補充資訊清單」。
   - **表格設定:** ${includeTables ? "必須將數據整理為 Markdown 表格呈現，以利閱讀。" : "請勿使用表格，所有數據請以文字段落描述。"}
   - 必須明確引用標準條號。
6. **禁止幻覺:** 絕對不要捏造數據。
7. **多模態輸入:** 如果有提供附件（圖片、PDF、Excel 等）或網址，請務必解析並整合其中的數據與資訊。

# Output Structure (輸出結構)
1. **揭露內容 (Data & Description):**
   - 直接開始，不需前言。
   - 整合所有選擇的標準內容。
   - ${includeTables ? "包含數據表格。" : "純文字描述數據。"}
2. **待補充資訊清單:** (若有缺漏資訊，請列在此處，每一項請明確指出缺少什麼數據)

# User Data (使用者提供的原始數據與說明)
${rawInput}
${urlContext}
`;

  try {
    const fileParts: ProcessedPart[] = [];
    if (files.length > 0) {
        for (const file of files) {
            const part = await processFile(file);
            fileParts.push(part);
        }
    }

    const parts = [
      { text: systemPrompt },
      ...fileParts.map(p => p.inlineData ? { inlineData: p.inlineData } : { text: p.text || '' })
    ];

    // Wrap the API call with retry logic
    const response = await callWithRetry(async () => {
      // Using gemini-3-pro-preview with low thinking budget for quality balance
      return await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: {
          // Set a modest thinking budget (1024 tokens) to improve quality without taking too long (approx 5-10s)
          thinkingConfig: { thinkingBudget: 1024 },
          // Enable Google Search to handle URLs or external info verification
          tools: [{ googleSearch: {} }] 
        }
      });
    });

    return response.text || "No response generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Provide a user-friendly error message for 429
    if (error.status === 429 || (error.message && error.message.includes('429'))) {
       throw new Error("系統忙碌中 (Quota Exceeded)。請稍後再試，或檢查您的 API Key 額度限制。");
    }
    
    throw new Error("Failed to generate report. " + (error.message || "Please check your API key and connection."));
  }
};

/**
 * Tool Definition for Updating Report
 */
const updateReportTool: FunctionDeclaration = {
  name: 'updateReport',
  description: 'Overwrites the current report with new content based on user instructions. Use this whenever the user asks to modify, edit, or change the report.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      newContent: {
        type: Type.STRING,
        description: 'The full, updated markdown content of the report.',
      },
    },
    required: ['newContent'],
  },
};

/**
 * Class to manage a persistent chat session for report refinement
 */
export class ReportAssistant {
  private chat: Chat;

  constructor(currentReport: string, standardContext: string, companyName: string) {
    // Keeping Chat on Flash for responsiveness, but instructed to be proactive about missing info
    this.chat = ai.chats.create({
      model: 'gemini-3-flash-preview', 
      config: {
        thinkingConfig: { thinkingBudget: 0 }, 
        systemInstruction: `You are a proactive AI Editor Assistant for ESG reports for ${companyName}. 
        
        Current Context:
        - You have a draft report.
        - You have the raw standard text.
        
        Your Specific Mission (High Priority):
        1. **Check for Missing Info:** Immediately look at the '### 待補充資訊清單' (Missing Information List) at the bottom of the current report.
        2. **Proactive Reminder:** Your goal is to help the user complete the report. 
           - **Do not wait for the user to ask.**
           - In your very first message (and subsequent ones), you MUST identify the first unresolved item in the missing list and politely ask the user to provide it.
           - Example: "I noticed we are missing the GWP source for Scope 1. Do you have that information?"
           - Guide them item by item.
        3. **Assist & Update:** When the user provides the info, generate the FULL updated report (incorporating the new info and removing the item from the missing list) and call the 'updateReport' tool.
        4. **GRI Formatting Rules (CRITICAL):** 
           - **Headers Only:** GRI tags like \`[GRI 305-1]()\` MUST ONLY appear at the end of markdown headers (e.g., \`### Emission Data [GRI 305-1]()\`).
           - **No Body Tags:** NEVER put GRI tags inside body paragraphs or sentences.
           - **Blue Style:** Always use the empty link syntax \`[]()\` for the tags to maintain blue styling.
        
        If the report is complete (no missing list), then you can help refine tone or format.
        `,
        tools: [{ functionDeclarations: [updateReportTool] }],
      },
      history: [
        {
          role: 'user',
          parts: [{ text: `Here is the current draft of the report:\n\n${currentReport}` }],
        },
        {
          role: 'model',
          parts: [{ text: "收到。我已經檢視了初稿。" }], // Default context, will be overridden by immediate user prompt or initial call
        }
      ]
    });
  }

  /**
   * Sends a message to the assistant.
   * Returns an object containing the text response AND/OR the new report content if a tool was called.
   */
  async sendMessage(message: string): Promise<{ responseText: string, updatedReport?: string }> {
    try {
      // Wrap chat message with retry logic
      const response = await callWithRetry(async () => {
        return await this.chat.sendMessage({ message });
      });
      
      let responseText = response.text || "";
      let updatedReport: string | undefined;

      // Check for function calls
      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const functionResponseParts = [];

        for (const call of functionCalls) {
          if (call.name === 'updateReport') {
            updatedReport = call.args['newContent'] as string;
            
            // Pass the ID back if available to strictly follow tool protocol
            functionResponseParts.push({
              functionResponse: {
                name: call.name,
                response: { result: "Report successfully updated in the UI." },
                id: call.id
              }
            });
          }
        }

        if (functionResponseParts.length > 0) {
            // Send tool response back to model to close the loop
            // Wrap tool response with retry logic too
            const toolResponse = await callWithRetry(async () => {
                return await this.chat.sendMessage({ message: functionResponseParts });
            });
            responseText = toolResponse.text || "Report updated.";
        }
      }

      return { responseText, updatedReport };

    } catch (error: any) {
      console.error("Chat Error:", error);
      if (error.status === 429 || (error.message && error.message.includes('429'))) {
        return { responseText: "系統忙碌中 (Quota Exceeded)。請稍後再試。" };
      }
      return { responseText: "Sorry, I encountered an error processing your request." };
    }
  }
}