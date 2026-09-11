# CUSTOMIZE.md — Edit your portfolio without any AI help

Every page also has an **EDIT MAP** comment at the very top — open the file, and the map tells you what to Ctrl+F. This guide is the full version.

**Golden rules**
1. Only change the words BETWEEN tags: `<h3>Change this</h3>` — never delete the `<...>` parts.
2. After every change: Save (Ctrl+S), check in Live Server, upload to GitHub when happy.
3. To add another of something (a cert, a project, a quote): copy an entire block from its opening tag to its matching closing tag, paste it below, then edit the copy.
4. Filenames are case-sensitive online: `Photo.JPG` is not `photo.jpg`.

---

## 1. Your identity
| What | File(s) | Ctrl+F | Change |
|---|---|---|---|
| Email | all pages | `hello@example.com` | Replace EVERY occurrence (button text AND `mailto:` links) |
| LinkedIn | index.html | `your-username` | Your real LinkedIn handle |
| Socials | index.html | `href="#" target="_blank"` | Put real profile URLs in place of `#` |
| Rotating hero words | index.html | `rotList` | Edit the list: `['small businesses','student orgs',...]` |
| Hero spec line | index.html | `Field:` | Edit the three spec items |
| Resume | about.html | `resume.pdf` | Export your resume as PDF, name it exactly `resume.pdf`, put it beside index.html |

## 2. Images
All images live in the `images/` folder. Ctrl+F `images/` in each file to see what is expected:
- `images/portrait.jpg` — hero portrait + About ID badge
- `images/cert-featured.jpg` — featured certificate screenshot
- `images/photo1.jpg` ... `photo3.jpg`, `design1.jpg` ... `design3.jpg` — Plates gallery
- `images/case-portal-1.jpg`, `case-portal-2.jpg` — case-study screens
Resize photos to about 1500px wide before adding (smaller file = faster site).

## 3. Projects (index.html)
Ctrl+F `work-row`. Each project block contains:
- `<h3>` title (W.01's title links to its case-study page)
- `.desc` — one-sentence description
- `.outcome` — your REAL result (delete the "(edit: ...)" note)
- `.note` — your role, `.note-dim` — the stack
- `Code` / `Live` links — your GitHub repo + deployed URL
- `data-img="..."` on the row — the hover-preview image

## 4. Case-study pages
`work-portal.html` is a template. For each new project:
1. Copy the file, rename it (e.g. `work-inventory.html`)
2. Edit title, meta strip, the 3 stats, Problem/Solution, screens, process, outcome
3. On index.html, point that project's title + "Case study" link at the new file

## 5. Certifications (index.html)
- Featured: Ctrl+F `Latest credential` — title, issuer, description, screenshot, and the `View credential` link (paste your verification URL over `#`)
- Grid: Ctrl+F `cred-row` — issuer / title / date / link per row. Copy a whole row to add one.
- LinkedIn button: Ctrl+F `your-username`

## 6. About page
- Intro paragraph: Ctrl+F `Kumusta! I'm Daryll`
- Education: Ctrl+F `edu-row` (note the "(edit me)" marks)
- Spec sheet rows: Ctrl+F `rowline`
- Skill gauges: Ctrl+F `data-w=` — the number is the % fill; also update the % label next to it
- Experience accordion: Ctrl+F `acc-item` — title, dates, bullets. Copy a whole `acc-item` to add one.
- ID badge fields: Ctrl+F `BSIT-2026-001`

## 7. Principles (index.html)
Ctrl+F `prin-row`. Each has a `data-fx` (leave it alone) and its text. P.01's text lives in `data-text="..."`.
WARNING: P.04 and the "Full transparency" note make promises about how you work — keep them only if true for you; otherwise reword or delete that `prin-row` plus the `.honest` block.

## 8. Quotes / References (index.html)
Ctrl+F `class="quote"`. **These are fake placeholders — never deploy them as-is.** Replace with real quotes (ask a professor or client — people usually say yes), or delete the whole `<section id="refs">...</section>` and the bridge link pointing to `#refs` until you have real ones.

## 9. Footer
Ctrl+F `tb-cell` — Project / Drawn by / Location / Revision text. Bump the revision number when you ship changes.

## 10. Colors & fonts (advanced)
All colors live in ONE place: the `:root{...}` block at the top of each file's CSS (`--azure`, `--pearl`, `--ink`...). Night-mode colors are in `body.night{...}`. Change a variable once and it applies everywhere.

## Deploying changes
Edit locally → check with Live Server → GitHub repo → Add file → Upload files → drag the changed file(s) → Commit changes → wait ~2 min → hard refresh (Ctrl+Shift+R).

---

## 8. Two editorial decisions (July 2026) — and how to reverse them

**The lobby is now a preloader, not a gate.** The particle sphere plays for
3.5 seconds with a progress line, then lifts itself; any click or key skips it
early. Nobody is forced to click to reach your work. To change the duration,
Ctrl+F `3500` (the timer) and `3.5s` (the bar animation) in `index.html` — keep
them equal.

**The References section is hidden.** Its quotes were invented placeholders,
and fake testimonials can genuinely hurt you in an interview. The whole section
still exists inside an HTML comment — Ctrl+F `HIDDEN REFERENCES` in
`index.html`. When you have 2+ REAL quotes (ask a professor, client, or
teammate — people usually say yes): remove the comment markers, replace the
names and quotes, then renumber Plates/How I work/Principles back to 05/06/07
(headings, ghost numbers, and the `Next —` bridge labels) and re-add
`refs:'04 / References'` to the `locLabels` list in the script.

