/**
 * Nexus AI — Premium Design Tokens v2
 * Cyan → Indigo → Violet spectrum, dark glassmorphism
 */
export const nexus = {
  colors: {
    bg: {
      deepest: '#050510',
      primary: '#0a0b1e',
      secondary: '#11132b',
      tertiary: '#1a1d3a',
      glass: 'rgba(255, 255, 255, 0.025)',
      glassHover: 'rgba(255, 255, 255, 0.05)',
    },
    accent: {
      cyan: '#00d4ff',
      blue: '#3b82f6',
      indigo: '#6366f1',
      violet: '#8b5cf6',
      purple: '#a78bfa',
    },
    text: {
      primary: '#e8ecf2',
      secondary: '#8892a8',
      muted: '#4a5068',
      accent: '#00d4ff',
    },
    border: {
      subtle: 'rgba(255, 255, 255, 0.04)',
      default: 'rgba(255, 255, 255, 0.08)',
      active: 'rgba(0, 212, 255, 0.25)',
      glow: 'rgba(99, 102, 241, 0.3)',
    },
    semantic: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
    agent: {
      main: '#6366f1',
      research: '#00d4ff',
      coder: '#22c55e',
      data: '#f59e0b',
      security: '#ef4444',
      devops: '#8b5cf6',
      pm: '#ec4899',
      tester: '#14b8a6',
      docs: '#f97316',
      paper: '#a855f7',
    },
  },
  typography: {
    fontFamily: {
      display: '"Clash Display", "Inter", system-ui, sans-serif',
      body: '"Inter", system-ui, sans-serif',
      mono: '"JetBrains Mono", "Fira Code", monospace',
    },
  },
  glass: {
    card: 'bg-[rgba(255,255,255,0.025)] backdrop-blur-xl border border-[rgba(255,255,255,0.06)] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.3)]',
    cardHover: 'hover:border-[rgba(0,212,255,0.15)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(0,212,255,0.1)] transition-all duration-300',
    input: 'bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#e8ecf2] placeholder-[#4a5068] focus:border-[rgba(0,212,255,0.4)] focus:shadow-[0_0_0_3px_rgba(0,212,255,0.1)] focus:bg-[rgba(255,255,255,0.06)] outline-none transition-all duration-200',
    separator: 'h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.08)] to-transparent',
    panel: 'bg-[rgba(255,255,255,0.02)] backdrop-blur-xl border border-[rgba(255,255,255,0.04)] rounded-2xl',
  },
  button: {
    primary: 'bg-gradient-to-r from-[#00d4ff] via-[#6366f1] to-[#8b5cf6] text-white font-semibold rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_24px_rgba(0,212,255,0.35)] hover:brightness-110 active:translate-y-0',
    ghost: 'bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] text-[#8892a8] font-medium rounded-xl transition-all duration-200 hover:bg-[rgba(255,255,255,0.08)] hover:text-[#e8ecf2] hover:border-[rgba(255,255,255,0.15)]',
    danger: 'bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)] text-[#fca5a5] font-medium rounded-xl transition-all duration-200 hover:bg-[rgba(239,68,68,0.25)]',
    icon: 'p-2 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#8892a8] hover:text-[#e8ecf2] hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] transition-all duration-200',
  },
  text: {
    primary: 'text-[#e8ecf2]',
    secondary: 'text-[#8892a8]',
    muted: 'text-[#4a5068]',
    accent: 'text-[#00d4ff]',
    gradient: 'bg-gradient-to-r from-[#00d4ff] to-[#a78bfa] bg-clip-text text-transparent',
  },
  animation: {
    duration: { instant: '0.1s', fast: '0.15s', normal: '0.25s', slow: '0.4s', slower: '0.6s' },
    easing: { default: 'cubic-bezier(0.16,1,0.3,1)', spring: 'cubic-bezier(0.34,1.56,0.64,1)', smooth: 'cubic-bezier(0.4,0,0.2,1)' },
  },
  radius: { sm: '0.375rem', md: '0.5rem', lg: '0.75rem', xl: '1rem', '2xl': '1.25rem', full: '9999px' },
  z: { base: 0, dropdown: 10, sticky: 20, sidebar: 30, modal: 40, tooltip: 50, toast: 60, palette: 70 },
} as const;

// Shorthand tw classes for quick use
export const nx = {
  card: `${nexus.glass.card} ${nexus.glass.cardHover}`,
  btn: nexus.button.primary,
  btnGhost: nexus.button.ghost,
  input: nexus.glass.input,
  heading: 'font-display font-semibold tracking-tight',
  badge: 'px-2 py-0.5 rounded-lg text-xs font-medium',
} as const;
