
export class BlobService {
  /**
   * Faz upload de um ficheiro via Proxy API para segurança.
   */
  async uploadImage(file: File | Blob, fileName: string): Promise<string> {
    try {
      const response = await fetch(`/api/upload?filename=${encodeURIComponent(fileName)}`, {
        method: 'POST',
        body: file,
      });

      if (!response.ok) throw new Error("Falha no upload via API");
      
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error("Erro no upload:", error);
      throw new Error("Falha ao guardar imagem. Verifique a ligação.");
    }
  }

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
