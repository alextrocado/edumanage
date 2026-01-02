
import { put } from '@vercel/blob';

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const url = new URL(req.url);
    const filename = url.searchParams.get('filename') || `file_${Date.now()}.jpg`;
    const blob = await req.blob();

    const { url: blobUrl } = await put(filename, blob, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return new Response(JSON.stringify({ url: blobUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
