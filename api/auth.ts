
export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { user, password } = await req.json();
    
    // As variáveis de ambiente são lidas apenas aqui (Server-side)
    const adminUser = process.env.APP_USER;
    const adminPass = process.env.APP_PASSWORD;

    if (user === adminUser && password === adminPass) {
      return new Response(JSON.stringify({ 
        success: true, 
        token: btoa(`${user}:${Date.now()}`) 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Credenciais inválidas' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
