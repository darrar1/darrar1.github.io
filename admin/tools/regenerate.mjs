// Rebuild every CMS section of the site from content/portfolio.json, using admin/templates.js.
//
//   node admin/tools/regenerate.mjs           → rewrite the pages
//   node admin/tools/regenerate.mjs --check   → only report sections that differ (exit 1 if any)
//
// Run this after changing a template in admin/templates.js, so the pages and the admin agree.
// Development helper only — the live site never runs it.
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const T = await import('data:text/javascript;base64,' + Buffer.from(await readFile(new URL('admin/templates.js', root), 'utf8')).toString('base64'));
const content = JSON.parse(await readFile(new URL('content/portfolio.json', root), 'utf8'));

const files = {};
for (const p of new Set([...Object.keys(T.PAGES), T.CASE_TEMPLATE, ...T.caseFiles(content).map((x) => x.p.case.file)])) {
  try { files[p] = await readFile(new URL(p, root), 'utf8'); } catch { /* new case page: built from the template */ }
}

if (process.argv.includes('--check')) {
  const issues = T.drift(content, files);
  console.log(issues.length ? issues.join('\n') : 'All CMS sections match content/portfolio.json.');
  process.exit(issues.length ? 1 : 0);
}

const out = T.buildPages(content, files);
let n = 0;
for (const [p, html] of Object.entries(out)) {
  if (html === files[p]) continue;
  // keep each file's existing line endings
  const crlf = /\r\n/.test(files[p] ?? '');
  await writeFile(new URL(p, root), crlf ? html.replace(/\r?\n/g, '\r\n') : html);
  console.log('updated', p); n++;
}
console.log(n ? `${n} file(s) regenerated.` : 'Nothing to regenerate.');
