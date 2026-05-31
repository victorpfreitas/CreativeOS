import type { ExpertVoicePost } from './types';

export function compactVoiceText(value?: string) {
  return (value || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function splitVoiceSamples(text: string) {
  return text
    .split(/\n\s*\n/g)
    .map((sample) => compactVoiceText(sample))
    .filter((sample) => sample.length >= 30);
}

export function uniqueVoiceSamples(posts: ExpertVoicePost[], legacySamples: string[] = []) {
  const seen = new Set<string>();
  const result: string[] = [];
  const add = (value?: string) => {
    const text = compactVoiceText(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    result.push(text);
  };

  posts
    .filter((post) => post.is_reference !== false && post.memory_kind !== 'rejected_or_ai_only')
    .forEach((post) => add(post.text));
  legacySamples.forEach(add);
  return result;
}

export function voiceMemoryHealth(posts: ExpertVoicePost[], legacySamples: string[] = []) {
  const samples = uniqueVoiceSamples(posts, legacySamples);
  const realPosts = posts.filter((post) => (post.memory_kind || 'real_post') === 'real_post' && post.is_reference !== false).length;
  const approvedDrafts = posts.filter((post) => post.memory_kind === 'approved_draft' && post.is_reference !== false).length;
  const rejected = posts.filter((post) => post.memory_kind === 'rejected_or_ai_only' || post.is_reference === false).length;
  const openings = new Set(samples.map((sample) => sample.split(/\n|[.!?]/)[0]?.slice(0, 60).toLowerCase()).filter(Boolean));
  const variety = openings.size;
  const score = Math.min(100, Math.round(realPosts * 5 + approvedDrafts * 2 + variety * 3 - rejected * 2));
  const label = score >= 75 ? 'forte' : score >= 40 ? 'utilizável' : 'fraca';
  const tone = score >= 75 ? 'emerald' : score >= 40 ? 'amber' : 'red';

  return {
    score,
    label,
    tone: tone as 'emerald' | 'amber' | 'red',
    samples,
    realPosts,
    approvedDrafts,
    rejected,
    variety,
    detail: score >= 75
      ? 'Boa base para escrever com voz própria.'
      : score >= 40
        ? 'Já ajuda, mas ainda precisa de mais posts reais.'
        : 'Pouco repertório real. A IA tende a cair no genérico.',
  };
}

export function buildVoiceProfile(samples: string[]) {
  const cleaned = samples.map((sample) => compactVoiceText(sample)).filter(Boolean);
  if (!cleaned.length) return '';

  const avgLength = Math.round(cleaned.reduce((sum, sample) => sum + sample.length, 0) / cleaned.length);
  const hasShortLines = cleaned.filter((sample) => sample.split('\n').some((line) => line.trim().length > 0 && line.trim().length < 70)).length;
  const hasQuestions = cleaned.filter((sample) => sample.includes('?')).length;
  const hasFirstPerson = cleaned.filter((sample) => /\b(eu|meu|minha|pra mim|no meu|acho|percebi)\b/i.test(sample)).length;

  return [
    `Perfil consolidado a partir de ${cleaned.length} textos de referência únicos.`,
    `Tamanho médio: ${avgLength} caracteres.`,
    hasShortLines >= cleaned.length / 2 ? 'Costuma usar linhas curtas e quebras para dar ritmo.' : 'Costuma desenvolver mais a ideia em parágrafos.',
    hasQuestions ? 'Usa perguntas como recurso de raciocínio, sem depender de chamada genérica.' : 'Não depende de perguntas para abrir os posts.',
    hasFirstPerson ? 'Tem marca de experiência própria e bastidor em primeira pessoa.' : 'A voz tende a ser mais analítica do que confessional.',
    'Priorizar vocabulário, ritmo e cortes presentes nos posts reais. Evitar frases prontas, hype e tom de marca.',
  ].join('\n');
}
