export type ThemeKey = 'dark' | 'light' | 'vibrant' | 'minimal' | 'bold_gradient';

export interface ThemeStyle {
  name: string;
  gradient: string;
  overlay: string;
  textColor: string;
  hookFont: string;
  bodyFont: string;
  textShadow: string;
  accentColor: string;
}

export const themeStyles: Record<ThemeKey, ThemeStyle> = {
  dark: {
    name: 'Dark Premium',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
    overlay: 'rgba(0,0,0,0.65)',
    textColor: 'white',
    hookFont: "'Playfair Display', serif",
    bodyFont: "'Inter', sans-serif",
    textShadow: '0 4px 30px rgba(0,0,0,0.8)',
    accentColor: '#818cf8',
  },
  light: {
    name: 'Light Clean',
    gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    overlay: 'rgba(255,255,255,0.85)',
    textColor: '#0f172a',
    hookFont: "'Space Grotesk', sans-serif",
    bodyFont: "'Inter', sans-serif",
    textShadow: 'none',
    accentColor: '#4f46e5',
  },
  vibrant: {
    name: 'Neon Vibrant',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #3b82f6 100%)',
    overlay: 'rgba(0,0,0,0.3)',
    textColor: 'white',
    hookFont: "'Outfit', sans-serif",
    bodyFont: "'Inter', sans-serif",
    textShadow: '0 4px 20px rgba(236,72,153,0.8)',
    accentColor: '#f472b6',
  },
  minimal: {
    name: 'Modern Minimal',
    gradient: 'linear-gradient(to bottom, #111111, #111111)',
    overlay: 'rgba(0,0,0,0.4)',
    textColor: 'white',
    hookFont: "'Inter', sans-serif",
    bodyFont: "'Inter', sans-serif",
    textShadow: 'none',
    accentColor: '#ffffff',
  },
  bold_gradient: {
    name: 'Bold Editorial',
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
    overlay: 'rgba(0,0,0,0.5)',
    textColor: 'white',
    hookFont: "'Archivo Black', sans-serif",
    bodyFont: "'Inter', sans-serif",
    textShadow: '0 10px 40px rgba(0,0,0,0.5)',
    accentColor: '#fbbf24',
  },
};
