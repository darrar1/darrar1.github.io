# HANDOVER.md — Daryll Celestial's Portfolio
*Prepared by Claude (Fable) for whichever model continues this work. Read fully before editing anything.*

---

## 1. The person and the goal

Daryll Celestial — incoming 4th-year BSIT student, Philippines. Web & mobile
developer first; graphic designer and amateur photographer second (always this
order). Goals: (a) get hired after graduation, (b) win freelance clients.
Live site: **https://darrar1.github.io** (GitHub Pages, repo `darrar1.github.io`,
"Deploy from a branch" → main → root, `.nojekyll` present).

He is a **coding beginner**. He edits in VS Code + Live Server on Windows,
uploads via GitHub's web UI (drag-and-drop → Commit). Give him Ctrl+F search
strings, exact filenames, and one step at a time. Remind him about: the green
Commit button, hard-refresh (Ctrl+Shift+R), lowercase filenames (Pages is
case-sensitive), and checking F12 → Console when "nothing works." CRLF warnings
are harmless — tell him so if he asks again.

## 2. The files

| File | Role |
|---|---|
| `index.html` | Home. Preloader + hero + sections 01–06 + contact + footer. |
| `about.html` | About page. ID badge hero, intro, education, spec sheet, experience. |
| `work-portal.html` | Case-study TEMPLATE (duplicate per project). |
| `CUSTOMIZE.md` | His self-service manual. **Update it whenever you change structure.** |
| `resume.pdf`, `images/*` | User-supplied. Expected names: `portrait.jpg`, `cert-featured.jpg`, `photo1–3.jpg`, `design1–3.jpg`, `case-portal-1/2.jpg`. |

Everything is **hand-coded vanilla HTML/CSS/JS, single file per page, zero
dependencies, no build step**. This is a deliberate brand point (footer says
"designed & hand-coded"). Do not introduce frameworks, bundlers, or external JS.

## 3. The design concept — protect it

**"Engineering draft → blueprint."** Pearl paper with a faint drafting grid;
mono annotations (JetBrains Mono) as the vernacular; hairline rules; sharp
3px-radius buttons; numbered document sections (`01 / Selected work`) with
`Next — 0X / …` **bridge** links; photography as numbered **Plates**; footer as
a blueprint **title block**; **night mode** = the draft becoming the blueprint
(deep navy, glowing grid). Fonts: Sora (display), Inter (body), JetBrains Mono
(annotations). Tokens live in `:root`; index flips them wholesale under
`body.night`; about.html uses an indirection layer (`--bg/--fg/--hd/--ln/--srf`)
instead — **the two pages' variable systems differ; check before copying CSS
between them.**

When he brings inspiration from other portfolios (he will — Charn Phivnil,
Fudali, ForAI, Kristián Ulrych so far), the winning move every time has been
**translating the idea into draft vocabulary, never carbon-copying**.

## 4. Feature inventory (do NOT re-add or duplicate these)

**index.html** — Preloader: full-screen canvas **particle sphere** (~1,400
fibonacci-distributed dots, cursor/touch repulsion via pointer events, scanner
band every 7s, progress line, auto-lifts after 3.5s, any click/key skips;
skipped for `#hash` arrivals, same-session returns via `sessionStorage
lobbySeen`, and reduced-motion). Hero: giant name with per-letter hover, second
line stroke-outlined, rotating positioning word (`rotList` in JS), dimension
line "SCALE 1:1 — BUILT BY HAND", tilting portrait with crop marks, spec line.
Sections: 01 Work (index rows + cursor-following image preview + outcome
metrics + role labels; W.01 links to work-portal.html), 02 Capabilities (ruled
columns), 03 Credentials (featured doc + ledger + LinkedIn button), 04 Plates
(two lanes + lightbox w/ keyboard), 05 How I work, 06 Principles (kinetic
typography: typewriter / cursor-wave letters / progress+stamp / AI
Tab-autocomplete), Contact (animated heading, click-to-copy email). **Night
mode triggers at #creative** and runs to the footer. Wow kit: grid spotlight
(#spot), crosshair cursor ring + click squeeze, paper grain, ghost numerals w/
parallax, self-drawing header rules, magnetic buttons. Header: expanding logo
(DAR → DARYLL CELESTIAL, crosshair dot), live sheet indicator (#loc). Footer:
status strip w/ pulsing live-dot + Top button, hover cells, live PH clock
(`phTime`), title block. **References section is COMMENTED OUT** (search
`HIDDEN REFERENCES`) — fake quotes removed by editorial decision; restore
instructions in CUSTOMIZE.md §8 (requires renumbering 04–06 back to 05–07).

**about.html** — Swinging ID badge (spring pendulum chasing cursor; the ONLY
remaining cursor context label: "HI ^_^" on the badge). A1 Intro, A2 Education
(**night mode triggers here**, "Lights off — blueprint mode" hint), A3 Spec
sheet (playful datasheet + animated gauges + locked "hire to unlock" bar),
A4 Experience accordion. Own loc indicator (A1–A4), letter-hover on heading,
CTA "Seen enough? / See the work." blur-to-focus.

**work-portal.html** — Case template: meta strip, 3-stat outcome band, Problem→
Solution, figure plates, process rows, outcome + Code/Live buttons, next-sheet
handoff. Contains a visible "this is a template" disclaimer — **keep it until
he fills real content** (protects him from fake-metrics readings).

## 5. Code architecture & conventions

- `index.html` has **TWO `<script>` blocks**: a small standalone **gate script**
  right after the lobby markup (must survive main-script crashes — never merge
  them), and the main script at the end. Validate each block separately:
  `node --check` per block, not concatenated.
- Every page top has an **EDIT MAP** comment (Ctrl+F search keys). Placeholder
  spots are marked; some carry `(edit: your real result)` or `[EDIT]`.
- Guards everywhere: `prefers-reduced-motion` disables all animation (verify
  final states are visible!), `(hover:hover)` gates pointer effects, a
  `<noscript>` block unhides the hero and removes the preloader.
- Observers: `.reveal` fade-ups, `.idx` self-draw, rail dots + `#loc` labels
  (shared IntersectionObserver with an `idMap`), night toggles, per-effect
  observers in Principles.
- Copy voice: first person, specific, no slogans. Mono labels UPPERCASE.

## 6. Hard-won lessons — read twice

1. **Interrupted turns still execute.** Repeatedly, an assistant reply appeared
   empty/cut off but its tool calls HAD partially or fully applied — sometimes a
   *different variant* than later attempted. **Always audit with `grep -c` on
   distinctive markers before applying anything**, and use Python
   `assert s.count(x) == 1` string surgery so mismatches abort before writing.
2. **Exact-string replaces die on formatting drift** (a `140px 140px, 140px`
   space variant silently no-op'd once and doubled the dot grid). Probe the
   real file text first; verify counts after.
3. **Bugs that shipped and were fixed** (don't reintroduce): `cDown` TDZ crash
   (declare-before-rAF-loop!), duplicate const declarations from double-applied
   blocks, `tbClock` null crash killing everything after it, orphaned `.`
   outside the logo, loc indicator overlapping nav (now in a `.brand` group).
   A single JS error halts everything after it — that's WHY the gate script is
   standalone.
4. **GitHub Pages quirks he hit**: stuck deployments (fix: Settings→Pages source
   toggle + fresh commit; `.nojekyll` added), Actions red-X reading, and one
   AI-generated bad advice episode (a Node build workflow for a no-build site —
   he pastes external AI advice sometimes; sanity-check it against his actual
   setup before endorsing).

## 7. His taste (learned the hard way)

Likes: night-mode flip, the ID badge, kinetic typography, the particle sphere,
minimal-but-alive, "wow" moments that mean something. Dislikes/rejected: word
spheres ("cringe"), giant marquee footers, ink-wash/breathing backgrounds,
context cursor labels (except the badge's), anything that "shouts AI CODED" —
emoji icons, uniform card grids, centered-everything, slogan copy. He responds
well to honest RED TEAM framing and has now **granted editorial judgment**:
push back when a request would hurt the portfolio.

## 8. Content status & the ONLY remaining work

**Everything personal is still placeholder** except his name/photos he's added
locally: email `hello@example.com`, social `href="#"`, LinkedIn `your-username`,
all four projects, all certs, case-study content, Plates images/metadata,
education/experience details, `resume.pdf`. Two items need his conscious
sign-off: **P.04 "AI-assisted. Human-accountable."** (a public promise he must
actually keep — keep only if he owns it) and **References** (restore only with
real, permissioned quotes).

**The design phase is DECLARED FINISHED** — communicated and agreed. The next
session's job is to help him fill real content, then do one final proofread/QA
pass (link check, image check, mobile check, console check). If he asks for new
features, the right first response is gentle pushback: every hour on effects
now has negative return. He knows this; hold the line kindly.

*— Fable, July 2026. It was a good build. Take care of it — and of him.*
