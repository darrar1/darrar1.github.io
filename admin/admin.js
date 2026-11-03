/* ===========================================================================
   admin/admin.js — private content editor for darrar1.github.io

   Security model (GitHub Pages has no server, so GitHub is the lock):
   • Writes need a fine-grained GitHub token limited to this one repository.
   • The token is stored ONLY encrypted (AES-GCM, key from your passphrase via
     PBKDF2-SHA256, 600k rounds). Unlocked, it lives in memory only.
   • Auto-lock after 15 min idle. No third-party scripts (see the CSP in index.html).
   • Everything you type is escaped by templates.js before it reaches the site.
   • Uploads: JPG/PNG/WebP checked by file signature, re-encoded (strips EXIF/GPS),
     resized; resume must be a real PDF. SVG is never accepted.
   =========================================================================== */
import { R, buildPages, drift, slugify, logoOk, href, src, PAGES, CASE_TEMPLATE, caseFiles, BUILTIN_LOGOS } from './templates.js';

// ---------- refuse to run inside another site's frame (clickjacking guard) ----------
if (window.top !== window.self) throw new Error('Refusing to run inside a frame');
document.documentElement.classList.add('ok');

const OWNER = 'darrar1', REPO = 'darrar1.github.io', BRANCH = 'main';
const CONTENT_PATH = 'content/portfolio.json', RESUME_PATH = 'images/Resume.pdf';
const VAULT_KEY = 'cms.vault.v1', DRAFT_KEY = 'cms.draft.v1', FAIL_KEY = 'cms.fail.v1';
const PBKDF2_ITER = 600000, IDLE_MS = 15 * 60 * 1000;
// Local test mode (127.0.0.1 / localhost only): reads the files from the local server,
// never touches GitHub, and Publish is replaced by a dry run.
const DEMO = ['127.0.0.1', 'localhost'].includes(location.hostname);

let TOKEN = null;                       // decrypted token: memory only
const base = { sha: null, tree: null, blobs: new Map(), files: {}, content: null };
let state = null;                       // content being edited
const pending = new Map();              // path -> { b64, dataUrl } uploads waiting for Publish
let dirty = false;

// ---------- tiny DOM helpers (no innerHTML with user data anywhere) ----------
const $ = (s) => document.querySelector(s);
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}
const btn = (label, onclick, opts = {}) => h('button', { type: 'button', class: opts.class || 'btn-sm', onclick, disabled: opts.disabled || null, title: opts.title || null }, label);
function status(msg, kind = '') { const s = $('#status'); s.textContent = msg; s.className = 'status ' + kind; }
function show(view) { for (const v of ['#vSetup', '#vUnlock', '#vEditor']) $(v).hidden = v !== view; $('#barActions').hidden = view !== '#vEditor'; }

// ---------- encoding ----------
const te = new TextEncoder(), td = new TextDecoder();
function b64(buf) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
const unb64 = (s) => Uint8Array.from(atob(s.replace(/\s/g, '')), (c) => c.charCodeAt(0));

// ===========================================================================
// Vault: the GitHub token, encrypted with your passphrase
// ===========================================================================
async function deriveKey(pass, salt, iter) {
  const raw = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, raw,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(secret, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt, PBKDF2_ITER);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(secret));
  return { v: 1, iter: PBKDF2_ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}
async function unseal(vault, pass) {
  const key = await deriveKey(pass, unb64(vault.salt), vault.iter);
  return td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, key, unb64(vault.ct)));
}
const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

// Wrong-passphrase slowdown (the real protection is the encryption itself).
function failInfo() { return readJSON(FAIL_KEY) || { n: 0, until: 0 }; }
function recordFail() {
  const f = failInfo(); f.n++;
  if (f.n >= 5) f.until = Date.now() + 30000 * 2 ** (f.n - 5);
  localStorage.setItem(FAIL_KEY, JSON.stringify(f));
}

// ===========================================================================
// GitHub API
// ===========================================================================
async function gh(path, opts = {}) {
  const res = await fetch('https://api.github.com' + path, {
    ...opts, cache: 'no-store', referrerPolicy: 'no-referrer',
    headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + TOKEN, 'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (!res.ok) {
    let msg = ''; try { msg = (await res.json()).message || ''; } catch {}
    const e = new Error(`GitHub ${res.status}${msg ? ': ' + msg : ''}`); e.status = res.status; throw e;
  }
  return res.status === 204 ? null : res.json();
}
const repo = (p) => `/repos/${OWNER}/${REPO}${p}`;

async function readFile(path) {
  if (DEMO) { const r = await fetch('../' + path, { cache: 'no-store' }); return r.ok ? r.text() : null; }
  const sha = base.blobs.get(path);
  if (!sha) return null;
  const blob = await gh(repo(`/git/blobs/${sha}`));
  return td.decode(unb64(blob.content));
}

async function loadSite() {
  status('Loading your site from GitHub…');
  base.files = {}; base.blobs = new Map();
  if (!DEMO) {
    base.sha = (await gh(repo(`/git/ref/heads/${BRANCH}`))).object.sha;
    base.tree = (await gh(repo(`/git/commits/${base.sha}`))).tree.sha;
    const tree = await gh(repo(`/git/trees/${base.tree}?recursive=1`));
    for (const t of tree.tree) if (t.type === 'blob') base.blobs.set(t.path, t.sha);
  }
  const json = await readFile(CONTENT_PATH);
  if (json == null) throw new Error('content/portfolio.json is not on GitHub yet — upload the new site files first (CUSTOMIZE.md → Admin page).');
  base.content = JSON.parse(json);
  const paths = new Set([...Object.keys(PAGES), CASE_TEMPLATE, ...caseFiles(base.content).map((x) => x.p.case.file)]);
  for (const p of paths) base.files[p] = await readFile(p);
  state = structuredClone(base.content);
  pending.clear(); dirty = false;
  status(DEMO ? 'Local test mode — reading local files, Publish is a dry run' : `Loaded · ${base.sha.slice(0, 7)}`, DEMO ? '' : 'good');
}
const fileExists = (p) => DEMO ? true : base.blobs.has(p);

// GitHub Pages lets browsers reuse admin files for up to 10 minutes. Right after a site update the
// browser can run the OLD admin code against the NEW pages; explain that instead of a raw error.
const STALE_MSG = "This browser is still using an older copy of the admin (GitHub Pages caches it for up to 10 minutes after an update). Press Ctrl + Shift + R to reload — your draft is kept.";
const buildMsg = (e) => (/CMS region ".*" not found/.test(e.message) ? STALE_MSG : e.message);

// ===========================================================================
// Images & PDF: validated by signature, re-encoded in the browser
// ===========================================================================
function sniff(head) {
  const s = (a, b) => String.fromCharCode(...head.slice(a, b));
  if (head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF) return 'jpeg';
  if (head[0] === 0x89 && s(1, 4) === 'PNG') return 'png';
  if (s(0, 4) === 'RIFF' && s(8, 12) === 'WEBP') return 'webp';
  if (s(0, 5) === '%PDF-') return 'pdf';
  return null;
}
async function addImage(file, maxW, nameHint) {
  if (file.size > 25e6) throw new Error('That file is over 25 MB.');
  const kind = sniff(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  if (!['jpeg', 'png', 'webp'].includes(kind)) throw new Error('Only JPG, PNG or WebP photos are accepted.');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width), w = Math.round(bmp.width * scale), hgt = Math.round(bmp.height * scale);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hgt;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hgt); ctx.drawImage(bmp, 0, 0, w, hgt);
  let q = 0.86, blob;
  do { blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', q)); q -= 0.08; } while (blob.size > 900e3 && q > 0.45);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const rand = [...crypto.getRandomValues(new Uint8Array(3))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const path = `images/${slugify(nameHint).slice(0, 30)}-${rand}.jpg`;
  pending.set(path, { b64: b64(bytes), dataUrl: 'data:image/jpeg;base64,' + b64(bytes) });
  return path;
}
async function addPdf(file) {
  if (file.size > 8e6) throw new Error('That PDF is over 8 MB.');
  if (sniff(new Uint8Array(await file.slice(0, 12).arrayBuffer())) !== 'pdf') throw new Error('That is not a PDF file.');
  pending.set(RESUME_PATH, { b64: b64(new Uint8Array(await file.arrayBuffer())), dataUrl: null });
}
function imgURL(v) {
  if (!v) return '';
  if (pending.has(v)) return pending.get(v).dataUrl;
  if (/^https:\/\//.test(v)) return v;
  return src(v) ? '../' + v : '';
}

// ===========================================================================
// Form schema — one entry per section. Limits keep the layout from breaking.
// ===========================================================================
const t = (k, label, max, more = {}) => ({ k, label, type: 'text', max, ...more });
const ta = (k, label, max, more = {}) => ({ k, label, type: 'textarea', max, ...more });
const url = (k, label, more = {}) => ({ k, label, type: 'url', ...more });
const img = (k, label, width, more = {}) => ({ k, label, type: 'image', width, ...more });

const CASE_FIELDS = [
  { k: 'file', label: 'Page file', type: 'readonly', hint: 'Set automatically from the title. The project title on Home links here.' },
  ta('summary', 'Summary (top of the page)', 320, { req: true }),
  { k: 'templateNotice', label: 'Show the "this is a template" note', type: 'check' },
  t('timeline', 'Timeline', 24, { hint: 'e.g. 6 weeks' }), t('client', 'For (client / org)', 32), t('year', 'Year', 10),
  { k: 'stats', label: 'Stat band (up to 3)', type: 'list', itemName: 'stat', max: 3, itemLabel: (s) => `${s.big || '—'} ${s.label || ''}`,
    newItem: () => ({ big: '', label: '' }), fields: [t('big', 'Big number', 10, { req: true }), t('label', 'Label', 60)] },
  { k: 'problem', label: 'The problem', type: 'paras', hint: 'Blank line = new paragraph.' },
  { k: 'solution', label: 'The solution', type: 'paras' },
  { k: 'screens', label: 'Screens', type: 'list', itemName: 'screen', max: 8, itemLabel: (s) => s.caption || 'Untitled screen',
    newItem: () => ({ image: '', caption: '', alt: '' }),
    fields: [img('image', 'Screenshot', 1800, { req: true, nameFrom: 'caption' }), t('caption', 'Caption', 70, { req: true }), t('alt', 'Describe the image (for screen readers)', 120)] },
  { k: 'process', label: 'Process notes', type: 'list', itemName: 'step', max: 8, itemLabel: (s) => s.title || 'Untitled step',
    newItem: () => ({ title: '', text: '' }), fields: [t('title', 'Step', 24, { req: true }), ta('text', 'What happened', 200)] },
  { k: 'changed', label: 'What changed (outcome)', type: 'paras' },
  { k: 'next', label: "What I'd do next", type: 'paras' },
];

const SECTIONS = [
  { id: 'projects', label: 'Projects', note: 'Order = order on Home. Every 4 projects form one bento group; the 1st of each group is the big photo tile (it also shows the description).',
    fields: [{ k: 'projects', type: 'list', itemName: 'project', max: 12, itemLabel: (p) => p.title || 'New project',
      newItem: () => ({ title: '', role: '', stack: '', outcome: '', desc: '', photo: '', code: '', live: '', case: null }),
      fields: [
        t('title', 'Title', 32, { req: true }), t('role', 'Your role', 28, { hint: 'e.g. Full-stack developer' }),
        t('stack', 'Stack', 36, { hint: 'Separate with " · " — e.g. React · Node · MySQL' }),
        t('outcome', 'Result', 90, { hint: 'Your real, measurable result.' }),
        ta('desc', 'One-sentence description (big tile only)', 140),
        img('photo', 'Photo / screenshot', 1600, { nameFrom: 'title' }),
        url('code', 'Code link (GitHub)'), url('live', 'Live link'),
        { k: 'case', label: 'This project has a case-study page', type: 'group', optional: true, fields: CASE_FIELDS,
          newValue: (p) => newCase(p), offWarning: 'Remove the case study? The title will stop linking to it (the old page file stays on the site).' },
      ] }] },
  { id: 'skills', label: 'Skills', note: 'One list feeds both pages. "On Home" = which carousel lane. "Level on About" = which depth column. Logo = a name from simpleicons.org (e.g. typescript), or adobe-photoshop / adobe-illustrator / adobe-lightroom.',
    fields: [{ k: 'skills', type: 'list', itemName: 'skill', max: 60, itemLabel: (s) => s.name || 'New skill',
      newItem: () => ({ name: '', logo: '', home: '', level: '' }),
      fields: [
        t('name', 'Name', 32, { req: true }),
        { k: 'logo', label: 'Logo name', type: 'logo', req: true },
        { k: 'home', label: 'On Home', type: 'select', options: [['', 'Not on Home'], ['dev', 'Development lane'], ['design', 'Design & photography lane']] },
        { k: 'level', label: 'Level on About', type: 'select', options: [['', 'Not on About'], ['proficient', 'Proficient'], ['working', 'Working'], ['exposure', 'Exposure']] },
      ] }] },
  { id: 'credentials', label: 'Credentials', note: 'The featured credential gets the big card; the rest are rows.', root: (s) => s.credentials,
    fields: [
      { k: 'featured', label: 'Featured credential', type: 'group', optional: true,
        newValue: () => ({ corner: '', image: '', imageAlt: '', label: '', title: '', sub: '', text: '', url: '' }),
        fields: [t('label', 'Label', 40, { hint: 'e.g. ★ Award · Best in Capstone' }), t('title', 'Title', 70, { req: true }),
          t('sub', 'Issuer · track · date', 80), ta('text', 'One sentence', 140), url('url', 'Verify link'),
          img('image', 'Certificate image', 1400, { nameFrom: 'title' }), t('imageAlt', 'Describe the image', 120), t('corner', 'Corner tag', 24, { hint: 'e.g. Award · 2026' })] },
      { k: 'list', label: 'Other credentials', type: 'list', itemName: 'credential', max: 40, itemLabel: (r) => r.title || 'New credential',
        newItem: () => ({ issuer: '', title: '', date: '', url: '' }),
        fields: [t('issuer', 'Issuer', 24, { req: true }), t('title', 'Title', 90, { req: true }), t('date', 'Date', 12, { hint: 'e.g. Jun 2026' }), url('url', 'Verify link')] },
    ] },
  { id: 'experience', label: 'Experience', note: 'Use "Now" in Dates for current roles (it shows as "Present" inside).',
    fields: [{ k: 'experience', type: 'list', itemName: 'role', max: 30, itemLabel: (e) => e.title || 'New role',
      newItem: () => ({ title: '', org: '', when: '', key: false, bullets: [] }),
      fields: [t('title', 'Role', 50, { req: true }), t('org', 'Organisation', 60), t('when', 'Dates', 20, { hint: 'e.g. 2024 — 2025 or 2026 — Now' }),
        { k: 'key', label: 'Flag as a key role', type: 'check' }, { k: 'bullets', label: 'Bullet points', type: 'lines', hint: 'One per line.' }] }] },
  { id: 'references', label: 'References', note: 'Only real quotes, with the person’s permission.',
    fields: [{ k: 'references', type: 'list', itemName: 'reference', max: 10, itemLabel: (r) => r.name || 'New reference',
      newItem: () => ({ text: '', name: '', role: '' }),
      fields: [ta('text', 'Quote (without quotation marks)', 600, { req: true }), t('name', 'Name', 40, { req: true }), t('role', 'Their role', 80)] }] },
  { id: 'basics', label: 'Basics', note: 'Small bits around the site, and your resume.', root: (s) => s.basics,
    fields: [
      t('now', 'Hero · "Now"', 40), t('status', 'Hero · "Status"', 24),
      { k: 'rotating', label: 'Hero · rotating words', type: 'lines', hint: 'One per line — "I build web and mobile apps for …"' },
      { k: 'facts', label: 'About · facts strip (up to 3)', type: 'list', itemName: 'fact', max: 3, itemLabel: (f) => f.label || 'New fact',
        newItem: () => ({ label: '', value: '' }), fields: [t('label', 'Label', 20, { req: true }), t('value', 'Value', 40)] },
      { k: '_resume', label: 'Resume (PDF)', type: 'pdf' },
    ] },
];

function newCase(p) {
  const used = new Set([...(state.projects || []).map((x) => x.case?.file).filter(Boolean), ...base.blobs.keys()]);
  let name = `work-${slugify(p.title || 'project')}`, n = 1, file = name + '.html';
  while (used.has(file)) file = `${name}-${++n}.html`;
  return { file, summary: '', templateNotice: false, timeline: '', client: '', year: String(new Date().getFullYear()),
    stats: [], problem: [], solution: [], screens: [], process: [], changed: [], next: [] };
}

// ===========================================================================
// Form renderer
// ===========================================================================
let uid = 0;
function changed() {
  dirty = true;
  clearTimeout(changed.t);
  changed.t = setTimeout(saveDraft, 400);
  $('#btnPublish').textContent = 'Publish •';
}
function urlProblem(v) {
  v = String(v || '').trim();
  if (!v || v === '#') return '';
  return href(v) === '#' ? 'Use a full link that starts with https://' : '';
}

function fieldsEditor(obj, fields) {
  return h('div', { class: 'fields' }, fields.map((f) => fieldEl(obj, f)));
}

function fieldEl(obj, f) {
  const id = 'f' + (++uid);
  const label = h('label', { for: id }, f.label, f.req ? h('span', { class: 'dim', 'aria-hidden': 'true' }, ' *') : null);
  const hint = f.hint ? h('p', { class: 'hint', id: id + 'h' }, f.hint) : null;
  const row = h('div', { class: 'field' });

  switch (f.type) {
    case 'text': case 'url': case 'textarea': case 'readonly': {
      const inp = f.type === 'textarea' ? h('textarea', { id, maxlength: f.max || null, rows: 3 })
        : h('input', { id, type: f.type === 'url' ? 'url' : 'text', maxlength: f.max || null, readonly: f.type === 'readonly' || null,
          autocomplete: 'off', spellcheck: f.type === 'url' ? 'false' : null, inputmode: f.type === 'url' ? 'url' : null });
      if (hint) inp.setAttribute('aria-describedby', id + 'h');
      inp.value = obj[f.k] ?? '';
      const count = f.max ? h('span', { class: 'count', 'aria-hidden': 'true' }) : null;
      const err = h('p', { class: 'err' });
      const upd = () => { if (count) { count.textContent = `${inp.value.length}/${f.max}`; count.classList.toggle('over', inp.value.length >= f.max); } };
      if (f.type !== 'readonly') inp.addEventListener('input', () => { obj[f.k] = inp.value; upd(); changed(); });
      if (f.type === 'url') inp.addEventListener('blur', () => { err.textContent = urlProblem(inp.value); });
      upd();
      row.append(label, count || '', inp, hint || '', err);
      break;
    }
    case 'logo': {
      const inp = h('input', { id, type: 'text', maxlength: 40, autocomplete: 'off', spellcheck: 'false' });
      inp.value = obj[f.k] ?? '';
      const prev = h('span', { class: 'logo-prev', role: 'img', 'aria-label': 'Logo preview' });
      const err = h('p', { class: 'err' });
      const upd = () => { const v = inp.value.trim(); obj[f.k] = v; setLogo(prev, v); err.textContent = v && !logoOk(v) ? 'Lowercase letters and numbers only (as on simpleicons.org).' : ''; };
      inp.addEventListener('input', () => { upd(); changed(); });
      upd();
      row.append(label, h('div', { class: 'logo-row' }, inp, prev), h('p', { class: 'hint' }, 'Find names at simpleicons.org — the preview turns on when the name is right.'), err);
      break;
    }
    case 'select': {
      const sel = h('select', { id }, f.options.map(([v, l]) => h('option', { value: v, selected: (obj[f.k] ?? '') === v || null }, l)));
      sel.addEventListener('change', () => { obj[f.k] = sel.value; changed(); });
      row.append(label, sel, hint || '');
      break;
    }
    case 'check': {
      const cb = h('input', { id, type: 'checkbox' }); cb.checked = !!obj[f.k];
      cb.addEventListener('change', () => { obj[f.k] = cb.checked; changed(); });
      row.append(h('label', { class: 'check' }, cb, f.label), hint || '');
      break;
    }
    case 'lines': case 'paras': {
      const sep = f.type === 'lines' ? '\n' : '\n\n';
      const inp = h('textarea', { id, rows: f.type === 'lines' ? 4 : 5 });
      inp.value = (obj[f.k] || []).join(sep);
      inp.addEventListener('input', () => {
        obj[f.k] = inp.value.split(f.type === 'lines' ? /\n/ : /\n\s*\n/).map((s) => s.trim()).filter(Boolean);
        changed();
      });
      row.append(label, inp, hint || '');
      break;
    }
    case 'image': {
      const thumb = h('img', { alt: '' });
      const info = h('p', { class: 'hint' });
      const file = h('input', { id, type: 'file', accept: 'image/jpeg,image/png,image/webp' });
      const rm = btn('Remove', () => { obj[f.k] = ''; draw(); changed(); }, { class: 'btn-sm danger' });
      const draw = () => {
        const v = obj[f.k] || '';
        thumb.hidden = !v; thumb.src = imgURL(v) || '';
        rm.hidden = !v;
        info.className = 'hint';
        if (!v) info.textContent = f.req ? 'No image yet (required).' : 'No image.';
        else if (pending.has(v)) info.textContent = 'New image — uploads when you publish.';
        else if (/^https:\/\//.test(v)) info.textContent = 'External image (placeholder). Upload your own to replace it.';
        else if (!fileExists(v)) { info.textContent = `⚠ ${v} is missing on the site — upload an image.`; info.className = 'hint warn'; }
        else info.textContent = v;
      };
      file.addEventListener('change', async () => {
        const fl = file.files[0]; if (!fl) return;
        try { status('Processing image…'); obj[f.k] = await addImage(fl, f.width || 1600, obj[f.nameFrom] || f.label); draw(); changed(); status('Image ready — it uploads when you publish.', 'good'); }
        catch (e) { info.textContent = e.message; info.className = 'err'; status(e.message, 'bad'); }
        file.value = '';
      });
      draw();
      row.append(label, h('div', { class: 'img-field' }, thumb, h('div', {}, file, info), rm));
      break;
    }
    case 'pdf': {
      const file = h('input', { id, type: 'file', accept: 'application/pdf' });
      const info = h('p', { class: 'hint' }, pending.has(RESUME_PATH) ? 'New resume — uploads when you publish.' : `Current file: ${RESUME_PATH}`);
      file.addEventListener('change', async () => {
        const fl = file.files[0]; if (!fl) return;
        try { await addPdf(fl); info.textContent = 'New resume — uploads when you publish.'; info.className = 'hint'; changed(); }
        catch (e) { info.textContent = e.message; info.className = 'err'; }
        file.value = '';
      });
      row.append(label, file, info);
      break;
    }
    case 'list': {
      const arr = Array.isArray(obj[f.k]) ? obj[f.k] : (obj[f.k] = []);
      const box = h('div', { class: 'list' });
      const draw = (openIndex = -1) => {
        box.replaceChildren();
        arr.forEach((it, i) => {
          const title = h('span', { class: 'item-t' }, f.itemLabel(it, i));
          const det = h('details', { class: 'item', open: i === openIndex || null },
            h('summary', {}, h('span', { class: 'item-n' }, String(i + 1).padStart(2, '0')), title),
            h('div', { class: 'item-body' },
              h('div', { class: 'item-tools' },
                btn('↑ Up', () => move(i, -1), { disabled: i === 0 }),
                btn('↓ Down', () => move(i, 1), { disabled: i === arr.length - 1 }),
                btn('Delete', () => del(i), { class: 'btn-sm danger' })),
              fieldsEditor(it, f.fields)));
          det.addEventListener('input', () => { title.textContent = f.itemLabel(it, i); });
          det.addEventListener('change', () => { title.textContent = f.itemLabel(it, i); });
          box.append(det);
        });
        box.append(h('button', { type: 'button', class: 'btn-add', disabled: (f.max && arr.length >= f.max) || null,
          onclick: () => { arr.push(f.newItem()); changed(); draw(arr.length - 1); } }, `+ Add ${f.itemName}`));
      };
      const move = (i, d) => { const j = i + d; [arr[i], arr[j]] = [arr[j], arr[i]]; changed(); draw(j); };
      const del = (i) => { if (!confirm(`Delete "${f.itemLabel(arr[i], i)}"?`)) return; arr.splice(i, 1); changed(); draw(); };
      draw();
      if (f.label) row.append(h('h3', { class: 'list-h' }, f.label));
      row.append(hint || '', box);
      break;
    }
    case 'group': {
      const body = h('div');
      const draw = () => { body.replaceChildren(); if (obj[f.k]) body.append(fieldsEditor(obj[f.k], f.fields)); };
      const g = h('div', { class: 'group' });
      if (f.optional) {
        const cb = h('input', { id, type: 'checkbox' }); cb.checked = !!obj[f.k];
        cb.addEventListener('change', () => {
          if (cb.checked) obj[f.k] = f.newValue(obj);
          else { if (!confirm(f.offWarning || 'Remove this?')) { cb.checked = true; return; } obj[f.k] = null; }
          changed(); draw();
        });
        g.append(h('label', { class: 'check' }, cb, f.label));
      } else g.append(h('h3', { class: 'list-h' }, f.label));
      g.append(hint || '', body);
      draw();
      row.append(g);
      break;
    }
  }
  return row;
}

// Logo preview: Simple Icons via CSS mask, or the drawn Adobe tiles.
const adobeMark = (letters) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect x='1.5' y='1.5' width='21' height='21' rx='4' fill='none' stroke='#000' stroke-width='1.6'/><text x='12' y='16' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-weight='700' font-size='10'>${letters}</text></svg>`)}")`;
const ADOBE_PREVIEW = { 'bi-ps': adobeMark('Ps'), 'bi-ai': adobeMark('Ai'), 'bi-lr': adobeMark('Lr') };
function setLogo(el, v) {
  const bi = BUILTIN_LOGOS[v];
  if (bi) el.style.setProperty('--src', ADOBE_PREVIEW[bi]);
  else if (/^[a-z0-9]+$/.test(v)) el.style.setProperty('--src', `url(https://cdn.simpleicons.org/${v})`);
  else el.style.removeProperty('--src');
}

// ===========================================================================
// Editor shell
// ===========================================================================
let current = 'projects';
function renderTabs() {
  $('#tabs').replaceChildren(...SECTIONS.map((s) => h('button', { type: 'button', 'aria-current': s.id === current ? 'page' : null,
    onclick: () => { current = s.id; renderTabs(); renderSection(); } }, s.label)));
}
function renderSection() {
  const s = SECTIONS.find((x) => x.id === current);
  const root = s.root ? s.root(state) : state;
  $('#editorBody').replaceChildren(
    h('div', { class: 'sec-head' }, h('h1', {}, s.label), h('p', { class: 'hint' }, s.note)),
    fieldsEditor(root, s.fields));
}

// ---------- drafts (content only; public anyway, so plain localStorage is fine) ----------
function saveDraft() {
  if (!dirty || !state) return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), base: base.sha, content: state }));
}
function offerDraft() {
  const d = readJSON(DRAFT_KEY);
  const bn = $('#banner');
  if (!d || JSON.stringify(d.content) === JSON.stringify(base.content)) { bn.hidden = true; return; }
  bn.hidden = false;
  bn.replaceChildren(h('span', {}, `Unsaved draft from ${new Date(d.at).toLocaleString()}.`),
    btn('Restore draft', () => {
      // keep only sections that still exist (e.g. a draft saved before a section was removed)
      state = structuredClone(base.content);
      for (const k of Object.keys(state)) if (k in d.content) state[k] = d.content[k];
      // images that were never uploaded can't be restored
      let lost = 0;
      (function walk(o) { for (const [k, v] of Object.entries(o || {})) {
        if (typeof v === 'string' && /^images\/.+\.jpg$/.test(v) && !pending.has(v) && !fileExists(v)) { o[k] = ''; lost++; }
        else if (v && typeof v === 'object') walk(v);
      } })(state);
      dirty = true; bn.hidden = true; renderSection();
      status(lost ? `Draft restored — ${lost} new image(s) need uploading again.` : 'Draft restored.', lost ? 'bad' : 'good');
    }),
    btn('Discard', () => { localStorage.removeItem(DRAFT_KEY); bn.hidden = true; }, { class: 'btn-sm danger' }));
}

// ---------- validation ----------
function validate(c) {
  const errs = [];
  const req = (v, what) => { if (!String(v ?? '').trim()) errs.push(`${what} is empty`); };
  const link = (v, what) => { if (urlProblem(v)) errs.push(`${what}: link must start with https://`); };
  (c.projects || []).forEach((p, i) => {
    const w = `Project ${i + 1}`; req(p.title, `${w} title`); link(p.code, `${w} code link`); link(p.live, `${w} live link`);
    if (p.case) { req(p.case.summary, `${w} case-study summary`);
      if (!/^work-[\w-]+\.html$/.test(p.case.file)) errs.push(`${w}: invalid case-study file name`);
      (p.case.screens || []).forEach((s, j) => { req(s.image, `${w} screen ${j + 1} image`); req(s.caption, `${w} screen ${j + 1} caption`); }); }
  });
  const files = (c.projects || []).map((p) => p.case?.file).filter(Boolean);
  if (new Set(files).size !== files.length) errs.push('Two projects point to the same case-study page');
  (c.skills || []).forEach((s, i) => { req(s.name, `Skill ${i + 1} name`); if (!logoOk(s.logo)) errs.push(`Skill ${i + 1} (${s.name || '?'}): logo name is invalid`); });
  const f = c.credentials?.featured; if (f) { req(f.title, 'Featured credential title'); link(f.url, 'Featured credential link'); }
  (c.credentials?.list || []).forEach((r, i) => { req(r.title, `Credential ${i + 1} title`); link(r.url, `Credential ${i + 1} link`); });
  (c.experience || []).forEach((e, i) => req(e.title, `Experience ${i + 1} role`));
  (c.references || []).forEach((r, i) => { req(r.text, `Reference ${i + 1} quote`); req(r.name, `Reference ${i + 1} name`); });
  return errs;
}

// Strip editor-only keys before saving.
const clean = (c) => JSON.parse(JSON.stringify(c, (k, v) => (k.startsWith('_') ? undefined : v)));

// ===========================================================================
// Preview
// ===========================================================================
function previewHTML(path) {
  const pages = buildPages(state, base.files);
  let html = pages[path];
  for (const [p, v] of pending) if (v.dataUrl) html = html.split(`"${p}"`).join(`"${v.dataUrl}"`);
  const siteRoot = new URL('../', location.href).href;
  const fix = `<base href="${siteRoot}"><style>#lobby{display:none!important}body.locked{overflow:auto!important}
.reveal,.display .row>span,.hero .spec,.hero-foot p,.hero-actions,.fig,.dim-wrap,.hero-stats{opacity:1!important;transform:none!important}
.dim,.idx::after{transform:scaleX(1)!important}.tier-logos li{opacity:1!important;scale:1!important;filter:none!important}
.tier-scale i{transform:none!important}.cta-talk .tl{color:var(--azure)!important}
.tlabel{opacity:1!important}</style>`;
  return html.replace(/<head>/i, '<head>' + fix);
}
function openPreview() {
  let pages;
  try { pages = buildPages(state, base.files); } catch (e) { status(buildMsg(e), 'bad'); return; }
  const sel = $('#pvPage');
  const names = { 'index.html': 'Home', 'about.html': 'About' };
  sel.replaceChildren(...Object.keys(pages).map((p) => h('option', { value: p }, names[p] || `Case study · ${p}`)));
  const anchor = { projects: '#work', skills: '#skills', credentials: '#certs', references: '#refs' }[current];
  sel.value = current === 'experience' ? 'about.html' : 'index.html';
  const load = () => {
    const fr = $('#pvFrame');
    fr.onload = () => {
      const target = sel.value === 'index.html' && anchor ? fr.contentDocument.querySelector(anchor)
        : sel.value === 'about.html' ? fr.contentDocument.querySelector(current === 'skills' ? '#profile' : '#experience') : null;
      if (target) target.scrollIntoView();
    };
    fr.srcdoc = previewHTML(sel.value);
  };
  sel.onchange = load;
  load();
  $('#dPreview').showModal();
}

// ===========================================================================
// Publish: one commit with content + regenerated pages + new images
// ===========================================================================
function openPublish() {
  const body = $('#pbBody'); body.replaceChildren();
  const errs = validate(state);
  let pages;
  try { pages = buildPages(state, base.files); } catch (e) { errs.push(buildMsg(e)); }
  if (errs.length) {
    body.append(h('p', {}, 'Fix these first:'), h('ul', { class: 'errs' }, errs.map((e) => h('li', {}, e))));
    $('#dPublish').showModal(); return;
  }
  const json = JSON.stringify(clean(state), null, 2) + '\n';
  const changes = [];
  if (json !== JSON.stringify(base.content, null, 2) + '\n') changes.push([CONTENT_PATH, json]);
  for (const [p, html] of Object.entries(pages)) if (html !== base.files[p]) changes.push([p, html]);
  const usedImages = [...pending.keys()].filter((p) => p === RESUME_PATH || JSON.stringify(state).includes(`"${p}"`));
  if (!changes.length && !usedImages.length) { body.append(h('p', {}, 'Nothing has changed.')); $('#dPublish').showModal(); return; }

  const issues = drift(base.content, base.files);
  const override = h('input', { type: 'checkbox', id: 'pbOverride' });
  const msg = h('input', { type: 'text', id: 'pbMsg', maxlength: 100, value: 'Update portfolio content' });
  const go = h('button', { type: 'button', class: 'btn btn-solid', disabled: issues.length ? true : null }, DEMO ? 'Dry run' : 'Publish now');
  override.addEventListener('change', () => { go.disabled = !override.checked; });
  body.append(
    h('p', {}, 'These files will be updated in one commit:'),
    h('ul', {}, changes.map(([p]) => h('li', {}, h('code', {}, p))), usedImages.map((p) => h('li', {}, h('code', {}, p), ' (new)'))),
    issues.length ? h('div', {}, h('p', {}, 'Careful — these sections were changed outside the admin (for example a design change that wasn’t regenerated). Publishing will overwrite them:'),
      h('ul', { class: 'drift' }, issues.map((x) => h('li', {}, x))),
      h('label', { class: 'check' }, override, 'Overwrite them anyway')) : '',
    h('label', { for: 'pbMsg' }, 'Note for the history'), msg, go);
  go.addEventListener('click', () => publish(changes, usedImages, msg.value.trim() || 'Update portfolio content', go));
  $('#dPublish').showModal();
}

async function publish(changes, images, message, go) {
  go.disabled = true;
  if (DEMO) { status(`Dry run OK — ${changes.length + images.length} file(s) would be committed.`, 'good'); $('#dPublish').close(); return; }
  try {
    status('Publishing…');
    const tree = [];
    for (const [path, text] of changes)
      tree.push({ path, mode: '100644', type: 'blob', sha: (await gh(repo('/git/blobs'), { method: 'POST', body: JSON.stringify({ content: text, encoding: 'utf-8' }) })).sha });
    for (const path of images)
      tree.push({ path, mode: '100644', type: 'blob', sha: (await gh(repo('/git/blobs'), { method: 'POST', body: JSON.stringify({ content: pending.get(path).b64, encoding: 'base64' }) })).sha });
    const newTree = await gh(repo('/git/trees'), { method: 'POST', body: JSON.stringify({ base_tree: base.tree, tree }) });
    const commit = await gh(repo('/git/commits'), { method: 'POST', body: JSON.stringify({ message: `${message}\n\nvia admin`, tree: newTree.sha, parents: [base.sha] }) });
    await gh(repo(`/git/refs/heads/${BRANCH}`), { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
    localStorage.removeItem(DRAFT_KEY);
    $('#dPublish').close();
    await loadSite(); renderSection(); offerDraft();
    $('#btnPublish').textContent = 'Publish';
    status(`Published ${commit.sha.slice(0, 7)} — live in about a minute.`, 'good');
  } catch (e) {
    go.disabled = false;
    const stale = e.status === 422 || e.status === 409;
    status(stale ? 'GitHub has newer changes than this page. Your draft is saved — reload the admin and restore it.' : e.message, 'bad');
    saveDraft();
  }
}

// ===========================================================================
// Lock / idle
// ===========================================================================
function lock() { saveDraft(); TOKEN = null; location.reload(); }
function armIdle() {
  let timer;
  const reset = () => { clearTimeout(timer); timer = setTimeout(lock, IDLE_MS); };
  for (const ev of ['pointerdown', 'keydown', 'scroll', 'input']) addEventListener(ev, reset, { passive: true });
  reset();
}

async function startEditor() {
  show('#vEditor');
  try { await loadSite(); }
  catch (e) {
    const msg = e.status === 401 ? 'GitHub rejected the saved key — it probably expired or was deleted. Press Lock, choose "Remove the saved key from this device", and connect a new token (CUSTOMIZE.md → Admin page).'
      : e.status === 403 || e.status === 404 ? 'The saved key cannot read this repository. Create a token for darrar1.github.io with Contents: Read and write.'
      : e.message;
    status(msg, 'bad'); $('#editorBody').replaceChildren(h('p', { class: 'err' }, msg)); return;
  }
  try { buildPages(base.content, base.files); }
  catch (e) { const msg = buildMsg(e); status(msg, "bad"); $("#editorBody").replaceChildren(h("p", { class: "err" }, msg)); return; }
  renderTabs(); renderSection(); offerDraft();
  if (!DEMO) armIdle();
  addEventListener('beforeunload', () => { if (dirty) saveDraft(); });
}

// ===========================================================================
// Boot
// ===========================================================================
$('#btnLock').addEventListener('click', lock);
$('#btnPreview').addEventListener('click', openPreview);
$('#btnPublish').addEventListener('click', openPublish);
$('#pvClose').addEventListener('click', () => $('#dPreview').close());
$('#pbClose').addEventListener('click', () => $('#dPublish').close());

$('#fSetup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#sErr'); err.textContent = '';
  const token = $('#sToken').value.trim(), p1 = $('#sPass1').value, p2 = $('#sPass2').value;
  if (/^ghp_/.test(token)) { err.textContent = 'That is a classic token (it can reach all your repositories). Create a fine-grained token instead.'; return; }
  if (!/^github_pat_[A-Za-z0-9_]{40,}$/.test(token)) { err.textContent = 'That does not look like a fine-grained GitHub token (github_pat_…).'; return; }
  if (p1.length < 12) { err.textContent = 'Use a passphrase of at least 12 characters.'; return; }
  if (p1 !== p2) { err.textContent = 'The passphrases do not match.'; return; }
  try {
    status('Checking the token with GitHub…');
    TOKEN = token;
    const r = await gh(repo(''));
    if (!r.permissions?.push) throw new Error('This token cannot write to the repository.');
    localStorage.setItem(VAULT_KEY, JSON.stringify(await seal(token, p1)));
    $('#sToken').value = $('#sPass1').value = $('#sPass2').value = '';
    startEditor();
  } catch (e2) { TOKEN = null; err.textContent = e2.status === 401 ? 'GitHub rejected that token.' : e2.status === 404 ? 'This token cannot see the repository — select darrar1.github.io when creating it.' : e2.message; status(''); }
});

$('#fUnlock').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#uErr'); err.textContent = '';
  const f = failInfo();
  if (Date.now() < f.until) { err.textContent = `Too many attempts. Try again in ${Math.ceil((f.until - Date.now()) / 1000)} s.`; return; }
  status('Unlocking…');
  try {
    TOKEN = await unseal(readJSON(VAULT_KEY), $('#uPass').value);
    $('#uPass').value = '';
    localStorage.removeItem(FAIL_KEY);
    startEditor();
  } catch { recordFail(); err.textContent = 'Wrong passphrase.'; status(''); }
});

$('#btnForget').addEventListener('click', () => {
  if (!confirm('Remove the encrypted key from this browser? You will need to paste a token again.')) return;
  localStorage.removeItem(VAULT_KEY); localStorage.removeItem(FAIL_KEY);
  location.reload();
});

if (DEMO) startEditor();
else if (!crypto?.subtle) { status('This browser cannot do secure encryption here (needs https).', 'bad'); }
else show(readJSON(VAULT_KEY) ? '#vUnlock' : '#vSetup');
