import type { CarouselTemplate } from './types';

export const carouselTemplates: CarouselTemplate[] = [
  {
    id: 'paper-manifesto',
    name: 'Manifesto Papel',
    description: 'Off-white, textura sutil, tipografia forte e estrutura editorial com bastante respiro.',
    theme: 'light',
    gradient: 'linear-gradient(135deg, #f4f1e8 0%, #ebe5d7 100%)',
    accentColor: '#111111',
    textColor: '#111111',
    badge: 'Manifesto',
    layout: 'editorial',
  },
];

export function getCarouselTemplate(id?: string): CarouselTemplate {
  return carouselTemplates.find((template) => template.id === id) || carouselTemplates[0];
}
