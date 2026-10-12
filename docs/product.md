# MatrixHR — Product Context

**Tagline:** The connected HR platform built for South Asia and the Middle East.

**Type:** Multi-tenant SaaS — HR & Payroll Software

## Vision

Become the default HR operating system for businesses in South Asia and the Middle East — combining global product quality with deep regional fluency.

## Problem

Global HR platforms (BambooHR, Rippling, HiBob) do not serve our region well:

- No Pakistani payroll (FBR tax, EOBI, PF, gratuity)
- No Urdu/Arabic support
- USD pricing — too expensive for local SMBs
- No local bank integration
- Slow, foreign support

## Solution

MatrixHR fills this gap with localization, modern UX, WhatsApp-native workflows, and transparent PKR pricing at 60–70% lower cost than global tools.

## Target Customers

- **Primary vertical (MVP):** Software houses and IT services — 20–500 employees
- **Expansion:** Manufacturing, retail, schools, hospitals, professional services, construction
- **Geography:** Pakistan first → UAE, Saudi, Bangladesh

## Founding Decisions (Locked)

| Decision | Choice |
|----------|--------|
| Funding | Bootstrap until 3–5 pilot clients validate; revisit seed at ~10 paying customers |
| Team | Solo founder owns product + engineering; hire sales at Month 4, CS at Month 6 |
| 3-year goal | Lifestyle-to-growth hybrid: profitable PK SMB SaaS, optional Series A at Year 3 |
| Initial vertical | Software houses — flexible attendance, project-based orgs, tech onboarding |

## Core Modules (14 total)

### MVP (Months 1–6)

1. Authentication & Multi-Tenancy
2. Employee Database (HRIS)
3. Leave Management
4. Attendance & Time Tracking
5. Onboarding & Offboarding
6. WhatsApp Integration
7. Employee Self-Service Portal (subset)

### Phase 2 (Months 7–12)

8. Payroll Engine
9. Recruitment / ATS
10. Performance Management
11. Reporting & Analytics

### Phase 3 (Months 13–18)

12. Learning Management System (LMS)
13. AI-Powered Features
14. Marketplace & Integrations

## Pricing (USD, manual bank-transfer renewal)

Source of truth: `USD_PLAN_CATALOG` and `AI_CREDIT_PACKS` in `packages/shared/src/constants.ts`.

| Plan | Monthly / yearly | Includes |
|------|------------------|----------|
| Starter | $25 / $250 | Core HR, leave, attendance, self-service, mobile |
| Growth | $69 / $690 | Starter + payroll, recruitment, onboarding, WhatsApp |
| Business | $149 / $1,490 | Growth + performance, LMS, reporting, API, AI credits; +$0.50 per extra active employee |
| Enterprise | Custom | SSO, dedicated CSM, SLA |

New signups get a 30-day trial with 100 AI credits. AI credit packs: 1,000 for $10, 5,000 for $45, 15,000 for $120 (never expire).
The earlier PKR per-employee plans are kept for existing customers and are not offered to new signups.

## Success Metrics — Year 1

- MVP launched and stable
- 10 paying customers
- PKR 5–10 lakh MRR
- DAU/MAU > 50%
- Time to first value < 14 days
- NPS > 40

## Software-House Defaults

- Leave: Annual 14d, Casual 10d, Sick 8d, flexible half-day
- Shifts: Flexible 8-hour
- Onboarding: Software Engineer template (GitHub, Slack, laptop, NDA, 3-month probation)
- Departments: Engineering, Product, Sales, HR, Finance, Operations
