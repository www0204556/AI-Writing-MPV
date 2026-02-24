import { get, set, del, keys, getMany } from 'idb-keyval';

export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  data: ArrayBuffer;
  uploadedAt: number;
}

const STORE_PREFIX = 'greenscribe_file_';

export const saveFileToIDB = async (file: File): Promise<StoredFile> => {
  const id = `${STORE_PREFIX}${Date.now()}_${file.name}`;
  const buffer = await file.arrayBuffer();
  
  const storedFile: StoredFile = {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    data: buffer,
    uploadedAt: Date.now(),
  };

  await set(id, storedFile);
  return storedFile;
};

export const getStoredFiles = async (): Promise<StoredFile[]> => {
  const allKeys = await keys();
  const fileKeys = allKeys.filter((key) => typeof key === 'string' && key.startsWith(STORE_PREFIX));
  
  if (fileKeys.length === 0) return [];

  const files = await getMany<StoredFile>(fileKeys);
  const validFiles = files.filter((f): f is StoredFile => f !== undefined);
  
  // Sort by upload time, newest first
  return validFiles.sort((a, b) => b.uploadedAt - a.uploadedAt);
};

export const deleteStoredFile = async (id: string): Promise<void> => {
  await del(id);
};

// Helper to convert StoredFile back to File object for processing
export const storedFileToFile = (stored: StoredFile): File => {
  return new File([stored.data], stored.name, { type: stored.type });
};
