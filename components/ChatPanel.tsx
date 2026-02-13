import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isProcessing: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, isProcessing, isOpen, onClose }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    
    const text = input;
    setInput('');
    await onSendMessage(text);
  };

  if (!isOpen) return null;

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-xl absolute md:relative right-0 z-20">
      {/* Header */}
      <div className="p-4 bg-leaf-600 text-white flex justify-between items-center shadow-sm">
        <h3 className="font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          AI 編輯助理
        </h3>
        <button onClick={onClose} className="hover:bg-leaf-700 p-1 rounded transition">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-10">
            <p>我可以協助您修改報告。</p>
            <p className="mt-2 text-xs">試試看: "請把語氣變得更正式" 或 "增加一個欄位顯示 GWP 值"</p>
          </div>
        )}
        
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.isSystem;

          return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[90%] rounded-lg px-4 py-3 text-sm shadow-sm break-words ${
                  isSystem 
                    ? 'bg-yellow-50 text-yellow-800 border border-yellow-100 text-xs italic text-center w-full' 
                    : isUser 
                      ? 'bg-leaf-600 text-white rounded-br-none' 
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                }`}
              >
                {/* Use ReactMarkdown to render the message content */}
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // P: Add consistent spacing for Chinese readability
                    p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                    // Strong: Ensure it stands out
                    strong: ({node, ...props}) => <strong className="font-bold opacity-90" {...props} />,
                    // Lists: Fix padding inside chat bubbles
                    ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                    li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                    // Links: Adjust color based on background
                    a: ({node, href, ...props}) => (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`underline decoration-1 underline-offset-2 ${isUser ? 'text-white hover:text-gray-100' : 'text-blue-600 hover:text-blue-800'}`}
                        {...props} 
                      />
                    ),
                    // Code: Inline code styling
                    code: ({node, className, children, ...props}: any) => {
                      return (
                        <code className={`px-1 py-0.5 rounded text-xs font-mono ${isUser ? 'bg-leaf-700 text-white' : 'bg-gray-100 text-gray-800 border border-gray-200'}`} {...props}>
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
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg rounded-bl-none px-4 py-3 shadow-sm">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            className="w-full border border-gray-300 rounded-full pl-4 pr-12 py-3 text-sm focus:border-leaf-500 focus:ring-1 focus:ring-leaf-500 outline-none shadow-sm"
            placeholder="輸入指令調整報告..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 bg-leaf-600 text-white rounded-full hover:bg-leaf-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;