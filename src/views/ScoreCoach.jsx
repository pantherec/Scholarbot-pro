import { useMemo } from "react";
import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { GlowCard, Button, SectionHeader, LinkButton } from "../ui/components.jsx";
import { gpaLadder, ladderSummary, gradeFromGradYear, guidanceFor, gradeLabel, COACH_DISCLAIMER } from "../lib/coach.js";

// Paid: the GPA ladder counted from the live catalog, and guidance cards that
// each name their source. The per-match "Why this score" breakdown is on My
// Matches for every plan.
export default function ScoreCoach() {
  const { profile, scholarshipDB, isPremium, openUpgrade, setView, setLegalModal } = useApp();
  const ladder = useMemo(() => gpaLadder(scholarshipDB), [scholarshipDB]);
  const mine = ladderSummary(ladder, profile.gpa);
  const grade = gradeFromGradYear(profile.gradYear);
  const cards = guidanceFor(grade);
  const text = { fontSize: TYPE.base, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6 };
  const max = Math.max(1, ladder.withMinimum);
  const younger = typeof grade === "number" && grade < 12;

  return (
    <div>
      <SectionHeader title="Score Coach" subtitle={younger
        ? "What to have in place by senior year, counted from our list and from sources we name."
        : "What you can still add this season, counted from our list and from sources we name."} />

      <p style={{ ...text, fontSize: TYPE.sm, maxWidth: 760, margin: "-12px 0 20px" }}>
        {COACH_DISCLAIMER}{" "}<LinkButton onClick={() => setLegalModal("terms")}>Read the terms</LinkButton>.
      </p>

      {!isPremium ? (
        <GlowCard hover={false} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: TYPE.xl, fontWeight: 400, marginBottom: 8 }}>Included with Premium and the Season Pass</h2>
          <ul style={{ ...text, margin: "0 0 14px", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
            <li>Your GPA against our list: how many awards with a stated minimum you meet now, and how many the next step up would open.</li>
            <li>A short list of what to do in {gradeLabel(grade)}, each item tied to a named source such as the U.S. Department of Education.</li>
          </ul>
          <p style={{ ...text, fontSize: TYPE.sm, marginBottom: 14 }}>
            Free on every plan: open My Matches and choose "Why this score" on any match to see the points you earned and the ones you did not.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={() => openUpgrade(null)} style={{ fontSize: TYPE.sm, padding: "10px 18px" }}>See plans</Button>
            <Button variant="secondary" onClick={() => setView("matches")} style={{ fontSize: TYPE.sm, padding: "10px 18px" }}>Go to My Matches</Button>
          </div>
        </GlowCard>
      ) : (
        <>
          <GlowCard hover={false} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: TYPE.xl, fontWeight: 400, marginBottom: 6 }}>Your GPA and our list</h2>
            <p style={{ ...text, fontSize: TYPE.sm, marginBottom: 14 }}>
              {ladder.withMinimum} open awards on our list state a GPA minimum. The bars show how many of those a student meets at each GPA.
            </p>
            <div role="img" aria-label={`Open awards with a stated GPA minimum that a student meets: ${ladder.rungs.map(r => `${r.open} at a ${r.gpa}`).join(", ")}`}
              style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560, fontVariantNumeric: "tabular-nums" }}>
              {ladder.rungs.map((r) => {
                const here = mine.gpa !== undefined && mine.gpa !== null && r.gpa <= mine.gpa && !ladder.rungs.some(o => o.gpa > r.gpa && o.gpa <= mine.gpa);
                return (
                  <div key={r.gpa} style={{ display: "grid", gridTemplateColumns: "48px 1fr 44px", alignItems: "center", gap: 10, fontFamily: FONTS.body, fontSize: TYPE.sm, color: here ? COLORS.teal : COLORS.textMuted }}>
                    <span>{r.gpa.toFixed(2).replace(/0$/, "")}</span>
                    <span style={{ display: "block", height: 14, borderRadius: 3, background: COLORS.border }}>
                      <span style={{ display: "block", height: "100%", width: `${Math.round((r.open / max) * 100)}%`, borderRadius: 3, background: here ? COLORS.teal : COLORS.textDim }} />
                    </span>
                    <strong style={{ textAlign: "right", fontWeight: 700 }}>{r.open}</strong>
                  </div>
                );
              })}
            </div>
            <p style={{ ...text, marginTop: 14, color: COLORS.text }}>
              {mine.now === null
                ? "Add your GPA to your profile to see where you stand."
                : <>At your {String(profile.gpa).trim()} GPA you meet the stated minimum on <strong>{mine.now}</strong> of those {ladder.withMinimum} awards.{" "}
                    {mine.next
                      ? <>A {mine.next.gpa} {younger ? "by senior year " : ""}would open <strong>{mine.next.more} more</strong>.</>
                      : "You already meet every stated minimum on our list."}</>}
            </p>
            <p style={{ ...text, fontSize: TYPE.sm, marginTop: 6 }}>
              Counted from MeritLaunch's catalog today. Every award has other rules as well, and our reading of a listing can be wrong, so check each provider's page.
            </p>
          </GlowCard>

          <h2 style={{ fontSize: TYPE.xl, fontWeight: 400, marginBottom: 12 }}>What providers and official sources say, for {gradeLabel(grade)}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            {cards.map((c) => (
              <GlowCard key={c.id} hover={false} style={{ padding: "16px 20px", borderLeft: `3px solid ${COLORS.gold}` }}>
                <h3 style={{ fontSize: TYPE.md, fontWeight: 400, marginBottom: 6 }}>{c.title}</h3>
                <p style={{ ...text, margin: 0, color: COLORS.text }}>{c.body}</p>
                <p style={{ ...text, fontSize: TYPE.xs, margin: "8px 0 0" }}>
                  Source: <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.gold }}>{c.source}</a>
                </p>
              </GlowCard>
            ))}
          </div>
          <p style={{ ...text, fontSize: TYPE.sm, maxWidth: 760 }}>
            One provider's criteria do not describe every provider. To see what a specific award is looking for, open My Matches and choose "Why this score".
          </p>
        </>
      )}
    </div>
  );
}
