import type { CarouselTemplate } from './types';

export const carouselTemplates: CarouselTemplate[] = [
  {
    id: 'authority-dark',
    name: 'Authority Dark',
    description: 'Editorial escuro para opinião forte e carrosséis de autoridade.',
    theme: 'dark',
    gradient: 'linear-gradient(135deg, #050505 0%, #111827 55%, #312e81 100%)',
    accentColor: '#a78bfa',
    textColor: '#ffffff',
    badge: 'Autoridade',
    layout: 'authority',
  },
  {
    id: 'editorial-light',
    name: 'Editorial Light',
    description: 'Visual limpo para educação e frameworks de alto valor.',
    theme: 'light',
    gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    accentColor: '#0f172a',
    textColor: '#0f172a',
    badge: 'Framework',
    layout: 'editorial',
  },
  {
    id: 'proof-lab',
    name: 'Proof Lab',
    description: 'Template de prova, análise e antes/depois com cara premium.',
    theme: 'minimal',
    gradient: 'linear-gradient(135deg, #111111 0%, #1f2937 60%, #065f46 100%)',
    accentColor: '#34d399',
    textColor: '#ffffff',
    badge: 'Prova',
    layout: 'proof',
  },
  {
    id: 'launch-signal',
    name: 'Launch Signal',
    description: 'Visual com energia para oferta, evento, aula ou lista de espera.',
    theme: 'bold_gradient',
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 50%, #db2777 100%)',
    accentColor: '#fbbf24',
    textColor: '#ffffff',
    badge: 'Lançamento',
    layout: 'launch',
  },
  {
    id: 'minimal-premium',
    name: 'Minimal Premium',
    description: 'Capa sóbria para insights diretos e venda sutil.',
    theme: 'minimal',
    gradient: 'linear-gradient(135deg, #0a0a0a 0%, #171717 100%)',
    accentColor: '#f5f5f5',
    textColor: '#ffffff',
    badge: 'Insight',
    layout: 'minimal',
  },
];

export function getCarouselTemplate(id?: string): CarouselTemplate {
  return carouselTemplates.find((template) => template.id === id) || carouselTemplates[0];
}
