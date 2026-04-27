export interface SourcePreview {
  title: string;
  url: string;
  imageUrl: string;
  excerpt: string;
  text: string;
}

export async function fetchRssSource(url: string): Promise<SourcePreview> {
  const response = await fetch(`/api/source/rss?url=${encodeURIComponent(url)}`);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Nao consegui ler essa fonte agora.');
  }

  return {
    title: data.title || '',
    url: data.url || url,
    imageUrl: data.imageUrl || '',
    excerpt: data.excerpt || '',
    text: data.text || '',
  };
}

export function getYouTubeVideoId(url: string): string {
  const cleanUrl = url.trim();
  if (!cleanUrl) return '';

  try {
    const parsed = new URL(cleanUrl);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (parsed.searchParams.get('v')) return parsed.searchParams.get('v') || '';
    const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?#]+)/);
    if (shortsMatch) return shortsMatch[1];
    const embedMatch = parsed.pathname.match(/\/embed\/([^/?#]+)/);
    if (embedMatch) return embedMatch[1];
  } catch {
    const looseMatch = cleanUrl.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([a-zA-Z0-9_-]{6,})/);
    return looseMatch?.[1] || '';
  }

  return '';
}

export function getYouTubeThumbnail(url: string): string {
  const id = getYouTubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : '';
}
