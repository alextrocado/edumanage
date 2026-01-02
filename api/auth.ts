export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { user, password } = await req.json();
    
    // Variáveis de ambiente lidas estritamente no servidor
    const adminUser = process.env.ADMIN_USER;
    const adminPass = process.env.ADMIN_PASSWORD;

    if (!adminUser || !adminPass) {
        return new Response(JSON.stringify({ error: 'Configuração do servidor incompleta (env missing).' }), { status: 500 });
    }

    if (user === adminUser && password === adminPass) {
      return new Response(JSON.stringify({ 
        success: true, 
        token: btoa(`${user}:${Date.now()}`) 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Credenciais administrativas inválidas.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erro interno na API de Autenticação.' }), { status: 500 });
  }
}