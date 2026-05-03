export type YouTubeTranscriptResult = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  transcriptText: string;
  transcriptLanguage: string;
  transcriptSource: 'official' | 'auto' | 'unavailable';
  hasTimestamps: boolean;
  note: string;
};

const REQUEST_TIMEOUT_MS = 30000;

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/$/, '');
}

export function getRequestOrigin(req: { headers?: Record<string, string | string[] | undefined> }) {
  const protoHeader = req.headers?.['x-forwarded-proto'];
  const hostHeader = req.headers?.host;
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;

  if (host) {
    return `${proto || 'https'}://${host}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://127.0.0.1:3000';
}

export async function fetchYouTubeTranscriptSource(origin: string, url: string, lang?: string): Promise<YouTubeTranscriptResult> {
  const target = new URL(`${normalizeOrigin(origin)}/api/source/youtube-intake`);
  target.searchParams.set('url', url);
  if (lang) target.searchParams.set('lang', lang);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(target.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || 'Nao consegui buscar a transcricao do YouTube agora.');
    }

    return {
      videoId: String(data?.videoId || ''),
      title: String(data?.title || 'Video do YouTube'),
      thumbnailUrl: String(data?.thumbnailUrl || ''),
      transcriptText: String(data?.transcriptText || ''),
      transcriptLanguage: String(data?.transcriptLanguage || lang || ''),
      transcriptSource: data?.transcriptSource === 'official' || data?.transcriptSource === 'auto' ? data.transcriptSource : 'unavailable',
      hasTimestamps: Boolean(data?.hasTimestamps),
      note: String(data?.note || ''),
    };
  } finally {
    clearTimeout(timeout);
  }
}
