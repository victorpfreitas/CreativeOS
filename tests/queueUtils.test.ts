import { describe, it, expect } from 'vitest';
import {
  getBrandDnaScore,
  getAutomationIssues,
  getAutomationHealthStatus,
  assessQueueState,
  getReviewStateLabel,
  getQueueLabelText,
} from '../src/lib/queueUtils';
import type { Automation, BrandDNA, Project, Slide } from '../src/lib/types';

function makeAutomation(overrides: Partial<Automation> = {}): Automation {
  return {
    project_id: 'p1',
    niche: 'financas pessoais',
    narrative_prompt: 'historia de virada',
    schedule_days: ['mon', 'wed'],
    schedule_time: '10:00',
    source_mode: 'topic',
    hook_collection_id: 'c1',
    body_collection_id: 'c2',
    status: 'active',
    ...overrides,
  } as unknown as Automation;
}

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return { type: 'body', text: '', title: '', body: '', cta: '', ...overrides } as Slide;
}

describe('getBrandDnaScore', () => {
  it('retorna 0 quando nao ha brand dna', () => {
    expect(getBrandDnaScore(undefined)).toBe(0);
  });

  it('calcula percentual de campos preenchidos', () => {
    const dna = { bio: 'x', market: 'y', target_audience: 'z', tone_of_voice: 'w' } as BrandDNA;
    // 4 de 8 campos = 50%
    expect(getBrandDnaScore(dna)).toBe(50);
  });

  it('ignora campos em branco', () => {
    const dna = { bio: '   ', market: '' } as BrandDNA;
    expect(getBrandDnaScore(dna)).toBe(0);
  });
});

describe('getAutomationIssues', () => {
  it('nao reporta problemas quando tudo esta preenchido', () => {
    expect(getAutomationIssues(makeAutomation())).toEqual([]);
  });

  it('reporta nicho e narrativa ausentes', () => {
    const issues = getAutomationIssues(makeAutomation({ niche: '', narrative_prompt: '  ' }));
    expect(issues).toContain('Nicho nao definido');
    expect(issues).toContain('Narrativa principal ausente');
  });

  it('exige URL do YouTube quando source_mode = youtube', () => {
    const issues = getAutomationIssues(makeAutomation({ source_mode: 'youtube', youtube_source_url: '' }));
    expect(issues).toContain('URL do YouTube ausente');
  });

  it('aponta brand DNA fraco quando score < 40', () => {
    const project = { brand_dna: { bio: 'x' } as BrandDNA } as Project;
    const issues = getAutomationIssues(makeAutomation(), project);
    expect(issues).toContain('Brand DNA ainda fraco');
  });
});

describe('getAutomationHealthStatus', () => {
  it('paused tem prioridade', () => {
    expect(getAutomationHealthStatus(makeAutomation({ status: 'paused' }))).toBe('paused');
  });

  it('missing_inputs quando ha problemas', () => {
    expect(getAutomationHealthStatus(makeAutomation({ niche: '' }))).toBe('missing_inputs');
  });

  it('healthy quando esta tudo certo', () => {
    expect(getAutomationHealthStatus(makeAutomation())).toBe('healthy');
  });
});

describe('assessQueueState', () => {
  const goodSlides = [
    makeSlide({ title: 'Um titulo forte e claro aqui' }),
    makeSlide({ body: 'apoio suficiente para sustentar a tese editorial' }),
    makeSlide({ body: 'mais um corpo com bastante conteudo de apoio' }),
    makeSlide({ cta: 'Salve este post', body: 'fechamento' }),
  ];

  it('pede contexto quando nao ha fonte', () => {
    const result = assessQueueState({ slides: goodSlides });
    expect(result.queueLabel).toBe('needs_source_context');
  });

  it('pede gancho mais forte com titulo curto ou readiness baixo', () => {
    const result = assessQueueState({
      slides: [makeSlide({ title: 'curto' }), ...goodSlides.slice(1)],
      sourceTitle: 'fonte',
      readinessScore: 90,
    });
    expect(result.queueLabel).toBe('needs_stronger_hook');
  });

  it('marca pronto para revisao quando tudo esta ok', () => {
    const result = assessQueueState({
      slides: goodSlides,
      caption: 'legenda com cta #tag',
      sourceTitle: 'fonte confiavel',
      sourceNotes: 'notas da fonte',
      readinessScore: 82,
    });
    expect(result.queueLabel).toBe('ready_for_review');
  });

  it('pede limpeza de cta quando falta cta ou legenda', () => {
    const result = assessQueueState({
      slides: [...goodSlides.slice(0, 3), makeSlide({ cta: '', body: 'fechamento' })],
      caption: '',
      sourceTitle: 'fonte',
      sourceNotes: 'notas',
      readinessScore: 82,
    });
    expect(result.queueLabel).toBe('needs_cta_cleanup');
  });
});

describe('labels', () => {
  it('getReviewStateLabel cobre estados conhecidos e default', () => {
    expect(getReviewStateLabel('approved')).toBe('Aprovado');
    expect(getReviewStateLabel(undefined)).toBe('Sem estado');
  });

  it('getQueueLabelText cobre labels conhecidos e default', () => {
    expect(getQueueLabelText('ready_for_review')).toBe('Pronto para revisao');
    expect(getQueueLabelText(undefined)).toBe('Sem leitura');
  });
});
