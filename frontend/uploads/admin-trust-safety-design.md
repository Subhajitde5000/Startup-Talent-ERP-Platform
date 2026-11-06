# Admin Trust, Safety and Quality Design (production spec)

**App:** Platform admin console on its own subdomain (for example `admin.yourdomain.com`). Routes below are relative to that subdomain.
**Users:** trust and safety moderators, senior moderators, AI quality reviewers, finance (for money disputes), compliance officers, and super admins.

These seven pages keep the platform safe, fair and trustworthy. They are the other end of everything the public-product designs promise: the employer **Trust and Safety** page (reports, flags, appeals), the job seeker **Report a concern** and scam center, the interview trainer **Request a review** flow, the mentor and investor dispute paths, and the platform posting rules. Your proposal lists "dispute handling," "moderation" and "spam and fake-posting reports" among the admin responsibilities and sets AI guardrails (human review for scoring that affects people, published rubrics, bias testing).

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Moderation Queue | `/moderation` | Flagged jobs, profiles, messages, reviews and startup content waiting for a human decision |
| 2 | Reports | `/reports` | Reports from users, clustered and linked to the content and accounts concerned |
| 3 | Appeals | `/appeals` | Independent re-review of moderation, verification and restriction decisions |
| 4 | Disputes | `/disputes` | Payments, mentor sign-offs, agreements, offers and fees between parties |
| 5 | Fraud and Abuse Monitoring | `/fraud` | Scam patterns, fake accounts, suspicious payments and logins; cases and responses |
| 6 | Policy Rules and Blocklists | `/policies` | Versioned rules, banned questions and terms, fee and contact patterns, testing and rollout |
| 7 | AI Quality and Human Review | `/ai-quality` | Review of disputed AI scores, bias and drift monitoring, rubric audits |

> **Subdomain note.** The admin console is a separate app, so there is no per-route role-based file. Section 3 gives a short **who sees what** table (internal roles) because it decides what each page shows. Section 12 lists the controls the subdomain still needs (single sign-on, mandatory two-factor, server-side permission checks, masking, audit), because a separate address doesn't protect anything on its own.

> **Legal and wellbeing reminder.** Moderation involves legal duties (for example handling child-safety material, law-enforcement requests, intermediary and grievance rules such as India's IT Rules, data protection and retention) and exposure to distressing content. Get legal advice before launch on reporting obligations, evidence retention, what you may tell users, and grievance officer and response-time requirements. Build reviewer wellbeing protections in from day one (section 11).

---

## 1. Design principles

- **Policy first, not personality:** every decision cites a published rule and a reason code. Two moderators looking at the same evidence should reach the same decision.
- **People decide anything serious:** automation can flag, rank, limit temporarily and queue. A person decides removals, suspensions, bans, rejections and penalties. Safe, reversible, temporary limits may be automatic.
- **Fair and proportionate:** a clear ladder from guidance to warning to limits to removal to suspension to permanent ban. The response matches the harm, the history and the evidence, never who the person is.
- **Everyone can appeal:** every adverse decision carries a path to an independent reviewer.
- **Protect people first, then data:** urgent safety and fraud cases jump the queue. Preserve evidence before acting, and handle a victim's identity with extra care.
- **Minimum exposure:** reviewers see only what they need. Distressing or sensitive content is blurred by default, and no one is asked to look at it longer than needed.
- **Transparent to users, opaque to abusers:** users learn what rule was broken and what happens next. Detection methods and thresholds stay internal.
- **Learn from errors:** overturned decisions and false positives feed rule and model improvements, tracked as process quality and never as individual rankings.
- **Everything is traceable:** every view, action, message, override and export is written to the audit log.

---

## 2. Design tokens and shared look

Same tokens as the Admin Dashboard (ink, ivory, one gold accent, light and dark themes; `Fraunces` and `Inter`; IST timestamps with a visible time zone; 8px grid; 12px cards; 10px controls).

### Shared chips

| Group | Chips |
|---|---|
| **Severity** | `S1 Critical` (error fill), `S2 High` (error tint), `S3 Medium` (warning tint), `S4 Low` (stone) |
| **Case status** | `New` (stone), `In review` (ink outline), `Waiting for info` (info tint), `Second review` (gold-tint), `Action taken` (success tint), `No action` (stone), `Escalated` (gold-tint), `Appealed` (gold-tint), `Closed` (stone outline) |
| **Content type** | `Job`, `Profile`, `Message`, `Review`, `Startup page`, `Resume`, `Document`, `Event` |
| **Action taken** | `Warned`, `Edited`, `Removed`, `Limited`, `Suspended`, `Banned`, `Restored` |
| **Source** | `User report`, `Automated flag`, `Staff-initiated`, `Provider alert`, `Legal request` |
| **SLA** | `On track`, `At risk`, `Breached` |
| **Automation badge** | `Auto-limited (temporary)` marks any automatic safety limit awaiting human review |

### Shared components
- **Case header:** ID, type, severity, status, SLA and target, claim lock ("Being reviewed by {name}"), **Claim**, **Release**, **Escalate**.
- **Content snapshot:** a frozen copy of the content at the time of flag or report (text, images blurred by default, structured fields), with a clear label "Snapshot taken {time}" so edits or deletions after the report don't erase evidence. A link opens the live item if it still exists.
- **Blur and reveal:** images, attachments and graphic or abusive text start blurred or collapsed with a content-type label; **Reveal** is a click, is logged, and auto-blurs after 30 seconds of inactivity. Severity-1 categories (for example child safety) never show media to general moderators: they go straight to a specialized team and the legal path (section 4.1).
- **Policy panel:** the relevant rule text (current version), examples, and the allowed actions for that rule, with the reason code picker.
- **Context panel:** history of the account or content (previous flags, actions, appeals) as IDs and outcomes, linked cases, and verification status. Personal data is masked until revealed with a reason.
- **Action drawer:** choose an action from the ladder, set a duration where relevant, pick reason codes (policy IDs), edit the user-facing message from a template, and see a preview of consequences ("This will pause 2 live jobs and notify 14 candidates in progress").
- **Timeline:** every event on the case with actor and time.
- **Reporter protection:** the reporter's identity is never shown to the reported party and is hidden from most moderators (visible only to senior moderators and compliance when needed, with logging).

### Keyboard shortcuts (case pages)
`c` claim · `r` release · `n` note · `e` escalate · `]` / `[` next or previous case · `1` to `4` quick severity set (supervisors) · `?` shortcuts. Disabled while typing.

---

## 3. Internal roles and what they see (content scoping)

| Internal role | Access in this area |
|---|---|
| Trust and safety moderator | Moderation, Reports, Fraud (assigned types), Appeals as a *non-original* reviewer; can apply actions up to **Suspend (time-limited)**; can't permanently ban or override a senior decision |
| Senior moderator or supervisor | Everything in the area; permanent bans, overrides, severity changes, assignment, rule exceptions, second reviews; can see reporter identity for a legitimate need (logged) |
| Child safety and legal escalation team (named individuals) | Severity-1 child safety and legal-request cases only; specialized tooling and law-enforcement handling |
| Fraud analyst | Fraud and Abuse Monitoring (rules, cases, entity links); can apply temporary limits and holds; permanent actions go through a senior moderator |
| Support agent | Can see status of a user's case and the message history shown to the user; can't see evidence or reporter identity |
| Finance | Disputes involving money (payments, payouts, refunds, fees); no content moderation |
| AI quality reviewer | AI Quality and Human Review only |
| Compliance officer | Read-only across cases, plus legal holds, regulator exports, law-enforcement request handling and the grievance process |
| Super admin | Everything, including policy rule changes through Part F (with dual control) |
| Others | No access |

The server enforces this on every request. Moderators with a conflict (relationship, employment or interest) declare it with a button; the case is reassigned and logged.

---

# Part A. Moderation Queue: `/moderation`

## A.1 Purpose
One list of every piece of content or behavior waiting for a human decision from automated flags, user reports and staff, ordered by harm and deadline.

## A.2 Layout
```
┌──────────────────────────────────────────────────────────────┐
│ Title "Moderation"                        [Saved views ▾]    │
├──────────────────────────────────────────────────────────────┤
│ Tabs: Queue · My cases · Auto-limited · Second review · Held │
├──────────────────────────────────────────────────────────────┤
│ Summary strip (4 cards)                                      │
├──────────────────────────────────────────────────────────────┤
│ Toolbar: search · filters · sort · density   [Next case]     │
├──────────────────────────────────────────────────────────────┤
│ Case table                                   │ Preview drawer│
└──────────────────────────────────────────────────────────────┘
```

### Summary strip
| Card | Example |
|---|---|
| Waiting | 63 |
| S1 and S2 open | 4 (error tint when above zero) |
| At risk or breached | 5 |
| Auto-limited awaiting review | 7 (limits expire if not reviewed in 24 hours) |

## A.3 Table

| Column | Content |
|---|---|
| Case | ID (mono), content type icon |
| Severity | S1 to S4 chip |
| Policy | Rule ID and short name ("P-04 Fee requests") |
| Source | Chip (User report, Automated flag, Staff) with report count |
| Subject | Job title, profile name or message excerpt **hidden by default** (shows "Message in thread"), organization or account ID |
| Created | Relative age |
| SLA | Chip with time remaining |
| History | Count of prior actions on the account (hover shows summary) |
| Assigned | Reviewer or lock icon |
| Auto-state | Whether an automatic limit is in effect |
| Actions | **Open**, **Claim** |

- **Default order:** severity first, then time to target, then number of independent reports (corroboration), then age. No other attributes are used.
- **Next case** claims the top eligible case for the person (respecting their training scope) and opens it.
- Row click opens a **preview drawer** with the policy, severity reasons, snapshot (blurred), history and the suggested actions.

## A.4 Service targets (defaults, configurable)
| Severity | Examples | First action target |
|---|---|---|
| S1 Critical | Child safety, credible threats, self-harm risk, active large-scale fraud | Immediately; on-call 24 hours a day; 15 minutes to first action |
| S2 High | Fee requests to candidates, impersonation of the platform or an employer, harassment, discrimination in a posted job | 1 hour |
| S3 Medium | Misleading claims, spam, off-platform contact requests, inappropriate content that isn't severe | 4 hours |
| S4 Low | Quality and formatting issues, minor policy deviations | 1 business day |

## A.5 The case page: `/moderation/:caseId`
Three columns on desktop:
- **Left (320px):** case summary, policy panel, checklist ("Check the content against the rule," "Check context," "Check history," "Decide").
- **Center:** content snapshot and context tabs (**Content**, **Context**, **History**, **Related cases**, **Reports**).
- **Right (360px):** action drawer, notes, timeline.

### Action ladder (default)
| Step | Action | Notes |
|---|---|---|
| 1 | **No action** | Reason required (for example, "Within policy"), counts as a resolved flag |
| 2 | **Educate or guidance message** | A neutral note pointing to the rule; no penalty |
| 3 | **Warn** | Recorded; repeated issues escalate |
| 4 | **Edit or remove content** | Edit only where the policy allows (for example removing a contact detail); otherwise remove with a reason |
| 5 | **Limit features** | For example, pause new job posting, outreach limits, hide a profile from search, disable messaging; with a duration and an end date |
| 6 | **Suspend account or organization** | Time-limited, with a reason and an appeal link; live items are handled per the preview of consequences |
| 7 | **Ban** | Permanent; senior moderator only; dual control; a second reviewer must have viewed the evidence |
Moderators can skip steps for serious harm, with the reason recorded.

### Reason codes
Each action needs one or more **policy IDs** (for example `P-04 Fee requests`, `P-07 Impersonation`, `P-11 Discriminatory criteria`, `P-15 Harassment`, `P-22 Misleading traction claims`, `P-30 Spam`, `P-41 Off-platform payment`), mapped to a plain-language message for the user.

### User-facing message
A template per policy, editable within limits, always stating: what happened, which rule, what happens next, how long a limit lasts, and how to appeal. It never reveals the reporter, detection methods or internal risk assessments.

### Consequence preview
Before confirming, the drawer shows a plain summary of effects ("Removes 1 job post, pauses 2 other live jobs, notifies 14 candidates in progress, sends the message below") and warnings ("This account has an open payout; money actions will be reviewed by finance").

### Second review
Required for: permanent bans, S1 and S2 removals of a verified organization's content, actions on accounts with large active relationships (for example, an employer with many candidates in process), reversals of a previous senior decision, and a random QA sample. The second reviewer can't be the first reviewer and doesn't see the first recommendation until recording their own.

### Special handling
- **Child safety, imminent harm or credible threats (S1):** the case is hidden from general moderators and routes to the specialized team with the legal path: preserve evidence, restrict access, and follow reporting duties to authorities as counsel directs. The UI shows a single **Escalate to legal and child safety** button; general moderators never download or share the material.
- **Law-enforcement or court requests:** never handled in this queue; they go to compliance (Part section 12.4).
- **Self-harm or distress content in messages:** routes to a protocol that prioritizes safe handling and appropriate resources; no punitive action against the person at risk.
- **Public figures and sensitive categories:** extra review for content about elections, hate speech, defamation claims and political content (the platform generally doesn't host political content; policy covers handling).

## A.6 Bulk actions
Allowed: assign, release, set a saved view, **apply the same no-action reason** to a cluster of duplicates (with a preview and a second reviewer for more than 20 items). **Not allowed:** bulk removal, suspension or ban across different cases. A *cluster action* exists for confirmed duplicates of the same content (for example, the same fee-request job posted 14 times) so moderators can act once with a visible list.

## A.7 Auto-limited tab
Items where the system applied a **temporary, reversible limit** (for example, hiding a job pending review after multiple fee-request reports, or pausing outreach for an account with a velocity spike). Each shows the rule that triggered it, the limit and its expiry. Reviewers confirm (turns into a manual action), lift (restores immediately with a reason), or let it expire (not recommended). Limits expire automatically after 24 hours if not reviewed, and every expiry creates a follow-up flag.

## A.8 Data contract
`GET /api/moderation/cases?severity=&status=&policy=&source=&assigned=&cursor=` returns IDs, severity, policy ID, counts, timestamps and SLA, never content. `GET /api/moderation/cases/{id}` returns the snapshot (images blurred by token, text flagged as sensitive), context and history with masked identifiers. Actions use `POST /api/moderation/cases/{id}/action` with `{ action, policyIds[], duration, internalNote, userMessageId }`, rejecting requests without a held lock, without reason codes, or that need a second reviewer or dual control but lack it.

## A.9 States
- **Empty:** "No cases waiting."
- **Spike detected:** banner "Reports of the same pattern are rising. Open the Fraud page." with a link.
- **Provider or model outage:** banner "Automated flagging is paused. Reports continue to arrive." The queue still works.
- **Reviewer wellbeing break prompt:** after a set time on sensitive categories (section 11).
- **Loading error:** inline **Retry**. Stale data labels as on the Dashboard.

---

# Part B. Reports: `/reports`

## B.1 Purpose
Every report from users, organized so repeated reports about the same thing become one case, with the reporter protected and the reported party treated fairly.

## B.2 Where reports come from
Report buttons in the product: job seekers (fake job, fee requested, misleading pay or role, discrimination, harassment, privacy), employers (fake or abusive candidate, spam applications, harassment, security), mentors, investors and startups (misleading claims, impersonation, harassment, fraud), and reviews, messages and events. Reports also arrive from support tickets and from staff. Each report carries the reporter's role, the reported item (job, profile, message, review, event, organization), the category, a description and optional attachments.

## B.3 Layout
Tabs: **New** · **Linked to a case** · **Needs more information** · **Duplicates merged** · **Closed**. Toolbar: search by report or case ID, filters (category, reporter role, reported type, severity, status, date), sort (Severity, Corroboration, Age).

### Table
Report ID, category, severity (set by rules and editable by senior moderators), reporter role (not the identity), reported item type and ID, report count for the same item, linked case, status, age, SLA, assigned, actions (**Open**, **Link to case**, **Merge**, **Close**).

## B.4 Intake processing (automatic, shown for transparency)
- **Acknowledgment:** the reporter gets an immediate confirmation with a reference and an expected timeline (confirm acknowledgment and resolution time requirements with counsel, for example under grievance rules).
- **Deduplication and clustering:** reports about the same item or account are grouped; the group shows total count, distinct reporter count, earliest and latest times, and categories.
- **Severity suggestion:** by category and keywords (for example, a "child" keyword in a report raises severity to S1 for human review), always editable by a person.
- **Abuse resistance:** repeated reports from the same person or coordinated reports (same text, same time) are flagged as possible **report abuse** and reviewed; outcomes are never decided by report count alone.
- **Linking:** the report links to the moderation case on the item, or creates one.

## B.5 Report detail page: `/reports/:id`
- **Report:** category, description, attachments (blurred), reporter's role and relationship to the reported item (for example "applied to this job"); reporter identity hidden by default (senior moderators and compliance can reveal with a reason).
- **Reported item:** the snapshot (A.5 rules) and context.
- **Related reports:** other reports on the same item or account.
- **Decision paths:**
  - **Link to case** (create or join a moderation case)
  - **Request more information from the reporter** (template; the reporter can reply once; the thread is private)
  - **Close: not a violation, out of scope, duplicate, cannot verify, or actioned** with a reason; the reporter gets an appropriate message (see B.6)
  - **Escalate** to senior moderator, fraud, legal, compliance or finance (for disputes)
- **Reporter safeguards:** if the report mentions a risk to the reporter (stalking, threats), route to S1 or S2 and show safety resources in the reply.

## B.6 Messages back to reporters
- Acknowledgment (immediate).
- Outcome message: "We reviewed your report. We took action under our rules" or "We didn't find a violation," with general reasons, a thank you, and a link to appeal or add more information (a reporter can ask for a second look once).
- The message never reveals the reported party's identity or the exact action unless the policy allows (for example, "the job was removed" is fine; internal notes are not).
- Reporters who face retaliation or contact from the reported party can reopen with priority.

## B.7 Fair treatment of the reported party
- A report is not a verdict. Accounts aren't penalized only because they were reported.
- The reported party can respond where the policy allows (for example before a suspension in non-urgent cases) and can always appeal after.
- Repeated false or malicious reports lead to guidance and, for abuse, limits on the reporting feature itself (never on the person's other access).

## B.8 States
- **Needs more information:** reporter reminder after 3 days; closes after 14 days with an invitation to reopen.
- **Reporter account deleted:** report remains; reporter contact removed.
- **Reported item removed by its owner:** the snapshot remains; the case continues (for patterns) or closes with the reason.
- **Duplicate wave:** a banner when more than N reports of the same type arrive within an hour, pointing to the Fraud page.
- **Loading error:** inline **Retry**.

---

# Part C. Appeals: `/appeals`

## C.1 Purpose
A fair second look at adverse decisions: moderation actions, restrictions, verification rejections, standing changes and, where allowed, dispute outcomes. It is the safeguard that makes strict moderation acceptable and is required by the employer and job seeker designs.

## C.2 Principles
- **Independent:** the reviewer was not involved in the original decision and, where possible, doesn't share a manager with the original reviewer.
- **Fresh look at the evidence:** the appeal reviewer sees the evidence, the rule, the original decision and the user's explanation and new evidence, but not the first reviewer's confidence or any "preferred outcome."
- **Timely and clear:** timeline stated up front; outcome explained in plain words.
- **Proportionate:** outcomes range from upholding to full reversal, including partial changes (for example shortening a limit).
- **Learning loop:** overturn rates by rule and by decision type feed policy and training (aggregate only).

## C.3 Layout
Tabs: **New** · **In review** · **Waiting for info** · **Decided** · **Overdue**. Toolbar: search, filters (decision type, policy ID, role, severity, source, age), sort (Deadline, Severity, Age).

### Summary strip
| Card | Example |
|---|---|
| Waiting | 19 |
| Due in 24 hours | 4 |
| Overturned in last 30 days | 18% (aggregate, by rule on the page) |
| Median time to decision | 3.1 days |

### Table
Appeal ID, decision type (Moderation, Restriction, Verification, Standing, Dispute), policy ID, applicant type (organization or person, name hidden until opened), original decision date and by (reviewer ID, not name in the list), appeal submitted, SLA (default 5 business days), status, assigned, actions.

## C.4 Appeal page: `/appeals/:id`
- **Original decision:** the action, reason codes, policy text at the time, the snapshot and the evidence summary.
- **The appeal:** the user's explanation (up to 2,000 characters), attachments, and any new evidence, clearly marked as new.
- **Compare view:** "What the first reviewer saw" next to "What's new."
- **Appeal checklist:** (1) Was the correct rule applied? (2) Was the evidence sufficient? (3) Was the action proportionate and consistent with similar cases? (4) Is there new evidence or context? (5) Was the process followed (notice, response opportunity)?
- **Decision options:** **Uphold**, **Partially overturn** (modify the action), **Overturn** (restore, remove records of the action where policy says), **Request more information**, **Escalate** (for complex or high-stakes cases).
- **Required fields:** reasons per checklist item, user message (template with specifics), and, for overturns, consequences (restore content, lift limits, remove strikes, notify affected parties).
- **Restoration actions** run automatically after confirmation (for example, re-publishing a job post, restoring search visibility) and are logged.
- **Second look:** one further review by a senior moderator is available if the user submits new evidence; there are no endless loops, and the final decision is clearly labeled.

## C.5 Special cases
- **Verification appeals:** routed to a senior verification reviewer; the verification case page shows the appeal inline.
- **Dispute appeals:** limited to process errors or new evidence; the platform doesn't act as a court (Part D).
- **Appeals about bans:** reviewed by two people; consider the entire history; a supervisor signs the result.
- **Appeals tied to legal requests:** read-only here; compliance handles them.
- **Abusive or repeated appeals:** the system can mark an appeal as manifestly unfounded with a senior moderator's decision and explanation, never automatically.

## C.6 States
- **Overdue:** error chip and supervisor alert; the user receives a delay notice with a revised date.
- **Same reviewer conflict:** the case reassigns automatically and shows "Reassigned to preserve independence."
- **User didn't respond to an info request:** auto-close after 14 days with a reopen link.
- **Appeal withdrawn:** closed with a record.
- **Content already deleted by the user:** the appeal can still decide on records and standing, not on restoration.

---

# Part D. Disputes: `/disputes`

## D.1 Purpose
Resolve disagreements between parties on the platform where records or money are involved: mentor session payments and cancellations, readiness sign-offs, agreements and equity terms, investor offers and fees, employer offers and job-post charges, refunds. The platform's role is to apply its own rules and keep records. It doesn't act as a court, give legal advice, or decide matters that belong in contracts or law.

## D.2 Dispute types

| Type | Examples | Typical evidence |
|---|---|---|
| **Payment and refund** | Session not held, duplicate charge, plan or pack charge dispute | Payment records, session logs, usage |
| **Mentor session or cancellation** | Late cancellation fees, no-shows | Session records, agreement terms |
| **Readiness sign-off** | Startup says a sign-off decision was unfair or ignored criteria; investor or mentor says a sign-off was misleading | Checklist, evidence trail, notes |
| **Agreement terms** | Fee or equity terms recorded incorrectly | Agreement versions, acceptance logs |
| **Investor offer or commitment record** | Disagreement about whether an offer was accepted or funds received | Offer versions, confirmations, activity logs |
| **Employer offer or hire record** | Disagreement about acceptance, withdrawal or start date | Offer versions, messages, hire records |
| **Success fee (if enabled)** | Fee applicability on a closed round | Commitment and round records, terms |
| **Content ownership or confidentiality** | Claims about shared documents or misuse of data room material | Audit trail, NDA records |

## D.3 Layout
Tabs: **New** · **In review** · **Waiting for parties** · **Held funds** · **Decided** · **Overdue**. Toolbar: search, filters (type, amount band, parties' roles, priority, status), sort (Held funds first, Deadline, Age). Summary strip: open disputes, funds currently held (amount, finance roles only), overdue, median time to resolve.

### Table
Dispute ID, type, parties (roles and organization IDs; names after open), amount (finance roles only; others see "Money involved"), what is held (payout hold, refund pending, fee hold), opened, SLA (default 5 business days), status, assigned, actions.

## D.4 Dispute page: `/disputes/:id`
Three columns:
- **Left:** summary, parties, timeline of platform events, applicable rules and agreement terms.
- **Center:** evidence tabs: **Records** (from the platform: sessions, payments, versions, acceptances, activity logs), **Party A statement**, **Party B statement**, **Messages** (platform messages the parties chose to share), **Documents**.
- **Right:** decision panel, notes, timeline.

### Process
1. **Intake:** the party opening the dispute states the issue and desired outcome (a template per type). The other party is notified and has a set time (default 5 business days) to respond.
2. **Evidence:** the platform adds its own records automatically. Parties can add statements and files; each side sees the other's statements (but not internal notes).
3. **Hold:** where money is involved, a hold may be placed on the disputed amount only (not the whole account), with a reason and a review date; holds need finance approval.
4. **Review:** a reviewer (finance for money, trust and safety for conduct, a senior reviewer for sign-offs) checks records against the rules and terms.
5. **Decision:** options: **Uphold the claim**, **Partly uphold**, **Decline**, **Refer to the parties** (the dispute is outside platform rules and the parties must resolve it directly or legally), **Escalate**.
6. **Outcome actions:** refund, credit note, release of a hold, correction of a record (for example fix a recorded term, with a visible note on the record rather than silently editing), restriction or other moderation action where conduct broke rules.
7. **Notice:** both parties receive a plain-language decision with the rule applied, what happens next, and appeal rights (limited to process errors or new evidence).

### Required fields
Decision, reason codes (policy and terms references), user messages for both sides (templates), actions with amounts and dates, and, for money, a finance approval and dual control above a threshold.

## D.5 Platform limits (stated on the page and in messages)
- The platform records offers, sign-offs and terms and applies its own policies. It does not decide legal rights, award damages, enforce contracts, hold funds as an escrow agent (unless separately licensed) or give legal, tax or financial advice.
- For disputes about binding agreements, parties are told to seek their own advice. The platform may preserve records and make them available to the parties and, with a legal basis, to authorities.
- Decisions about readiness sign-offs concern whether the **process and criteria** were followed, not whether a startup is a good investment.

## D.6 Special rules
- **Held funds** show age; holds longer than 14 days require a supervisor's review.
- **Dual control** for refunds and payout changes above the threshold: finance reviewer plus a second approver.
- **Conflict handling:** staff with a relationship to a party can't review it.
- **Related fraud:** a dispute that looks like fraud (for example, chargeback abuse) links to a Fraud case and may change its handling.
- **Fairness checks:** similar disputes should get consistent outcomes; the page shows a **Precedents** panel (aggregated, anonymized prior decisions for the same type and rule).

## D.7 States
- **Waiting for a party:** reminders at day 2 and day 4; if no response by the deadline, decide on available records and say so.
- **Parties settled:** a "Resolved between parties" closure with a note; holds are released per the parties' written agreement.
- **Overdue:** error chip; supervisor alert; delay notice to both parties.
- **Provider chargeback:** linked to the payment provider's process and deadlines; the page shows provider response deadlines prominently.
- **Loading error:** inline **Retry**.

---

# Part E. Fraud and Abuse Monitoring: `/fraud`

## E.1 Purpose
Detect and stop patterns that single reports can't show: scam networks, fake employers and jobs, fake candidates, fake startups and investors, impersonation, payment fraud, account takeover, referral and promo abuse, and automated spam. It supports your proposal's goals of verified employers, spam and fake-posting reports, and platform trust.

## E.2 Layout
Header with title, a status strip, and tabs: **Overview** · **Signals** · **Cases** · **Entities and links** · **Rules and models** · **Actions log** · **False positives**.

### Status strip
| Card | Example |
|---|---|
| Open fraud cases | 12 (S1 and S2 count highlighted) |
| Active temporary limits | 9 |
| Signals in last 24 hours | 214 (by type) |
| False-positive rate (last 30 days) | 3.2% (aggregate) |

## E.3 Overview tab
- **Live signal chart:** counts by signal type over time (fee-request language, new domain with many posts, mass messages, velocity spikes, payment failures, device or IP clusters, document forgery signals, impersonation of staff).
- **Hot clusters:** groups of linked accounts with a risk summary, size and age.
- **Provider and rule health:** which detection rules fired, any provider issues, and model version in use.
- **Trend notes:** automated, factual summaries ("Fee-request reports up 40% since 08:00, 3 domains involved").

## E.4 Signals tab
A stream and table of detection events with: signal type, entity (account, organization, job, payment instrument ID, device or IP cluster ID), severity score band (Low, Medium, High), rule or model, time, status (New, Reviewed, Linked to case, Dismissed). IDs only; no personal data. Filters by type, band, entity, time. **Open entity** shows linked details.

## E.5 Cases tab
Fraud cases opened from signals or by analysts: ID, pattern name, entities involved, severity, status, owner, SLA, impact estimate (for example, "14 candidates contacted"), actions taken.

### Fraud case page: `/fraud/cases/:id`
- **Summary:** pattern, timeline, why it was flagged (rules and signals, in plain language), who is affected.
- **Entity graph:** a simple linked view of accounts, organizations, domains, payment instruments, devices and IP ranges with relation labels and counts; clicking a node shows masked identifiers and links to the relevant case or verification record. No free-form browsing of personal data.
- **Impact panel:** affected users by role and count (names hidden), and recommended protections (for example, notify candidates who engaged, in line with policy).
- **Actions** (with preview and approval rules): 
  - **Limit** (outreach, posting, messaging, payouts, new sign-ups from a pattern), temporary by default, with an end date.
  - **Hold** payments or payouts (finance approval).
  - **Suspend** accounts or organizations (senior moderator; appeal link).
  - **Block** a domain, payment instrument or device pattern (time-limited review dates; permanent blocks need a senior and compliance review).
  - **Notify affected users** (templates approved by trust and safety and legal).
  - **Escalate to compliance or law enforcement** (via compliance only).
  - **Close as false positive** (feeds the false-positive log).
- **Evidence preservation:** one click creates an immutable evidence bundle (snapshots, logs, hashes) under legal hold if required.

## E.6 Entities and links tab
Search by account, organization, domain, payment instrument token, device or IP cluster ID. Shows linked entities, history of actions and the verification status of each. Access is read-only and heavily masked; each search is logged. The page states: "Links are signals, not proof."

## E.7 Rules and models tab
- **Detection rules** list: name, description, signal type, threshold, state (`Shadow`, `Live`, `Paused`), owner, last changed, precision (share of flags confirmed) and volume.
- **Rule lifecycle:** draft → test on historical data → **shadow mode** (flag only, no effect) → limited live → full live. Changes need review by a second fraud analyst and approval from a senior.
- **Models:** version, training data window summary, evaluation metrics (precision and recall on labeled data), bias and fairness checks (no personal characteristics used), last audit.
- **Kill switch:** instantly pause a rule or model (supervisors), logged with reason.
- **Guardrails:** automatic actions are limited to temporary, reversible measures (for example, delaying a job post for review, pausing outreach). No automatic permanent bans or payment seizures. Rules never use personal characteristics.

## E.8 Actions log
Append-only list of every action taken in this area with who, when, reason and approver. Filters by action, entity type and approver.

## E.9 False positives tab
Cases and flags later found to be wrong, with the rule involved, the harm (for example, "job hidden 6 hours"), the fix, and a trend per rule. Used to tune rules and train reviewers. Includes a **Reinstate** helper that lifts limits and sends an apology template where the user was affected. Metrics are aggregate; individual analysts aren't ranked.

## E.10 Data handling
- Detection uses behavior and technical signals, never personal characteristics.
- Payment data is handled as tokens and masked identifiers only.
- Device and IP information is minimized, retained for a short period unless a case needs it, and protected.
- Data is shared with law enforcement or other parties only through compliance with a legal basis.

## E.11 States
- **Signal flood:** the page batches and groups signals and shows a banner "High volume. Showing clustered view."
- **Provider or model outage:** banner with the affected rules; manual review guidance appears.
- **Shadow rules:** labeled so analysts don't assume live protection.
- **Case waiting on finance or legal:** status chip with owner and expected date.
- **Loading error:** inline **Retry**.

---

# Part F. Policy Rules and Blocklists: `/policies`

## F.1 Purpose
The single source of truth for what is allowed on the platform, and the machinery that enforces it automatically in the product: banned screening questions, biased or exclusionary terms, fee and payment patterns, off-platform contact patterns, posting rules, and content categories. The employer Job Editor, Templates page and Messages, the job seeker messaging warnings, and moderation actions all read from here.

## F.2 Layout
Tabs: **Policies** · **Rules (automatic checks)** · **Blocklists** · **Test sandbox** · **Rollouts** · **Change log**. Header with search and a **Draft change** button.

## F.3 Policies tab (human-readable rules)
A library of policies, each with an ID, title, plain-language rule text, examples (allowed and not allowed), severity default, allowed actions on the ladder, user-facing summary, and the product surfaces it applies to. Examples: fee requests, impersonation, discriminatory criteria, harassment, misleading claims, off-platform payment, spam, privacy violations, fake traction in startup profiles, review manipulation, event conduct, AI misuse.
- Each policy has a **version**, **effective date**, **owner** and **last reviewed** date, and links to the public posting rules and help articles so public text and internal text stay in sync.
- **Localization:** translated user-facing summaries (English first, others later).

## F.4 Rules tab (automatic checks)
Each rule: ID, linked policy, what it checks (job text, screening question, message, profile field, review), logic type (pattern, dictionary, classifier, combination), severity, default result (`Block`, `Warn`, `Flag for review`, `Log only`), surfaces (Job Editor, Messages, Templates, Startup profile, Reviews), state (`Draft`, `Shadow`, `Live`, `Paused`), precision and volume, owner, last changed.
- **Block** is used only for clear cases (for example, payment requests to candidates, protected-characteristic questions in screening). Everything else warns or flags for human review.
- **User-facing copy** for each rule (what the user sees when it triggers), with suggested alternatives ("Ask about availability to travel if travel is a real requirement").
- **Appeal route:** each block shows how to ask for a review, which creates a **Report or Appeal** here.

## F.5 Blocklists tab
Managed lists, each versioned, with entries, match type (exact, phrase, pattern, domain), language, severity, source and notes:
- **Prohibited screening questions and topics** (age, gender, religion, caste, nationality, marital status, family plans, health, photos, and similar), in multiple languages and common phrasings.
- **Biased or exclusionary terms** ("young team," "rockstar," and others) with neutral alternatives.
- **Fee and payment patterns:** "registration fee," "security deposit," "training fee," payment links, UPI IDs and bank details in job posts or messages.
- **Off-platform contact patterns:** personal phone numbers, messaging apps and links in job posts and early messages.
- **Scam phrases and templates** known to circulate.
- **Impersonation terms:** platform staff names, brand names and common impostor patterns.
- **Domains and payment instruments:** blocked or watched entities (managed with the Fraud page).
- **Allow lists** to prevent false positives (for example, legitimate fee-related wording in legitimate contexts such as a startup's product pricing page).
Entries show hit counts and false-positive counts, so noisy entries can be tuned or removed.

## F.6 Test sandbox
Paste text or choose sample items (jobs, messages, screening questions) to see which rules and blocklists fire, with explanations and the user-facing message. A **regression set** of labeled examples (should block, should pass) runs against any draft change and shows precision and recall changes. Tests include multilingual and edge cases (for example, Hindi and mixed-language phrasing, transliteration, obfuscated characters, legitimate sentences containing banned words).

## F.7 Change management and rollouts
- **Draft change:** edit a policy, rule or list; the system shows the diff, the test results and the estimated impact (how many recent items would have been affected).
- **Review:** two-person rule: an author and a senior reviewer from trust and safety; policy meaning changes also need legal review. Super admin approves publishing for **Block** rules and policy changes that affect all users.
- **Rollout stages:** `Shadow` (no effect, measure) → `Warn only` → `Live`. Rollbacks are one click. Scheduled rollouts show the date and notify affected teams.
- **User notice:** policy changes that affect users (new bans, new rules) are published with a version, effective date and a notice period (default 14 days) except for urgent safety changes.
- **Change log:** every change with who, when, why, version, test results and rollout stage. A public-facing **policy change history** is generated from approved changes.

## F.8 Quality and feedback
- **False-positive and false-negative feedback** from moderators, support and users flows back to each rule's page.
- **Quarterly review** reminders for each policy and rule owner.
- **Bias review:** rules and lists are checked for disproportionate impact across languages, regions and writing styles; findings and fixes are logged.
- **Metrics:** for each rule, volume, precision, overturned-on-appeal rate and time-to-decision (aggregate).

## F.9 States
- **Draft with failing regression tests:** can't be published; the page lists failing examples.
- **Conflicting rules:** warning with the conflicting items.
- **List too large or slow:** performance hint and suggestion to split.
- **Rollout failure or spike in false positives:** automatic alert and one-click rollback.
- **Loading error:** inline **Retry**.

---

# Part G. AI Quality and Human Review: `/ai-quality`

## G.1 Purpose
Keeps the platform's AI features fair, accurate and accountable, as your proposal requires: **human review for any scoring that affects people, published rubrics, bias testing on resume and interview feedback, no use of candidate data to train third-party models, and clear AI labels.** This page is where staff review disputed scores, audit rubrics, monitor bias and drift, and handle AI incidents. It connects to the job seeker interview trainer ("Request a review"), the resume maker (fact flags), job recommendations and employer match hints.

## G.2 Layout
Tabs: **Review queue** · **Rubrics and audits** · **Bias and drift monitoring** · **Golden sets and calibration** · **Incidents** · **Model and prompt registry**. Summary strip: reviews waiting, median time to review, overturn rate (30 days), open AI incidents.

## G.3 Review queue

### Sources
- **Score review requests** from candidates (interview trainer): a candidate disputes a score on an answer or a session.
- **Resume AI flags:** cases where the AI may have produced an unsupported claim, or a candidate or employer reported fabricated content.
- **Recommendation and match complaints:** reports that a recommendation or match hint was unfair or wrong.
- **Sampling reviews:** random samples from each AI feature for quality assurance.
- **Employer or admin escalations:** scores shared with employers that look inconsistent.

### Table
Review ID, feature (Interview feedback, Readiness score, Resume drafting, Job match hint, Recommendation, Mentor match), source, requested by (role, not identity), submitted, SLA (default 5 business days), status, assigned, rubric and model version, actions. IDs and categories only.

## G.4 Review page: `/ai-quality/reviews/:id`
**Blinded by design:** the reviewer sees the content needed to judge (the question, the answer text, the AI's score and explanation, the rubric and anchor examples) but not the candidate's name, photo, demographic data, employer, or any profile details. Recordings and audio are not shown unless the candidate chose to attach them to their review request, and then only the minimum needed.

### Panels
- **Rubric panel:** the published rubric version used, with band descriptions and example answers.
- **Answer panel:** the transcript or text (with transcription confidence notes) and, where relevant, the session context (question type, level, job posting excerpt if the session was built from one).
- **AI output panel:** scores per dimension, explanations quoted from the answer, suggested better answer (to check it didn't add facts).
- **Reviewer scoring:** the reviewer scores each dimension independently *before* seeing the AI's score (toggle to reveal after scoring), to reduce anchoring.
- **Compare:** after scoring, show differences between reviewer and AI, with the threshold for "material difference" (for example, more than 1 band).
- **Checks:** facts-only check for suggested answers and resume text (did the AI add anything not in the source?), policy check (inappropriate content), language check (accuracy for non-native phrasing).

### Decisions
- **Score confirmed:** AI score stands, with an explanation for the candidate.
- **Score corrected:** a new score replaces the AI score; the readiness score recalculates and any shared score updates for employers who haven't viewed it; viewed scores show a correction notice where the platform allows.
- **Score removed:** if the session had a technical problem (audio failure, wrong question set) or the response can't be scored fairly.
- **Escalate to rubric review:** the dispute reveals an unclear rubric or systematic problem.
- **Request more information** from the candidate (one question).
Each decision records reasons and feeds the quality dashboards. The candidate message is a template: what was reviewed, the outcome, and what changed, in plain words.

### Second review
Required for: overturns above a material threshold, reviews that involve claims of bias, and a random QA sample. The second reviewer doesn't see the first score until recording their own.

## G.5 Rubrics and audits tab
- **Rubric library:** each rubric (clarity, structure, relevance, confidence; per interview type; resume ATS rules; match rules) with version, effective date, owner, published text (links to the public rubric page), anchor examples and change log.
- **Rubric review workflow:** draft → expert review → bias review → publish with notice; candidates and employers are notified of significant changes; old sessions keep the rubric version used.
- **Audit schedule:** quarterly audits per feature with sampled sessions, reviewer agreement (aggregate), findings, remediation tasks and sign-off. Reports are exportable for compliance.
- **Published transparency:** summaries of audit outcomes feed the public Scoring Rubric and Privacy page (counts and findings, never individual cases).

## G.6 Bias and drift monitoring tab
Dashboards with aggregate, privacy-preserving metrics:
- **Score distributions** by interview type, level, language, answer length and mode (text, voice, video), with confidence intervals and drift alerts when distributions shift.
- **Fairness checks** on proxies the system is allowed to test with consent and legal review (for example, language and speaking-style groups, transcription confidence), comparing score differences after controlling for answer quality on the golden set. The page documents which attributes are tested, how the data is obtained, and the safeguards. Personal characteristics aren't used in scoring.
- **Transcription quality:** word error rate on test sets by accent and audio condition; alerts if quality varies across groups.
- **Override and overturn rates** by feature and rubric dimension.
- **Resume AI:** rate of fact flags, share of suggestions accepted or rejected, incidents of unsupported claims reaching export (should be zero), and false-flag rate.
- **Recommendations and match hints:** exposure and click patterns across job types and company sizes, checks for unintended concentration, and complaints.
- **Alerts:** thresholds for drift or disparity trigger incidents (G.8).
- **Minimum group sizes** apply; small groups are merged or hidden.

## G.7 Golden sets and calibration tab
- **Golden sets:** expert-labeled answers (with anchor scores) per rubric, used to test every model or prompt change before release; include diverse speaking styles, languages and answer qualities.
- **Calibration sessions:** periodic exercises where reviewers score the same blinded items, with agreement shown in aggregate and by rubric dimension to find unclear anchors. Individual results are used only for coaching, not performance ranking.
- **Release gates:** a change to the model, prompt or rubric must pass accuracy and fairness thresholds on the golden set; failing runs block release and open a task.

## G.8 Incidents tab
AI incidents: harmful or inappropriate output, systematic scoring errors, fabricated resume content, privacy leaks, bias findings, provider data-handling problems. Each has severity, status, owner, timeline, affected feature and counts, user impact, containment (for example, disable a feature flag, pause score sharing, revert a model), root cause, fixes, and communications (internal and user-facing). A **pause score sharing** control (supervisors) hides the readiness score from employers while an incident is investigated.

## G.9 Model and prompt registry tab
- **Registry:** each model, prompt and configuration in production with version, owner, purpose, data handling (no use of candidate data to train third-party models; provider processing terms; retention), evaluation results, release date and rollback link.
- **Change control:** two-person approval for production changes; release notes; scheduled review.
- **Provider oversight:** list of AI providers, data-processing terms status, sub-processors and review dates.
- **Labels:** confirmation that every AI output surface in the product carries the AI label and explanation link; changes to labeling need review.

## G.10 Privacy and data rules
- Reviewers see only the minimum content, with identity hidden. Content is accessed through short-lived views and not exported.
- Review data is retained for a limited period, then anonymized. Candidates' recordings aren't available to reviewers unless the candidate attaches them.
- Candidate data is never used to train third-party models, and any internal improvement uses only data with a lawful basis and opt-in where required.
- Quality metrics are aggregate, and individual reviewer metrics are used only for calibration and coaching.

## G.11 States
- **No reviews waiting:** "No reviews waiting."
- **Spike in review requests for one rubric dimension:** banner suggesting a rubric review.
- **Model drift alert:** banner with the affected feature and **Open incident**.
- **Provider outage:** AI-dependent reviews can still proceed from stored outputs; new AI runs are paused.
- **Loading error:** inline **Retry**.

---

# Part H. Cross-cutting design

## H.1 Case numbering and linking
Every case has a stable ID (for example `MOD-2026-018342`, `REP-…`, `APL-…`, `DSP-…`, `FRD-…`, `AIQ-…`). Cases link to each other (a report to a moderation case, a moderation action to an appeal, a dispute to a fraud case). The **Related** panel shows IDs, types and statuses only.

## H.2 Notifications to users from this area
- Standard templates per outcome (acknowledgment, info request, action taken, no action, appeal decision, dispute decision, AI review result).
- Messages are plain-language, translatable, never include other people's data, and always include how to appeal or respond.
- Employers and candidates in progress are notified when an action affects them (for example, a paused job) with neutral wording.

## H.3 Service targets and calendar
Targets use IST business calendars for non-urgent items and clock time for S1 and S2. All defaults are configurable in Configuration, versioned and logged.

## H.4 Transparency and reporting
- **Internal:** weekly and monthly reports on volumes, response times, overturn rates, false positives, repeat offender patterns, AI quality metrics (aggregate).
- **External (as counsel advises):** periodic transparency summaries (counts of reports, actions and appeals), published grievance process and contact details, and responses to regulators.
- **Grievance process:** a clearly published route and officer details as required; acknowledged and resolved within the legally required times (confirm exact requirements with counsel).

---

# Part I. Data model and APIs (summary)

### Shared case object
```json
{
  "id": "MOD-2026-018342",
  "type": "moderation",
  "severity": "S2",
  "status": "in_review",
  "policyIds": ["P-04"],
  "source": "user_report",
  "reportCount": 6,
  "subject": { "kind": "job", "id": "job_8812", "orgId": "org_77" },
  "snapshotId": "snp_5531",
  "autoState": { "limited": true, "limitExpiresAt": "2026-11-07T10:00:00+05:30" },
  "sla": { "targetAt": "2026-11-06T15:30:00+05:30", "state": "at_risk" },
  "lock": { "by": "stf_9", "expiresAt": "2026-11-06T14:50:00+05:30" },
  "actions": [],
  "timeline": []
}
```

### Endpoints (pattern)
- Lists: `GET /api/{moderation|reports|appeals|disputes|fraud|ai-quality}/...` return IDs, categories, timestamps and SLA, never content or personal data.
- Detail: `GET /api/.../{id}` returns masked context; media and sensitive text come through short-lived signed view tokens that blur by default and write an access log entry.
- Claim and release: `POST /api/.../{id}/claim`, `/release`.
- Actions: `POST /api/.../{id}/action` with required reason codes, a held lock, user message ID and, where needed, `secondReviewId` or `dualControlId`.
- Reveal: `POST /api/.../{id}/reveal` with reason code (reporter identity, masked fields).
- Policy and rule changes: `POST /api/policies/drafts`, `/test`, `/rollout`, `/rollback` with two-person approval.
- Evidence: `POST /api/.../{id}/evidence-bundle` creates an immutable bundle with hashes; legal holds block deletion.
- Webhooks and events from the product (flags, reports, payments, sessions) are signed, idempotent and queued.

### Server rules
- Adverse actions require reason codes and the user message; permanent bans and overrides need second review or dual control.
- Locks are exclusive; actions without a lock by the same reviewer are refused.
- Time-limited limits always carry an end date and create a follow-up flag at expiry.
- All writes append to the audit log; nothing in this area can be deleted by staff.

---

# Part J. States and error handling (common)

| State | Behavior |
|---|---|
| Case claimed by someone else | Read-only view with the holder's name; **Request release** (supervisors) |
| Lock expired mid-review | Banner "Your lock expired" with **Reclaim**; notes kept as a local draft |
| Content deleted after report | Snapshot remains; case continues with a note |
| Reporter or user deletes their account | Case continues; personal data handled per deletion and legal-hold rules |
| Conflicting decisions (two at once) | Second is refused with the first decision's summary |
| Decision would affect many people | Consequence preview with counts and a second-reviewer prompt above a threshold |
| Automation outage | Banner; manual queues continue; no automatic limits are applied |
| Legal hold on a case | Banner; deletion and edits blocked; compliance contact shown |
| Overdue | Error chip; supervisor alert; user delay notices where required |
| Reviewer wellbeing prompt | After time on sensitive categories: suggest a break; supervisors can rotate cases |
| Offline | Notes autosave locally; actions disabled with "You're offline." |
| Staging | Strip shows STAGING; synthetic data only |

---

# Part K. Accessibility, performance and reviewer wellbeing

- **Accessibility:** WCAG 2.1 AA in light and dark themes; keyboard-only completion of a case (claim, review, decide); visible focus ring; media have text alternatives where possible; status uses text and icons as well as color; live regions announce lock changes politely.
- **Performance:** queues load under 1.5 seconds (p75); case pages under 2 seconds with media loaded on demand; large graphs and charts paginate or aggregate; no more than 50 rows rendered at once with virtualized lists.
- **Reliability:** each page degrades gracefully if a provider or model is down; the audit log and evidence store have high availability and backups.
- **Wellbeing protections (required):**
  - Blur-by-default for images, attachments and graphic text, with reveal on click and automatic re-blur.
  - Severity-1 categories (child safety and similar) never displayed to general moderators; specialized team and counseling support.
  - Break reminders after 60 minutes on sensitive categories, rotation rules, limits on daily exposure time, and a way to skip and reassign a case without penalty.
  - Access to confidential counseling and a team lead check-in routine.
  - No quotas on speed for sensitive content; quality metrics are aggregate.
- **Localization:** English first; templates and policy summaries translatable; mixed-language content supported in the reviewer's view with an on-demand translation (labeled).
- **Observability:** error tracking and performance monitoring without personal data; alerts for queue age, spikes, rule false-positive jumps and provider failures; feature flags per page and per rule.

---

# Part L. Security, privacy and audit

- **Admin app controls (subdomain):** single sign-on, mandatory two-factor (hardware key or authenticator app), 15-minute idle lock, 8-hour absolute session, host-scoped `Secure`, `HttpOnly`, `SameSite=Strict` cookies, strict CSP, no indexing, optional VPN or IP allowlist, server-side permission checks on every request, separate deployment and secrets from the public app.
- **Data minimization:** lists carry IDs, categories, timestamps and SLA only. Content and personal data open only on case pages with masking, blur and logged reveals. Reporter identities are hidden from most staff.
- **No screenshots or exports of sensitive content** are provided by the tool; exports contain IDs and aggregate counts. Policy reminders appear in the footer.
- **Audit:** every claim, release, view of sensitive content, reveal, action, note, message, override, policy change, rule rollout and export writes an append-only audit entry with staff ID, time, case ID and reason.
- **Dual control and separation of duties:** second review for bans and large-impact actions; finance plus a second approver for money; two-person rule for policy and rule changes; staff can't review their own conflicts or their own earlier decisions on appeal.
- **Evidence and legal holds:** immutable evidence bundles with hashes; legal holds by compliance block deletion; retention schedules are set with counsel.
- **Law-enforcement and regulator requests:** handled only by compliance with a documented legal basis, a verification step, a log, and minimal disclosure; moderators never respond to such requests directly.
- **User privacy:** users can see what actions were taken on their content and accounts (through notices and their data-rights requests) and can correct errors; reporter identity and detection methods remain confidential.
- **Fairness safeguards:** rules, lists and models are reviewed for bias; decisions cite policies; appeals are independent; precedent and QA sampling keep outcomes consistent; no decision uses personal characteristics.
- **Regulatory:** confirm with counsel the intermediary and grievance obligations (for example India's IT Rules), child-safety reporting duties, evidence retention, notice and appeal requirements, transparency reporting, data protection (DPDP Act) and cross-border data handling.

---

# Part M. Acceptance criteria and QA checklist

**Moderation and reports**
- [ ] Queue order follows severity, time to target, corroboration, then age; S1 cases reach on-call within the target and never display media to general moderators.
- [ ] Content is blurred by default, reveals are logged, and snapshots persist after edits or deletion.
- [ ] Actions require reason codes, a user message and a held lock; bans and large-impact actions require a second reviewer; consequence previews are accurate.
- [ ] Reports cluster duplicates; reporter identity is hidden from the reported party and from most staff; reveal needs a reason and is logged.
- [ ] Coordinated or abusive reporting is flagged and never decides outcomes by count alone.
- [ ] Automatic limits are temporary, reversible, labeled and expire into a follow-up flag.

**Appeals**
- [ ] The appeal reviewer is never the original reviewer; the first reviewer's recommendation is hidden until the appeal reviewer records theirs.
- [ ] Overturns restore content and standing automatically and are logged; notices are sent to affected parties.
- [ ] Time limits, overdue alerts and delay notices work.

**Disputes**
- [ ] Platform records are attached automatically; both parties can respond; the other party's statements are visible, internal notes are not.
- [ ] Holds apply to the disputed amount only, need finance approval, and show age; holds over 14 days trigger supervisor review.
- [ ] Money outcomes require dual control above the threshold; record corrections are visible notes, not silent edits.
- [ ] Decision messages state the rule applied and the platform's limits.

**Fraud**
- [ ] Rules move through draft, shadow and live with second-analyst review; the kill switch works instantly and is logged.
- [ ] Automatic actions are limited to temporary, reversible measures; permanent actions need a senior and, where specified, compliance.
- [ ] The entity graph shows IDs and relations only, with masked identifiers; each search is logged.
- [ ] False-positive tracking updates rule precision and creates reinstatement tasks.

**Policy rules**
- [ ] A change can't publish unless regression tests pass; two-person approval and legal review (where needed) are enforced.
- [ ] Shadow and warn-only stages work; rollback restores the previous version in one click.
- [ ] Blocked screening questions and fee patterns are enforced in the Job Editor, Templates and Messages from the live rule set within a minute of publishing.
- [ ] Multilingual and obfuscation test cases pass.

**AI quality**
- [ ] Reviewers see no identity or demographic data; they score before seeing the AI score; second review applies to material overturns.
- [ ] Corrections update the readiness score and shared scores correctly, with notices to the candidate.
- [ ] Release gates block model, prompt or rubric changes that fail golden-set accuracy or fairness thresholds.
- [ ] Drift or disparity alerts open incidents; **pause score sharing** hides scores from employers instantly and reversibly.
- [ ] Every AI surface in the product carries its label and explanation link.

**Security, privacy and wellbeing**
- [ ] SSO and two-factor are mandatory; idle lock and session limits work; permissions are enforced on the server for every request.
- [ ] No personal data appears in lists, logs, error reports, notifications or analytics payloads.
- [ ] Legal holds block deletion; evidence bundles are immutable and hashed.
- [ ] Break reminders, rotation and skip-without-penalty work; severity-1 routing never exposes material to general staff.

**Accessibility and performance**
- [ ] Keyboard-only use covers every action; AA contrast in both themes; live regions announce lock changes politely.
- [ ] Performance targets in Part K are met; automation or provider failure doesn't block manual queues.

---

# Part N. Build order (suggested)

1. **Admin foundation:** subdomain, SSO, two-factor, internal roles with server-side checks, append-only audit log, evidence store with snapshots, blur and reveal service.
2. **Policy Rules and Blocklists** (data model, versioning, test sandbox, rollout stages). The product's Job Editor, Messages and Templates read from it, so it should exist before employers and candidates go live.
3. **Reports** intake, clustering and the **Moderation Queue** with the action ladder, reason codes, user messages and second review.
4. **Appeals** (independent reviewer assignment, restoration actions). Ship alongside the first moderation actions, because every adverse action needs an appeal path.
5. **Disputes** for payments and sign-offs, integrated with finance approvals and dual control.
6. **Fraud and Abuse Monitoring:** signals and cases first, then the entity graph, rule lifecycle and false-positive tracking.
7. **AI Quality and Human Review** before the readiness score is visible to any employer: review queue, blinded scoring, golden sets, release gates, bias and drift monitoring, incident handling and the model registry.
8. Transparency reporting, grievance process links, retention and legal holds, reviewer wellbeing tooling polish.
9. Accessibility, performance and security review against the checklist, then a staged rollout (one reviewer team first, with shadow rules).

**Suggested first release:** the foundation, Policy Rules and Blocklists, Reports, the Moderation Queue and Appeals, since employers and job seekers depend on them. Add Disputes when payments go live, Fraud and Abuse Monitoring when volumes justify it, and AI Quality and Human Review before any readiness score is shared with employers (your proposal requires human review for scoring that affects people).

**Reminder for the build:** the subdomain is an isolation layer, not an access control. Keep mandatory two-factor, server-side permission checks, blur and masking with logged reveals, second review and dual control for serious decisions, independent appeals and the append-only audit log from day one. Automation may only flag, rank and apply temporary, reversible limits; people decide the rest. Get legal advice on intermediary and grievance obligations, child-safety and law-enforcement handling, evidence retention, KYC-related and financial-crime reporting duties, transparency reporting and data protection before launch.
