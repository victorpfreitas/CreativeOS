import type { ContentBrief } from '../lib/types';

export interface SourcePreview {
  title: string;
  url: string;
  imageUrl: string;
  excerpt: string;
  text: string;
}

export interface SourceImageResolution {
  sourceCaptureType?: ContentBrief['source_capture_type'];
  sourceCaptureUrl?: string;
  sourceCaptureStatus?: ContentBrief['source_capture_status'];
  sourceCaptureNote?: string;
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

export function getYouTubeThumbnailCandidates(url: string): string[] {
  const id = getYouTubeVideoId(url);
  if (!id) return [];
  return [
    `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${id}/sddefault.jpg`,
    `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
    `https://img.youtube.com/vi/${id}/default.jpg`,
  ];
}

export async function resolveSourceImage(input: {
  sourceType?: ContentBrief['source_type'];
  sourceUrl?: string;
  sourceImageUrl?: string;
  projectId?: string;
  automationId?: string;
  fallbackImageUrl?: string;
}): Promise<SourceImageResolution> {
  const params = new URLSearchParams();
  if (input.sourceType) params.set('sourceType', input.sourceType);
  if (input.sourceUrl) params.set('sourceUrl', input.sourceUrl);
  if (input.sourceImageUrl) params.set('sourceImageUrl', input.sourceImageUrl);
  if (input.projectId) params.set('projectId', input.projectId);
  if (input.automationId) params.set('automationId', input.automationId);
  if (input.fallbackImageUrl) params.set('fallbackImageUrl', input.fallbackImageUrl);

  const response = await fetch(`/api/source/resolve-image?${params.toString()}`);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Nao consegui resolver a imagem da fonte.');
  }

  return {
    sourceCaptureType: data?.sourceCaptureType,
    sourceCaptureUrl: data?.sourceCaptureUrl,
    sourceCaptureStatus: data?.sourceCaptureStatus,
    sourceCaptureNote: data?.sourceCaptureNote,
  };
}
