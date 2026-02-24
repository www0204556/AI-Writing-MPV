import { WorkerMessage, WorkerResponse } from './fileWorker';

export interface ProcessedPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

// Singleton worker instance
let sharedWorker: Worker | null = null;
let messageIdCounter = 0;
const pendingRequests = new Map<string, { resolve: (val: ProcessedPart) => void, reject: (err: any) => void, fileName: string }>();

const getWorker = (): Worker => {
  if (!sharedWorker) {
    sharedWorker = new Worker(new URL('./fileWorker.ts', import.meta.url), { type: 'module' });
    
    sharedWorker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const response = e.data;
      const handlers = pendingRequests.get(response.id);
      
      if (handlers) {
        pendingRequests.delete(response.id);
        if (response.error) {
          console.error(`Error processing file ${handlers.fileName}:`, response.error);
          handlers.resolve({ text: `[Error parsing file: ${handlers.fileName}]` });
        } else {
          handlers.resolve({
            text: response.text,
            inlineData: response.inlineData
          });
        }
      }
    };

    sharedWorker.onerror = (err) => {
      console.error(`Worker error:`, err);
      // Resolve all pending requests with error
      for (const [id, handlers] of pendingRequests.entries()) {
        handlers.resolve({ text: `[Error processing file: ${handlers.fileName}]` });
      }
      pendingRequests.clear();
      // Restart worker on next request
      sharedWorker?.terminate();
      sharedWorker = null;
    };
  }
  return sharedWorker;
};

/**
 * Converts a File object into a format suitable for the Gemini API using a Web Worker.
 */
export const processFile = (file: File): Promise<ProcessedPart> => {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    const id = `msg_${++messageIdCounter}`;
    
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(id);
      console.warn(`File processing timed out for ${file.name}`);
      resolve({ text: `[Error: Processing file ${file.name} timed out]` });
    }, 8000); // 8 seconds timeout

    pendingRequests.set(id, { 
      resolve: (val) => { clearTimeout(timeoutId); resolve(val); }, 
      reject: (err) => { clearTimeout(timeoutId); reject(err); }, 
      fileName: file.name 
    });

    // Send data to worker
    file.arrayBuffer().then(buffer => {
      const message: WorkerMessage = {
        id,
        fileData: buffer,
        fileName: file.name,
        fileType: file.type
      };
      // Transfer the buffer to the worker for performance
      worker.postMessage(message, [buffer]);
    }).catch(err => {
       console.error("Failed to read file buffer", err);
       pendingRequests.delete(id);
       resolve({ text: `[Error reading file: ${file.name}]` });
    });
  });
};
