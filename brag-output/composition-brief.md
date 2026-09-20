# Hyperframes Composition Brief: MatrixHR

## Objective
Create a short launch-style brag video for MatrixHR.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 21 seconds

## Source Material
- Project root: `E:\Matrix HR`
- Primary files read: `README.md`, `docs/product.md`, `apps/web/tailwind.config.ts`, `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/login/page.tsx`, `apps/web/src/app/(app)/payroll/page.tsx`, `apps/web/src/app/(app)/approvals/page.tsx`, `apps/api/src/payroll/payroll.service.ts`
- Product name: MatrixHR
- Tagline / strongest claim: "The connected HR platform built for South Asia and the Middle East."
- Key UI or visual moment to recreate:
  - The Payroll screen (`payroll/page.tsx`): period in mono, status badge, help text, action buttons that change per status.
  - The Approvals screen (`approvals/page.tsx`): "Pending Items (N)" card with request rows and Approve / Reject buttons.
  - The login brand panel (`login/page.tsx`): deep green gradient, blurred emerald orbs, rounded "M" tile plus wordmark.
- Copy that must appear verbatim:
  - "FBR tax." / "EOBI." / "PF."
  - "Global HR software never learned them."
  - "The connected HR platform built for South Asia and the Middle East."
  - Status help texts: "Awaiting approval from someone other than the preparer." · "Approved — lock to generate and archive payslips." · "Locked. Payslips are generated."
  - Button labels: "Submit for Review", "Approve", "Lock & Generate Payslips"
  - "Approvals" · "Review and action pending requests" · "Pending Items (3)"
  - "Now they're checkboxes."
- Do NOT claim: gratuity. The payroll service states gratuity and notice-period pay are not modelled. Do not put "gratuity" on screen.

## Creative Direction
- Tone preset: default
- Creative direction: dry regional-SaaS launch. The paperwork nobody else localized.
- Interpretation: Clean, warm and confident; humor from understatement. Fast motion and snappy transitions, but every line the viewer must read holds long enough to read it.
- Angle: Every generic HR tool skips the acronyms a Pakistani payroll admin deals with every month. The video opens on those acronyms as a small wall of dread, shows the real payroll approval chain and approvals inbox working, then pays the acronyms off as tidy checkboxes.
- Hook: Three terms type out one at a time ("FBR tax." / "EOBI." / "PF."), then "Global HR software never learned them."
- Outro / punchline: The three terms return as chips and check themselves off, then "Now they're checkboxes." Then hold on the M tile and MatrixHR wordmark while the music fades.
- Avoid:
  - Generic SaaS language ("streamline", "all-in-one", "supercharge")
  - Abstract filler visuals
  - Unrelated visual redesign; recreate the product's own look
  - Invented numbers or features beyond what the plan lists

## Visual Identity
- Background: `#08251c` (brand-950), gradient toward `#0c3526` and `#13513b` (brand-800), as on the login brand panel
- Text: white on dark; on the recreated light UI `hsl(172 32% 11%)`, muted `hsl(165 9% 41%)`
- Accent: `#2a9a6d` (brand-500); warm secondary `#fbbf24`, sparingly
- Recreated UI surface: `hsl(150 25% 98%)` page, `#ffffff` cards, `hsl(152 14% 89%)` borders, rounded-lg corners, soft shadow (`0 2px 4px rgba(8,37,28,.06), 0 12px 32px -8px rgba(8,37,28,.14)`)
- Display font: Bricolage Grotesque (headings; tracking about -0.015em)
- Body font: Figtree
- Visual references from the project: login brand panel (blurred emerald orbs, rounded "M" tile), payroll status badge and mono period, approvals request rows

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 4.5s (0.0-4.5) — three terms typed one at a time, then "Global HR software never learned them."
2. Reveal — 4.5s (4.5-9.0) — M tile + MatrixHR wordmark, tagline (two lines)
3. Payroll, working — 5.0s (9.0-14.0) — Payroll card; cursor clicks Submit for Review (10.02) → Approve (11.52) → Lock & Generate Payslips (12.52); badge DRAFT→REVIEW→APPROVED→LOCKED; caption "Payroll that needs a second pair of eyes."
4. Approvals — 3.0s (14.0-17.0) — three request cards arrive (14.52, 15.02, 15.52), Approve clicked at 16.52, count 3→2; caption "Every request. One inbox."
5. Punchline + logo — 4.0s (17.0-21.0) — chips slam in at 17.02 and check off; "Now they're checkboxes."; M tile + MatrixHR hold; music fades

## Audio
- Audio role: warm bed with sparse professional accents
- Audio arc: quiet keyboard ticks over a low bed → bed lifts at the reveal → clicks and card taps ride the beat grid → payoff on the strong cue at 17.02 → fade under the final logo
- Music: `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3`
- Music treatment: low bed under the hook, lift slightly at 4.5s, fade out over roughly the last 1.5s
- Music cue guidance: bundled preset — `C:\Users\mrb\.claude\plugins\cache\brag\brag\0.2.2\skills\brag\assets\music\cues\happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json` (120.19 BPM; beat grid starts 3.02s). Strong-cue lock: 17.02s (optional 16.02s). Beat-grid: payroll clicks 10.02 / 11.52 / 12.52; approval cards 14.52 / 15.02 / 15.52.
- Audio-reactive treatment: subtle; music RMS/bass gently breathes the blurred emerald glow behind the hook and outro and the recreated UI card presence. No waveform or equalizer visuals.
- Audio-coupled moments:
  - Scene 1 hook — typed terms — keypress ticks
  - Scene 3 — three simulated cursor clicks — soft UI clicks matched to the badge flip frames
  - Scene 4 — three card arrivals + Approve click — subtle taps
  - Scene 5 — chips check off — small ticks; final logo — one low, dry hit
- SFX selection guidance: match sound to motion; sparse; no whooshes, risers or comedic stings.
- SFX analysis guidance: `C:\Users\mrb\.claude\plugins\cache\brag\brag\0.2.2\skills\brag\assets\sfx\sfx-analysis.md` (prefer low high-frequency-risk files for repeated moments; keyboard set in `assets/sfx/keyboard/` for typing).
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copy the chosen music and any Hyperframes-selected SFX into `brag-output/composition/assets/`

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core` (composition contract + `data-*` timing), `hyperframes-animation` (motion), `hyperframes-creative` (design spec, beats, audio-reactive), `hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli` (lint/check/render). /brag is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project (Payroll + Approvals recreations, tagline, and status strings above).
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds (target 21s).
- Include the planned music/SFX layer.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Ignore cues that hurt readability, scene pacing, or the product story.
- Major reveals may move toward nearby strong cues within about 0.15s; smaller entrances may align to beats within about 0.10s. Use only 1-3 strong cue locks.
- Use SFX to support motion and interaction; restraint when the edit is already busy.
- Honor the planned music treatment (low bed, lift at reveal, fade under final logo).
- Consider the audio-reactive workflow for subtle glow/presence only.
- Use local assets for audio and any required runtime/media dependencies when possible.
- Run `hyperframes check` before render — it is brag's single gate.
