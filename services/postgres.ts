
import { createPool, VercelPool } from '@vercel/postgres';
import { AppData } from '../types';

export class PostgresService {
  private pool: VercelPool | null = null;
  private connectionString: string | undefined = process.env.POSTGRES_URL;

  /**
   * Inicializa ou atualiza a string de ligação.
   */
  init(url: string) {
    if (url && url !== this.connectionString) {
      this.connectionString = url;
      // Reset do pool para forçar nova ligação com o URL atualizado
      this.pool = null;
    }
  }

  /**
   * Obtém o pool de conexões ativo. 
   * Retorna null se não houver URL configurado em vez de lançar erro.
   */
  private getPool(): VercelPool | null {
    if (this.pool) return this.pool;

    const url = this.connectionString || process.env.POSTGRES_URL;

    if (!url) {
      console.warn("PostgresService: POSTGRES_URL não definida. Modo Cloud desativado.");
      return null;
    }

    try {
      this.pool = createPool({
        connectionString: url,
      });
      return this.pool;
    } catch (e) {
      console.error("Erro ao criar pool de ligações Postgres:", e);
      return null;
    }
  }

  /**
   * Garante que a tabela 'registos' existe.
   */
  async ensureTable() {
    try {
      const client = this.getPool();
      if (!client) return;
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS registos (
          id TEXT PRIMARY KEY,
          data JSONB,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (err) {
      console.error("Erro ao preparar tabela Vercel Postgres:", err);
    }
  }

  /**
   * Sincroniza os dados para a cloud.
   */
  async pushData(userId: string, data: AppData): Promise<boolean> {
    try {
      const client = this.getPool();
      if (!client) return false;
      
      // Limpeza de dados sensíveis antes de enviar para a cloud
      const cleanData = { 
        ...data, 
        config: { 
          ...data.config, 
          appPassword: undefined,
          postgresConnectionString: undefined,
          cloudToken: undefined
        } 
      };

      const dataStr = JSON.stringify(cleanData);

      await client.query(`
        INSERT INTO registos (id, data, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (id) 
        DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP
      `, [userId, dataStr]);

      return true;
    } catch (err) {
      console.error("Erro ao sincronizar com Vercel Postgres:", err);
      return false;
    }
  }

  /**
   * Recupera os dados da cloud.
   */
  async pullData(userId: string): Promise<AppData | null> {
    try {
      const client = this.getPool();
      if (!client) return null;

      const { rows } = await client.query('SELECT data FROM registos WHERE id = $1', [userId]);
      
      if (rows && rows.length > 0) {
        return rows[0].data as AppData;
      }
      return null;
    } catch (err) {
      console.error("Erro ao ler do Vercel Postgres:", err);
      return null;
    }
  }

  /**
   * Lista todos os utilizadores sincronizados.
   */
  async listAllSyncs() {
    try {
      const client = this.getPool();
      if (!client) return [];

      const { rows } = await client.query('SELECT id, updated_at FROM registos ORDER BY updated_at DESC');
      return rows;
    } catch (err) {
      return [];
    }
  }
}

export const postgresService = new PostgresService();
