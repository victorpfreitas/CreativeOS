export type ThemeKey = 'dark' | 'light' | 'vibrant';

export interface ThemeStyle {
  gradient: string;
  overlay: string;
  textColor: string;
  fontFamily: string;
  textShadow: string;
}

export const themeStyles: Record<ThemeKey, ThemeStyle> = {
  dark: {
    gradient: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
    overlay: 'rgba(0,0,0,0.6)',
    textColor: 'white',
    fontFamily: "'Playfair Display', serif",
    textShadow: '0 4px 30px rgba(0,0,0,0.8)',
  },
  light: {
    gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    overlay: 'rgba(255,255,255,0.85)',
    textColor: '#0f172a',
    fontFamily: "'Space Grotesk', sans-serif",
    textShadow: 'none',
  },
  vibrant: {
    gradient: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #3b82f6 100%)',
    overlay: 'rgba(0,0,0,0.3)',
    textColor: 'white',
    fontFamily: "'Outfit', sans-serif",
    textShadow: '0 4px 20px rgba(236,72,153,0.8)',
  },
};
