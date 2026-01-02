
import { AppData } from '../types';

/**
 * PostgresService agora funciona exclusivamente como um cliente HTTP.
 * Não importa @vercel/postgres para evitar erros de build no browser.
 */
export class PostgresService {
  init(url: string) {
    // No modelo API, a configuração é gerida no servidor
    console.debug("PostgresService: Ligado via Proxy API /api/db");
  }

  async ensureTable() {
    // A inicialização da tabela é feita pela API no servidor
    return true;
  }

  async pushData(userId: string, data: AppData): Promise<boolean> {
    try {
      const response = await fetch(`/api/db?userId=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
      });
      return response.ok;
    } catch (err) {
      console.error("Erro na sincronização Cloud:", err);
      return false;
    }
  }

  async pullData(userId: string): Promise<AppData | null> {
    try {
      const response = await fetch(`/api/db?userId=${encodeURIComponent(userId)}`);
      if (response.ok) {
        const data = await response.json();
        return data as AppData;
      }
      return null;
    } catch (err) {
      console.error("Erro ao recuperar dados da Cloud:", err);
      return null;
    }
  }

  async listAllSyncs() {
    return [];
  }
}

export const postgresService = new PostgresService();
