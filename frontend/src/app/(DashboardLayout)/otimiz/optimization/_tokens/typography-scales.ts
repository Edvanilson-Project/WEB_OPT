/**
 * Design tokens para tipografia e espaçamento enterprise
 * Refinamentos de alto nível para UI professionalização
 */

export const TYPOGRAPHY_SCALES = {
  /** Para labels pequenos e contadores */
  sectionLabel: {
    fontSize: '0.65rem',
    fontWeight: 900,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    lineHeight: 1.2,
  },

  /** Para títulos de seção secondary */
  sectionSubtitle: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: 0.5,
    lineHeight: 1.25,
  },

  /** Para descrições gerais */
  description: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    lineHeight: 1.45,
  },

  /** Para timestamps e info metadada */
  metadata: {
    fontSize: '0.75rem',
    fontWeight: 500,
    lineHeight: 1.2,
  },

  /** Para valores principais (duração, contadores) */
  value: {
    fontSize: '0.875rem',
    fontWeight: 700,
    lineHeight: 1.3,
  },

  /** Para hints e tooltips */
  hint: {
    fontSize: '0.7rem',
    fontWeight: 500,
    lineHeight: 1.3,
    opacity: 0.75,
  },
};

export const SPACING_SCALES = {
  /** Espaçamento muito compacto (inputs, badges) */
  compact: {
    padding: '0.25rem 0.5rem',
    gap: 0.5,
  },

  /** Espaçamento compacto (botões, chips pequeños) */
  normal: {
    padding: '0.5rem 0.75rem',
    gap: 0.75,
  },

  /** Espaçamento espaçoso (cards, paineis) */
  comfortable: {
    padding: '1rem',
    gap: 1.5,
  },

  /** Espaçamento relaxado (seções principais) */
  relaxed: {
    padding: '1.5rem',
    gap: 2.5,
  },
};

/**
 * Helper para aplicar tipografia com classe/sx
 */
export function getTypographySx(scale: keyof typeof TYPOGRAPHY_SCALES) {
  const s = TYPOGRAPHY_SCALES[scale] as {
    fontSize: string; fontWeight: number; lineHeight: number;
    letterSpacing?: number; textTransform?: string; opacity?: number;
  };
  return {
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    letterSpacing: s.letterSpacing ?? 0,
    textTransform: s.textTransform ?? 'none',
    lineHeight: s.lineHeight,
  };
}
