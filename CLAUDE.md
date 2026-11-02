# CLAUDE.md — rules for working on this portfolio

Read `HANDOVER.md` for the design concept and history. These rules exist because the site has a **content admin** (`/admin/`, opened with Shift + |).

## Content vs design — never mix them

| What | Lives in | Changed by |
|---|---|---|
| Text, photos, links, skills, credentials, experience | `content/portfolio.json` + `images/` | The owner, through the admin page |
| Markup of CMS sections | `admin/templates.js` | You (Claude), on a design request |
| Styling, effects, everything else | the page files (`index.html`, `about.html`, `work-portal.html`) | You (Claude) |

## Hard rules

1. **Never hand-edit HTML between `<!-- CMS:name -->` and `<!-- /CMS:name -->` markers** (or `/* CMS:name */` in scripts). It is regenerated on every publish. To change a CMS section's markup: edit its template in `admin/templates.js`, then run `node admin/tools/regenerate.mjs`.
2. **Never move, rename or delete a CMS marker** without updating `PAGES` / `CASE_REGIONS` in `admin/templates.js`.
3. Before finishing any change, run `node admin/tools/regenerate.mjs --check` — it must print "All CMS sections match". If it doesn't, the admin's next publish would warn the owner and overwrite your edit.
4. New content fields: add them to the template **and** to the form schema in `admin/admin.js` (`SECTIONS`), with a sensible default so existing content keeps working.
5. Content is plain text. Templates must escape everything with `esc()` / `attr()` and pass links through `href()`, images through `src()`. Never insert raw HTML from content.
6. Admin security is part of the design: keep `admin/index.html`'s Content-Security-Policy strict (no third-party scripts, `connect-src` = GitHub API only), no inline scripts, no `innerHTML` with user data in `admin/admin.js`.
7. `work-portal.html` is both the W.01 case study **and the template for every new case-study page**. Design changes there apply to all case studies (regenerate afterwards).
8. Site stays vanilla HTML/CSS/JS, no build step, no frameworks (Node is only for the regenerate helper).
