import type { ExpertContentPreset } from './types';

export const expertContentPresets: ExpertContentPreset[] = [
  {
    id: 'authority',
    label: 'Autoridade',
    description: 'Constrói confiança com uma opinião forte e um princípio claro.',
    goal: 'Gerar autoridade e fazer o público enxergar o expert como referência.',
    defaultCta: 'Salve para revisar antes da sua próxima decisão importante.',
    narrativePrompt: 'Tom de autoridade: direto, estratégico, com ponto de vista forte e exemplos concretos.',
  },
  {
    id: 'education',
    label: 'Educação',
    description: 'Ensina um conceito importante sem parecer aula genérica.',
    goal: 'Educar o público e aumentar percepção de clareza, método e valor.',
    defaultCta: 'Compartilhe com alguém que precisa entender isso hoje.',
    narrativePrompt: 'Tom didático premium: simples, memorável, com progressão lógica e sem jargão vazio.',
  },
  {
    id: 'objection',
    label: 'Objeção',
    description: 'Quebra uma crença que impede a compra ou a mudança.',
    goal: 'Reduzir uma objeção central e abrir espaço para desejo ou ação.',
    defaultCta: 'Se essa objeção estava te travando, volte para o começo e leia de novo.',
    narrativePrompt: 'Tom provocador: empático, mas firme. Nomeia a objeção e mostra uma nova forma de pensar.',
  },
  {
    id: 'proof',
    label: 'Prova social',
    description: 'Transforma resultado, caso ou bastidor em argumento de confiança.',
    goal: 'Aumentar confiança usando evidência, contraste antes/depois e aprendizado prático.',
    defaultCta: 'Quer ver mais bastidores como esse? Continue acompanhando.',
    narrativePrompt: 'Tom analítico e convincente: mostra evidência, contexto e aprendizado sem exagero.',
  },
  {
    id: 'launch',
    label: 'Lançamento',
    description: 'Cria tensão e desejo para uma oferta, aula ou evento.',
    goal: 'Preparar o público para uma oferta ou chamada sem parecer panfleto.',
    defaultCta: 'Entre na lista de espera para receber os próximos passos.',
    narrativePrompt: 'Tom de lançamento sofisticado: cria urgência com clareza, sem hype vazio.',
  },
  {
    id: 'soft-sell',
    label: 'Venda sutil',
    description: 'Conecta dor, insight e solução sem quebrar a confiança.',
    goal: 'Gerar demanda para a oferta de forma consultiva e elegante.',
    defaultCta: 'Se isso faz sentido para sua fase atual, me chame para conversar.',
    narrativePrompt: 'Tom consultivo: diagnóstico claro, convite natural e autoridade sem pressão.',
  },
];

export function getExpertContentPreset(id: string): ExpertContentPreset {
  return expertContentPresets.find((preset) => preset.id === id) || expertContentPresets[0];
}
