import { useEffect, useState } from "react";
import { useApp } from "../../AppContext.js";
import { COLORS, FONTS, TYPE } from "../../ui/theme.js";
import { Modal, Button, LinkButton } from "../../ui/components.jsx";
import { TOUR_STEPS, TOUR_MAX_VISITS, readTour, writeTour, nextTourVisit } from "../../lib/tour.js";

// A small drawing for each step, built from the site's own colours so it reads
// as part of the product. Decorative: the text carries the meaning.
function Art({ kind }) {
  const g = COLORS.gold, t = COLORS.teal, m = COLORS.textDim, b = COLORS.border, s = COLORS.surface, r = COLORS.urgentText;
  const card = (x, y, w, h, extra = {}) => <rect x={x} y={y} width={w} height={h} rx="8" fill={s} stroke={b} {...extra} />;
  const line = (x, y, w, c = m, h = 6) => <rect x={x} y={y} width={w} height={h} rx="3" fill={c} />;
  const ring = (cx, cy, pct, c) => (<>
    <circle cx={cx} cy={cy} r="16" fill="none" stroke={b} strokeWidth="5" />
    <circle cx={cx} cy={cy} r="16" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${pct} 100.5`} transform={`rotate(-90 ${cx} ${cy})`} />
  </>);
  const scenes = {
    welcome: (<>
      <path d="M30 96 C90 20, 190 20, 290 60" fill="none" stroke={b} strokeWidth="2" strokeDasharray="4 6" />
      {[[42, 88, "1"], [112, 52, "2"], [196, 40, "3"], [278, 58, "4"]].map(([x, y, n]) => (
        <g key={n}><circle cx={x} cy={y} r="15" fill={s} stroke={g} strokeWidth="2" /><text x={x} y={y + 5} textAnchor="middle" fontSize="13" fill={g} fontFamily="sans-serif">{n}</text></g>
      ))}
      {line(26, 112, 34, m, 5)}{line(96, 78, 34, m, 5)}{line(180, 66, 34, m, 5)}{line(262, 84, 34, m, 5)}
    </>),
    profile: (<>
      {card(40, 18, 240, 104)}
      <circle cx="78" cy="52" r="16" fill="none" stroke={g} strokeWidth="2" /><circle cx="78" cy="47" r="5" fill={g} /><path d="M67 62c3-7 19-7 22 0" fill="none" stroke={g} strokeWidth="2" />
      {line(108, 40, 120, COLORS.text)}{line(108, 54, 80)}
      {line(58, 84, 90)}{line(58, 98, 60)}
      <rect x="170" y="78" width="46" height="30" rx="6" fill="none" stroke={t} strokeDasharray="4 3" /><rect x="222" y="78" width="46" height="30" rx="6" fill="none" stroke={t} strokeDasharray="4 3" />
      <text x="193" y="97" textAnchor="middle" fontSize="9" fill={t} fontFamily="sans-serif">Resume</text><text x="245" y="97" textAnchor="middle" fontSize="9" fill={t} fontFamily="sans-serif">Brag</text>
    </>),
    matches: (<>
      {card(30, 14, 260, 48)}{ring(58, 38, 65, t)}<text x="58" y="42" textAnchor="middle" fontSize="11" fill={t} fontFamily="sans-serif">65</text>
      {line(88, 28, 120, COLORS.text)}{line(88, 42, 70)}<rect x="232" y="27" width="46" height="20" rx="6" fill={g} />
      {card(30, 72, 260, 48, { strokeDasharray: "5 4", fill: COLORS.bg })}{ring(58, 96, 40, m)}<text x="58" y="100" textAnchor="middle" fontSize="11" fill={m} fontFamily="sans-serif">40</text>
      {line(88, 86, 110, m)}{line(88, 100, 130, r, 5)}
    </>),
    coach: (<>
      {card(30, 14, 260, 108)}
      {[[2.5, 60, m], [3.0, 150, t], [3.5, 190, m], [3.75, 206, m]].map(([l, w, c], i) => (
        <g key={l}><text x="46" y={40 + i * 22} fontSize="10" fill={c} fontFamily="sans-serif">{l}</text>
          <rect x="74" y={32 + i * 22} width="206" height="10" rx="3" fill={b} /><rect x="74" y={32 + i * 22} width={w} height="10" rx="3" fill={c} /></g>
      ))}
    </>),
    find: (<>
      {card(30, 14, 260, 30)}<circle cx="50" cy="29" r="7" fill="none" stroke={g} strokeWidth="2" /><path d="m55 34 5 5" stroke={g} strokeWidth="2" />{line(70, 26, 130)}
      {card(30, 54, 124, 68)}{line(42, 68, 80, COLORS.text)}{line(42, 82, 60)}{line(42, 96, 90)}
      <rect x="166" y="54" width="124" height="68" rx="8" fill="none" stroke={t} strokeDasharray="5 4" />
      <path d="M228 100V74m0 0-9 9m9-9 9 9" fill="none" stroke={t} strokeWidth="2" strokeLinecap="round" /><text x="228" y="114" textAnchor="middle" fontSize="9" fill={t} fontFamily="sans-serif">Upload or paste</text>
    </>),
    write: (<>
      <rect x="60" y="12" width="200" height="112" rx="6" fill="#f3ecd9" />
      {line(78, 28, 110, "#3a3528")}{line(78, 44, 164, "#8a836f", 5)}{line(78, 56, 150, "#8a836f", 5)}
      <rect x="76" y="66" width="74" height="11" rx="3" fill="#f6d77a" />{line(156, 69, 80, "#8a836f", 5)}
      {line(78, 84, 160, "#8a836f", 5)}{line(78, 96, 120, "#8a836f", 5)}
      <path d="m232 102 22-22 8 8-22 22-10 2z" fill={g} stroke="#3a3528" strokeWidth="1" />
    </>),
    keep: (<>
      {card(30, 16, 120, 104)}<path d="M52 34h22v30l-11-8-11 8z" fill="none" stroke={g} strokeWidth="2" />{line(84, 38, 54, COLORS.text)}{line(84, 52, 40)}{line(46, 80, 88)}{line(46, 94, 64)}
      {card(170, 16, 120, 104)}<rect x="186" y="30" width="88" height="14" rx="3" fill={b} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <rect key={i} x={186 + (i % 4) * 23} y={52 + Math.floor(i / 4) * 26} width="18" height="18" rx="4" fill={i === 5 ? t : "none"} stroke={i === 5 ? t : b} />)}
    </>),
    data: (<>
      <path d="M160 14 214 34v34c0 26-22 44-54 56-32-12-54-30-54-56V34z" fill={s} stroke={t} strokeWidth="2" />
      <path d="m138 68 16 16 30-32" fill="none" stroke={t} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </>),
  };
  return (
    <svg viewBox="0 0 320 136" role="img" aria-hidden="true" style={{ width: "100%", height: "auto", maxHeight: 170, display: "block", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12 }}>
      {scenes[kind] || scenes.welcome}
    </svg>
  );
}

// `active` is true once the visitor is inside the app (not the landing page or
// the parent payment page). The tour opens on the first few visits; "Skip"
// closes it for this visit, and the checkbox stops it for good.
export default function Tour({ active }) {
  const { setView, tourRequest } = useApp();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [never, setNever] = useState(false);

  // Count one visit per browser session, the first time the app opens in it.
  useEffect(() => {
    if (!active) return;
    let counted = false;
    try { counted = sessionStorage.getItem("meritlaunch-tour-seen") === "1"; } catch (e) { /* ignore */ }
    if (counted) return;
    try { sessionStorage.setItem("meritlaunch-tour-seen", "1"); } catch (e) { /* ignore */ }
    const { show, state } = nextTourVisit(readTour(localStorage));
    if (show) { writeTour(localStorage, state); setStep(0); setOpen(true); }
  }, [active]);

  // "Take the tour" in the sidebar reopens it at any time.
  useEffect(() => { if (tourRequest) { setStep(0); setNever(readTour(localStorage).never); setOpen(true); } }, [tourRequest]);

  const close = () => {
    const cur = readTour(localStorage);
    writeTour(localStorage, { ...cur, never });
    setOpen(false);
  };
  const s = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;
  if (!open) return null;
  return (
    <Modal open={open} onClose={close} labelledBy="tour-title" width={520}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>
          Step {step + 1} of {TOUR_STEPS.length}
        </span>
        <LinkButton onClick={close} style={{ fontSize: TYPE.sm }}>Skip the tour</LinkButton>
      </div>
      <Art kind={s.art} />
      <h2 id="tour-title" style={{ fontSize: TYPE.xl, fontWeight: 400, margin: "16px 0 8px" }}>{s.title}</h2>
      <p aria-live="polite" style={{ fontSize: TYPE.base, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6, margin: 0, minHeight: 104 }}>{s.body}</p>

      <div aria-hidden="true" style={{ display: "flex", gap: 6, justifyContent: "center", margin: "14px 0" }}>
        {TOUR_STEPS.map((x, i) => <span key={x.id} style={{ width: i === step ? 18 : 8, height: 8, borderRadius: 4, background: i === step ? COLORS.gold : COLORS.border, transition: "width 0.2s" }} />)}
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
        <Button variant="secondary" onClick={() => setStep(n => Math.max(0, n - 1))} disabled={step === 0} style={{ fontSize: TYPE.sm, padding: "10px 16px" }}>Back</Button>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {s.view && (
            <Button variant="secondary" onClick={() => { setView(s.view); close(); }} style={{ fontSize: TYPE.sm, padding: "10px 16px" }}>Take me there</Button>
          )}
          <Button onClick={() => (last ? close() : setStep(n => n + 1))} style={{ fontSize: TYPE.sm, padding: "10px 20px" }}>{last ? "Finish" : "Next"}</Button>
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${COLORS.border}`, fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, cursor: "pointer" }}>
        <input type="checkbox" checked={never} onChange={e => setNever(e.target.checked)} style={{ width: 18, height: 18, accentColor: COLORS.gold }} />
        Don't show this again
      </label>
      <p style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textDim, margin: "6px 0 0" }}>
        The tour appears on your first {TOUR_MAX_VISITS} visits. You can open it any time from "Take the tour" in the menu.
      </p>
    </Modal>
  );
}
