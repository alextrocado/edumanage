
import { put } from '@vercel/blob';

export class BlobService {
  /**
   * Faz upload de um ficheiro para o Vercel Blob e retorna o URL público.
   */
  async uploadImage(file: File | Blob, fileName: string): Promise<string> {
    try {
      // O token deve estar em process.env.BLOB_READ_WRITE_TOKEN no Vercel
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      
      const { url } = await put(fileName, file, {
        access: 'public',
        token: token
      });
      return url;
    } catch (error) {
      console.error("Erro no upload para Vercel Blob:", error);
      throw new Error("Falha ao guardar imagem na cloud. Verifique o token do Vercel Blob.");
    }
  }

  /**
   * Converte uma string base64 para Blob.
   */
  base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}

export const blobService = new BlobService();
