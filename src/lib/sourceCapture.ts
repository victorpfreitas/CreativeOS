import type { ContentBrief, Slideshow } from './types';

export type SourceCaptureType = NonNullable<ContentBrief['source_capture_type']>;
export type SourceCaptureStatus = NonNullable<ContentBrief['source_capture_status']>;

export type SourceCaptureFields = Pick<
  ContentBrief,
  'source_capture_type' | 'source_capture_url' | 'source_capture_status' | 'source_capture_note'
>;

export function getSourceCaptureTypeLabel(type?: SourceCaptureType) {
  switch (type) {
    case 'source_image':
      return 'Imagem da fonte';
    case 'page_screenshot':
      return 'Print da pagina';
    case 'youtube_thumbnail':
      return 'Thumbnail oficial';
    case 'project_fallback':
      return 'Fallback visual';
    default:
      return 'Sem imagem definida';
  }
}

export function getSourceCaptureStatusLabel(status?: SourceCaptureStatus) {
  switch (status) {
    case 'ready':
      return 'Pronto';
    case 'fallback_used':
      return 'Fallback usado';
    case 'failed':
      return 'Sem imagem';
    default:
      return 'Pendente';
  }
}

export function pickResolvedSourceImageUrl(
  sourceCaptureUrl?: string,
  sourceImageUrl?: string
) {
  return sourceCaptureUrl || sourceImageUrl || '';
}

export function getSlideshowSourceCapture(slideshow: Slideshow): SourceCaptureFields {
  return {
    source_capture_type: slideshow.source_capture_type || slideshow.brief?.source_capture_type,
    source_capture_url: slideshow.source_capture_url || slideshow.brief?.source_capture_url,
    source_capture_status: slideshow.source_capture_status || slideshow.brief?.source_capture_status,
    source_capture_note: slideshow.source_capture_note || slideshow.brief?.source_capture_note,
  };
}
