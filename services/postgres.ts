
import { AppData } from '../types';

export class PostgresService {
  /**
   * No novo modelo API, o init não precisa de configurar strings no frontend.
   */
  init(url: string) {
    console.debug("PostgresService: Utilizando API Proxy Serverless.");
  }

  async ensureTable() {
    // A tabela é garantida na chamada da API
    return true;
  }

  async pushData(userId: string, data: AppData): Promise<boolean> {
    try {
      const response = await fetch(`/api/db?userId=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.ok;
    } catch (err) {
      console.error("Erro ao sincronizar via API:", err);
      return false;
    }
  }

  async pullData(userId: string): Promise<AppData | null> {
    try {
      const response = await fetch(`/api/db?userId=${encodeURIComponent(userId)}`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (err) {
      console.error("Erro ao ler via API:", err);
      return null;
    }
  }

  async listAllSyncs() {
    // Implementar se necessário listar múltiplos utilizadores
    return [];
  }
}

export const postgresService = new PostgresService();
