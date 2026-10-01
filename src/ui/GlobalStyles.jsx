import { COLORS } from "./theme.js";

// App-wide CSS: reset, focus rings, keyframes, and the responsive rules that
// inline styles can't express (media queries, :focus-visible, ::placeholder).
export default function GlobalStyles() {
  return (
    <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.bg}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${COLORS.borderHover}; }
        ::placeholder { color: ${COLORS.textDim}; }
        select option { background: ${COLORS.surface}; color: ${COLORS.text}; }
        input:not([type=checkbox]):not([type=radio]), select, textarea { border-color: ${COLORS.fieldBorder}; }
        input:focus, textarea:focus, select:focus { border-color: ${COLORS.gold} !important; }
        /* Keyboard focus is always visible (never remove outlines on controls) */
        :focus-visible { outline: 2px solid ${COLORS.gold}; outline-offset: 2px; }
        a { color: ${COLORS.gold}; }
        /* Cards wrapping a visually hidden radio still show keyboard focus */
        label:has(> input.sr-only:focus-visible) { outline: 2px solid ${COLORS.gold}; outline-offset: 3px; }
        .sr-only { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
        .skeleton { background: linear-gradient(90deg, ${COLORS.card}, ${COLORS.cardHover}, ${COLORS.card}); background-size: 200% 100%; animation: shimmer 1.4s ease-in-out infinite; }
        @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        @media (prefers-reduced-motion: reduce) {
          .skeleton { animation: none; }
          *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
        }
        @keyframes toastIn {
          from { transform: translateX(100px) scale(0.95); opacity: 0; }
          to { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        button:hover { opacity: 0.92; }
        button:active { transform: scale(0.98); }

        @keyframes revealUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @supports (animation-timeline: view()) {
          @media (prefers-reduced-motion: no-preference) {
            .reveal { animation: revealUp linear both; animation-timeline: view(); animation-range: entry 5% cover 25%; }
          }
        }
        @media (max-width: 1024px) {
          .landing-hero-title { font-size: clamp(40px, 6vw, 60px) !important; }
          .app-main { padding: 28px 28px !important; }
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          /* Landing page */
          .landing-hero-title { font-size: 36px !important; }
          .landing-hero-subtitle { font-size: 15px !important; }
          .landing-stats-grid { gap: 20px !important; }
          .landing-steps-grid { grid-template-columns: 1fr !important; }
          .landing-pricing-grid { grid-template-columns: 1fr !important; max-width: 380px !important; }
          .landing-nav { padding: 12px 16px !important; }
          .landing-nav-buttons { gap: 6px !important; }
          /* 44px minimum touch target — small type is fine, small hit areas are not */
          .landing-nav-buttons button { font-size: 12px !important; padding: 10px 14px !important; min-height: 44px; }

          /* App grids stack on phones (inline grid styles need !important here) */
          .two-col { grid-template-columns: 1fr !important; }
          .dash-stats { grid-template-columns: 1fr 1fr !important; }
          .status-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .step-tabs { overflow-x: auto; }
          .step-tabs > button { min-width: 120px; }
          .filters-row > select, .filters-row > button { flex: 1 1 140px; }
          .landing-footer { justify-content: center !important; text-align: center; }

          /* Editorial story spread stacks on small screens */
          .landing-story-grid { grid-template-columns: 1fr !important; }
          .landing-story-grid .landing-story-image { min-height: 260px !important; }
          .landing-story-grid img, .landing-story-image > div:first-of-type { border-radius: 14px 14px 0 0 !important; }

          /* App shell */
          .mobile-menu-btn { display: block !important; }
          .mobile-overlay { display: block !important; }
          .app-sidebar { transform: translateX(-100%); }
          .app-sidebar.open { transform: translateX(0); }
          .app-main { margin-left: 0 !important; padding: 20px 16px !important; padding-top: 56px !important; }
        }
      `}</style>
  );
}
