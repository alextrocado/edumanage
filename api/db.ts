
import { sql } from '@vercel/postgres';

export default async function handler(req: Request) {
  const { method } = req;
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') || 'default_prof';

  // O Vercel Postgres injeta automaticamente a POSTGRES_URL no ambiente Node.js aqui
  try {
    // Garantir que a tabela existe
    await sql`
      CREATE TABLE IF NOT EXISTS registos (
        id TEXT PRIMARY KEY,
        data JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    if (method === 'GET') {
      const { rows } = await sql`SELECT data FROM registos WHERE id = ${userId}`;
      return new Response(JSON.stringify(rows[0]?.data || null), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'POST') {
      const data = await req.json();
      await sql`
        INSERT INTO registos (id, data, updated_at)
        VALUES (${userId}, ${JSON.stringify(data)}, CURRENT_TIMESTAMP)
        ON CONFLICT (id) 
        DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP
      `;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (error: any) {
    console.error('API DB Error:', error);
    return new Response(JSON.stringify({ error: 'Erro de ligação à base de dados na cloud.' }), { status: 500 });
  }
}
