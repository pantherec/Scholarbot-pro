// ============================================================
// DESIGN SYSTEM — Phase A: Brand Voice & Visual Identity
// ============================================================
export const COLORS = {
  bg: "#08080d",
  surface: "#0f0f17",
  card: "#141420",
  cardHover: "#1a1a2d",
  border: "#26263b",
  borderHover: "#34344f",
  // Form-field outline: 3:1+ against the panel so a field reads as a field (WCAG 1.4.11).
  fieldBorder: "#62628a",
  gold: "#c9a227",
  goldLight: "#d4b545",
  goldDim: "rgba(201,162,39,0.12)",
  goldGlow: "rgba(201,162,39,0.25)",
  teal: "#4ecdc4",
  tealDim: "rgba(78,205,196,0.12)",
  pink: "#e04040",
  pinkDim: "rgba(224,64,64,0.12)",
  // Readable red for text on dark/tinted grounds (#e04040 measures 4.3:1 there).
  urgentText: "#f47a6f",
  purple: "#4ecdc4",
  purpleDim: "rgba(78,205,196,0.12)",
  orange: "#c9a227",
  text: "#e8e4dc",
  // Both clear 4.5:1 on bg, surface and card (textDim was #555566 at 2.5–2.7:1).
  textMuted: "#aeabbb",
  textDim: "#8f8da2",
  white: "#ffffff",
};

export const FONTS = {
  heading: "'Instrument Serif', Georgia, 'Times New Roman', serif",
  body: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'DM Mono', 'Fira Code', monospace",
};

// Type scale. Every font size in the app comes from here; nothing renders below
// 12px. Roles: xs = captions/eyebrows, sm = secondary text, base = UI text,
// md = reading text and card titles, lg/xl = section heads, 2xl/3xl = page
// sections, 4xl = page titles, display = the landing hero.
export const TYPE = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 38,
  display: 64,
};
