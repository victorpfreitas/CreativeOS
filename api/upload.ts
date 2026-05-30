// Upload de imagem via ImgBB — mantem a API key no servidor.
// O cliente envia a imagem em base64; aqui repassamos para o ImgBB usando
// IMGBB_API_KEY (sem prefixo VITE_, portanto fora do bundle do cliente).

const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';
const UPLOAD_TIMEOUT_MS = 30000;
// Limite defensivo do payload base64 (~8MB de imagem ≈ 11MB em base64).
const MAX_BASE64_LENGTH = 11_000_000;

function readApiKey() {
  return (process.env.IMGBB_API_KEY || process.env.VITE_IMGBB_API_KEY || '').trim();
}

function normalizeBase64(value: unknown) {
  if (typeof value !== 'string') return '';
  // Aceita data URLs (data:image/png;base64,XXXX) ou base64 puro.
  const commaIndex = value.indexOf(',');
  const raw = value.startsWith('data:') && commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
  return raw.trim();
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = UPLOAD_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = readApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: 'Upload nao configurado: defina IMGBB_API_KEY no ambiente.' });
  }

  const image = normalizeBase64(req.body?.image);
  if (!image) {
    return res.status(400).json({ error: 'Envie a imagem em base64 no campo "image".' });
  }
  if (image.length > MAX_BASE64_LENGTH) {
    return res.status(413).json({ error: 'Imagem muito grande para upload.' });
  }

  try {
    const form = new URLSearchParams();
    form.set('key', apiKey);
    form.set('image', image);

    const response = await fetchWithTimeout(IMGBB_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
      const message = data?.error?.message || `ImgBB respondeu com erro ${response.status}.`;
      return res.status(502).json({ error: message });
    }

    return res.status(200).json({ url: data.data.url as string });
  } catch (err: any) {
    const message = err?.name === 'AbortError' ? 'O upload demorou demais para responder.' : 'Falha ao fazer upload da imagem.';
    return res.status(502).json({ error: message });
  }
}
