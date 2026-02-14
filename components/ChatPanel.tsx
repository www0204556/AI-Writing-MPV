import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, files: File[]) => Promise<void>;
  isProcessing: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, isProcessing, isOpen, onClose }) => {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && files.length === 0) || isProcessing) return;
    
    const text = input;
    const currentFiles = [...files];
    
    setInput('');
    setFiles([]);
    
    await onSendMessage(text, currentFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("您的瀏覽器不支援語音輸入功能 (Your browser does not support speech recognition).");
      return;
    }

    // Toggle logic: If already listening, stop it.
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'zh-TW';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + transcript);
    };

    recognition.onerror = (event: any) => {
      // 'aborted' occurs when recognition is stopped manually or interrupted. 
      // It is not a critical error to report to the user.
      if (event.error === 'aborted') {
        setIsListening(false);
        return;
      }
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
        recognition.start();
    } catch (e) {
        console.error("Failed to start recognition:", e);
        setIsListening(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full md:w-[380px] bg-white border-l border-gray-100 flex flex-col h-full shadow-2xl shadow-gray-200/50 absolute md:relative right-0 z-30 transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-white flex justify-between items-center h-[72px] flex-shrink-0">
        <h3 className="font-bold flex items-center gap-2 text-gray-800">
          <div className="p-1.5 bg-leaf-100 rounded-lg text-leaf-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          AI 編輯助理
        </h3>
        <button onClick={onClose} className="hover:bg-gray-100 p-2 rounded-full transition-colors text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#F8F9FB]" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm opacity-60">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="font-medium">我可以協助您修改報告</p>
            <p className="mt-2 text-xs bg-gray-100 px-3 py-1 rounded-full">試試: "語氣正式一點" 或上傳新數據</p>
          </div>
        )}
        
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.isSystem;

          return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
               {!isUser && !isSystem && (
                   <div className="w-8 h-8 rounded-full bg-gradient-to-br from-leaf-400 to-leaf-600 flex items-center justify-center text-white text-xs mr-2 flex-shrink-0 shadow-sm mt-auto">
                       AI
                   </div>
               )}
              <div 
                className={`max-w-[85%] px-5 py-3.5 text-sm shadow-sm break-words leading-relaxed ${
                  isSystem 
                    ? 'bg-yellow-50 text-yellow-800 border border-yellow-100 text-xs italic text-center w-full rounded-xl' 
                    : isUser 
                      ? 'bg-gray-800 text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-white text-gray-700 border border-gray-100 rounded-2xl rounded-tl-sm'
                }`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold opacity-90" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                    li: ({node, ...props}) => <li className="" {...props} />,
                    a: ({node, href, ...props}) => (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`underline decoration-1 underline-offset-2 font-medium ${isUser ? 'text-white' : 'text-blue-600'}`}
                        {...props} 
                      />
                    ),
                    code: ({node, className, children, ...props}: any) => {
                      return (
                        <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${isUser ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'}`} {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              </div>
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex justify-start items-end">
             <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-white text-xs mr-2 flex-shrink-0 mb-1">
                 ...
             </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex space-x-1.5">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-100 flex-shrink-0">
        
        {/* Selected Files Preview */}
        {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
                {files.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-leaf-50 text-leaf-700 text-xs px-2 py-1 rounded-md border border-leaf-200">
                        <span className="truncate max-w-[100px]">{file.name}</span>
                        <button onClick={() => removeFile(idx)} className="text-leaf-400 hover:text-red-500">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                ))}
            </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          {/* File Upload Button */}
          <button
             type="button"
             onClick={() => fileInputRef.current?.click()}
             className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors mb-[1px]"
             title="上傳文件 (Upload)"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            multiple 
            accept="image/*,application/pdf,.docx,.xlsx,.xls"
          />

          {/* Voice Input Button */}
          <button
             type="button"
             onClick={handleVoiceInput}
             className={`p-3 rounded-xl transition-all duration-300 mb-[1px] ${
                 isListening 
                 ? 'text-red-500 bg-red-50 animate-pulse' 
                 : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
             }`}
             title="語音輸入 (Voice Input)"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
             </svg>
          </button>

          <div className="flex-1 relative">
            <input
                type="text"
                className="w-full bg-gray-50 border-0 rounded-2xl pl-4 pr-12 py-3.5 text-sm focus:ring-2 focus:ring-leaf-500/50 outline-none shadow-inner transition-all placeholder:text-gray-400"
                placeholder={isListening ? "正在聆聽..." : "輸入指令..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isProcessing}
            />
            <button
                type="submit"
                disabled={(!input.trim() && files.length === 0) || isProcessing}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-leaf-600 text-white rounded-xl hover:bg-leaf-700 disabled:bg-gray-200 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md shadow-leaf-500/20"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;