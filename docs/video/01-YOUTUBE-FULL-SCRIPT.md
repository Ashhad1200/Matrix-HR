# MatrixHR — Full YouTube Explainer Script
*Long-form product tour, ~12–16 minutes. Format per scene: **VISUAL** (what's on screen / B-roll) and **VO** (voiceover, read aloud). Tone: calm, confident, plain-spoken. Swap "MatrixHR" for a reseller brand if producing a white-label cut.*

**Runtime target:** 13–16 min · **Voice:** one narrator · **Lower-thirds:** feature names as they appear.

---

### SCENE 1 — Cold open (0:00–0:35)
**VISUAL:** Black screen. A single payslip fades up, line by line — Basic salary, Income tax, EOBI, Provident fund, Loan instalment, Net pay. The net-pay number lands last.
**VO:** Every month, a number lands in your team's bank accounts. And everything your HR team did — the leave, the attendance, the expenses, the loans — it all ends up right here, on the payslip. The problem is, in most companies, that number is assembled by hand, from five different places, by one person, at midnight. This is about fixing that.
**ON-SCREEN TEXT:** *MatrixHR — everything HR does ends up on a payslip.*

### SCENE 2 — The problem (0:35–1:30)
**VISUAL:** Five scattered objects on a desk — a spreadsheet, a biometric clock, a phone showing WhatsApp, a paper notebook, an accountant's calculator. Thin red lines try to connect them and tangle.
**VO:** Here's how it usually works. Employees live in a spreadsheet. Attendance is on a biometric machine. Leave gets approved on WhatsApp. Loans are tracked in someone's notebook. And at month-end, an accountant re-types all of it into payroll. Every one of those hand-offs is a chance to lose money, or lose trust. A missed unpaid day. A loan instalment nobody deducted. An approval nobody can find.
**VISUAL:** The tangle resolves into one clean line feeding a single document.
**VO:** MatrixHR replaces the whole chain with one employee record that every part of the system reads from. Type a person's details once — and payroll is built from live data, not re-typed from memory.

### SCENE 3 — What it is (1:30–2:20)
**VISUAL:** The MatrixHR dashboard loads. Clean sidebar, the brand mark top-left.
**VO:** MatrixHR is HR and payroll software built for companies in Pakistan and the Gulf. It's one system that covers hiring, time, pay, performance and the paperwork around them. It runs in the browser, it works on a phone, and there's a mobile app. And it's multi-tenant — which is a technical way of saying: many companies can run on it, and no company can ever see another's data. We'll come back to that, because it matters more than it sounds.
**ON-SCREEN TEXT:** *One record. Every module. One payslip.*

### SCENE 4 — Who sees what (2:20–3:20)
**VISUAL:** The same employee record viewed four times, side by side: as an Admin (everything), a Manager (team view), the Employee (self-service), and — faded, separate — the Operator's backoffice.
**VO:** Open one employee, and what you see depends on who you are. An HR admin sees everything. A manager sees their own team — their reports' leave, performance and approvals, nothing more. The employee sees themselves: their profile, their payslips, their leave balance. And the operator — the person running the platform — never sees any company's HR data at all; they get a separate backoffice.
**VISUAL:** The "Pay, ID and bank" fields visibly blank out in the Manager and Employee-of-someone-else views.
**VO:** Salary, national ID and bank details are the tightest. HR and the person themselves — that's it. Managers and colleagues get a directory view with those fields stripped out entirely. And the menu you see is driven by your role — but the real lock is in the server, not the menu.

### SCENE 5 — The payroll run (3:20–5:10) — *the centrepiece*
**VISUAL:** A payroll run screen. Employee rows populate. A "Prepare" button, then a separate "Approve" button that is greyed out for the same user.
**VO:** This is the heart of it — a payroll run that takes two people to approve. One person prepares it. A different person approves it. MatrixHR will not let the person who prepared a run sign off on their own work — because the mistakes that cost the most are the ones nobody else looked at.
**VISUAL:** Zoom into one employee's breakdown. Each input slides in and labels itself.
**VO:** For each person, the run pulls everything together on its own. Base salary. Allowances, bonuses and deductions — what we call pay components. Unpaid days from attendance, pro-rated to the month. Then the statutory pieces — for Pakistan, the FBR income-tax slabs, EOBI and provident fund; and there's a United States engine too. Those rates live in a rule set versioned by date, so when the budget changes, it applies from the right day, and last month's run stays correct. Finally, expense reimbursements and loan instalments.
**VISUAL:** Three outputs fan out: a payslip PDF, a bank file, a QuickBooks journal.
**VO:** Press approve, and out comes a payslip for every employee that explains every line, a bank file to pay everyone at once — Meezan, HBL, or a generic format — and a journal for your accountant. And if you ever need to reopen a locked run, you can — but only with a reason, and it's recorded.

### SCENE 6 — Time: leave, clock, timesheets (5:10–6:30)
**VISUAL:** A leave calendar; a browser clock-in button; a ZKTeco terminal; a timesheet grid.
**VO:** Feeding all of that is time. Leave types, yearly balances, carry-forward — set them once and everyone gets a balance automatically. And leave counts working days only: weekends and public holidays are never deducted, and every company sets its own weekend — which, in this region, isn't always Saturday and Sunday. An employee can edit or cancel a request while it's still pending, without emailing anyone.
**VISUAL:** Punches flow from the ZKTeco device into the attendance list.
**VO:** Attendance comes from wherever your team actually is — a browser, a shared kiosk screen, or a ZKTeco biometric terminal that pushes punches straight in. And timesheets track hours against projects, approved by managers. All of it lands back on the payslip.

### SCENE 7 — WhatsApp approvals (6:30–7:30)
**VISUAL:** A phone. A WhatsApp message arrives: "Leave request from Ali — reply with code 7K4M2P to approve." The manager types the code; a green tick; a balance updates on the laptop behind.
**VO:** Here's a small thing that changes how fast work moves. Managers approve leave from WhatsApp. The request arrives with a one-time code. Reply with it, and the leave is approved, the balance updates, done — no laptop. The codes skip the characters that look alike — zero, O, one, I — so they read cleanly. Each code works once and expires within a day. Employees opt in before any message is sent, and STOP ends it. The webhook is signature-checked, so a forged message is ignored. And every approval from chat goes into the audit log, exactly like one made in the app.

### SCENE 8 — The AI assistant (7:30–8:40)
**VISUAL:** A chat panel. User types: "How many people are on leave next Tuesday?" A clean answer. Then: "Apply two days of annual leave for me next week." The assistant shows a **confirmation card** before doing anything.
**VO:** There's an assistant built in. You can ask it about your own data — in plain language, and only ever scoped to what you're allowed to see. "Who's out next week." "What's my leave balance." But here's the line it won't cross: before it changes anything, it asks. And it will never finalise payroll, change a salary, or touch bank details — full stop. The operator picks the model behind it — OpenAI, Claude or Gemini — and usage runs on a simple credits system. Under a reseller's brand, it even speaks in that brand's name.

### SCENE 9 — Activity Monitor (8:40–10:10) — *handle with care, lead with transparency*
**VISUAL:** An HR toggle: "Activity Monitor — off." It turns on; a policy editor appears. Then an **employee's** screen: a consent screen, an "Install agent" button, and a tray icon lighting up.
**VO:** Now, monitoring — and MatrixHR does this deliberately differently. It's optional, and it's off until you turn it on. When you do, you first publish a policy. Then the employee installs the agent themselves, after reading and accepting that policy — and a tray icon stays visible the whole time it runs.
**VISUAL:** Split card: "Records — active/idle time, mouse & keyboard counts, app in focus" vs "Never — keystrokes, screen, clipboard, file contents."
**VO:** What does it record? Time and activity. Active versus idle time. Counts of mouse and keyboard activity — never which keys. The app or website in focus. What does it never touch? Your keystrokes. Your screen. Your clipboard. The contents of anything. There's no AI reading the logs.
**VISUAL:** The employee's "My Activity" page showing their own day; then an HR alert: "Ali's agent stopped reporting at 2:14pm."
**VO:** Every employee can open their own page and see exactly what's been collected about them. HR sees daily summaries — not keystrokes, not screens. And if an agent is switched off, HR is told — so you know when monitoring stops, without hiding that from the person. This is monitoring you can show your team. The Windows app ships first, then Mac and Linux.

### SCENE 10 — Security & isolation (10:10–11:20)
**VISUAL:** Two company logos. An arrow from Company B tries to reach Company A's data and hits a wall. A test runner ticks through routes, all green.
**VO:** Back to that promise — one company can never read another's data. Every record carries its company; every query is scoped to it. And to prove it's real, there's a test that replays every single route in the system as a user from a second company — and counts anything that comes back as a failure. The build doesn't ship if one row crosses.
**VISUAL:** Quick montage: 2FA code, a lock icon, encrypted keys, a signed webhook, a private file link expiring.
**VO:** On top of that: two-factor sign-in, lockout on repeated wrong passwords, every session signed out when a password changes, encrypted bank and device credentials, private files behind links that expire, and a production server that refuses to even start on insecure defaults. Everything sensitive is in the audit log.

### SCENE 11 — Pricing & currency (11:20–12:20)
**VISUAL:** The pricing page. A PKR / USD toggle flips; the numbers change from rupees to dollars.
**VO:** Pricing is simple, and it's in your currency. Companies in Pakistan are billed in rupees; everyone else in dollars — picked from your country when you sign up. Three plans — Starter, Growth, Business — each with a set price in both currencies. No exchange-rate surprises. You pay by bank transfer: upload the proof, the operator approves it, and you get a numbered receipt. Every new company starts with a thirty-day free trial and a hundred AI credits.

### SCENE 12 — White-label & single-company (12:20–13:20)
**VISUAL:** The same app re-skinned with a different logo and colour; then a single isolated building icon labelled "your own server."
**VO:** And there are two ways to run it. If you're a reseller, you can run the whole thing under your own brand — your name, your logo, your colours, your domain, across the app, the emails, even the payslips — hosting many client companies on one server, each one fully walled off from the others. Or, if you're a single company that wants its own private copy on its own server, you can run that too, with everything switched on and none of the billing machinery.

### SCENE 13 — Close (13:20–14:10)
**VISUAL:** Return to the payslip from the cold open — now surrounded by small icons of every module feeding into it.
**VO:** So that's MatrixHR. One employee record. Every part of HR reading from it. Attendance, leave, expenses, loans and pay components flowing into a payroll run that a second person approves — and out as payslips, bank files and clean accounts. With the things teams here actually use: WhatsApp approvals, biometric clocks, rupee-or-dollar billing, an assistant that asks before it acts, and monitoring you can show your team. One record, every module, and a number at the bottom you can defend.
**ON-SCREEN TEXT:** *MatrixHR · matrixhr.treevoxa.com · Start a free trial.*
**VO:** Create your company, import your people, and run a draft payroll against last month's numbers. See it for yourself.

---

## Production notes
- **Honesty guardrails:** don't show fake customer logos or invented statistics. The test-suite proof point ("replays every route from another company") is real and powerful — use it. Tax-rate accuracy: always add the caption *"Confirm current rates with your advisor."*
- **White-label cut:** replace the brand name/logo/colour and drop Scene 12's white-label half; keep single-company if relevant.
- **Shorter 6-min cut:** keep Scenes 1, 2, 5, 7, 9, 10, 13.
- **Captions:** burn in feature names as lower-thirds; this plays silently on LinkedIn/X too.
