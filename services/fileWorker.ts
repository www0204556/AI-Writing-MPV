import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Define the shape of data sent TO the worker
export interface WorkerMessage {
  id: string;
  fileData: ArrayBuffer;
  fileName: string;
  fileType: string;
}

// Define the shape of data returned FROM the worker
export interface WorkerResponse {
  id: string;
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  error?: string;
}

/**
 * Helper to convert ArrayBuffer to Base64 string efficiently
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    const chunkSize = 0x8000; // 32768
    for (let i = 0; i < len; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as unknown as number[]);
    }
    return btoa(binary);
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { id, fileData, fileName, fileType } = e.data;

  try {
    // Handle PDF
    if (fileType === 'application/pdf') {
      const base64 = arrayBufferToBase64(fileData);
      self.postMessage({ 
        id,
        inlineData: { 
          mimeType: 'application/pdf', 
          data: base64 
        } 
      } as WorkerResponse);
      return;
    }
    
    // Handle Images
    if (fileType.startsWith('image/')) {
      const base64 = arrayBufferToBase64(fileData);
      self.postMessage({ 
        id,
        inlineData: { 
          mimeType: fileType, 
          data: base64 
        } 
      } as WorkerResponse);
      return;
    }

    // Handle Word Documents (.docx)
    if (fileName.endsWith('.docx')) {
       try {
         const result = await mammoth.extractRawText({ arrayBuffer: fileData });
         self.postMessage({ 
            id,
            text: `\n[Attached File Content: ${fileName}]\n${result.value}\n[End of File: ${fileName}]\n` 
         } as WorkerResponse);
       } catch (err: any) {
         self.postMessage({ id, error: `Docx parsing failed: ${err.message}` } as WorkerResponse);
       }
       return;
    }

    // Handle Excel Files (.xlsx, .xls)
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
       try {
         const workbook = XLSX.read(fileData, { type: 'array' });
         let csvContent = "";
         for(const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            if (csv.trim()) {
              csvContent += `[Sheet: ${sheetName}]\n${csv}\n`;
            }
         }
         self.postMessage({ 
            id,
            text: `\n[Attached File Content: ${fileName}]\n${csvContent}\n[End of File: ${fileName}]\n` 
         } as WorkerResponse);
       } catch (err: any) {
         self.postMessage({ id, error: `Excel parsing failed: ${err.message}` } as WorkerResponse);
       }
       return;
    }

    // Fallback for text files
    if (fileType.startsWith('text/')) {
      const text = new TextDecoder().decode(fileData);
      self.postMessage({ 
        id,
        text: `\n[Attached File Content: ${fileName}]\n${text}\n` 
      } as WorkerResponse);
      return;
    }

    self.postMessage({ id, text: `[Skipped unsupported file: ${fileName}]` } as WorkerResponse);

  } catch (err: any) {
      self.postMessage({ id, error: `Unknown worker error: ${err.message}` } as WorkerResponse);
  }
};
