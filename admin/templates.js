/* ===========================================================================
   admin/templates.js — content (content/portfolio.json) → the site's HTML.

   This is the ONLY place where CMS-managed markup is defined. It is used by:
     • admin/admin.js               (preview + publish, in the browser)
     • admin/tools/regenerate.mjs   (rebuild pages after a design change)

   Design change to a CMS section? Edit its template below, then run
   `node admin/tools/regenerate.mjs`. Never hand-edit HTML between
   <!-- CMS:name --> markers in the pages: it is regenerated on every publish.
   =========================================================================== */

// ---------- escaping: everything coming from content is plain text ----------
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const attr = (s) => esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Links: https, mailto, in-page anchors or one of the site's own pages.
// Anything else (javascript:, data:, http:, typos) becomes "#".
export function href(u) {
  const s = String(u ?? '').trim();
  if (/^https:\/\/[^\s"'<>]+$/i.test(s) || /^mailto:[^\s"'<>]+$/i.test(s)) return attr(s);
  if (/^(#[\w-]*|(index|about|work-[\w-]+)\.html(#[\w-]+)?)$/.test(s)) return s;
  return '#';
}

// Images: a file inside images/ or an https URL. Anything else renders as empty.
export function src(u) {
  const s = String(u ?? '').trim();
  if (/^images\/[\w.-]+\.(jpe?g|png|webp|pdf)$/i.test(s)) return s;
  if (/^https:\/\/[^\s"'<>()\\]+$/i.test(s)) return attr(s);
  return '';
}

export const pad = (n) => String(n).padStart(2, '0');
export const slugify = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item';

// ---------- shared pieces ----------
const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  code: svg('<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>'),
  ext: svg('<path d="M7 17 17 7"/><path d="M7 7h10v10"/>'),
};

// Logos: a Simple Icons name (cdn.simpleicons.org/<name>) or one of the drawn Adobe marks.
export const BUILTIN_LOGOS = { 'adobe-photoshop': 'bi-ps', 'adobe-illustrator': 'bi-ai', 'adobe-lightroom': 'bi-lr' };
export const logoOk = (v) => Boolean(BUILTIN_LOGOS[v]) || /^[a-z0-9]+$/.test(String(v ?? ''));
function logo(s) {
  const name = attr(s.name);
  const bi = BUILTIN_LOGOS[s.logo];
  if (bi) return `<span class="brand-i ${bi}" role="img" aria-label="${name}" title="${name}"></span>`;
  const slug = /^[a-z0-9]+$/.test(String(s.logo ?? '')) ? s.logo : 'simpleicons';
  return `<span class="brand-i" role="img" aria-label="${name}" title="${name}" style="--src:url(https://cdn.simpleicons.org/${slug})"></span>`;
}
const lines = (...xs) => xs.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false).join('\n');

// ===========================================================================
// Section templates. Each returns the HTML that goes between its markers.
// ===========================================================================
export const R = {};

// ---- index: hero spec line + rotating word ----
R.heroSpec = (c) => lines(
  `<span class="note-dim">Now: <b>${esc(c.basics?.now)}</b></span>`,
  `<span class="note-dim">Status: <b style="color:var(--azure)">${esc(c.basics?.status)}</b></span>`,
);
R.rotFirst = (c) => esc((c.basics?.rotating || [])[0] || '');
R.rot = (c) => `const rotList = ${JSON.stringify((c.basics?.rotating || []).map(String)).replace(/</g, '\\u003c')};`;

// ---- index: 01 Selected work (bento) ----
// Groups of four: hero (photo) · wide · dark · blue. A last, incomplete group uses full/half tiles.
const GROUP = ['w-hero', 'w-wide', 'w-dark', 'w-blue'];
const PARTIAL = { 1: ['w-wide w-full'], 2: ['w-wide w-half', 'w-dark w-half'], 3: ['w-wide w-full', 'w-dark w-half', 'w-blue w-half'] };
R.work = (c) => {
  const ps = c.projects || [];
  return lines(ps.map((p, i) => {
    const size = Math.min(4, ps.length - Math.floor(i / 4) * 4), pos = i % 4;
    const cls = size === 4 ? GROUP[pos] : PARTIAL[size][pos];
    const hero = cls === 'w-hero', photo = src(p.photo);
    const title = p.case?.file ? `<a href="${href(p.case.file)}">${esc(p.title)}</a>` : esc(p.title);
    const links = [
      p.code ? `<a href="${href(p.code)}" target="_blank" rel="noopener" class="ic sm" data-label="Code">${ICON.code}</a>` : '',
      p.live ? `<a href="${href(p.live)}" target="_blank" rel="noopener" class="ic sm" data-label="Live">${ICON.ext}</a>` : '',
    ].join('');
    return lines(
      `<article class="work-row ${cls}"${!hero && photo ? ` data-img="${photo}"` : ''}>`,
      hero && photo ? `  <div class="w-photo"><img src="${photo}" alt=""></div>` : null,
      `  <div class="w-top"><span class="num">W.${pad(i + 1)}</span>${p.role ? `<span class="w-role">${esc(p.role)}</span>` : ''}</div>`,
      '  <div>',
      `    <h3>${title}</h3>`,
      hero && p.desc ? `    <p class="desc">${esc(p.desc)}</p>` : null,
      p.outcome ? `    <p class="outcome">→ ${esc(p.outcome)}</p>` : null,
      '  </div>',
      `  <div class="w-foot"><span class="w-stack">${esc(p.stack)}</span>${links ? `<div class="links">${links}</div>` : ''}</div>`,
      '</article>',
    );
  }));
};

// ---- index: 02 Capabilities (logo carousel lanes) ----
R.cap = (c) => {
  const lane = (key, label, rev) => [
    `<div class="lane-track${rev ? ' rev' : ''}">`,
    `  <ul class="lane-set" aria-label="${label}">`,
    (c.skills || []).filter((s) => s.home === key).map((s) => `    <li>${logo(s)}</li>`),
    '  </ul>',
    '</div>',
  ];
  return lines(lane('dev', 'Development', false), lane('design', 'Design and photography', true));
};

// ---- index: 03 Credentials ----
R.creds = (c) => {
  const f = c.credentials?.featured;
  const feat = f && f.title ? [
    '<div class="cred-feat reveal">',
    '  <div class="doc">',
    `    <span class="corner tl">${esc(f.corner)}</span>`,
    src(f.image) ? `    <img src="${src(f.image)}" alt="${attr(f.imageAlt || f.title)}">` : null,
    '    <span class="corner br">Verified</span>',
    '  </div>',
    '  <div class="info">',
    `    <span class="note">${esc(f.label)}</span>`,
    `    <h3>${esc(f.title)}</h3>`,
    `    <span class="note-dim">${esc(f.sub)}</span>`,
    f.text ? `    <p>${esc(f.text)}</p>` : null,
    f.url ? `    <a href="${href(f.url)}" target="_blank" rel="noopener" class="btn btn-solid">Verify <span class="ar" aria-hidden="true">↗</span></a>` : null,
    '  </div>',
    '</div>',
    '',
  ] : [];
  return lines(feat, '<div class="cred-table reveal">', (c.credentials?.list || []).map((r) => [
    '  <div class="cred-row">',
    `    <span class="note-dim">${esc(r.issuer)}</span>`,
    `    <h4>${esc(r.title)}</h4>`,
    `    <span class="note-dim">${esc(r.date)}</span>`,
    r.url ? `    <a href="${href(r.url)}" target="_blank" rel="noopener" class="ic sm" data-label="View">${ICON.ext}</a>` : null,
    '  </div>',
  ]), '</div>');
};

// ---- index: 04 References ----
R.refs = (c) => lines((c.references || []).map((r, i) => [
  '<div class="quote">',
  `  <span class="qn">Ref. ${pad(i + 1)}</span>`,
  `  <p>"${esc(r.text)}"</p>`,
  `  <div class="who"><h4>${esc(r.name)}</h4><span>${esc(r.role)}</span></div>`,
  '</div>',
]));

// ---- index: 05 Plates ----
const LANES = [
  ['photo', 'Through the lens', 'Photography', 'Photography', 'P'],
  ['design', 'By design', 'Graphic design', 'Design', 'D'],
];
R.plates = (c) => lines(LANES.map(([key, head, note, pill, letter]) => [
  '<div class="lane">',
  `  <div class="lane-head"><h3>${head}</h3><span class="note">${note}</span></div>`,
  '  <div class="lane-stack">',
  (c.plates || []).filter((p) => p.lane === key).map((p, i) => [
    `    <figure class="plate" data-pill="${pill}" data-meta="${attr(p.meta)}">`,
    `      <div class="ph"><img src="${src(p.image)}" alt="${attr(p.alt || p.title)}"></div>`,
    `      <div class="cap"><b>${esc(p.title)}</b><span class="note-dim">Plate ${letter}.${pad(i + 1)}</span></div>`,
    '    </figure>',
  ]),
  '  </div>',
  '</div>',
]));

// ---- about: A3 skill depth ----
const TIERS = [
  ['proficient', 't3', 'Proficient', 'note'],
  ['working', 't2', 'Working', 'note-dim'],
  ['exposure', 't1', 'Exposure', 'note-dim'],
];
R.depth = (c) => {
  let d = 0;
  return lines(TIERS.map(([level, cls, label, labelCls]) => {
    const items = (c.skills || []).filter((s) => s.level === level);
    if (!items.length) return null;
    return [
      `<div class="tier-col ${cls}" style="--d:${d++}">`,
      `  <ul class="tier-logos" aria-label="${label}">`,
      items.map((s, i) => `    <li style="--i:${i}">${logo(s)}</li>`),
      '  </ul>',
      '  <div class="tier-scale" aria-hidden="true"><i></i></div>',
      `  <span class="${labelCls} tlabel" aria-hidden="true">${label}</span>`,
      '</div>',
    ];
  }));
};

// ---- about: facts strip ----
R.facts = (c) => lines((c.basics?.facts || []).slice(0, 3).map((f) => `<div><small>${esc(f.label)}</small><b>${esc(f.value)}</b></div>`));

// ---- about: A4 experience accordion ----
R.exp = (c) => lines((c.experience || []).map((e, i) => [
  `<div class="acc-item${e.key ? ' key' : ''}">`,
  '  <h3 class="acc-h"><button class="acc-head" aria-expanded="false">',
  `    <span class="num">E.${pad(i + 1)}</span>`,
  `    <span class="acc-title">${esc(e.title)}${e.key ? ' <span class="acc-flag">Key</span>' : ''}</span>`,
  `    <span class="when">${esc(e.when)}</span>`,
  '    <span class="pm" aria-hidden="true">+</span>',
  '  </button></h3>',
  '  <div class="acc-body"><div class="acc-inner">',
  `    <span class="note">${esc([e.org, String(e.when || '').replace(/\bNow\b/, 'Present')].filter(Boolean).join(' · '))}</span>`,
  '    <ul>',
  (e.bullets || []).map((b) => `      <li>${esc(b)}</li>`),
  '    </ul>',
  '  </div></div>',
  '</div>',
]));

// ---- case-study pages (built from the work-portal.html template) ----
R.caseTitle = (c, p) => `<title>${esc(p.title)} — Case study — Daryll Celestial</title>`;
R.caseLoc = (c, p, i) => `W.${pad(i + 1)} / Case study`;
R.caseDoc = (c, p, i) => `Case study — sheet W.${pad(i + 1)}`;
R.caseMain = (c, p, i) => {
  const k = p.case, num = `W.${pad(i + 1)}`, ps = c.projects || [];
  const ni = (i + 1) % ps.length, next = ps[ni] || p;
  const paras = (arr, ind) => (arr || []).filter(Boolean).map((t) => `${ind}<p>${esc(t)}</p>`);
  const btns = [
    p.code ? `          <a href="${href(p.code)}" target="_blank" rel="noopener" class="btn btn-solid">${ICON.code} Code</a>` : null,
    p.live ? `          <a href="${href(p.live)}" target="_blank" rel="noopener" class="btn">Live <span class="ar" aria-hidden="true">↗</span></a>` : null,
  ].filter(Boolean);

  const secs = [{
    name: 'PROBLEM / SOLUTION', h: 'Problem → Solution', body: [
      '    <div class="two reveal">', '      <div>', '        <h3>The problem</h3>', paras(k.problem, '        '), '      </div>',
      '      <div>', '        <h3>The solution</h3>', paras(k.solution, '        '), '      </div>', '    </div>'],
  }];
  if ((k.screens || []).length) secs.push({
    name: 'SCREENS', h: 'The build', body: k.screens.map((s, j) => [
      '    <figure class="plate reveal">',
      `      <div class="ph"><img src="${src(s.image)}" alt="${attr(s.alt || s.caption)}"></div>`,
      `      <div class="cap"><b>${esc(s.caption)}</b><span class="note-dim">Fig. ${pad(j + 1)}</span></div>`,
      '    </figure>']),
  });
  if ((k.process || []).length) secs.push({
    name: 'PROCESS', h: 'Process notes', body: ['    <div class="plist reveal">',
      k.process.map((r, j) => `      <div class="prow"><span class="note">P.${pad(j + 1)}</span><h3>${esc(r.title)}</h3><p>${esc(r.text)}</p></div>`),
      '    </div>'],
  });
  secs.push({
    name: 'OUTCOME', h: 'Outcome', id: 'outcome', body: [
      '    <div class="two reveal">', '      <div>', '        <h3>What changed</h3>', paras(k.changed, '        '), '      </div>',
      '      <div>', "        <h3>What I'd do next</h3>", paras(k.next, '        '),
      btns.length ? ['        <div style="display:flex; gap:14px; margin-top:22px; flex-wrap:wrap;">', btns, '        </div>'] : null,
      '      </div>', '    </div>'],
  });

  return lines(
    '<!-- ===== CASE HERO ===== -->',
    '<section class="chero" style="padding-bottom:40px;">',
    '  <div class="wrap">',
    `    <span class="ghost" aria-hidden="true">${num}</span>`,
    '    <div class="crumb">',
    '      <span class="note">Case study</span>',
    `      <span class="note-dim">Sheet ${num} — Rev 1.0</span>`,
    '    </div>',
    `    <h1>${esc(p.title)}</h1>`,
    `    <p class="sum">${esc(k.summary)}${k.templateNotice ? ' <em style="font-style:normal;color:var(--mist)">(All content on this page is a template — replace with your real project.)</em>' : ''}</p>`,
    '',
    '    <div class="meta reveal">',
    `      <div><small>Role</small><b>${esc(p.role)}</b></div>`,
    `      <div><small>Stack</small><b>${esc(p.stack)}</b></div>`,
    `      <div><small>Timeline</small><b>${esc(k.timeline)}</b></div>`,
    `      <div><small>For</small><b>${esc(k.client)}</b></div>`,
    `      <div><small>Year</small><b>${esc(k.year)}</b></div>`,
    '    </div>',
    (k.stats || []).length ? ['', '    <div class="stats reveal">',
      k.stats.slice(0, 3).map((s) => `      <div class="stat"><div class="big">${esc(s.big)}</div><p>${esc(s.label)}</p></div>`),
      '    </div>'] : null,
    '  </div>',
    '</section>',
    secs.map((s, j) => {
      const n = pad(j + 1);
      const bridge = j > 0 && secs[j + 1]?.id === 'outcome'
        ? `    <div class="bridge reveal"><a href="#outcome" aria-label="${pad(j + 2)} Outcome">${pad(j + 2)} <span class="ar" aria-hidden="true">↓</span></a></div>` : null;
      return ['', `<!-- ===== ${n} ${s.name} ===== -->`,
        `<section${s.id ? ` id="${s.id}"` : ''} style="padding-top:${j === 0 ? '60px' : '0'};">`,
        '  <div class="wrap">',
        `    <span class="ghost" aria-hidden="true">${n}</span>`,
        `    <div class="idx reveal"><span class="n">${n}</span><h2>${esc(s.h)}</h2></div>`,
        s.body, bridge, '  </div>', '</section>'];
    }),
    '',
    '<!-- ===== NEXT PROJECT ===== -->',
    '<section class="nextproj" style="padding-top:20px;">',
    '  <div class="wrap">',
    '    <span class="note reveal">Next sheet</span>',
    `    <h2 class="reveal">W.${pad(ni + 1)} —<br><span class="outline">${esc(next.title)}</span></h2>`,
    '    <div class="row2 reveal">',
    '      <a href="index.html#work" class="btn btn-solid"><span aria-hidden="true">←</span> All work</a>',
    '      <a href="index.html#contact" class="btn">Contact <span class="ar" aria-hidden="true">→</span></a>',
    '    </div>',
    '  </div>',
    '</section>',
  );
};

// ===========================================================================
// Region engine: <!-- CMS:name --> … <!-- /CMS:name -->  (or /* CMS:name */ in scripts)
// ===========================================================================
const rx = (name) => new RegExp(`([ \\t]*)(<!-- CMS:${name} -->|/\\* CMS:${name} \\*/)([\\s\\S]*?)(<!-- /CMS:${name} -->|/\\* /CMS:${name} \\*/)`);

export function getRegion(html, name) {
  const m = String(html ?? '').match(rx(name));
  return m ? m[3] : null;
}
export function setRegion(html, name, content) {
  const re = rx(name), m = html.match(re);
  if (!m) throw new Error(`CMS region "${name}" not found`);
  const [, indent, open, inner, close] = m;
  const body = /\n/.test(inner)
    ? '\n' + content.split('\n').map((l) => (l ? indent + l : l)).join('\n') + '\n' + indent
    : content;
  return html.replace(re, () => indent + open + body + close);
}
export const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// Which regions live on which page, and which template renders them.
export const PAGES = {
  'index.html': { heroSpec: 'hero-spec', rotFirst: 'rot-first', rot: 'rot', work: 'work', cap: 'cap', creds: 'creds', refs: 'refs', plates: 'plates' },
  'about.html': { depth: 'depth', facts: 'facts', exp: 'exp' },
};
export const CASE_TEMPLATE = 'work-portal.html';
const CASE_REGIONS = { caseTitle: 'case-title', caseLoc: 'case-loc', caseMain: 'case-main', caseDoc: 'case-doc' };

export const caseFiles = (c) => (c.projects || []).map((p, i) => ({ p, i })).filter((x) => x.p.case && x.p.case.file);

// Render every CMS region. files = { path: current text }. Returns { path: new text }.
// New case-study pages start from the work-portal.html template.
export function buildPages(c, files) {
  const out = {};
  for (const [path, regions] of Object.entries(PAGES)) {
    let html = files[path];
    if (html == null) throw new Error(`${path} is missing`);
    for (const [fn, name] of Object.entries(regions)) html = setRegion(html, name, R[fn](c));
    out[path] = html;
  }
  for (const { p, i } of caseFiles(c)) {
    let html = files[p.case.file] ?? files[CASE_TEMPLATE];
    if (html == null) throw new Error(`${CASE_TEMPLATE} (case-study template) is missing`);
    for (const [fn, name] of Object.entries(CASE_REGIONS)) html = setRegion(html, name, R[fn](c, p, i));
    out[p.case.file] = html;
  }
  return out;
}

// Regions that no longer match what the content would produce = edited outside the admin
// (or a template changed without regenerating). Publishing would overwrite them.
export function drift(c, files) {
  const issues = [];
  const check = (path, name, expected) => {
    const cur = getRegion(files[path], name);
    if (cur == null) issues.push(`${path}: section "${name}" is missing its CMS markers`);
    else if (norm(cur) !== norm(expected)) issues.push(`${path}: section "${name}" was changed outside the admin`);
  };
  for (const [path, regions] of Object.entries(PAGES)) {
    if (files[path] == null) continue;
    for (const [fn, name] of Object.entries(regions)) check(path, name, R[fn](c));
  }
  for (const { p, i } of caseFiles(c)) {
    if (files[p.case.file] == null) continue;
    for (const [fn, name] of Object.entries(CASE_REGIONS)) check(p.case.file, name, R[fn](c, p, i));
  }
  return issues;
}
