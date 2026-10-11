// signed_in_flow.mjs — signed-in journeys for the MeritLaunch critic (core flow + conversion lenses).
//
// Signs in to the dedicated TEST accounts through the real sign-in form, then walks:
//   cloud-profile check → dashboard → matching → letter draft → [outline] → [voice profile]
//   → [upgrade dialog → parent link → parent page signed out → checkout session URL]
// and writes results.json plus screenshots to --out.
//
// Usage (local build on 127.0.0.1:58xx; see SKILL.md §1):
//   ML_TEST_PASSWORD=... node signed_in_flow.mjs --url http://127.0.0.1:5891 --out <dir>
//     [--accounts lexi,ethan] [--full] [--checkout] [--chrome <path>] [--proxy https://meritlaunch.com]
//     [--pw <dir containing node_modules/playwright-core or playwright>]
//
// Cost and side effects (read before running):
//   - Each draft spends one free letter on that TEST account and a real Anthropic call. Reset the
//     test accounts' usage in Supabase between runs (SKILL.md §1), never a real user's.
//   - --checkout only asks the API for a Stripe Checkout session and checks a checkout.stripe.com
//     URL comes back. The browser redirect to Stripe is aborted; nothing is ever paid.
//   - Never point this at real student accounts. The password comes only from ML_TEST_PASSWORD.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes('--' + k);
const BASE = (arg('url') || '').replace(/\/$/, '');
const OUT = arg('out');
const PASSWORD = process.env.ML_TEST_PASSWORD;
if (!BASE || !OUT || !PASSWORD) { console.error('usage: ML_TEST_PASSWORD=... node signed_in_flow.mjs --url <local build> --out <dir> [--accounts a,b] [--full] [--checkout]'); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const SUPABASE_URL = 'https://zudczsepvkjbjgomgilz.supabase.co';
// Public anon key (same one shipped in the browser bundle).
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1ZGN6c2VwdmtqYmpnb21naWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMjcyMjUsImV4cCI6MjA4NjYwMzIyNX0.cyslrHtWjzvvmZfdQHWdP5xIMfP2xkYltdwMKCpNG2w';
const ACCOUNTS = { lexi: 'lexitest', ethan: 'ethantest', maria: 'mariatest', amara: 'amaratest', wei: 'weitest' };
const picked = (arg('accounts') || Object.keys(ACCOUNTS).join(',')).split(',');
const PROXY = arg('proxy');

let pw;
const pwDir = arg('pw');
if (pwDir) { const req = createRequire(join(pwDir, 'package.json')); try { pw = req('playwright-core'); } catch { pw = req('playwright'); } }
else { try { pw = await import('playwright-core'); } catch { pw = await import('playwright'); } }
const { chromium } = pw;
const chromePath = arg('chrome');
const browser = await chromium.launch(chromePath ? { executablePath: chromePath, headless: true } : { channel: 'chrome', headless: true });

const stripeHits = [];
const apiErrors = [];
async function route(rt) {
  const req = rt.request(); const u = new URL(req.url());
  if (u.hostname.endsWith('stripe.com')) { stripeHits.push(u.host); return rt.abort(); }
  if (!PROXY) return rt.continue();
  let target = req.url();
  if (['localhost', '127.0.0.1'].includes(u.hostname) && u.pathname.startsWith('/api/')) target = PROXY + u.pathname + u.search;
  const headers = {}; for (const [k, v] of Object.entries(req.headers())) if (!['host', 'content-length', 'connection'].includes(k)) headers[k] = v;
  try {
    const m = req.method(); const r = await fetch(target, { method: m, headers, body: ['GET', 'HEAD'].includes(m) ? undefined : req.postDataBuffer() || undefined });
    const body = Buffer.from(await r.arrayBuffer()); const h = {}; r.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k)) h[k] = v; });
    if (!r.ok && u.pathname.startsWith('/api/')) apiErrors.push(`${r.status} ${u.pathname} ${body.toString('utf8').slice(0, 160)}`);
    await rt.fulfill({ status: r.status, headers: h, body });
  } catch { await rt.fulfill({ status: 502, body: 'proxy error' }); }
}
const routeMatch = (u) => u.hostname.endsWith('stripe.com') || (PROXY && (!['localhost', '127.0.0.1'].includes(u.hostname) || u.pathname.startsWith('/api/')));

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(routeMatch, route);
  const page = await ctx.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(String(e.message).slice(0, 200)));
  return { ctx, page };
}
const text = async (p) => (await p.locator('body').innerText()).trim();
const crashed = (t) => t.includes('Something went wrong');
async function signIn(page, email) {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Sign In', exact: true }).first().click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForTimeout(2500);
}
// In-app navigation only after sign-in. A full page load (page.goto) re-runs getSession(), which
// in the sandbox hangs and signs the student out at ~8 s (see SKILL.md Learnings).
async function nav(page, label) {
  if (label === 'Dashboard' && await page.getByRole('button', { name: 'Dashboard', exact: true }).count()) {
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  } else {
    await page.locator('#app-sidebar').getByRole('button', { name: label, exact: true }).click();
  }
  await page.waitForTimeout(900);
}
async function fetchProfile(email) {
  const s = await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON }, body: JSON.stringify({ email, password: PASSWORD }) })).json();
  if (!s.access_token) throw new Error('sign-in failed for ' + email);
  const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?select=profile_data&id=eq.${s.user.id}`, { headers: { apikey: ANON, Authorization: 'Bearer ' + s.access_token } })).json();
  return rows?.[0]?.profile_data || null;
}
// Wait for a NEW draft: the generate button leaves its busy state and the text differs from `prev`.
async function waitForNewDraft(page, prev, timeout = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    await page.waitForTimeout(1000);
    const busy = await page.getByRole('button', { name: /Drafting from your details/ }).count();
    if (busy) continue;
    const t = await page.locator('body').innerText();
    if (t.includes('Something went wrong')) return '';
    const v = await page.locator('textarea[aria-label*="letter" i]').first().inputValue().catch(() => '');
    if (v && v !== prev) return v;
  }
  return '';
}
async function matchCount(page) {
  const t = await page.locator('body').innerText();
  const m = t.match(/Found (\d+) scholarships/) || t.match(/(\d+) (?:eligible )?(?:matches|scholarships you)/i);
  return m ? +m[1] : null;
}
const SCH_NAME = 'Community Leadership Merit Award';
const SCH_TEXT = 'A $2,500 award for a graduating senior with sustained leadership and service in their community. Minimum 3.0 GPA. Explain how your intended field of study connects to community impact, and describe a challenge you overcame.';

const results = [];
for (const key of picked) {
  const email = `coreyskinner+${ACCOUNTS[key]}@gmail.com`;
  const r = { account: key };
  console.log(`\n== ${key}`);
  try {
    // A. Does a normal sign-in bring back the saved cloud profile? (regression check)
    {
      const { ctx, page } = await newPage();
      await signIn(page, email);
      await nav(page, 'Dashboard');
      await nav(page, 'My Profile');
      await page.waitForTimeout(1600);
      const t = await text(page);
      r.cloudProfileOnSignIn = !t.includes('What year were you born') && /\d+% profile complete/.test(t);
      r.signedIn = t.includes('Sign Out');
      await page.screenshot({ path: join(OUT, `${key}_after_signin_profile.png`) });
      await ctx.close();
    }
    // B. The flows, with the saved profile seeded locally (so A's result can't block B).
    const profile = await fetchProfile(email);
    const { ctx, page } = await newPage();
    if (profile) await page.addInitScript((p) => localStorage.setItem('scholarbot-profile', JSON.stringify(p)), profile);
    await signIn(page, email);
    await nav(page, 'Dashboard');
    let t = await text(page);
    r.dashboardOk = !crashed(t) && t.includes('Sign Out');
    await page.screenshot({ path: join(OUT, `${key}_dashboard.png`), fullPage: true });

    await nav(page, 'My Profile');
    const m0 = Date.now();
    await page.getByRole('button', { name: 'See my matches', exact: true }).first().click();
    // Matching calls /api/usage first; wait for the app to land on /app/matches (up to 25 s).
    let count = null;
    while (Date.now() - m0 < 25000 && !page.url().includes('/app/matches')) { await page.waitForTimeout(500); count = count ?? await matchCount(page); }
    await page.waitForTimeout(800);
    count = count ?? await matchCount(page);
    t = await text(page);
    r.matchSeconds = Math.round((Date.now() - m0) / 1000);
    r.matching = { ok: !crashed(t) && page.url().includes('/app/matches'), eligibleCount: count };
    await page.screenshot({ path: join(OUT, `${key}_matches.png`), fullPage: true });

    await nav(page, 'Write a Letter');
    await page.getByRole('button', { name: 'Paste', exact: true }).click();
    await page.locator('input[placeholder="Scholarship name"]').fill(SCH_NAME);
    await page.locator('textarea[placeholder="Paste the full scholarship description here..."]').fill(SCH_TEXT);
    const t0 = Date.now();
    await page.getByRole('button', { name: /Draft my letter/ }).click();
    const letter = await waitForNewDraft(page, '');
    t = await text(page);
    r.letter = { ok: letter.length > 400 && !crashed(t), seconds: Math.round((Date.now() - t0) / 1000), words: letter.split(/\s+/).filter(Boolean).length,
      emDashes: (letter.match(/—/g) || []).length, opening: letter.slice(0, 160) };
    writeFileSync(join(OUT, `${key}_letter.txt`), letter);
    await page.screenshot({ path: join(OUT, `${key}_letter.png`), fullPage: true });

    if (flag('full')) {
      await page.locator('input[name="ai-policy"][value="unsure"]').check();
      await page.getByRole('button', { name: 'Make my outline' }).click();
      const outline = await waitForNewDraft(page, letter);
      r.outline = { ok: outline.length > 200 && outline !== letter, preview: outline.slice(0, 160) };

      await nav(page, 'My Profile');
      await page.getByRole('button', { name: /Build my voice profile/ }).click();
      await page.waitForFunction(() => /Your Voice Profile|Something went wrong/.test(document.body.innerText), { timeout: 90000 }).catch(() => {});
      r.voiceProfile = { ok: (await text(page)).includes('Your Voice Profile') };

      await page.getByRole('button', { name: 'Upgrade', exact: true }).first().click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('button', { name: 'Ask a parent to pay' }).click();
      await page.waitForFunction(() => !!document.querySelector('#parent-link') || /Couldn't create/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
      const link = await page.locator('#parent-link').inputValue().catch(() => '');
      r.parentLink = { created: link.includes('/pay/') };
      await page.screenshot({ path: join(OUT, `${key}_upgrade.png`) });
      if (r.parentLink.created) {
        const p2 = await newPage();
        await p2.page.goto(`${BASE}/pay/${link.split('/pay/')[1]}`, { waitUntil: 'load' });
        await p2.page.waitForFunction(() => !/Checking your link/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
        const pt = await text(p2.page);
        r.parentPage = { ready: pt.includes('Your student asked you'), leaksStudent: [profile?.name, profile?.school].filter(Boolean).some((x) => pt.includes(x.split(' ')[0])) };
        await p2.page.screenshot({ path: join(OUT, `${key}_parent_page.png`), fullPage: true });
        if (flag('checkout') && r.parentPage.ready) {
          const before = stripeHits.length;
          await p2.page.getByRole('button', { name: /Continue to secure checkout/ }).click();
          await p2.page.waitForTimeout(8000);
          r.parentCheckoutReachedStripe = stripeHits.length > before;
        }
        await p2.ctx.close();
      }
    }
    r.pageErrors = page.__errors;
    r.apiErrors = apiErrors.splice(0);
    await ctx.close();
  } catch (e) { r.error = String(e.message).split('\n')[0]; r.apiErrors = apiErrors.splice(0); }
  console.log(JSON.stringify(r));
  results.push(r);
}
await browser.close();
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
console.log(`\nwrote ${join(OUT, 'results.json')}`);
