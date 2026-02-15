import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { StandardType, ChatMessage } from '../types';
import { generateReport, retrieveContext, ReportAssistant } from '../services/geminiService';

interface ReportContextType {
  // Input State
  selectedStandards: StandardType[];
  setSelectedStandards: React.Dispatch<React.SetStateAction<StandardType[]>>;
  companyName: string;
  setCompanyName: (name: string) => void;
  reportingYear: string;
  setReportingYear: (year: string) => void;
  rawInput: string;
  setRawInput: (input: string) => void;
  targetWordCount: number;
  setTargetWordCount: (count: number) => void;
  tone: string;
  setTone: (tone: string) => void;
  includeTables: boolean;
  setIncludeTables: (include: boolean) => void;
  includeCharts: boolean;
  setIncludeCharts: (include: boolean) => void;
  useGoogleSearch: boolean;
  setUseGoogleSearch: (use: boolean) => void;
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  urls: string[];
  setUrls: React.Dispatch<React.SetStateAction<string[]>>;

  // Result State
  generatedReport: string | null;
  retrievedContext: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Chat State
  isChatOpen: boolean;
  setIsChatOpen: (isOpen: boolean) => void;
  chatMessages: ChatMessage[];
  isChatProcessing: boolean;
  
  // Actions
  handleGenerate: () => Promise<void>;
  handleSendMessage: (text: string, files: File[]) => Promise<void>;
  handleAddUrl: (url: string) => void;
  removeUrl: (index: number) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeFile: (index: number) => void;
  setGeneratedReport: (report: string | null) => void; 
}

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export const ReportProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State Management
  const [selectedStandards, setSelectedStandards] = useState<StandardType[]>([]);
  const [companyName, setCompanyName] = useState<string>('');
  const [reportingYear, setReportingYear] = useState<string>('2024');
  const [rawInput, setRawInput] = useState<string>('');
  const [targetWordCount, setTargetWordCount] = useState<number>(500);
  const [tone, setTone] = useState<string>('professional');
  const [includeTables, setIncludeTables] = useState<boolean>(false);
  const [includeCharts, setIncludeCharts] = useState<boolean>(false);
  const [useGoogleSearch, setUseGoogleSearch] = useState<boolean>(false);
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [retrievedContext, setRetrievedContext] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatProcessing, setIsChatProcessing] = useState(false);
  const assistantRef = useRef<ReportAssistant | null>(null);

  // Actions
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddUrl = (url: string) => {
    if (url.trim()) {
      setUrls(prev => [...prev, url.trim()]);
    }
  };

  const removeUrl = (index: number) => {
    setUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!rawInput.trim() && files.length === 0 && urls.length === 0 && !useGoogleSearch) {
      alert("請至少提供一項資料來源：輸入文字、上傳檔案、提供連結或啟用 Google 搜尋。");
      return;
    }

    if (selectedStandards.length === 0) {
      alert("請至少選擇一個揭露項目 (Please select at least one disclosure item)");
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedReport(""); // Clear previous report, prepare for stream
    setRetrievedContext(null);
    
    // Reset Chat
    setChatMessages([]);
    setIsChatOpen(false);
    assistantRef.current = null;

    try {
      const context = await retrieveContext(selectedStandards);
      setRetrievedContext(context);

      const report = await generateReport(
        companyName,
        reportingYear,
        selectedStandards, 
        rawInput, 
        context, 
        files, 
        urls,
        targetWordCount,
        tone,
        includeTables,
        includeCharts,
        useGoogleSearch,
        (streamedText) => {
            setGeneratedReport(streamedText);
        }
      );
      // Final set to ensure everything is consistent
      setGeneratedReport(report);
      
      assistantRef.current = new ReportAssistant(report, context, companyName);
      
      setIsChatProcessing(true);
      setTimeout(async () => {
          if (assistantRef.current) {
              try {
                // For the auto-greeting, we can also use streaming if we want, 
                // but for simplicity/speed of this small message, we might just await it or stream it.
                // Let's stream it for consistency.
                const greetingResult = await assistantRef.current.sendMessage(
                    "請向使用者簡短打招呼(我是您的AI編輯助理)，然後根據目前報告文末的「待補充資訊清單」，主動且明確地詢問使用者是否能提供第一項缺漏的資訊 (請列出具體項目)。請保持語氣專業且友善。",
                    [],
                    (text) => {
                        setChatMessages(prev => {
                            const newHistory = [...prev];
                            // If last message is model, update it, else add new
                            if (newHistory.length > 0 && newHistory[newHistory.length - 1].role === 'model') {
                                newHistory[newHistory.length - 1].text = text;
                                return newHistory;
                            } else {
                                return [...newHistory, { role: 'model', text }];
                            }
                        });
                    }
                );
                
                // Final update ensures completion
                setChatMessages(prev => {
                     const newHistory = [...prev];
                     // Ensure the message exists if streaming didn't trigger (rare) or just finalize it
                     if (newHistory.length > 0 && newHistory[newHistory.length - 1].role === 'model') {
                        newHistory[newHistory.length - 1].text = greetingResult.responseText;
                        return newHistory;
                     } 
                     return [{ role: 'model', text: greetingResult.responseText }];
                });

                setIsChatOpen(true);
              } catch (e) {
                  console.error("Auto-greeting failed", e);
              } finally {
                  setIsChatProcessing(false);
              }
          }
      }, 500);

    } catch (err: any) {
      setError(err.message || "An error occurred during generation.");
    } finally {
        // Only stop loading state for the main report generation
        if (!assistantRef.current) setIsLoading(false); 
        setIsLoading(false);
    }
  };

  const handleSendMessage = async (text: string, newFiles: File[] = []) => {
    if (!assistantRef.current) return;

    setIsChatProcessing(true);
    
    let userMsgText = text;
    if (newFiles.length > 0) {
        userMsgText += `\n(已上傳 ${newFiles.length} 個檔案)`;
    }
    setChatMessages(prev => [...prev, { role: 'user', text: userMsgText }]);

    // Placeholder for AI response to stream into
    setChatMessages(prev => [...prev, { role: 'model', text: "" }]);

    try {
      const result = await assistantRef.current.sendMessage(
          text, 
          newFiles,
          (streamedText) => {
            setChatMessages(prev => {
                const newHistory = [...prev];
                const lastIdx = newHistory.length - 1;
                if (newHistory[lastIdx].role === 'model') {
                    newHistory[lastIdx].text = streamedText;
                }
                return newHistory;
            });
          }
      );
      
      if (result.updatedReport) {
        setGeneratedReport(result.updatedReport);
      }
      
      // Final update to ensure state consistency
      setChatMessages(prev => {
        const newHistory = [...prev];
        const lastIdx = newHistory.length - 1;
        if (newHistory[lastIdx].role === 'model') {
            newHistory[lastIdx].text = result.responseText;
        }
        return newHistory;
      });

    } catch (e) {
      console.error(e);
      setChatMessages(prev => {
         const newHistory = [...prev];
         newHistory[newHistory.length - 1].text = "Error communicating with assistant.";
         return newHistory;
      });
    } finally {
      setIsChatProcessing(false);
    }
  };

  return (
    <ReportContext.Provider value={{
      selectedStandards, setSelectedStandards,
      companyName, setCompanyName,
      reportingYear, setReportingYear,
      rawInput, setRawInput,
      targetWordCount, setTargetWordCount,
      tone, setTone,
      includeTables, setIncludeTables,
      includeCharts, setIncludeCharts,
      useGoogleSearch, setUseGoogleSearch,
      files, setFiles,
      urls, setUrls,
      generatedReport, setGeneratedReport,
      retrievedContext,
      isLoading,
      error,
      isChatOpen, setIsChatOpen,
      chatMessages,
      isChatProcessing,
      handleGenerate,
      handleSendMessage,
      handleAddUrl,
      removeUrl,
      handleFileChange,
      removeFile
    }}>
      {children}
    </ReportContext.Provider>
  );
};

export const useReport = () => {
  const context = useContext(ReportContext);
  if (context === undefined) {
    throw new Error('useReport must be used within a ReportProvider');
  }
  return context;
};
