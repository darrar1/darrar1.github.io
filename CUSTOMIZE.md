# CUSTOMIZE.md — Edit your portfolio without any AI help

Every page also has an **EDIT MAP** comment at the very top — open the file, and the map tells you what to Ctrl+F. This guide is the full version.

**Golden rules**
1. Only change the words BETWEEN tags: `<h3>Change this</h3>` — never delete the `<...>` parts.
2. After every change: Save (Ctrl+S), check in Live Server, upload to GitHub when happy.
3. To add another of something (a cert, a project, a quote): copy an entire block from its opening tag to its matching closing tag, paste it below, then edit the copy.
4. Filenames are case-sensitive online: `Photo.JPG` is not `photo.jpg`.

---

## 0. The admin page — the easy way (recommended)

Most content is now edited in your private **admin page** instead of in the HTML: projects, case studies, skills, credentials, plates, experience, references, hero words, the facts strip and your resume. Sections still edited by hand (this guide): How I work, Principles, contact links, footer.

> ⚠ Never hand-edit HTML between `<!-- CMS:name -->` markers — the admin rewrites those sections on every publish (it warns you first).

**One-time: go live.** Upload/push *all* the new files (including the `admin/` and `content/` folders) to GitHub. The admin reads your site from GitHub, so it only works after that.

**One-time per device: connect GitHub**
1. GitHub → your photo → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name: `portfolio admin` · Expiration: **90 days**.
3. Repository access: **Only select repositories → darrar1.github.io**.
4. Permissions → Repository permissions → **Contents: Read and write**. Nothing else.
5. Generate, then copy the token (it starts with `github_pat_`).
6. On your site press **Shift + |** (on a phone: open `darrar1.github.io/admin/`). Paste the token, choose a passphrase of 12+ characters (not your GitHub password), press **Encrypt & continue**. The token is stored only encrypted, only in that browser.

**Every time:** Shift + | → passphrase → edit → **Preview** → **Publish**. The site updates in about a minute. It locks itself after 15 minutes idle, or press **Lock**.

**Photos:** upload any JPG / PNG / WebP — the admin resizes it, strips location data and names the file for you.

**Safety:** turn on two-factor login for your GitHub account. If a device is lost or you suspect anything, delete the token on GitHub (Fine-grained tokens → Delete) — the encrypted copy becomes useless. When the token expires, the admin says GitHub rejected it: click *Remove the saved key from this device* and repeat the one-time steps. Every publish is a commit, so any change can be undone from the repository history.

---

## 1. Your identity
| What | File(s) | Ctrl+F | Change |
|---|---|---|---|
| Email | all pages | `hello@example.com` | Replace EVERY occurrence (button text AND `mailto:` links) |
| LinkedIn | index.html | `your-username` | Your real LinkedIn handle |
| Socials | index.html | `href="#" target="_blank"` | Put real profile URLs in place of `#` |
| Rotating hero words | index.html | `rotList` | Edit the list: `['small businesses','student orgs',...]` |
| Hero spec line | index.html | `Now:` | Edit the two spec items |
| Resume | about.html | `Resume.pdf` | Your resume lives at `images/Resume.pdf`. To update it, replace that file and keep the exact name (capital R — GitHub Pages is case-sensitive) |

**Icon buttons** (Code, Live, View, socials) have no visible text. Their name for screen readers is the `aria-label` (socials) or `data-label` (Code / Live / View) — keep it when you edit the link.

## 2. Images
All images live in the `images/` folder. Ctrl+F `images/` in each file to see what is expected:
- `images/portrait.jpg` — hero portrait + About ID badge
- `images/cert-featured.jpg` — featured certificate screenshot
- `images/photo1.jpg` ... `photo3.jpg`, `design1.jpg` ... `design3.jpg` — Plates gallery
- `images/case-portal-1.jpg`, `case-portal-2.jpg` — case-study screens
Resize photos to about 1500px wide before adding (smaller file = faster site).

## Capabilities logos (index.html)
Ctrl+F `LOGOS`. Each tool is one `<li>` line. To add one, copy a line and change the name in `aria-label` / `title` and in the URL: `https://cdn.simpleicons.org/<name>` (find names at simpleicons.org — e.g. `typescript`, `firebase`, `kotlin`). The carousel repeats the logos by itself; you only list each tool once.

## 3. Projects (index.html)
Ctrl+F `work-row`. The projects are a bento grid of 4 tiles — keep the order, the tile sizes come from it:
- **W.01 (big photo tile)** — your best project. Its photo is the `<img>` inside `w-photo` (use a real screenshot); the whole tile opens its case study. It is the only tile with a `.desc` sentence.
- **W.02–W.04** — title, `.outcome`, role (`w-role`), stack (`w-stack`). `data-img="..."` is the faint photo that appears inside the tile on hover.
- `.outcome` — your REAL result (delete the "(edit: ...)" note)
- `Code` / `Live` icons — put your GitHub repo + deployed URL in the two `href="#"`

## 4. Case-study pages
`work-portal.html` is a template. For each new project:
1. Copy the file, rename it (e.g. `work-inventory.html`)
2. Edit title, meta strip, the 3 stats, Problem/Solution, screens, process, outcome
3. On index.html, point that project's title link at the new file

## 5. Certifications (index.html)
- Featured: Ctrl+F `Latest credential` — title, issuer, description, screenshot, and the `View credential` link (paste your verification URL over `#`)
- Grid: Ctrl+F `cred-row` — issuer / title / date / link per row. Copy a whole row to add one.
- LinkedIn button: Ctrl+F `your-username`

## 6. About page
- Intro paragraph: Ctrl+F `Kumusta! I'm Daryll`
- Education: Ctrl+F `edu-row` (note the "(edit me)" marks)
- Skills (logos by level): Ctrl+F `SKILLS`. Move a `<li>` line into the Proficient / Working / Exposure column to change its level; copy a line to add a tool (logo names at simpleicons.org)
- Facts strip (Origin · Off-hours · Building toward): Ctrl+F `class="facts"`
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

