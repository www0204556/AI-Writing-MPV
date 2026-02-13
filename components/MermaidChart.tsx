import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidChartProps {
  chart: string;
}

const MermaidChart: React.FC<MermaidChartProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    mermaid.initialize({ 
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'loose'
    });

    const renderChart = async () => {
      try {
        if (containerRef.current) {
          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
          const { svg } = await mermaid.render(id, chart);
          setSvg(svg);
          setError(false);
        }
      } catch (err) {
        console.error('Mermaid rendering failed:', err);
        setError(true);
      }
    };

    if (chart) {
      renderChart();
    }
  }, [chart]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 my-4">
        <p className="text-red-700 text-sm font-bold mb-2">圖表無法預覽 (Syntax Error in Chart Code):</p>
        <pre className="text-xs text-red-600 font-mono whitespace-pre-wrap overflow-x-auto bg-red-100 p-2 rounded">
          {chart}
        </pre>
        <p className="text-xs text-gray-500 mt-2">建議: 您可以複製上方代碼並請 AI 修正語法 (例如：移除未加引號的括號)。</p>
      </div>
    );
  }

  return (
    <div className="my-6 flex justify-center">
      <div 
        ref={containerRef}
        className="mermaid-container overflow-x-auto bg-white p-4 rounded-lg border border-gray-100 shadow-sm"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
};

export default MermaidChart;