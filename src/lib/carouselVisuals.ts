export interface CarouselFontPreset {
  id: string;
  name: string;
  description: string;
  displayFont: string;
  bodyFont: string;
  titleWeight: number;
  bodyWeight: number;
  letterSpacing: string;
}

export interface CarouselColorPalette {
  id: string;
  name: string;
  description: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  line: string;
  textureOpacity: number;
}

export const defaultFontPresetId = 'grotesk-bold';
export const defaultColorPaletteId = 'paper-ink';

export const carouselFontPresets: CarouselFontPreset[] = [
  {
    id: 'grotesk-bold',
    name: 'Grotesca Forte',
    description: 'Peso alto, leitura rápida e impacto de manifesto.',
    displayFont: 'Inter, Arial Black, Arial, sans-serif',
    bodyFont: 'Inter, Arial, sans-serif',
    titleWeight: 950,
    bodyWeight: 760,
    letterSpacing: '-0.045em',
  },
  {
    id: 'editorial-serif',
    name: 'Editorial Serifada',
    description: 'Contraste de revista com corpo limpo e premium.',
    displayFont: 'Georgia, Times New Roman, serif',
    bodyFont: 'Inter, Arial, sans-serif',
    titleWeight: 800,
    bodyWeight: 620,
    letterSpacing: '-0.035em',
  },
  {
    id: 'clean-authority',
    name: 'Autoridade Limpa',
    description: 'Mais sóbria, precisa e fácil de ler em textos maiores.',
    displayFont: 'Arial, Helvetica, sans-serif',
    bodyFont: 'Arial, Helvetica, sans-serif',
    titleWeight: 900,
    bodyWeight: 650,
    letterSpacing: '-0.03em',
  },
];

export const carouselColorPalettes: CarouselColorPalette[] = [
  {
    id: 'paper-ink',
    name: 'Papel e Tinta',
    description: 'O manifesto clássico em off-white e preto.',
    background: '#f4f0e6',
    surface: '#fffaf0',
    text: '#111111',
    muted: '#57534a',
    accent: '#111111',
    line: '#111111',
    textureOpacity: 0.28,
  },
  {
    id: 'clay-editorial',
    name: 'Argila Editorial',
    description: 'Off-white com destaque quente, inspirado em editoriais minimalistas.',
    background: '#f7f2ea',
    surface: '#fff8ee',
    text: '#111827',
    muted: '#5f625d',
    accent: '#d37f50',
    line: '#111827',
    textureOpacity: 0.22,
  },
  {
    id: 'olive-proof',
    name: 'Oliva Prova',
    description: 'Sério e orgânico, bom para autoridade e método.',
    background: '#f3f0e6',
    surface: '#fbf7ec',
    text: '#17211b',
    muted: '#596257',
    accent: '#6f7f4f',
    line: '#17211b',
    textureOpacity: 0.24,
  },
  {
    id: 'night-paper',
    name: 'Papel Noturno',
    description: 'Versão escura para frases fortes e contraste alto.',
    background: '#111111',
    surface: '#171717',
    text: '#f4f0e6',
    muted: '#c8c0ae',
    accent: '#d37f50',
    line: '#f4f0e6',
    textureOpacity: 0.18,
  },
];

export function getCarouselFontPreset(id?: string): CarouselFontPreset {
  return carouselFontPresets.find((preset) => preset.id === id) || carouselFontPresets[0];
}

export function getCarouselColorPalette(id?: string): CarouselColorPalette {
  return carouselColorPalettes.find((palette) => palette.id === id) || carouselColorPalettes[0];
}
