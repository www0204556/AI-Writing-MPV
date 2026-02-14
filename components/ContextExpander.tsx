import React, { useState } from 'react';

interface ContextExpanderProps {
  title: string;
  content: string;
}

const ContextExpander: React.FC<ContextExpanderProps> = ({ title, content }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-2xl mb-6 bg-white shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3.5 bg-white flex justify-between items-center hover:bg-gray-50 transition-colors duration-200"
      >
        <span className="text-sm font-bold text-gray-600 flex items-center gap-2.5">
          <div className="p-1.5 bg-leaf-50 rounded-lg text-leaf-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          {title}
        </span>
        <div className={`p-1 rounded-full transition-all duration-200 ${isOpen ? 'bg-gray-100 rotate-180' : 'bg-transparent'}`}>
             <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
      </button>
      
      {isOpen && (
        <div className="p-5 bg-gray-50/80 border-t border-gray-100">
          <pre className="whitespace-pre-wrap text-xs text-gray-600 font-mono leading-relaxed max-h-60 overflow-y-auto scrollbar-thin p-2 rounded-lg">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ContextExpander;