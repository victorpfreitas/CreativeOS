import type { Automation, BrandDNA, Project, Slideshow } from './types';
import { getSlideshowSourceCapture, getSourceCaptureStatusLabel, getSourceCaptureTypeLabel } from './sourceCapture';

export function getBrandDnaScore(brandDna?: BrandDNA) {
  if (!brandDna) return 0;
  const fields = [
    brandDna.bio,
    brandDna.market,
    brandDna.target_audience,
    brandDna.tone_of_voice,
    brandDna.key_messages,
    brandDna.core_promise,
    brandDna.unique_mechanism,
    brandDna.proof_points,
  ];
  const filled = fields.filter((value) => value && value.trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}

export function getAutomationIssues(automation: Automation, project?: Project | null) {
  const issues: string[] = [];

  if (!automation.project_id) issues.push('Sem projeto conectado');
  if (!automation.niche?.trim()) issues.push('Nicho não definido');
  if (!automation.narrative_prompt?.trim()) issues.push('Narrativa principal ausente');
  if (!automation.schedule_days?.length || !automation.schedule_time?.trim()) issues.push('Agenda não configurada');
  if (!automation.hook_collection_id && !automation.body_collection_id) issues.push('Sem caminho visual definido');
  if (project && getBrandDnaScore(project.brand_dna) < 40) issues.push('Brand DNA ainda fraco');

  return issues;
}

export function getAutomationHealthStatus(automation: Automation, project?: Project | null) {
  if (automation.status === 'paused') return 'paused' as const;
  if (getAutomationIssues(automation, project).length > 0) return 'missing_inputs' as const;
  return 'healthy' as const;
}

export function assessQueueState(input: {
  slides: Slideshow['slides'];
  caption?: string;
  sourceTitle?: string;
  sourceNotes?: string;
  readinessScore?: number;
}) {
  const { slides, caption, sourceTitle, sourceNotes, readinessScore } = input;
  const coverTitle = (slides[0]?.title || slides[0]?.text || '').trim();
  const lastSlide = slides[slides.length - 1];
  const bodySupport = slides.slice(1, -1).some((slide) => (slide.body || '').trim().length >= 20);

  if (!sourceTitle && !sourceNotes) {
    return {
      queueLabel: 'needs_source_context' as const,
      queueNote: 'Faltou contexto de fonte suficiente para dar segurança editorial.',
    };
  }

  if (coverTitle.length < 14 || (readinessScore ?? 0) < 60) {
    return {
      queueLabel: 'needs_stronger_hook' as const,
      queueNote: 'Vale reforçar promessa, gancho ou clareza antes da revisão final.',
    };
  }

  if (!bodySupport) {
    return {
      queueLabel: 'needs_source_context' as const,
      queueNote: 'Os slides de corpo ainda têm pouco apoio para sustentar a tese.',
    };
  }

  if (!(lastSlide?.cta || '').trim() || !(caption || '').trim()) {
    return {
      queueLabel: 'needs_cta_cleanup' as const,
      queueNote: 'O fechamento ainda pede CTA ou legenda mais forte.',
    };
  }

  return {
    queueLabel: 'ready_for_review' as const,
    queueNote: 'Draft pronto para revisão humana e ajustes finos no editor.',
  };
}

export function getSlideshowProjectId(slideshow: Slideshow) {
  return slideshow.brief?.project_id || slideshow.automation?.project_id || '';
}

export function getReviewStateLabel(state?: Slideshow['review_state']) {
  switch (state) {
    case 'queued':
      return 'Na fila';
    case 'reviewing':
      return 'Em revisão';
    case 'approved':
      return 'Aprovado';
    case 'rejected':
      return 'Descartado';
    case 'needs_regeneration':
      return 'Pedir nova versão';
    default:
      return 'Sem estado';
  }
}

export function getQueueLabelText(label?: Slideshow['queue_label']) {
  switch (label) {
    case 'ready_for_review':
      return 'Pronto para revisão';
    case 'needs_stronger_hook':
      return 'Gancho fraco';
    case 'needs_source_context':
      return 'Falta contexto';
    case 'needs_cta_cleanup':
      return 'CTA para lapidar';
    default:
      return 'Sem leitura';
  }
}

export function getSourceCaptureSummary(slideshow: Slideshow) {
  const capture = getSlideshowSourceCapture(slideshow);
  return {
    typeLabel: getSourceCaptureTypeLabel(capture.source_capture_type),
    statusLabel: getSourceCaptureStatusLabel(capture.source_capture_status),
    note: capture.source_capture_note || 'Sem observacao visual salva para este draft.',
    isFallback: capture.source_capture_status === 'fallback_used',
    failed: capture.source_capture_status === 'failed',
  };
}
