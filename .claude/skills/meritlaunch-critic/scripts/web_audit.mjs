// web_audit.mjs — evidence harness for the product critics (juripath-critic, meritlaunch-critic).
// MeritLaunch copy of shared-bases/scripts/web_audit.mjs, plus two portability options:
//   --chrome <path>   launch this Chromium binary instead of the installed Chrome channel
//                     (cloud sandbox: /opt/pw-browsers/chromium-*/chrome-linux/chrome)
//   --proxy <origin>  for sandboxes where the browser itself has no internet: Supabase and other
//                     external requests are fetched by Node and fulfilled, and local /api/* calls
//                     are sent to <origin> (e.g. https://meritlaunch.com). Read-only use only.
//
// Drives the REAL pages in headless Chrome (playwright-core + the installed Chrome), at phone and
// desktop sizes, and writes screenshots plus measured facts a critic can cite:
//   load: FCP, LCP, CLS, transfer bytes, DOM size · errors: console errors, page errors, failed
//   requests · accessibility: missing alt / labels / accessible names, heading order, html lang,
//   tap targets < 24 px, text contrast below WCAG AA, text < 12 px · layout: sideways scroll ·
//   metadata: title, description, canonical, Open Graph · optional axe-core if AXE_PATH is set.
//
// Usage:
//   node web_audit.mjs --url http://127.0.0.1:5871 --out <tmp dir> [--journey journey.json]
//        [--viewports 390x844,1440x900] [--storage session:jp_review=1] [--pw <dir with playwright-core>]
//
// A journey file lists pages to capture, each reached by optional steps from its path:
//   [{ "name": "landing", "path": "/" },
//    { "name": "wizard", "path": "/", "steps": [{ "click": "text=Start" }, { "wait": 800 }] }]
// Step verbs: click (selector), fill ([selector, value]), select ([selector, value]), press ([selector, key]), wait (ms),
// waitFor (selector), scroll ("bottom"). Selectors are Playwright selectors ("text=…", CSS, role=…).
//
// READ-ONLY by design: it loads pages and reads them. It never signs up, logs in, pays or submits a
// form that leaves the machine; journeys must not either (see the critic skills' access rules).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const base = arg('url');
const out = arg('out');
if (!base || !out) { console.error('usage: node web_audit.mjs --url <base url> --out <dir> [--journey file]'); process.exit(2); }
mkdirSync(out, { recursive: true });

const pwDir = arg('pw', 'C:/Users/corey/Documents/Claude/Projects/AI supported Legal Repository Project/juripath-app');
const req = createRequire(join(pwDir, 'package.json'));
const { chromium } = req('playwright-core');

const viewports = arg('viewports', '390x844,1440x900').split(',').map((v) => {
  const [w, h] = v.split('x').map(Number); return { w, h, label: w < 800 ? 'phone' : 'desktop' };
});
const journey = arg('journey') ? JSON.parse(readFileSync(arg('journey'), 'utf8')) : [{ name: 'home', path: '/' }];
const storage = (arg('storage', '') || '').split(',').filter(Boolean).map((s) => {
  const [kind, kv] = s.split(':'); const [k, ...rest] = kv.split('='); return { kind, k, v: rest.join('=') };
});
const axePath = process.env.AXE_PATH && existsSync(process.env.AXE_PATH) ? process.env.AXE_PATH : null;

// Runs inside the page: every measurement the critic can cite.
function pageFacts(isPhone) {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const brief = (el) => { const t = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('alt') || el.id || el.className || '').toString().trim().replace(/\s+/g, ' ');
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} "${t.slice(0, 50)}"`; };
  const meta = (sel) => { const m = document.querySelector(sel); return m ? (m.getAttribute('content') || m.getAttribute('href')) : null; };
  const parse = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { let e = el; while (e) { const s = getComputedStyle(e); if (s.backgroundImage && s.backgroundImage !== 'none') return null; const c = parse(s.backgroundColor); if (c && c.a > 0.5) return c; e = e.parentElement; } return { r: 255, g: 255, b: 255, a: 1 }; };

  const f = { title: document.title, lang: document.documentElement.lang || null,
    description: meta('meta[name="description"]'), canonical: meta('link[rel="canonical"]'),
    ogTitle: meta('meta[property="og:title"]'), ogImage: meta('meta[property="og:image"]'),
    viewportMeta: meta('meta[name="viewport"]'), domNodes: document.getElementsByTagName('*').length };
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) {
    const ox = (el) => getComputedStyle(el).overflowX;
    const clipped = ['hidden', 'clip'].includes(ox(document.documentElement)) || ['hidden', 'clip'].includes(ox(document.body));
    // The element sticking out furthest, ignoring anything inside a scroll container of its own.
    let worst = null, worstR = vw;
    for (const el of document.body.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.right > worstR + 1 && vis(el)) {
      let p = el.parentElement, inner = false; while (p && p !== document.body) { if (['auto', 'scroll'].includes(ox(p)) && p.scrollWidth > p.clientWidth) { inner = true; break; } p = p.parentElement; }
      if (!inner) { worst = el; worstR = r.right; } } }
    f.sidewaysScroll = `${document.documentElement.scrollWidth}px wide in a ${vw}px viewport${clipped ? ' (clipped by overflow-x, not scrollable)' : ' (user can scroll sideways)'}${worst ? `; widest: ${brief(worst)} right edge ${Math.round(worstR)}px` : ''}`;
  } else f.sidewaysScroll = null;
  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis);
  f.h1Count = hs.filter((h) => h.tagName === 'H1').length;
  f.headingSkips = []; for (let i = 1; i < hs.length; i++) { const a = +hs[i - 1].tagName[1], b = +hs[i].tagName[1]; if (b > a + 1) f.headingSkips.push(`${hs[i - 1].tagName}→${hs[i].tagName} at ${brief(hs[i])}`); }
  const imgs = [...document.images].filter(vis);
  f.imgNoAlt = imgs.filter((i) => !i.hasAttribute('alt')).map(brief).slice(0, 8);
  f.imgBroken = imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src).slice(0, 8);
  f.imgOversized = imgs.filter((i) => i.naturalWidth > 2.5 * i.getBoundingClientRect().width * devicePixelRatio && i.naturalWidth > 600)
    .map((i) => `${(i.currentSrc || i.src).split('/').pop()} ${i.naturalWidth}px shown at ${Math.round(i.getBoundingClientRect().width)}px`).slice(0, 8);
  const controls = [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(vis);
  f.unlabelledControls = controls.filter((c) => !(c.labels && c.labels.length) && !c.getAttribute('aria-label') && !c.getAttribute('aria-labelledby') && !c.getAttribute('title')).map(brief).slice(0, 8);
  const actions = [...document.querySelectorAll('button,a[href],[role=button]')].filter(vis);
  f.namelessActions = actions.filter((a) => !(a.innerText || '').trim() && !a.getAttribute('aria-label') && !a.getAttribute('title') && !a.querySelector('img[alt]:not([alt=""])')).map(brief).slice(0, 8);
  if (isPhone) {
    const small = actions.filter((a) => { const r = a.getBoundingClientRect(); return r.width < 24 || r.height < 24; });
    f.smallTapTargets = { count: small.length, of: actions.length, examples: small.slice(0, 6).map((a) => { const r = a.getBoundingClientRect(); return `${brief(a)} ${Math.round(r.width)}×${Math.round(r.height)}`; }) };
  }
  const texts = []; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode() && texts.length < 400) { const n = walker.currentNode; if (n.textContent.trim().length > 1 && n.parentElement && vis(n.parentElement)) texts.push(n.parentElement); }
  const lowC = [], tiny = []; const seen = new Set();
  for (const el of texts) { if (seen.has(el)) continue; seen.add(el); const s = getComputedStyle(el); const fg = parse(s.color); const bg = bgOf(el);
    const px = parseFloat(s.fontSize); if (isPhone && px < 12) tiny.push(`${brief(el)} ${px}px`);
    if (!fg || !bg) continue; const fgc = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
    const L1 = lum(fgc), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const large = px >= 24 || (px >= 18.66 && +s.fontWeight >= 700); if (ratio < (large ? 3 : 4.5)) lowC.push(`${brief(el)} ${ratio.toFixed(2)}:1`); }
  f.lowContrast = { count: lowC.length, examples: lowC.slice(0, 8) };
  if (isPhone) f.tinyText = { count: tiny.length, examples: tiny.slice(0, 6) };
  return f;
}

const MAX_SHOT_H = 8000;
const chromePath = arg('chrome');
const proxyOrigin = arg('proxy');
const launchOpts = chromePath ? { executablePath: chromePath, headless: true } : { channel: 'chrome', headless: true };
let browser = await chromium.launch(launchOpts);
async function proxyRoute(route) {
  const req = route.request(); const u = new URL(req.url());
  let target = req.url();
  if (['localhost', '127.0.0.1'].includes(u.hostname) && u.pathname.startsWith('/api/')) target = proxyOrigin + u.pathname + u.search;
  const headers = {}; for (const [k, v] of Object.entries(req.headers())) if (!['host', 'content-length', 'connection'].includes(k)) headers[k] = v;
  try {
    const m = req.method(); const r = await fetch(target, { method: m, headers, body: ['GET', 'HEAD'].includes(m) ? undefined : req.postDataBuffer() || undefined });
    const body = Buffer.from(await r.arrayBuffer()); const h = {}; r.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k)) h[k] = v; });
    await route.fulfill({ status: r.status, headers: h, body });
  } catch (e) { await route.fulfill({ status: 502, body: 'proxy error' }); }
}
const proxyMatch = (u) => !['localhost', '127.0.0.1'].includes(u.hostname) || u.pathname.startsWith('/api/');
const results = [];
for (const vp of viewports) {
  for (const pg of journey) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.label === 'phone' ? 2 : 1, isMobile: vp.label === 'phone', hasTouch: vp.label === 'phone' });
    if (proxyOrigin) await ctx.route(proxyMatch, proxyRoute);
    if (storage.length) await ctx.addInitScript((items) => { for (const it of items) { try { (it.kind === 'local' ? localStorage : sessionStorage).setItem(it.k, it.v); } catch (e) {} } }, storage);
    await ctx.addInitScript(() => {
      window.__cwv = { lcp: 0, cls: 0, fcp: 0 };
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__cwv.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cwv.cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__cwv.fcp = e.startTime; }).observe({ type: 'paint', buffered: true }); } catch (e) {}
    });
    const page = await ctx.newPage();
    const errors = [], failed = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 200)));
    page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText || 'failed'} ${r.url()}`.slice(0, 200)));
    page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`.slice(0, 200)); });
    const rec = { page: pg.name, viewport: `${vp.w}x${vp.h}`, device: vp.label };
    try {
      const t0 = Date.now();
      await page.goto(new URL(pg.path || '/', base).href, { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(1500);
      for (const st of pg.steps || []) {
        if (st.click) await page.locator(st.click).first().click({ timeout: 8000 });
        else if (st.fill) await page.locator(st.fill[0]).first().fill(st.fill[1], { timeout: 8000 });
        else if (st.press) await page.locator(st.press[0]).first().press(st.press[1], { timeout: 8000 });
        else if (st.select) await page.locator(st.select[0]).first().selectOption(st.select[1], { timeout: 8000 });
        else if (st.waitFor) await page.locator(st.waitFor).first().waitFor({ timeout: 10000 });
        else if (st.scroll === 'bottom') await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        if (st.wait) await page.waitForTimeout(st.wait); else await page.waitForTimeout(400);
      }
      rec.loadMs = Date.now() - t0;
      rec.vitals = await page.evaluate(() => {
        const res = performance.getEntriesByType('resource'); const nav = performance.getEntriesByType('navigation')[0];
        const bytes = res.reduce((s, r) => s + (r.transferSize || 0), 0) + (nav ? nav.transferSize || 0 : 0);
        return { fcpMs: Math.round(window.__cwv.fcp), lcpMs: Math.round(window.__cwv.lcp), cls: +window.__cwv.cls.toFixed(3), transferKB: Math.round(bytes / 1024), requests: res.length + 1 };
      });
      rec.facts = await page.evaluate(pageFacts, vp.label === 'phone');
      if (axePath) {
        await page.addScriptTag({ path: axePath });
        rec.axe = await page.evaluate(async () => { const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag22aa'] });
          return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })); });
      }
      // Full-page capture, capped: a very long page at phone pixel density can exhaust the
      // renderer (a 400-card scholarship list crashed it). Past the cap, capture the top part.
      const shot = `${pg.name}_${vp.label}.png`;
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      rec.pageHeightPx = h;
      if (h <= MAX_SHOT_H) await page.screenshot({ path: join(out, shot), fullPage: true });
      else { await page.screenshot({ path: join(out, shot), fullPage: true, clip: { x: 0, y: 0, width: vp.w, height: MAX_SHOT_H } }); rec.screenshotNote = `top ${MAX_SHOT_H}px of ${h}px`; }
      rec.screenshot = shot;
    } catch (e) { rec.error = String(e.message).slice(0, 300); }
    rec.consoleErrors = errors.slice(0, 10); rec.failedRequests = [...new Set(failed)].slice(0, 12);
    results.push(rec);
    try { await ctx.close(); } catch (e) { rec.error = (rec.error ? rec.error + ' | ' : '') + 'page crashed or closed'; }
    if (!browser.isConnected()) browser = await chromium.launch(launchOpts);
    const v = rec.vitals || {};
    console.log(`${rec.error ? 'ERR ' : 'ok  '} ${pg.name.padEnd(16)} ${rec.viewport.padEnd(9)} LCP ${v.lcpMs ?? '-'}ms CLS ${v.cls ?? '-'} ${v.transferKB ?? '-'}KB errors ${errors.length} failed ${rec.failedRequests.length}${rec.error ? '  ' + rec.error : ''}`);
  }
}
await browser.close();
writeFileSync(join(out, 'audit.json'), JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2));
console.log(`\nwrote ${join(out, 'audit.json')} and ${results.filter((r) => r.screenshot).length} screenshots`);
