# MatrixHR marketing site: direction and system

This is the working brief behind `apps/web/src/app/page.tsx`. Read it before changing the landing page, so new
sections keep to one idea instead of drifting back toward a generic SaaS template.

## The idea

**Everything HR does ends up on a payslip.**

A clock-in, a day of unpaid leave, an approved fuel claim, a loan instalment: in a Pakistani company each of these
lands on one document at month end. Today that document is assembled by hand from a biometric export, an email
thread, a WhatsApp group, a loan register and a bank portal. MatrixHR connects those sources, then shows its working.

So the payslip is the page's visual thread:

- The hero is a live payslip. Visitors toggle this month's events and the same calculation the API runs
  (`apps/web/src/lib/payslip.ts`, built on the rule constants in `@matrixhr/shared`) recomputes each line and names
  the module it came from.
- The story sections follow the payslip's life: where its inputs come from, how a run is checked by a second person,
  how it is paid, and who is allowed to read it.
- The signature moment is the **Locked** stamp in the payroll-run sequence.

The visitor should leave thinking: "they understand how our month-end actually works."

## What we avoided, and why

Competitor research (September 2026): Bayzat, Keka and ZenHR all open with a centred headline, "AI-powered" chips, a
device mockup and a logo strip. Global references (Linear, Ramp, Mercury) differ in tone but share one move worth
learning from: they lead with the real product at a legible scale, and let short, dry copy carry the voice.

So: no device mockups, no logo strip (we have no customers we may name yet), no invented numbers or testimonials, no
"AI-powered" badges, no purple, no glow, no bento grid. Proof is things a buyer can verify: behaviour of the product,
and the tests that back the security claims.

## Tokens

Defined as CSS custom properties on `.mx` in `globals.css`, with a dark variant under `.dark .mx`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--mx-paper` | `#F2F5F1` | `#0B1411` | Page ground. Cool, green-tinted, never cream. |
| `--mx-sheet` | `#FFFFFF` | `#111D19` | Payslips and records: the "document" surface. |
| `--mx-ink` | `#0B1F19` | `#E7EEEA` | Text. |
| `--mx-ink-2` | `#4A5E57` | `#9DB0A8` | Secondary text. |
| `--mx-rule` | `#D3DDD7` | `#22322C` | Hairlines, ledger rules. |
| `--mx-ledger` | `#0A2A20` | `#06190F` | Deep green sections (the "back office"). |
| `--mx-signal` | `#1C7E57` | `#4CB588` | Brand action, positive values. |
| `--mx-stamp` | `#A96A06` | `#E0A526` | Approval and lock stamps only. |
| `--mx-debit` | `#9B3B2A` | `#E58B77` | Deductions on the payslip. |

Type:

- Display: Bricolage Grotesque with its `wdth` axis narrowed (≈ 82) and tight leading. Condensed, slightly
  eccentric, and it matches the product UI.
- Body and figures: Figtree. Every amount uses tabular figures so columns align like a ledger.
- Scale: display `clamp(2.75rem, 6vw, 5.5rem)` / 0.95, h2 `clamp(2rem, 3.8vw, 3.4rem)` / 1.02, h3 1.25rem,
  body 1.0625rem / 1.6, small 0.875rem. Sentence case everywhere. No all-caps eyebrows.

Shape: documents (payslips, records) get a 4px radius and a torn/perforated edge; controls get 10px. The difference
is deliberate: paper versus interface.

Grid: 12 columns, max width 80rem, gutter 16px on mobile, 32px from `lg`.

## Motion

Smallest stack that works: CSS transitions plus IntersectionObserver and one scroll-progress hook. No GSAP, Lenis or
WebGL. Nothing on this page needs a timeline library, and each would add weight to the first load.

| Tier | Duration | Easing | Used for |
|---|---|---|---|
| micro | 140ms | `cubic-bezier(.2,.7,.2,1)` | hover, press, focus |
| standard | 280ms | same | toggles, tabs, redaction |
| expressive | 620ms | `cubic-bezier(.16,1,.3,1)` | payslip lines entering, number roll |
| stamp | 460ms | `cubic-bezier(.34,1.56,.64,1)` | the Locked stamp |

One orchestrated load moment: the hero payslip "prints" line by line. After that, motion answers the visitor
(toggling events, scrolling the run, switching roles). Sections do not all fade upward.

`prefers-reduced-motion`: numbers jump to their final value, the run sequence becomes a static list of four states,
the stamp appears without scaling.

## CTA architecture

- Primary: **Start free trial** (nav, hero, pricing, closing).
- Secondary: **See pricing** (hero), because price is the first question in this market.
- Low commitment: the hero payslip itself, then **Sign in** for existing customers.

## Honesty rules

- Payroll engines exist for Pakistan and the US. Do not claim GCC payroll.
- The default tax slabs are an editable rule set, not a statement of current FBR rates. Keep the disclaimer under the
  hero payslip.
- Do not put gratuity on screen: it is not modelled.
- Pricing comes from `docs/product.md` and `PRICING_TIERS`. Keep them in sync.
