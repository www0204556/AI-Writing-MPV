import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MermaidChart from './MermaidChart';

interface MarkdownViewerProps {
  content: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = React.memo(({ content }) => {
  return (
    <div className="prose prose-sm md:prose-base prose-leaf max-w-none text-gray-700 leading-relaxed font-normal">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          // Customize links to look like blue text for GRI standards
          a: ({node, href, children, ...props}) => {
             const isAnchor = !href || href === '' || href === '#';
             return (
                 <a 
                   href={href}
                   className={`text-blue-600 font-bold no-underline rounded px-0.5 -mx-0.5 transition-colors ${isAnchor ? 'cursor-default pointer-events-none' : 'hover:bg-blue-50'}`}
                   {...props}
                 >
                    {children}
                 </a>
             );
          },
          // Custom Code Block Renderer for Mermaid
          code: ({node, inline, className, children, ...props}: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const isMermaid = match && match[1] === 'mermaid';

            if (!inline && isMermaid) {
              return <MermaidChart chart={String(children).replace(/\n$/, '')} />;
            }

            return !inline ? (
                <div className="relative group my-6">
                    <pre className="bg-gray-800 text-gray-100 rounded-2xl p-5 overflow-x-auto text-xs shadow-lg shadow-gray-200">
                        <code className={className} {...props}>
                            {children}
                        </code>
                    </pre>
                </div>
            ) : (
              <code className="bg-gray-100 text-red-500 px-1.5 py-0.5 rounded-md text-sm font-mono border border-gray-200" {...props}>
                {children}
              </code>
            );
          },
          table: ({node, ...props}) => (
            <div className="overflow-hidden my-8 border border-gray-200 rounded-2xl shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200" {...props} />
              </div>
            </div>
          ),
          thead: ({node, ...props}) => (
            <thead className="bg-gray-50/50" {...props} />
          ),
          th: ({node, ...props}) => (
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200" {...props} />
          ),
          td: ({node, ...props}) => (
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 border-b border-gray-50 last:border-0" {...props} />
          ),
          h1: ({node, ...props}) => <h1 className="text-3xl font-extrabold text-leaf-900 mt-10 mb-6 tracking-tight" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-xl font-bold text-leaf-800 mt-8 mb-4 flex items-center gap-2 after:content-[''] after:h-px after:flex-1 after:bg-leaf-100 after:ml-4" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-lg font-bold text-leaf-700 mt-6 mb-3" {...props} />,
          p: ({node, ...props}) => <p className="mb-4" {...props} />,
          strong: ({node, children, ...props}) => {
             return <strong className="font-bold text-gray-900 bg-orange-50 px-1 rounded -mx-0.5" {...props}>{children}</strong>
          }, 
          ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4 space-y-2 marker:text-leaf-400" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-4 space-y-2 marker:text-leaf-600 marker:font-bold" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownViewer;