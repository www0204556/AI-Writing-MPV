import React, { useState, useRef, useEffect } from 'react';
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
  const [targetWordCount, setTargetWordCount] = useState<number>(800);
  
  // Content Settings
  const [includeTables, setIncludeTables] = useState<boolean>(true);
  const [includeCharts, setIncludeCharts] = useState<boolean>(true);

  const [files, setFiles] = useState<File[]>([]);
  // URL State
  const [urls, setUrls] = useState<string[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>('');

  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [retrievedContext, setRetrievedContext] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatProcessing, setIsChatProcessing] = useState(false);
  const assistantRef = useRef<ReportAssistant | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Assistant when report is generated
  useEffect(() => {
    if (generatedReport && retrievedContext && !assistantRef.current) {
        // Only initialize if not already exists
    }
  }, [generatedReport, retrievedContext]);

  // Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
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
    }
  };

  const removeUrl = (index: number) => {
    setUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleStandardToggle = (standard: StandardType) => {
    setSelectedStandards(prev => {
      if (prev.includes(standard)) {
        return prev.filter(s => s !== standard);
      } else {
        return [...prev, standard];
      }
    });
  };

  const handleGenerate = async () => {
    if (!rawInput.trim() && files.length === 0 && urls.length === 0) {
      alert("請輸入揭露資訊、上傳參考資料或提供網頁連結 (Please enter valid information, upload documents, or provide links)");
      return;
    }

    if (selectedStandards.length === 0) {
      alert("請至少選擇一個揭露項目 (Please select at least one disclosure item)");
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedReport(null);
    setRetrievedContext(null);
    
    // Reset Chat on new generation
    setChatMessages([]);
    setIsChatOpen(false);
    assistantRef.current = null;

    try {
      // Step 1: "Retrieve" (Simulated RAG) - Now handles array
      const context = retrieveContext(selectedStandards);
      setRetrievedContext(context);

      // Step 2: "Generate" (Gemini API with Multimodal Support)
      // Pass URLs, WordCount, and Table settings to the service
      const report = await generateReport(
        companyName,
        reportingYear, // Pass the year
        selectedStandards, 
        rawInput, 
        context, 
        files, 
        urls,
        targetWordCount,
        includeTables,
        includeCharts
      );
      setGeneratedReport(report);
      
      // Initialize Assistant immediately with the fresh report
      assistantRef.current = new ReportAssistant(report, context, companyName);
      
      // Step 3: Trigger active "Proactive Greeting" from AI
      // We send a hidden message to the AI asking it to analyze the report and greet the user proactively.
      setIsChatProcessing(true); // Show little loading indicator in chat if visible
      
      const greetingResult = await assistantRef.current.sendMessage(
        "請向使用者簡短打招呼(我是您的AI編輯助理)，然後根據目前報告文末的「待補充資訊清單」，主動且明確地詢問使用者是否能提供第一項缺漏的資訊 (請列出具體項目)。請保持語氣專業且友善。"
      );
      
      setChatMessages([{ role: 'model', text: greetingResult.responseText }]);
      setIsChatOpen(true);
      setIsChatProcessing(false);

    } catch (err: any) {
      setError(err.message || "An error occurred during generation.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedReport) {
      navigator.clipboard.writeText(generatedReport);
      alert("Report copied to clipboard!");
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!assistantRef.current) return;

    setIsChatProcessing(true);
    
    // Optimistic UI update
    setChatMessages(prev => [...prev, { role: 'user', text }]);

    try {
      const result = await assistantRef.current.sendMessage(text);
      
      // Update Report if tool was called
      if (result.updatedReport) {
        setGeneratedReport(result.updatedReport);
        setChatMessages(prev => [
            ...prev, 
            { role: 'model', text: result.responseText },
            // { role: 'model', text: "Report updated.", isSystem: true } // Optional system msg
        ]);
      } else {
        setChatMessages(prev => [...prev, { role: 'model', text: result.responseText }]);
      }

    } catch (e) {
      console.error(e);
      setChatMessages(prev => [...prev, { role: 'model', text: "Error communicating with assistant." }]);
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
  const gri200Options = getStandards("GRI 2", "GRI 2-"); // Starts with GRI 2 but NOT GRI 2-
  const gri300Options = getStandards("GRI 3", "GRI 3-"); // Starts with GRI 3 but NOT GRI 3-
  const gri400Options = getStandards("GRI 4");

  const renderCheckboxGroup = (title: string, options: string[]) => {
    const filtered = filterOptions(options);
    if (filtered.length === 0) return null; // Don't render empty groups

    return (
      <div className="mb-4">
        <p className="text-xs font-bold text-gray-500 px-2 py-1 bg-gray-100 uppercase sticky top-0 z-10">{title}</p>
        {filtered.map(opt => (
          <label key={opt} className="flex items-start p-2 hover:bg-leaf-50 rounded cursor-pointer transition-colors">
            <input 
              type="checkbox" 
              className="mt-1 h-4 w-4 text-leaf-600 focus:ring-leaf-500 border-gray-300 rounded flex-shrink-0"
              checked={selectedStandards.includes(opt as StandardType)}
              onChange={() => handleStandardToggle(opt as StandardType)}
            />
            {/* Highlight match if searching */}
            <span className={`ml-2 text-sm ${standardSearchTerm ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
              {opt}
            </span>
          </label>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-col md:flex-row bg-gray-100 overflow-hidden font-sans relative">
      
      {/* LEFT COLUMN: Sidebar / Settings */}
      <aside className="w-full md:w-1/3 lg:w-96 bg-white border-r border-gray-200 flex flex-col h-full shadow-lg z-10 flex-shrink-0">
        <div className="p-6 bg-leaf-600 text-white">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            永續報告書 by AI
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Company Name & Year - Row Layout */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                公司名稱
              </label>
              <input
                type="text"
                className="block w-full rounded-lg border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-leaf-500 focus:ring-leaf-500 border outline-none"
                placeholder="範例科技"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="w-1/3">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                報告年度
              </label>
              <select
                value={reportingYear}
                onChange={(e) => setReportingYear(e.target.value)}
                className="block w-full rounded-lg border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-leaf-500 focus:ring-leaf-500 border outline-none"
              >
                <option value="2023">2023</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
              </select>
            </div>
          </div>

          {/* Standard Selector (Search + List) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              揭露項目 (可複選)
            </label>
            
            {/* Search Box */}
            <div className="relative mb-2">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                </svg>
              </div>
              <input 
                type="text" 
                className="block w-full p-2 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-leaf-500 focus:border-leaf-500 outline-none" 
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

            <div className="border border-gray-300 rounded-lg bg-gray-50 max-h-60 overflow-y-auto p-2">
              {renderCheckboxGroup("GRI 2: 一般揭露 (General Disclosures)", gri2Options)}
              {renderCheckboxGroup("GRI 3: 重大主題 (Material Topics)", gri3Options)}
              {renderCheckboxGroup("GRI 200: 經濟 (Economic)", gri200Options)}
              {renderCheckboxGroup("GRI 300: 環境 (Environmental)", gri300Options)}
              {renderCheckboxGroup("GRI 400: 社會 (Social)", gri400Options)}
              
              {/* Fallback if no results */}
              {standardSearchTerm && 
               filterOptions([...gri2Options, ...gri3Options, ...gri200Options, ...gri300Options, ...gri400Options]).length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  找不到符合 "{standardSearchTerm}" 的項目
                </div>
               )}
            </div>
            <p className="text-xs text-gray-500 mt-1">已選擇 {selectedStandards.length} 個項目</p>
          </div>

          {/* Configuration: Word Count & Charts */}
          <div className="space-y-4">
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                    預計中文字數
                </label>
                <input
                    type="number"
                    min={100}
                    step={100}
                    value={targetWordCount}
                    onChange={(e) => setTargetWordCount(Number(e.target.value))}
                    className="block w-full rounded-lg border-gray-300 bg-gray-50 p-2.5 text-sm focus:border-leaf-500 focus:ring-leaf-500 border outline-none"
                />
            </div>
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                    產出內容設定
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer bg-white px-3 py-2 border border-gray-200 rounded-lg flex-1 hover:border-leaf-400 transition-colors">
                      <input 
                          type="checkbox" 
                          checked={includeTables}
                          onChange={(e) => setIncludeTables(e.target.checked)}
                          className="h-4 w-4 text-leaf-600 focus:ring-leaf-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">包含數據表格</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer bg-white px-3 py-2 border border-gray-200 rounded-lg flex-1 hover:border-leaf-400 transition-colors">
                      <input 
                          type="checkbox" 
                          checked={includeCharts}
                          onChange={(e) => setIncludeCharts(e.target.checked)}
                          className="h-4 w-4 text-leaf-600 focus:ring-leaf-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">包含統計圖表</span>
                  </label>
                </div>
            </div>
          </div>

          {/* Input Area */}
          <div className="flex-1 flex flex-col min-h-[150px]">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              輸入文字資料 (Input Data)
            </label>
            <textarea
              className="w-full flex-1 rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 focus:border-leaf-500 focus:ring-leaf-500 resize-none shadow-inner outline-none"
              placeholder={`請輸入欲請AI整合的文字資料`}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
            />
          </div>

          {/* URL Input Area */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              網頁連結 (Web Links)
            </label>
            <div className="flex gap-2">
              <input 
                type="text"
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-leaf-500 focus:ring-leaf-500 outline-none"
                placeholder="https://example.com/esg-report"
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
                onKeyDown={(e) => { if(e.key === 'Enter') handleAddUrl(e); }}
              />
              <button 
                onClick={handleAddUrl}
                className="bg-leaf-100 text-leaf-700 hover:bg-leaf-200 px-3 py-2 rounded-lg font-bold border border-leaf-300 transition-colors"
              >
                +
              </button>
            </div>
            
            {/* URL List */}
            {urls.length > 0 && (
              <ul className="mt-3 space-y-2">
                {urls.map((url, index) => (
                  <li key={index} className="flex justify-between items-center bg-blue-50 px-3 py-2 rounded text-xs border border-blue-100">
                    <div className="flex items-center truncate mr-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-blue-700 hover:underline">{url}</a>
                    </div>
                    <button 
                      onClick={() => removeUrl(index)}
                      className="text-red-400 hover:text-red-600 focus:outline-none"
                      title="Remove"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* File Upload Area */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              上傳參考資料 (Upload Reference Materials)
            </label>
            
            {/* Drop Zone / Button */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-leaf-400 transition-colors group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                multiple 
                accept="image/*,application/pdf,.docx,.xlsx,.xls"
              />
              <svg className="h-8 w-8 text-gray-400 group-hover:text-leaf-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-xs text-gray-500 text-center">
                <span className="font-semibold text-leaf-600">點擊上傳</span> PDF, Word, Excel, Images
              </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <li key={index} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded text-xs border border-gray-200">
                    <div className="flex items-center truncate mr-2">
                      <svg className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="truncate text-gray-700">{file.name}</span>
                    </div>
                    <button 
                      onClick={() => removeFile(index)}
                      className="text-red-400 hover:text-red-600 focus:outline-none"
                      title="Remove"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-lg font-bold text-white shadow-md transition-all duration-200 transform active:scale-95 ${
              isLoading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-leaf-600 hover:bg-leaf-700 hover:shadow-lg'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              "產出初稿內容"
            )}
          </button>
        </div>
      </aside>

      {/* CENTER: Main Area / Result */}
      <main className="flex-1 flex flex-col h-full bg-gray-100 overflow-hidden relative">
        <header className="bg-white border-b border-gray-200 px-8 py-3 shadow-sm flex justify-center items-center z-10 flex-shrink-0 relative">
          <div className="flex flex-col items-center">
            <h2 className="text-lg font-bold text-gray-800">初稿預覽</h2>
            <p className="text-xs text-gray-400 mt-0.5">初稿版本是 AI產製，有時可能會出錯，敬請自行查證。</p>
          </div>
          <div className="flex gap-2 absolute right-8">
            {generatedReport && (
                <>
                <button
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded border transition-colors ${
                        isChatOpen 
                        ? 'bg-leaf-100 text-leaf-800 border-leaf-300' 
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    AI 編輯助理 {isChatOpen ? '(開啟中)' : ''}
                </button>
                <button
                onClick={handleCopy}
                className="text-sm px-3 py-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 border border-gray-300 transition-colors"
                >
                複製到剪貼簿 (Copy)
                </button>
                </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Context Section (RAG Debug/Reference) */}
            {retrievedContext && (
              <ContextExpander 
                title="參考標準原文 (Retrieved Standard Context)" 
                content={retrievedContext} 
              />
            )}

            {/* Main Result Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[500px] flex flex-col">
              {generatedReport ? (
                <div className="p-8">
                  <MarkdownViewer content={generatedReport} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm">尚未生成報告 (Report not generated yet)</p>
                  <p className="text-xs mt-1 text-gray-300">
                    請在左側輸入數據或上傳文件，並點擊生成按鈕。
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