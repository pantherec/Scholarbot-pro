import { useState, useEffect, useRef, Component } from "react";
import { COLORS, FONTS, TYPE } from "./theme.js";
import { trackError } from "../analytics.js";

// ============================================================
// REUSABLE UI COMPONENTS
// ============================================================
export function GlowCard({ children, style, hover = true, onClick, glow = COLORS.gold }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hover && setHovered(true)}
      onMouseLeave={() => hover && setHovered(false)}
      style={{
        background: COLORS.card,
        border: `1px solid ${hovered ? glow + "44" : COLORS.border}`,
        borderRadius: 14,
        padding: 24,
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hovered ? `0 12px 40px ${glow}15` : "none",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Badge({ children, color = COLORS.gold, style }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 10px", borderRadius: 6, fontSize: TYPE.xs,
      fontFamily: FONTS.body, fontWeight: 600,
      background: color + "18", color: color,
      ...style,
    }}>
      {children}
    </span>
  );
}

// Custom stroke icon set — replaces the unicode glyphs (◇ ◈ ⬡ ◆ …) that used to
// carry the app chrome, so weight, caps, and color stay uniform everywhere.
export const ICON_PATHS = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-5.5h5V21"/></>,
  profile: <><circle cx="12" cy="7.5" r="3.5"/><path d="M4.5 20.5c0-3.6 3.3-6 7.5-6s7.5 2.4 7.5 6"/></>,
  search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/></>,
  matches: <><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 11.6v.8"/></>,
  apply: <><rect x="6" y="4.5" width="12" height="16.5" rx="2"/><path d="M9.5 4.5a2.5 2.5 0 0 1 5 0"/><path d="m9 13.5 2 2 4-4.5"/></>,
  generate: <><path d="M4 20l1.2-4.2L16.7 4.3a2 2 0 0 1 2.9 2.9L8.2 18.7 4 20z"/><path d="m14.5 6.5 3 3"/></>,
  templates: <><path d="m12 3.5 8.5 4.7L12 13 3.5 8.2 12 3.5z"/><path d="M3.5 12.5 12 17.3l8.5-4.8"/><path d="M3.5 16.5 12 21.3l8.5-4.8"/></>,
  saved: <path d="M6.5 3.5h11V21L12 16.7 6.5 21V3.5z"/>,
  tracker: <><rect x="3.5" y="4" width="4.6" height="12" rx="1"/><rect x="9.7" y="4" width="4.6" height="16.5" rx="1"/><rect x="15.9" y="4" width="4.6" height="8" rx="1"/></>,
  science: <><path d="M9.5 3.5h5"/><path d="M10.5 3.5v5.2L5.2 18.2A1.6 1.6 0 0 0 6.6 20.5h10.8a1.6 1.6 0 0 0 1.4-2.3L13.5 8.7V3.5"/><path d="M7.6 14h8.8"/></>,
  rise: <><path d="M4 18 10 12l3.5 3.5L20 9"/><path d="M15 9h5v5"/></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17"/><path d="M8 3v4M16 3v4"/></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5"/>,
  menu: <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
  close: <><path d="m6 6 12 12"/><path d="M18 6 6 18"/></>,
  upload: <><path d="M12 15.5V4.5"/><path d="m7.5 9 4.5-4.5L16.5 9"/><path d="M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"/></>,
  doc: <><path d="M7 3.5h7l4.5 4.5V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M14 3.5V8h4.5"/><path d="M9 13h6M9 16.5h6"/></>,
  info: <><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.6v.4"/></>,
};

// Brand mark: the gold serif monogram used in the nav, sidebar, favicon and OG image.
export function BrandMark({ size = 26 }) {
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: 6, background: "#0A0A0F",
      border: "1px solid rgba(201,162,39,0.45)", display: "inline-flex",
      alignItems: "center", justifyContent: "center", color: "#c9a227",
      fontFamily: "'Instrument Serif', Georgia, serif", fontSize: size * 0.72, lineHeight: 1, flexShrink: 0,
    }}>M</span>
  );
}

// Accessible dialog: labelled, modal, traps Tab, closes on Escape (unless
// `locked`), and returns focus to whatever opened it.
export function Modal({ open, onClose, labelledBy, locked = false, children, width = 420, align = "center" }) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement;
    const focusables = () => [...(panelRef.current?.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) || [])];
    const first = focusables()[0];
    (first || panelRef.current)?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !locked) { e.stopPropagation(); onClose?.(); return; }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const firstEl = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (opener && typeof opener.focus === "function") opener.focus();
    };
  }, [open, locked]);
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000, padding: 16,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
    }} onClick={() => { if (!locked) onClose?.(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}
        onClick={e => e.stopPropagation()} style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16,
          padding: 32, width, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)", textAlign: align, outline: "none",
        }}>
        {children}
      </div>
    </div>
  );
}

// Text-styled control that is a real button (keyboard reachable, announced).
export function LinkButton({ children, onClick, style }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: "none", border: "none", padding: 0, cursor: "pointer",
      color: COLORS.gold, font: "inherit", textDecoration: "underline", textUnderlineOffset: 2, ...style,
    }}>{children}</button>
  );
}
export function AppIcon({ name, size = 18, color = "currentColor", strokeWidth = 1.7, style }) {
  const paths = ICON_PATHS[name];
  if (!paths) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0, ...style }} aria-hidden="true">
      {paths}
    </svg>
  );
}

// Landing letter demo — surfaces the product's signature streaming-letter moment
// on the marketing page as a short scripted loop over a labeled sample profile.
// Renders the full text statically when the visitor prefers reduced motion.
export const DEMO_LETTER = "The first thing I ever fixed was a grain auger. Nine at night, rain coming, flashlight in my teeth.\n\nMy robotics coach says I engineer like a farmer. He means I fix things with whatever is on hand. I want to study agricultural engineering so that next time, the fix starts before the bolt shears.";
export function LetterDemo() {
  const [chars, setChars] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setChars(DEMO_LETTER.length);
      return;
    }
    let i = 0, timer;
    const tick = () => {
      i += 1;
      setChars(i);
      if (i < DEMO_LETTER.length) {
        timer = setTimeout(tick, 26 + (".!?\n".includes(DEMO_LETTER[i - 1]) ? 180 : 0));
      } else {
        timer = setTimeout(() => { i = 0; setChars(0); timer = setTimeout(tick, 400); }, 4200);
      }
    };
    timer = setTimeout(tick, 800);
    return () => clearTimeout(timer);
  }, []);
  const done = chars >= DEMO_LETTER.length;
  return (
    <div style={{
      maxWidth: 640, margin: "0 auto", background: COLORS.card,
      border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden",
      textAlign: "left",
    }}>
      <div style={{
        padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`,
        fontFamily: FONTS.mono, fontSize: TYPE.xs, color: COLORS.textDim, letterSpacing: 0.5,
        display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
      }}>
        <span style={{ color: COLORS.teal }}>SAMPLE PROFILE</span>
        <span>FFA vice president · robotics captain · first-gen · Hartley, IA</span>
      </div>
      <div style={{
        padding: "26px 28px", fontFamily: FONTS.heading, fontSize: TYPE.lg, lineHeight: 1.65,
        color: COLORS.text, whiteSpace: "pre-wrap", minHeight: 178,
      }}>
        {DEMO_LETTER.slice(0, chars)}
        <span style={{
          display: "inline-block", width: 2, height: "1.05em", background: COLORS.gold,
          verticalAlign: "text-bottom", marginLeft: 2,
          animation: done ? "blink 1.1s step-end infinite" : "none",
        }} />
      </div>
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", disabled, style, icon, ...rest }) {
  const styles = {
    primary: {
      background: disabled ? COLORS.textDim : `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})`,
      color: COLORS.bg, fontWeight: 700, border: "none",
      boxShadow: disabled ? "none" : `0 4px 20px ${COLORS.goldGlow}`,
    },
    secondary: {
      background: "transparent", color: COLORS.gold,
      border: `1px solid ${COLORS.gold}44`, fontWeight: 600,
    },
    ghost: {
      background: "transparent", color: COLORS.textMuted,
      border: `1px solid ${COLORS.border}`, fontWeight: 500,
    },
    danger: {
      background: "transparent", color: COLORS.pink,
      border: `1px solid ${COLORS.pink}44`, fontWeight: 600,
    },
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} {...rest} style={{
      padding: "12px 24px", borderRadius: 10, fontSize: TYPE.base,
      fontFamily: FONTS.body, cursor: disabled ? "not-allowed" : "pointer",
      display: "inline-flex", alignItems: "center", gap: 8,
      transition: "all 0.2s", ...styles[variant], ...style,
    }}>
      {icon && <span style={{ fontSize: TYPE.md }}>{icon}</span>}
      {children}
    </button>
  );
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
      <div>
        <h1 style={{
          fontSize: TYPE["4xl"], fontWeight: 400, fontFamily: FONTS.heading,
          lineHeight: 1.15, marginBottom: subtitle ? 6 : 0,
          background: `linear-gradient(135deg, ${COLORS.text}, ${COLORS.gold})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontFamily: FONTS.body, fontSize: TYPE.md, color: COLORS.textMuted, lineHeight: 1.5, maxWidth: 520 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, desc, action, actionLabel }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ width: 72, height: 72, margin: "0 auto 18px", borderRadius: "50%", background: COLORS.goldDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <AppIcon name={icon} size={32} color={COLORS.gold} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: TYPE.xl, fontFamily: FONTS.heading, color: COLORS.text, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: TYPE.base, fontFamily: FONTS.body, color: COLORS.textMuted, maxWidth: 360, margin: "0 auto 24px", lineHeight: 1.6 }}>{desc}</div>
      {action && <Button onClick={action}>{actionLabel}</Button>}
    </div>
  );
}

export function ProgressRing({ value, size = 52, color = COLORS.teal }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={COLORS.border} strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)" }} />
    </svg>
  );
}

// Fallback shown when a render error is caught. Fully inline-styled so it never
// depends on anything the crashed subtree was providing.
export function ErrorFallback({ onReset, onReload }) {
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONTS.body }}>
      <div style={{ maxWidth: 460, textAlign: "center", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: "40px 32px" }}>
        <div style={{ fontSize: TYPE["4xl"], marginBottom: 12 }}>&#9888;&#65039;</div>
        <div style={{ fontSize: TYPE.xl, fontFamily: FONTS.heading, color: COLORS.gold, marginBottom: 10 }}>Something went wrong</div>
        <div style={{ fontSize: TYPE.base, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 24 }}>
          This page hit an unexpected error. You&#39;re still signed in &mdash; try again to pick up where you left off.
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onReset} style={{ padding: "12px 24px", borderRadius: 10, border: "none", cursor: "pointer", background: COLORS.gold, color: COLORS.bg, fontSize: TYPE.base, fontWeight: 600, fontFamily: FONTS.body }}>Try again</button>
          <button onClick={onReload} style={{ padding: "12px 24px", borderRadius: 10, cursor: "pointer", background: "transparent", color: COLORS.textMuted, fontSize: TYPE.base, fontFamily: FONTS.body, border: `1px solid ${COLORS.border}` }}>Reload page</button>
        </div>
      </div>
    </div>
  );
}

// Without a boundary, ANY render-time throw unmounts the whole React tree and
// leaves a blank white page — which is what stranded the user mid-letter and
// forced a reload (and, on reload, a fresh session-restore that could time out
// and "log them out"). This contains such a throw to a recoverable card and
// reports the real stack so we can pinpoint and fix the underlying cause.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("MeritLaunch render error:", error, info?.componentStack);
    trackError(error, { componentStack: (info?.componentStack || "").slice(0, 3000) });
  }
  handleReset = () => {
    this.setState({ hasError: false });
    if (this.props.onReset) this.props.onReset();
  };
  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReset={this.handleReset} onReload={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
