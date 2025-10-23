import { put } from '@vercel/blob';

export async function uploadFile(file: File, path: string) {
  try {
    const blob = await put(`tasks/${path}/${Date.now()}-${file.name}`, file, {
      access: 'public',
    });
    return blob.url;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file');
  }
}