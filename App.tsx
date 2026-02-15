import React, { useState, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { StandardType, ChatMessage } from './types';
import { generateReport, retrieveContext, ReportAssistant } from './services/geminiService';
import MarkdownViewer from './components/MarkdownViewer';
import ContextExpander from './components/ContextExpander';
import ChatPanel from './components/ChatPanel';

const App: React.FC = () => {
  // State Management
  const [selectedStandards, setSelectedStandards] = useState<StandardType[]>([]);
  const [companyName, setCompanyName] = useState<string>('');
  const [reportingYear, setReportingYear] = useState<string>('2024'); // Default to 2024
  const [standardSearchTerm, setStandardSearchTerm] = useState<string>(''); // For searching standards

  const [rawInput, setRawInput] = useState<string>('');
  const [targetWordCount, setTargetWordCount] = useState<number>(500); // Default adjusted to 500
  
  // Tone Settings
  const [tone, setTone] = useState<string>('professional');

  // Format Settings - Defaults set to false as requested
  const [includeTables, setIncludeTables] = useState<boolean>(false);
  const [includeCharts, setIncludeCharts] = useState<boolean>(false);

  // Data Source Settings
  const [useGoogleSearch, setUseGoogleSearch] = useState<boolean>(false);

  const [files, setFiles] = useState<File[]>([]);
  // URL State
  const [urls, setUrls] = useState<string[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>('');

  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [retrievedContext, setRetrievedContext] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatProcessing, setIsChatProcessing] = useState(false);
  const assistantRef = useRef<ReportAssistant | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation Logic
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!companyName.trim()) {
      newErrors.companyName = "請輸入公司名稱";
      isValid = false;
    }

    if (selectedStandards.length === 0) {
      newErrors.standards = "請至少選擇一個揭露項目";
      isValid = false;
    }

    const hasSource = rawInput.trim() || files.length > 0 || urls.length > 0 || useGoogleSearch;
    if (!hasSource) {
      newErrors.source = "請至少提供一種資料來源 (文字、檔案、連結或搜尋)";
      isValid = false;
    }

    setErrors(newErrors);
    
    // Trigger toasts for non-field specific errors or general guidance
    if (!isValid) {
        if (newErrors.standards) toast.error(newErrors.standards, { id: 'err-std' });
        else if (newErrors.source) toast.error(newErrors.source, { id: 'err-src' });
        else if (newErrors.companyName) toast.error("請檢查表單欄位", { id: 'err-form' });
    }

    return isValid;
  };

  // Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
      // Clear source error if it exists
      if (errors.source) setErrors(prev => ({ ...prev, source: '' }));
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddUrl = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    if (currentUrl.trim()) {
      setUrls(prev => [...prev, currentUrl.trim()]);
      setCurrentUrl('');
      // Clear source error if it exists
      if (errors.source) setErrors(prev => ({ ...prev, source: '' }));
    }
  };

  const removeUrl = (index: number) => {
    setUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleStandardToggle = (standard: StandardType) => {
    setSelectedStandards(prev => {
      let newState;
      if (prev.includes(standard)) {
        newState = prev.filter(s => s !== standard);
      } else {
        newState = [...prev, standard];
      }
      // Clear standards error if selection is not empty
      if (newState.length > 0 && errors.standards) {
          setErrors(e => ({ ...e, standards: '' }));
      }
      return newState;
    });
  };

  const handleGenerate = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);
    setGeneratedReport(null);
    setRetrievedContext(null);
    
    // Reset Chat on new generation
    setChatMessages([]);
    setIsChatOpen(false);
    assistantRef.current = null;

    try {
      // Step 1: "Retrieve" (Simulated RAG)
      const context = await retrieveContext(selectedStandards);
      setRetrievedContext(context);

      // Step 2: "Generate" (Gemini 3 Pro)
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
        useGoogleSearch, // Pass the search preference
        (streamedText) => {
             setGeneratedReport(streamedText);
        }
      );
      setGeneratedReport(report);
      
      // Step 3: Initialize Assistant
      // Done here explicitly to avoid race conditions with useEffect
      assistantRef.current = new ReportAssistant(report, context, companyName);
      
      // Step 4: Proactive Greeting (Active Mode)
      setIsChatProcessing(true);
      
      // Slight delay to ensure UI renders first
      setTimeout(async () => {
          if (assistantRef.current) {
              try {
                const greetingResult = await assistantRef.current.sendMessage(
                    "請向使用者簡短打招呼(我是您的AI編輯助理)，然後根據目前報告文末的「待補充資訊清單」，主動且明確地詢問使用者是否能提供第一項缺漏的資訊 (請列出具體項目)。請保持語氣專業且友善。",
                    [],
                    (text) => {
                        setChatMessages(prev => {
                            const newHistory = [...prev];
                            if (newHistory.length > 0 && newHistory[newHistory.length - 1].role === 'model') {
                                newHistory[newHistory.length - 1].text = text;
                                return newHistory;
                            } else {
                                return [...newHistory, { role: 'model', text }];
                            }
                        });
                    }
                );
                
                // Ensure final state
                setChatMessages(prev => {
                     const newHistory = [...prev];
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
      toast.error(err.message || "生成報告時發生錯誤");
      setIsLoading(false); 
    } finally {
        if (!assistantRef.current) setIsLoading(false); 
        setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedReport) {
      navigator.clipboard.writeText(generatedReport);
      toast.success("報告已複製到剪貼簿！", {
          icon: '📋',
          style: {
              borderRadius: '10px',
              background: '#333',
              color: '#fff',
          },
      });
    }
  };

  const handleSendMessage = async (text: string, files: File[] = []) => {
    if (!assistantRef.current) return;

    setIsChatProcessing(true);
    
    // Optimistic UI update
    let userMsgText = text;
    if (files.length > 0) {
        userMsgText += `\n(已上傳 ${files.length} 個檔案)`;
    }
    setChatMessages(prev => [...prev, { role: 'user', text: userMsgText }]);

    // Placeholder for stream
    setChatMessages(prev => [...prev, { role: 'model', text: "" }]);

    try {
      // Pass files to the assistant service
      const result = await assistantRef.current.sendMessage(
          text, 
          files,
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
      
      // Update Report if tool was called
      if (result.updatedReport) {
        setGeneratedReport(result.updatedReport);
        toast.success("報告內容已更新", { id: 'report-updated' });
      }
      
      // Final sync
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
      toast.error("助理回應發生錯誤");
    } finally {
      setIsChatProcessing(false);
    }
  };

  // Helper to filter standards
  const getStandards = (prefix: string, excludePrefix?: string) => 
    Object.values(StandardType).filter(v => 
      v.startsWith(prefix) && (!excludePrefix || !v.startsWith(excludePrefix))
    );

  // Helper to filter options based on search term
  const filterOptions = (options: string[]) => {
    if (!standardSearchTerm) return options;
    return options.filter(opt => 
      opt.toLowerCase().includes(standardSearchTerm.toLowerCase())
    );
  };

  const gri2Options = getStandards("GRI 2-");
  const gri3Options = getStandards("GRI 3-");
  const gri200Options = getStandards("GRI 2", "GRI 2-"); 
  const gri300Options = getStandards("GRI 3", "GRI 3-"); 
  const gri400Options = getStandards("GRI 4");

  const renderCheckboxGroup = (title: string, options: string[]) => {
    const filtered = filterOptions(options);
    if (filtered.length === 0) return null; 

    return (
      <div className="mb-6">
        <p className="text-xs font-bold text-gray-500 px-3 py-1.5 bg-gray-100 rounded-lg uppercase sticky top-0 z-10 backdrop-blur-sm bg-opacity-90">{title}</p>
        <div className="mt-2 space-y-1">
          {filtered.map(opt => (
            <label key={opt} className="flex items-start p-2 hover:bg-leaf-50 rounded-xl cursor-pointer transition-colors group">
              <input 
                type="checkbox" 
                className="mt-1 h-4 w-4 text-leaf-600 focus:ring-leaf-500 border-gray-300 rounded transition-colors group-hover:border-leaf-400"
                checked={selectedStandards.includes(opt as StandardType)}
                onChange={() => handleStandardToggle(opt as StandardType)}
              />
              <span className={`ml-2 text-sm leading-relaxed ${standardSearchTerm ? 'text-gray-900 font-medium' : 'text-gray-600 group-hover:text-gray-900'}`}>
                {opt}
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-col md:flex-row bg-[#F8F9FB] overflow-hidden font-sans relative text-gray-800">
      <Toaster position="top-center" />
      
      {/* LEFT COLUMN: Sidebar / Settings */}
      <aside className="w-full md:w-1/3 lg:w-[420px] bg-white border-r border-gray-100 flex flex-col h-full shadow-lg shadow-gray-200/50 z-20 flex-shrink-0">
        <div className="p-6 bg-white border-b border-gray-100">
          <h1 className="text-xl font-bold flex items-center gap-2 text-leaf-800 tracking-tight">
            <div className="p-2 bg-leaf-100 rounded-lg text-leaf-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            AI Writing <span className="text-gray-400 font-normal text-sm ml-1">MVP</span>
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
          
          {/* Company Name & Year */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                公司名稱 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`block w-full rounded-xl border-0 p-3 text-sm text-gray-900 ring-1 ring-inset focus:ring-2 focus:ring-inset transition-all outline-none placeholder:text-gray-400 ${
                  errors.companyName 
                    ? 'bg-red-50 ring-red-300 focus:ring-red-500' 
                    : 'bg-gray-50 ring-gray-200 focus:ring-leaf-500'
                }`}
                placeholder="例如：範例科技股份有限公司"
                value={companyName}
                onChange={(e) => {
                    setCompanyName(e.target.value);
                    if (errors.companyName) setErrors(err => ({...err, companyName: ''}));
                }}
              />
              {errors.companyName && (
                  <p className="mt-1 text-xs text-red-500 font-medium animate-pulse">{errors.companyName}</p>
              )}
            </div>
            <div className="w-1/3">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                年度
              </label>
              <div className="relative">
                <select
                  value={reportingYear}
                  onChange={(e) => setReportingYear(e.target.value)}
                  className="block w-full appearance-none rounded-xl border-0 bg-gray-50 p-3 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-leaf-500 transition-all outline-none cursor-pointer"
                >
                  <option value="2023">2023</option>
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Standard Selector */}
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${errors.standards ? 'text-red-500' : 'text-gray-500'}`}>
              揭露項目 <span className={`font-normal normal-case ml-1 ${errors.standards ? 'text-red-500' : 'text-leaf-600'}`}>(已選 {selectedStandards.length} 項)</span>
            </label>
            
            <div className="relative mb-3 group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none transition-colors group-focus-within:text-leaf-500">
                <svg className="w-4 h-4 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                </svg>
              </div>
              <input 
                type="text" 
                className={`block w-full rounded-xl border-0 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 ring-1 ring-inset focus:ring-2 focus:ring-inset focus:ring-leaf-500 transition-all outline-none ${errors.standards ? 'ring-red-200' : 'ring-gray-200'}`} 
                placeholder="搜尋準則 (如: 305, 溫室氣體...)"
                value={standardSearchTerm}
                onChange={(e) => setStandardSearchTerm(e.target.value)}
              />
              {standardSearchTerm && (
                <button 
                    onClick={() => setStandardSearchTerm('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              )}
            </div>

            <div className={`border rounded-2xl bg-white max-h-64 overflow-y-auto p-3 shadow-sm scrollbar-thin ${errors.standards ? 'border-red-300' : 'border-gray-200'}`}>
              {renderCheckboxGroup("GRI 2: 一般揭露 (General)", gri2Options)}
              {renderCheckboxGroup("GRI 3: 重大主題 (Material)", gri3Options)}
              {renderCheckboxGroup("GRI 200: 經濟 (Economic)", gri200Options)}
              {renderCheckboxGroup("GRI 300: 環境 (Environmental)", gri300Options)}
              {renderCheckboxGroup("GRI 400: 社會 (Social)", gri400Options)}
              
              {standardSearchTerm && 
               filterOptions([...gri2Options, ...gri3Options, ...gri200Options, ...gri300Options, ...gri400Options]).length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">
                  找不到符合 "{standardSearchTerm}" 的項目
                </div>
               )}
            </div>
          </div>

          {/* Configuration: Word Count, Tone, Format */}
          <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                    預計中文字數
                </label>
                <input
                    type="number"
                    min={100}
                    step={100}
                    value={targetWordCount}
                    onChange={(e) => setTargetWordCount(Number(e.target.value))}
                    className="block w-full rounded-xl border-0 bg-gray-50 p-3 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-leaf-500 transition-all outline-none"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                    撰寫語氣 (Tone)
                </label>
                <div className="relative">
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="block w-full appearance-none rounded-xl border-0 bg-gray-50 p-3 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-leaf-500 transition-all outline-none cursor-pointer"
                  >
                    <option value="professional">專業合規型 (Professional)</option>
                    <option value="analytical">管理分析型 (Analytical)</option>
                    <option value="brand">品牌溝通型 (Brand Communication)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                     <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
            </div>

            {/* Data Source & Format Settings */}
            <div className="pt-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                    功能設定 (Settings)
                </label>
                <div className="space-y-1">
                    <label className="flex items-center p-2 hover:bg-leaf-50 rounded-xl cursor-pointer transition-colors">
                        <input
                        type="checkbox"
                        className="h-4 w-4 text-leaf-600 focus:ring-leaf-500 border-gray-300 rounded"
                        checked={useGoogleSearch}
                        onChange={(e) => {
                            setUseGoogleSearch(e.target.checked);
                            if (errors.source) setErrors(e => ({...e, source: ''}));
                        }}
                        />
                        <span className="ml-2 text-sm text-gray-700 font-medium">使用 Google 搜尋補充資料 (Google Search)</span>
                    </label>
                    <label className="flex items-center p-2 hover:bg-leaf-50 rounded-xl cursor-pointer transition-colors">
                        <input
                        type="checkbox"
                        className="h-4 w-4 text-leaf-600 focus:ring-leaf-500 border-gray-300 rounded"
                        checked={includeTables}
                        onChange={(e) => setIncludeTables(e.target.checked)}
                        />
                        <span className="ml-2 text-sm text-gray-700 font-medium">包含數據表格 (Tables)</span>
                    </label>
                    <label className="flex items-center p-2 hover:bg-leaf-50 rounded-xl cursor-pointer transition-colors">
                        <input
                        type="checkbox"
                        className="h-4 w-4 text-leaf-600 focus:ring-leaf-500 border-gray-300 rounded"
                        checked={includeCharts}
                        onChange={(e) => setIncludeCharts(e.target.checked)}
                        />
                        <span className="ml-2 text-sm text-gray-700 font-medium">包含分析圖表 (Charts)</span>
                    </label>
                </div>
            </div>
          </div>

          <div className="h-px bg-gray-100 my-4"></div>

          {/* Input Area */}
          <div className="flex-1 flex flex-col min-h-[150px]">
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${errors.source ? 'text-red-500' : 'text-gray-500'}`}>
              文字資料輸入 (Data Input)
            </label>
            <textarea
              className={`w-full flex-1 rounded-2xl border-0 p-4 text-sm text-gray-900 ring-1 ring-inset focus:ring-2 focus:ring-inset resize-none shadow-sm transition-all outline-none ${
                  errors.source 
                    ? 'bg-red-50 ring-red-200 focus:ring-red-500' 
                    : 'bg-gray-50 ring-gray-200 focus:ring-leaf-500'
              }`}
              placeholder={`請在此貼上欲整合的原始文字資料...`}
              value={rawInput}
              onChange={(e) => {
                  setRawInput(e.target.value);
                  if (errors.source) setErrors(e => ({...e, source: ''}));
              }}
            />
          </div>

          {/* URL Input */}
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${errors.source ? 'text-red-500' : 'text-gray-500'}`}>
              網頁連結 (Reference URLs)
            </label>
            <div className="flex gap-2">
              <input 
                type="text"
                className={`flex-1 rounded-xl border-0 px-4 py-2.5 text-sm ring-1 ring-inset outline-none transition-all ${
                    errors.source 
                        ? 'bg-red-50 ring-red-200 focus:ring-red-500' 
                        : 'bg-gray-50 ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-leaf-500'
                }`}
                placeholder="https://..."
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
                onKeyDown={(e) => { if(e.key === 'Enter') handleAddUrl(e); }}
              />
              <button 
                onClick={handleAddUrl}
                className="bg-gray-100 text-gray-600 hover:bg-leaf-100 hover:text-leaf-700 px-4 py-2 rounded-xl font-bold transition-all border border-gray-200 hover:border-leaf-200 active:scale-95"
              >
                +
              </button>
            </div>
            
            {urls.length > 0 && (
              <ul className="mt-3 space-y-2">
                {urls.map((url, index) => (
                  <li key={index} className="flex justify-between items-center bg-blue-50/50 px-3 py-2 rounded-lg text-xs border border-blue-100/50">
                    <div className="flex items-center truncate mr-2 text-blue-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-2 flex-shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">{url}</a>
                    </div>
                    <button onClick={() => removeUrl(index)} className="text-blue-300 hover:text-red-500 transition-colors">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* File Upload */}
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${errors.source ? 'text-red-500' : 'text-gray-500'}`}>
              參考資料上傳 (Files)
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-all duration-300 group bg-white ${
                  errors.source 
                  ? 'border-red-300 hover:border-red-400' 
                  : 'border-gray-200 hover:border-leaf-400'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                multiple 
                accept="image/*,application/pdf,.docx,.xlsx,.xls"
              />
              <div className={`p-3 rounded-full mb-3 group-hover:scale-110 transition-transform duration-300 ${errors.source ? 'bg-red-50' : 'bg-gray-50'}`}>
                <svg className={`h-6 w-6 transition-colors ${errors.source ? 'text-red-400' : 'text-gray-400 group-hover:text-leaf-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className={`text-xs text-center font-medium ${errors.source ? 'text-red-400' : 'text-gray-500'}`}>
                點擊上傳 PDF, Word, Excel, Images
              </p>
            </div>

            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <li key={index} className="flex justify-between items-center bg-gray-50 px-3 py-2.5 rounded-xl text-xs border border-gray-100 shadow-sm">
                    <div className="flex items-center truncate mr-2">
                      <svg className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="truncate text-gray-700 font-medium">{file.name}</span>
                    </div>
                    <button onClick={() => removeFile(index)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pb-8">
            <button
                onClick={handleGenerate}
                disabled={isLoading}
                className={`w-full py-4 px-6 rounded-2xl font-bold text-white shadow-lg shadow-leaf-500/30 transition-all duration-300 transform active:scale-[0.98] ${
                isLoading 
                    ? 'bg-gray-400 cursor-not-allowed shadow-none' 
                    : 'bg-gradient-to-r from-leaf-600 to-leaf-500 hover:to-leaf-600 hover:shadow-xl hover:shadow-leaf-500/40'
                }`}
            >
                {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    AI 撰寫中...
                </span>
                ) : (
                "開始生成報告"
                )}
            </button>
          </div>
        </div>
      </aside>

      {/* CENTER: Main Area / Result */}
      <main className="flex-1 flex flex-col h-full bg-[#F8F9FB] overflow-hidden relative">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-8 py-4 shadow-sm z-10 flex-shrink-0 relative flex justify-between items-center h-[72px]">
          <div className="flex flex-col items-center mx-auto">
            <h2 className="text-base font-bold text-gray-800 tracking-wide">初稿預覽</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">初稿版本是 AI產製，有時可能會出錯，敬請自行查證。</p>
          </div>
          
          <div className="flex gap-3 absolute right-8">
            {generatedReport && (
                <>
                <button
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl border transition-all duration-200 font-medium ${
                        isChatOpen 
                        ? 'bg-leaf-50 text-leaf-700 border-leaf-200 shadow-inner' 
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                    }`}
                >
                    <div className={`w-2 h-2 rounded-full ${isChatOpen ? 'bg-leaf-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    AI 助理
                </button>
                <button
                onClick={handleCopy}
                className="text-sm px-4 py-2 rounded-xl bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 shadow-sm transition-all duration-200 font-medium active:scale-95"
                >
                複製
                </button>
                </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative scrollbar-thin">
          <div className="max-w-4xl mx-auto space-y-6 pb-20">
            
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-2xl shadow-sm flex items-start gap-3">
                 <svg className="h-5 w-5 text-red-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700 leading-relaxed font-medium">{error}</p>
              </div>
            )}

            {/* Context Section (RAG Debug/Reference) */}
            {retrievedContext && (
              <ContextExpander 
                title="參考標準原文 (Standard Context)" 
                content={retrievedContext} 
              />
            )}

            {/* Main Result Section */}
            <div className={`bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-white min-h-[600px] flex flex-col transition-all duration-500 ${generatedReport ? 'opacity-100 translate-y-0' : 'opacity-100'}`}>
              {generatedReport ? (
                <div className="p-8 md:p-12">
                  <MarkdownViewer content={generatedReport} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                  <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <p className="text-base font-medium text-gray-500">尚未生成報告</p>
                  <p className="text-sm mt-2 text-gray-400 text-center max-w-xs leading-relaxed">
                    請在左側輸入數據或上傳文件，<br/>並點擊「開始生成報告」按鈕。
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* RIGHT COLUMN: Chat Panel */}
      <ChatPanel 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        isProcessing={isChatProcessing}
      />

    </div>
  );
};

export default App;