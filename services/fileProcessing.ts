import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export interface ProcessedPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

/**
 * Converts a File object into a format suitable for the Gemini API.
 * - PDF/Images: Converted to Base64 (inlineData)
 * - Docx/Excel: Text extracted client-side (text)
 */
export const processFile = async (file: File): Promise<ProcessedPart> => {
  const arrayBuffer = await file.arrayBuffer();

  // Handle PDF
  if (file.type === 'application/pdf') {
    const base64 = await bufferToBase64(arrayBuffer);
    return { 
      inlineData: { 
        mimeType: 'application/pdf', 
        data: base64 
      } 
    };
  }
  
  // Handle Images
  if (file.type.startsWith('image/')) {
    const base64 = await bufferToBase64(arrayBuffer);
    return { 
      inlineData: { 
        mimeType: file.type, 
        data: base64 
      } 
    };
  }

  // Handle Word Documents (.docx)
  if (file.name.endsWith('.docx')) {
     try {
       const result = await mammoth.extractRawText({ arrayBuffer });
       return { text: `\n[Attached File Content: ${file.name}]\n${result.value}\n[End of File: ${file.name}]\n` };
     } catch (e) {
       console.error("Docx parsing failed", e);
       return { text: `[Error parsing file: ${file.name}]` };
     }
  }

  // Handle Excel Files (.xlsx, .xls)
  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
     try {
       const workbook = XLSX.read(arrayBuffer, { type: 'array' });
       let csvContent = "";
       for(const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          if (csv.trim()) {
            csvContent += `[Sheet: ${sheetName}]\n${csv}\n`;
          }
       }
       return { text: `\n[Attached File Content: ${file.name}]\n${csvContent}\n[End of File: ${file.name}]\n` };
     } catch (e) {
       console.error("Excel parsing failed", e);
       return { text: `[Error parsing file: ${file.name}]` };
     }
  }

  // Fallback for text files
  if (file.type.startsWith('text/')) {
    const text = new TextDecoder().decode(arrayBuffer);
    return { text: `\n[Attached File Content: ${file.name}]\n${text}\n` };
  }

  return { text: `[Skipped unsupported file: ${file.name}]` };
};

/**
 * Helper to convert ArrayBuffer to Base64 string (without data URL prefix)
 */
function bufferToBase64(buffer: ArrayBuffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([buffer]);
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // remove data:mime/type;base64, prefix
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}