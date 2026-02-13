import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownViewerProps {
  content: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  return (
    <div className="prose prose-sm md:prose-base prose-leaf max-w-none text-gray-800">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          // Customize links to look like blue text for GRI standards (which we set as empty links [GRI x]())
          a: ({node, href, children, ...props}) => {
             // If it's an empty link (generated for styling), or just general links, make them blue.
             // We disable pointer events if it's purely for styling (empty href or #), 
             // but keeping it simple: just blue text.
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
          // Highlight warnings "敬請增補" in red/orange
          strong: ({node, children, ...props}) => {
             // Check if children text contains the warning keyword
             // This is a bit rough in React children inspection but visually 'strong' style is enough.
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