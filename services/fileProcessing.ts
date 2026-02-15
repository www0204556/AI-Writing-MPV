import { WorkerMessage, WorkerResponse } from './fileWorker';

export interface ProcessedPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

/**
 * Converts a File object into a format suitable for the Gemini API using a Web Worker.
 */
export const processFile = (file: File): Promise<ProcessedPart> => {
  return new Promise((resolve, reject) => {
    // Create a new worker for each file processing task (simple approach)
    // In a production app, you might want to reuse a worker instance (Worker Pool)
    const worker = new Worker(new URL('./fileWorker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const response = e.data;
      if (response.error) {
        console.error(`Error processing file ${file.name}:`, response.error);
        // Fallback to error text instead of rejecting, so one bad file doesn't kill the whole request
        resolve({ text: `[Error parsing file: ${file.name}]` });
      } else {
        resolve({
          text: response.text,
          inlineData: response.inlineData
        });
      }
      worker.terminate();
    };

    worker.onerror = (err) => {
      console.error(`Worker error for file ${file.name}:`, err);
      resolve({ text: `[Error processing file: ${file.name}]` });
      worker.terminate();
    };

    // Send data to worker
    file.arrayBuffer().then(buffer => {
      const message: WorkerMessage = {
        fileData: buffer,
        fileName: file.name,
        fileType: file.type
      };
      // Transfer the buffer to the worker for performance
      worker.postMessage(message, [buffer]);
    }).catch(err => {
       console.error("Failed to read file buffer", err);
       resolve({ text: `[Error reading file: ${file.name}]` });
       worker.terminate();
    });
  });
};
