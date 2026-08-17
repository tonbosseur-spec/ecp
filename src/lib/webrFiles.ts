/**
 * WebR File System Manager
 * 
 * Handles local file imports from the browser into the WebR virtual file system.
 */

import { writeWebRFile, deleteWebRFile, listWebRFiles, webRFileExists } from './webrEngine';

export interface WebRFileMeta {
  name: string;
  size: number;
  path: string;
  type: string;
  lastModified: number;
}

export const MAX_IMPORT_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.txt', '.rds', '.rdata', '.sav', '.dta'];

/**
 * Sanitizes a filename to prevent path traversal or problematic characters.
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/\\/g, '/')
    .split('/')
    .pop() || 'file'
    .replace(/[^a-zA-Z0-9._\-\s]/g, '_')
    .replace(/\s+/g, '_');
}

/**
 * Validates a file before import.
 */
export function validateFileForImport(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Aucun fichier sélectionné.' };
  }

  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return { 
      valid: false, 
      error: `Format non supporté. Formats autorisés : ${ALLOWED_EXTENSIONS.join(', ')}` 
    };
  }

  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return { 
      valid: false, 
      error: `Fichier trop volumineux. La taille maximale est de ${MAX_IMPORT_FILE_SIZE / (1024 * 1024)} Mo.` 
    };
  }

  return { valid: true };
}

/**
 * Imports a browser File object into the WebR VFS.
 */
export async function importFileToWebR(file: File): Promise<WebRFileMeta> {
  const validation = validateFileForImport(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const safeName = sanitizeFileName(file.name);
  
  try {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    
    await writeWebRFile(safeName, data);
    
    // Double check existence
    const exists = await webRFileExists(safeName);
    if (!exists) {
      throw new Error("Échec de l'écriture dans le système de fichiers WebR.");
    }

    return {
      name: safeName,
      size: file.size,
      path: safeName,
      type: file.type || 'application/octet-stream',
      lastModified: file.lastModified
    };
  } catch (err: any) {
    console.error("Erreur d'importation WebR:", err);
    throw new Error(err?.message || "Erreur lors de l'importation du fichier.");
  }
}

/**
 * Lists all user-imported files in the WebR environment.
 */
export async function getWebRFiles(): Promise<WebRFileMeta[]> {
  const fileNames = await listWebRFiles('.');
  
  return fileNames.map(name => ({
    name,
    size: 0,
    path: name,
    type: name.endsWith('.xlsx') || name.endsWith('.xls') ? 'application/vnd.ms-excel' : 'text/plain',
    lastModified: Date.now()
  }));
}

/**
 * Deletes a file from WebR.
 */
export async function removeFileFromWebR(name: string): Promise<void> {
  await deleteWebRFile(name);
}
