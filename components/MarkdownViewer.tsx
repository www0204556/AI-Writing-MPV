import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MermaidChart from './MermaidChart';

interface MarkdownViewerProps {
  content: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  return (
    <div className="prose prose-sm md:prose-base prose-leaf max-w-none text-gray-800">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          // Customize links to look like blue text for GRI standards
          a: ({node, href, children, ...props}) => {
             const isAnchor = !href || href === '' || href === '#';
             return (
                 <a 
                   href={href}
                   className={`text-blue-600 font-bold no-underline ${isAnchor ? 'cursor-default pointer-events-none' : 'hover:underline'}`}
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
                <div className="relative group">
                    <pre className="bg-gray-800 text-gray-100 rounded-lg p-4 overflow-x-auto text-xs my-4">
                        <code className={className} {...props}>
                            {children}
                        </code>
                    </pre>
                </div>
            ) : (
              <code className="bg-gray-100 text-red-500 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            );
          },
          table: ({node, ...props}) => (
            <div className="overflow-x-auto my-4 border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200" {...props} />
            </div>
          ),
          th: ({node, ...props}) => (
            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-bold" {...props} />
          ),
          td: ({node, ...props}) => (
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 border-t border-gray-100" {...props} />
          ),
          h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-leaf-800 mt-6 mb-4 pb-2 border-b border-leaf-200" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-leaf-700 mt-5 mb-3" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-lg font-medium text-leaf-600 mt-4 mb-2" {...props} />,
          strong: ({node, children, ...props}) => {
             return <strong className="font-bold text-orange-600" {...props}>{children}</strong>
          }, 
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;