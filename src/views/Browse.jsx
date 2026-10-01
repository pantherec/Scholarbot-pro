import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { authFetch } from "../lib/api.js";
import { US_STATE_NAMES } from "../data/catalog.js";
import { GlowCard, Badge, LinkButton, AppIcon, Button, SectionHeader } from "../ui/components.jsx";

export default function Browse() {
  const { scholarshipDB, setScholarshipDB, searchQuery, setSearchQuery, importUrl, setImportUrl, importLoading, setImportLoading, filterNeedBased, setFilterNeedBased, filterCountry, setFilterCountry, filterState, setFilterState, showExpired, setShowExpired, browseLimit, setBrowseLimit, setSelectedScholarship, trackedApps, authUser, setView, isPremium, openUpgrade, notify, trackApplication, availableStates, CountryFlag, getDeadlineStatus, expiredCount, filteredScholarships, catalogReady, catalogCount, LinkCheck } = useApp();
  return (
              <div>
                <SectionHeader
                  title="Browse Scholarships"
                  subtitle={catalogReady
                    ? `${filteredScholarships.length.toLocaleString()} of ${catalogCount} scholarships${!showExpired && expiredCount > 0 ? ` · ${expiredCount} closed hidden` : ""}`
                    : "Loading the latest scholarship list..."}
                />

                {/* Disclaimer Banner */}
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "14px 18px", marginBottom: 24, borderRadius: 10,
                  background: `${COLORS.orange}08`, border: `1px solid ${COLORS.orange}22`,
                  fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6,
                }}>
                  <AppIcon name="info" size={18} color={COLORS.gold} style={{ marginTop: 1 }} />
                  <span>
                    <strong style={{ color: COLORS.gold }}>Before you apply:</strong> MeritLaunch aggregates scholarship information from public sources for your convenience. While we work to keep this data accurate, we cannot independently verify every listing. Always confirm eligibility, deadlines, and legitimacy directly with the scholarship provider before applying. <strong>Never pay an application fee for a legitimate scholarship.</strong> Closed listings stay in the catalog because most scholarships are annual, and we re-check each one monthly for a new deadline.
                  </span>
                </div>

                {/* URL Import (Premium) — enforced on the server too */}
                {!isPremium && authUser && (
                  <div style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 16 }}>
                    Found a scholarship somewhere else? <LinkButton onClick={() => openUpgrade(null)}>Import any scholarship from a URL with Premium</LinkButton>, or paste it into Write a Letter for free.
                  </div>
                )}
                {isPremium && (
                  <GlowCard hover={false} glow={COLORS.teal} style={{ padding: "16px 20px", marginBottom: 20 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.teal, marginBottom: 6, fontWeight: 500 }}>
                          ★ Import from URL
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input value={importUrl} onChange={e => setImportUrl(e.target.value)} aria-label="Scholarship page URL"
                            placeholder="Paste a scholarship page URL..."
                            style={{
                              flex: 1, padding: "8px 14px", background: COLORS.surface,
                              border: `1px solid ${COLORS.border}`, borderRadius: 8,
                              color: COLORS.text, fontSize: TYPE.sm, fontFamily: FONTS.body, outline: "none",
                            }}/>
                          <Button disabled={importLoading || !importUrl.trim()} onClick={async () => {
                            setImportLoading(true);
                            try {
                              const resp = await authFetch("/api/import-scholarship", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ url: importUrl.trim() }),
                              });
                              const data = await resp.json();
                              if (resp.ok && data.name) {
                                setScholarshipDB(prev => [data, ...prev]);
                                setImportUrl("");
                                notify(`Imported "${data.name}" — ${data.amount}`, "success");
                              } else {
                                notify(data.error || "Could not extract scholarship info.", "error");
                              }
                            } catch { notify("Import failed. Check the URL and try again.", "error"); }
                            finally { setImportLoading(false); }
                          }} style={{ fontSize: TYPE.xs, padding: "8px 16px" }}>
                            {importLoading ? "Importing..." : "Import"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </GlowCard>
                )}

                {/* Country Filter Tabs */}
                {(() => {
                  const countUS = scholarshipDB.filter(s => (s.country || "US") === "US" || (s.country || "US") === "BOTH").length;
                  const countCA = scholarshipDB.filter(s => (s.country || "US") === "CA" || (s.country || "US") === "BOTH").length;
                  const countBoth = scholarshipDB.filter(s => (s.country || "US") === "BOTH").length;
                  const tabs = [
                    { key: "all", label: "All Scholarships", count: scholarshipDB.length },
                    { key: "US", label: "US", count: countUS, flag: "us" },
                    { key: "CA", label: "Canada", count: countCA, flag: "ca" },
                    { key: "BOTH", label: "US + Canada", count: countBoth },
                  ];
                  return (
                    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                      {tabs.map(tab => {
                        const active = filterCountry === tab.key;
                        return (
                          <button type="button" key={tab.key} aria-pressed={active} onClick={() => setFilterCountry(tab.key)} style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "8px 16px", borderRadius: 20, cursor: "pointer",
                            fontSize: TYPE.sm, fontFamily: FONTS.body, fontWeight: active ? 600 : 400,
                            background: active ? COLORS.goldDim : COLORS.surface,
                            border: `1px solid ${active ? COLORS.gold : COLORS.border}`,
                            color: active ? COLORS.text : COLORS.textMuted, minHeight: 40,
                            transition: "all 0.2s ease",
                          }}>
                            {tab.flag && <img src={`https://flagcdn.com/w40/${tab.flag}.png`} alt={tab.flag} style={{ height: 13, borderRadius: 1 }} />}
                            {tab.key === "BOTH" && <>
                              <img src="https://flagcdn.com/w40/us.png" alt="US" style={{ height: 13, borderRadius: 1 }} />
                              <img src="https://flagcdn.com/w40/ca.png" alt="CA" style={{ height: 13, borderRadius: 1, marginLeft: -3 }} />
                            </>}
                            <span>{tab.label}</span>
                            <span style={{
                              fontSize: TYPE.xs, padding: "1px 7px", borderRadius: 10,
                              background: active ? "rgba(255,255,255,0.12)" : COLORS.border,
                              color: active ? COLORS.text : COLORS.textMuted,
                            }}>{tab.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Search + Filters */}
                <div className="filters-row" style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 260px", position: "relative" }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: COLORS.textMuted }}><AppIcon name="search" size={16} /></span>
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} aria-label="Search scholarships"
                      placeholder="Search name, criteria, amount..."
                      style={{
                        width: "100%", padding: "12px 16px 12px 38px", background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`, borderRadius: 10,
                        color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box",
                      }}/>
                  </div>
                  <select value={filterNeedBased} onChange={e => setFilterNeedBased(e.target.value)} aria-label="Need-based or merit-based"
                    style={{
                      padding: "12px 16px", background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`, borderRadius: 10,
                      color: COLORS.text, fontSize: TYPE.sm, fontFamily: FONTS.body, outline: "none",
                    }}>
                    <option value="all">All Types</option>
                    <option value="need">Need-Based</option>
                    <option value="merit">Merit-Based</option>
                  </select>
                  <button
                    onClick={() => setShowExpired(v => !v)}
                    aria-pressed={!showExpired}
                    title={showExpired ? "Hide scholarships whose deadline has passed (they stay in the catalog and are re-checked monthly)" : "Show scholarships whose deadline has passed"}
                    style={{
                      padding: "12px 16px", background: showExpired ? COLORS.surface : COLORS.pinkDim,
                      border: `1px solid ${showExpired ? COLORS.border : COLORS.pink}`, borderRadius: 10,
                      color: showExpired ? COLORS.textDim : COLORS.pink,
                      fontSize: TYPE.sm, fontFamily: FONTS.body, cursor: "pointer", whiteSpace: "nowrap",
                    }}>
                    {showExpired ? "Hide closed" : "Show closed"}{expiredCount > 0 ? ` (${expiredCount})` : ""}
                  </button>
                  {availableStates.length > 0 && (
                    <select value={filterState} onChange={e => setFilterState(e.target.value)} aria-label="State"
                      title="Show national scholarships plus those for a state you're considering"
                      style={{
                        padding: "12px 16px", background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`, borderRadius: 10,
                        color: COLORS.text, fontSize: TYPE.sm, fontFamily: FONTS.body, outline: "none",
                      }}>
                      <option value="all">All States</option>
                      {availableStates.map(code => (
                        <option key={code} value={code}>{US_STATE_NAMES[code] || code}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Scholarship Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredScholarships.slice(0, browseLimit).map(s => {
                    const dl = getDeadlineStatus(s.deadline);
                    return (
                      <GlowCard key={s.id} style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: TYPE.md, fontWeight: 400, marginBottom: 6, fontFamily: FONTS.heading }}>{s.name}</div>
                          <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 10 }}>
                            {s.criteria.slice(0, 160)}{s.criteria.length > 160 ? "..." : ""}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <CountryFlag country={s.country || "US"} />
                            {s.amount && <Badge color={COLORS.gold}>{s.amount}</Badge>}
                            <Badge color={dl.color}>{dl.label}</Badge>
                            {s.needBased === "Y" && <Badge color={COLORS.teal}>Need-Based</Badge>}
                            <LinkCheck s={s} />
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                          <Button onClick={() => { setSelectedScholarship(s); setView("generate"); }} style={{ fontSize: TYPE.xs, padding: "8px 16px" }}>
                            Apply →
                          </Button>
                          <Button variant="secondary" onClick={() => trackApplication(s)} style={{ fontSize: TYPE.xs, padding: "6px 14px" }}>
                            {trackedApps.some(a => a.scholarshipId === s.id) ? "✓ Tracked" : "Track"}
                          </Button>
                          {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: TYPE.sm, color: COLORS.textMuted, fontFamily: FONTS.body, textAlign: "center", padding: "8px 4px", minHeight: 32 }}>Source ↗<span className="sr-only"> for {s.name} (opens in a new tab)</span></a>}
                        </div>
                      </GlowCard>
                    );
                  })}
                </div>
                {filteredScholarships.length > browseLimit && (
                  <div style={{ textAlign: "center", marginTop: 20 }}>
                    <Button variant="secondary" onClick={() => setBrowseLimit(n => n + 24)}>
                      Show more ({(filteredScholarships.length - browseLimit).toLocaleString()} left)
                    </Button>
                  </div>
                )}
              </div>
  );
}
