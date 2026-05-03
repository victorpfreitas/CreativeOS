import type { ContentBrief, Slideshow } from './types';

export type SourceTranscriptSource = NonNullable<ContentBrief['source_transcript_source']>;
export type SourceTranscriptStatus = NonNullable<ContentBrief['source_transcript_status']>;

export function getTranscriptSourceLabel(source?: SourceTranscriptSource) {
  switch (source) {
    case 'official':
      return 'Legenda oficial';
    case 'auto':
      return 'Legenda automatica';
    case 'unavailable':
      return 'Sem transcricao';
    default:
      return 'Sem transcricao';
  }
}

export function getTranscriptStatusLabel(status?: SourceTranscriptStatus) {
  switch (status) {
    case 'ready':
      return 'Pronta';
    case 'partial':
      return 'Parcial';
    case 'failed':
      return 'Indisponivel';
    default:
      return 'Indisponivel';
  }
}

export function getSlideshowTranscriptMeta(slideshow: Slideshow) {
  return {
    transcript: slideshow.brief?.source_transcript || slideshow.source_transcript || '',
    language: slideshow.brief?.source_transcript_language || slideshow.source_transcript_language || '',
    source: slideshow.brief?.source_transcript_source || slideshow.source_transcript_source,
    status: slideshow.brief?.source_transcript_status || slideshow.source_transcript_status,
    note: slideshow.brief?.source_transcript_note || slideshow.source_transcript_note || '',
  };
}
