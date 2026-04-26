import type { CarouselTemplate } from './types';

export const carouselTemplates: CarouselTemplate[] = [
  {
    id: 'paper-manifesto',
    name: 'Manifesto Papel',
    description: 'Preto no off-white, tipografia gigante, textura editorial e corpo com cara de processo criativo.',
    theme: 'light',
    gradient: 'linear-gradient(135deg, #f4f1e8 0%, #ebe5d7 100%)',
    accentColor: '#111111',
    textColor: '#111111',
    badge: 'Manifesto',
    layout: 'editorial',
  },
  {
    id: 'obvious-poster',
    name: 'Poster Óbvio',
    description: 'Imagem editorial em fundo cheio com texto branco enorme, seco e memorável.',
    theme: 'minimal',
    gradient: 'linear-gradient(135deg, #8f8f8a 0%, #555552 100%)',
    accentColor: '#ffffff',
    textColor: '#ffffff',
    badge: 'Poster',
    layout: 'authority',
  },
  {
    id: 'orange-signal',
    name: 'Signal Laranja',
    description: 'Energia comercial com contraste preto, laranja, grid e chamadas fortes para marca/agência.',
    theme: 'bold_gradient',
    gradient: 'linear-gradient(135deg, #060301 0%, #180701 42%, #ff4d00 100%)',
    accentColor: '#ff5a14',
    textColor: '#ffffff',
    badge: 'Signal',
    layout: 'launch',
  },
  {
    id: 'product-editorial',
    name: 'Editorial Foto',
    description: 'Foto como peça central e tipografia de campanha, bom para bastidor, produto, case e prova social.',
    theme: 'minimal',
    gradient: 'linear-gradient(135deg, #b7aea3 0%, #6f665e 100%)',
    accentColor: '#ffffff',
    textColor: '#ffffff',
    badge: 'Foto',
    layout: 'proof',
  },
];

export function getCarouselTemplate(id?: string): CarouselTemplate {
  return carouselTemplates.find((template) => template.id === id) || carouselTemplates[0];
}
