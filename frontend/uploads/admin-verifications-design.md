# Admin Verification and Approvals Design (production spec)

**App:** Platform admin console on its own subdomain (for example `admin.yourdomain.com`). Routes below are relative to that subdomain.
**Users:** internal staff, mainly verification reviewers, with supervisors, compliance officers and super admins.

These six pages are the gate for every other role in the product. Your proposal says the platform admin team verifies and approves startups, mentors, investors and employers, with business checks for startups and employers, credential checks for mentors, and KYC for investors, and that employers must be verified before they can publish jobs or contact candidates. The public-product designs we built point here: the startup profile ("Verified startup"), the mentor application, the investor application and KYC levels, and the employer verification and the verified-employer badge.

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Verification Queue | `/verifications` | All pending reviews across roles, ordered by risk and deadline |
| 2 | Startup Verification Review | `/verifications/startups/:id` | Business checks before a startup goes live |
| 3 | Mentor Credential Review | `/verifications/mentors/:id` | Credential, experience and conflict checks before a mentor can accept startups |
| 4 | Investor KYC Review | `/verifications/investors/:id` | Identity, entity and eligibility checks, by verification level |
| 5 | Employer Verification Review | `/verifications/employers/:id` | Registration, domain, representative and fraud-signal checks before posting and outreach |
| 6 | Re-verification and Expiry | `/verifications/expiring` | Verifications nearing expiry or triggered by changes |

> **Subdomain note.** The admin console is a separate app, so there is no per-route role-based file here. Each page does include a short **who sees what** table (internal roles) because that decides what the page shows. Section 12 lists the controls the subdomain still needs (single sign-on, mandatory two-factor, server-side permission checks, masking, audit), because a separate address doesn't protect anything on its own.

> **Legal and fairness reminder.** KYC, eligibility and business verification have legal and data-protection requirements. Get legal advice before launch on KYC scope, investor eligibility rules (for example, accredited or qualified investor requirements), sanctions and risk screening, document retention, and what you may tell an applicant about a rejection. Reviewers decide on documents and facts, never on personal characteristics.

---

## 1. Design principles

- **Humans decide, tools assist:** automated checks and provider results are inputs. A rejection always needs a person and a written reason. Low-risk approvals may be automatic only if you choose, with random human sampling.
- **Evidence beside the decision:** the checklist, the documents and the decision panel are on one screen, so a reviewer doesn't hunt for context.
- **Minimum data, maximum care:** reviewers see only what a check needs. Identity numbers and bank details are masked by default, revealing needs a reason, and every reveal is logged.
- **Consistent standards:** each applicant type has a fixed, published checklist and reason codes. Two reviewers should reach the same decision on the same evidence.
- **Fair to people with unusual paperwork:** there is always a manual path for applicants who can't provide the standard documents, with alternative evidence rules, and no automatic rejection from a mismatch of name spelling, transliteration or format.
- **Clear and kind communication:** applicants learn what was verified, what is missing, how to fix it, and how to appeal. Messages never reveal fraud-detection methods.
- **Speed without shortcuts:** service targets and aging are visible; claiming locks a case; the order of work follows risk, deadline and age only.
- **Everything is traceable:** every view, reveal, claim, decision and message is written to the audit log.

---

## 2. Design tokens and shared look

Same tokens as the Admin Dashboard (ink, ivory, one gold accent, light and dark themes; `Fraunces` and `Inter`; IST timestamps with a visible time zone; 8px grid; 12px cards; 10px controls). Status colors: success for approved and passed, warning for needs attention and at risk, error for rejected and breached, info for on hold or waiting for the applicant.

### Shared status chips

| Group | Chips |
|---|---|
| **Case status** | `Submitted` (stone), `In review` (ink outline), `Waiting for applicant` (info tint), `Second review needed` (gold-tint), `On hold` (stone outline), `Approved` (success tint), `Rejected` (error tint), `Withdrawn` (stone), `Expired` (stone outline) |
| **Risk tier** | `Low` (stone), `Medium` (warning tint), `High` (error tint) with the reasons on hover |
| **Check result** | `Passed` (success), `Needs attention` (warning), `Failed` (error), `Not run` (stone), `Waived` (stone outline with reason), `Provider error` (warning outline) |
| **Source** | `Applicant-provided`, `Provider-verified`, `Reviewer-verified`, `Public record` |
| **SLA** | `On track`, `At risk`, `Breached` |

### Shared components
- **Case header:** applicant name and type, ID, submitted date, status, risk tier, SLA chip and target, claim lock ("Being reviewed by {name}"), **Claim**, **Release**.
- **Checklist:** a fixed list of checks per type. Each row: check name, result chip, source chip, evidence link, reviewer note, who and when.
- **Evidence viewer:** view-only, watermarked with the reviewer's staff ID and time, zoom, page jump, side-by-side with the application data. Downloads are off. Documents close after 5 minutes idle.
- **Masked field:** shows `••••• 4417`; **Reveal** asks for a reason (from a short list plus a note), shows the value for 60 seconds, and logs it.
- **Decision panel:** buttons by state, a required reason code, a free-text note for the internal record, an applicant-facing message (editable template), and a summary of what the decision unlocks or restricts.
- **Timeline:** every event on the case in order, with actor and time.
- **Linked records:** other accounts or organizations linked by shared signals (same business registration, domain, phone, payment instrument or device pattern), shown as IDs and relation type only, with a link that opens the other case if the reviewer may.

### Keyboard shortcuts (review pages)
`c` claim · `r` release · `]` and `[` next or previous document · `n` add note · `a` approve (opens confirmation) · `q` request changes · `x` reject (opens reason picker) · `?` shortcuts. Disabled while typing.

---

## 3. Internal roles and what they see (content scoping)

| Internal role | Verification access |
|---|---|
| Verification reviewer | Review and decide cases of the types assigned to them (for example startups and mentors only); can't override a high-risk flag or approve their own relatives or conflicts |
| Senior reviewer or supervisor | All types; second reviews, overrides of automated flags, assignment and release of locks, QA sampling |
| Trust and safety moderator | Read-only access to a case when linked to a report or fraud signal |
| Support agent | Case status and the applicant-facing message history only (no documents, no identity data) |
| Compliance officer | Read-only access to cases, decisions, audit and retention status; can place legal holds |
| Super admin | Everything, including reason-code and checklist changes through Configuration (versioned) |
| Others | No access |

The server enforces this on every request. A reviewer who is related to, employed by, or has a financial interest in an applicant must declare a conflict (a button on the case); the case is reassigned and the declaration is logged.

---

# Part A. Verification Queue: `/verifications`

## A.1 Purpose
One list of every case waiting for a human, ordered by risk, deadline and age, so the most urgent cases are done first and nothing sits unseen.

## A.2 Layout
```
┌──────────────────────────────────────────────────────────────┐
│ Title "Verifications"                     [Saved views ▾]    │
├──────────────────────────────────────────────────────────────┤
│ Type tabs: All · Startups · Mentors · Investors · Employers  │
│ Status: Submitted · In review · Waiting · Second review · Hold│
├──────────────────────────────────────────────────────────────┤
│ Summary strip (4 cards)                                      │
├──────────────────────────────────────────────────────────────┤
│ Toolbar: search · filters · sort · density · [Next case]     │
├──────────────────────────────────────────────────────────────┤
│ Table of cases                                  │ Case preview│
│                                                 │ drawer      │
└──────────────────────────────────────────────────────────────┘
```

### Summary strip
| Card | Example |
|---|---|
| Waiting | 31 |
| At risk or breached | 4 (warning or error tint) |
| Mine | 3 claimed |
| Median time to decision (30 days) | 1.4 days |

## A.3 Table

| Column | Content |
|---|---|
| Case | ID (mono), type icon |
| Applicant | Name (organization or person), country or state; for investors and mentors the person's name only |
| Submitted | Date and relative age |
| Status | Case status chip |
| Risk | Risk tier chip with a count of flags |
| Auto-checks | Mini result strip (for example 5 passed, 1 needs attention) |
| SLA | Chip and time remaining ("Due in 7 h") |
| Assigned | Reviewer avatar or "Unassigned" or lock icon |
| Level or scope | For investors the requested level (Basic, Full); for employers whether live drafts are waiting; for mentors whether a startup request is pending |
| Last activity | Time and actor (applicant or staff) |
| Actions | **Open**, **Claim** |

- Default sort: **severity and risk, time remaining to target, age** (the platform ordering rule). Alternative sorts: Oldest first, Submitted date, Type.
- Row click opens a **preview drawer** (summary, check results, risk reasons, timeline). **Open** goes to the full review page. `j` and `k` move between rows.
- **Next case** (top right) claims the first eligible case for the person using the ordering rule and opens it.

## A.4 Filters and saved views
Type, status, risk tier, SLA state, assigned to (me, unassigned, a person), requested level (investors), country or state, submitted date, has live drafts (employers), has pending startup request (mentors), linked-records present, provider error. **Saved views** ("Unassigned high risk", "Waiting for applicant over 7 days") can be shared with the team.

## A.5 Bulk actions (deliberately limited)
Allowed: **Assign**, **Release**, **Add to saved view**, **Send reminder to applicant** (template, for `Waiting for applicant` only), **Export list** (IDs and statuses only, supervisors). **Not allowed:** bulk approve, bulk reject or bulk reveal, because each decision needs its own evidence.

## A.6 Claiming and locks
Claiming locks a case for 10 minutes, renewed while active. Others see "Being reviewed by {name}." Cases idle 10 minutes return to the queue. Supervisors can release or reassign with a reason. A reviewer can hold at most 5 cases at once to prevent hoarding.

## A.7 Data contract

`GET /api/verifications?type=&status=&risk=&sla=&assigned=&cursor=`
```json
{
  "items": [
    {
      "id": "VER-2026-004812",
      "type": "employer",
      "applicant": { "displayName": "Acme Talent Pvt Ltd", "region": "KA" },
      "status": "submitted",
      "risk": { "tier": "medium", "flags": ["domain_mismatch"] },
      "autoChecks": { "passed": 5, "attention": 1, "failed": 0 },
      "submittedAt": "2026-11-05T10:14:00+05:30",
      "targetAt": "2026-11-07T18:00:00+05:30",
      "sla": "on_track",
      "assignedTo": null,
      "lock": null,
      "requestedLevel": null,
      "context": { "liveDrafts": 2 }
    }
  ],
  "nextCursor": "..."
}
```
No identity numbers, document names or contact details in list responses.

## A.8 States
- **Empty:** "No cases waiting." with the date of the last case decided.
- **No results:** "No cases match." with **Clear filters**.
- **Provider outage:** banner "KYC provider unavailable. Cases needing provider checks are paused." Affected rows show `Provider error`; reviewers can still work other checks.
- **Backlog (over target):** a supervisor banner with counts by type and **Rebalance**.
- **Stale or live updates paused:** same labels as the Dashboard.
- **Loading error:** inline **Retry**.

---

# Part B. Startup Verification Review: `/verifications/startups/:id`

## B.1 What this verification means
A **Verified startup** is a real, legally existing business whose registration details match what the applicant submitted and whose representative can act for it. It is not an endorsement of the idea, the team's quality or its prospects. It unlocks being listed to mentors and investors (when the founders choose), publishing hiring requests, and the Verified startup badge.

## B.2 Layout (all review pages)
Three columns on desktop:
- **Left (320px):** case summary and **checklist**.
- **Center (flexible):** **evidence viewer** and application data side by side (tabs: Application, Documents, Auto-check results, Linked records).
- **Right (360px):** **decision panel**, notes and timeline.
On tablet the right panel becomes a drawer; the review page is not offered on phones.

## B.3 Startup checklist (default, configurable by version)

| # | Check | Evidence and rule | Source |
|---|---|---|---|
| 1 | **Legal entity exists** | Registration number and legal name match the registry record (for example the company registry or LLP record); entity status is active | Provider or public record |
| 2 | **Name match** | Legal name, trade name and the name on documents are consistent; common variations and transliterations are accepted; differences go to a note, not an automatic fail | Reviewer |
| 3 | **Registered address** | Address in the application matches the registry or an official proof; virtual office or shared address is noted, not an automatic fail | Provider or reviewer |
| 4 | **Tax registration (if provided)** | Tax or GST registration matches the legal name; status active | Provider |
| 5 | **Authorized representative** | The applicant is a director, partner, founder or has written authority; proof such as board resolution, authorization letter or registry listing | Reviewer |
| 6 | **Representative identity** | Identity check of the applicant (liveness and document match from the KYC provider, or alternative evidence) at the "business representative" level | Provider |
| 7 | **Website and email domain** | Official email on a domain matching the company or its website; website exists and matches the business; a free-mail address needs the alternative evidence | Auto-check and reviewer |
| 8 | **Duplicate or linked entities** | No unexplained duplicate of the same registration; linked accounts reviewed | Auto-check and reviewer |
| 9 | **Risk and sanctions screening** | Provider screening for the entity and the representative; results reviewed by a person if any hit | Provider |
| 10 | **Application consistency** | Stage, sector and team size are plausible; no contradictory claims (reviewers don't judge the quality of the idea) | Reviewer |

Early-stage startups that are not yet incorporated: the page offers the **pre-incorporation path** (founder identity plus proof of intent such as a draft incorporation filing), which grants a lower tier (**Founder verified**) with a plain label, and a reminder to upgrade after incorporation.

## B.4 Decision outcomes (startup)

| Outcome | Result for the applicant |
|---|---|
| **Approve** | Startup becomes verified; can choose investor and mentor visibility; badge appears |
| **Approve with conditions** | Verified at a lower tier (for example Founder verified) with a stated next step and date |
| **Request changes** | Case moves to `Waiting for applicant` with specific items and a deadline (default 14 days) |
| **Reject** | Verification declined with reason codes and an appeal route |
| **Put on hold** | Internal hold (for example awaiting a provider); applicant sees "In review" |
| **Escalate** | Goes to a senior reviewer for second review |

Reason codes (examples): `REG_NOT_FOUND`, `REG_INACTIVE`, `NAME_MISMATCH_UNRESOLVED`, `REP_AUTHORITY_UNPROVEN`, `IDENTITY_CHECK_FAILED`, `DOMAIN_UNVERIFIED`, `DUPLICATE_ENTITY`, `SCREENING_HIT_CONFIRMED`, `DOCUMENT_UNREADABLE`, `INFO_INCONSISTENT`. Codes map to plain-language applicant messages.

## B.5 States and edge cases
- **Registry lookup fails or isn't supported for the country:** `Provider error` or `Not run`; reviewer uses documents and the manual path; the result is marked `Reviewer-verified`.
- **Name differences:** a note field and a "Reviewed variation" tag; never an automatic fail.
- **Founder outside India or non-standard registry:** manual path with alternative evidence list.
- **Previously rejected applicant reapplies:** shows prior case ID, reasons and what changed; a different reviewer is assigned where possible.

---

# Part C. Mentor Credential Review: `/verifications/mentors/:id`

## C.1 What this verification means
A **Verified mentor** has a confirmed identity, credible and checked claims about their roles, expertise and any exits, and no unmanaged conflicts. It lets the mentor accept startups, sign off readiness items and appear in matches. It is not a guarantee of mentoring quality, which is shown separately through reviews and impact.

## C.2 Checklist (default)

| # | Check | Evidence and rule | Source |
|---|---|---|---|
| 1 | **Identity** | Identity check by the KYC provider (document and liveness) or alternative evidence | Provider |
| 2 | **Employment and roles** | At least the principal roles claimed are confirmed: company websites, press, regulatory filings, LinkedIn plus a second source, employer letter or a referee. Each role is tagged `Verified` or `Self-reported` | Reviewer |
| 3 | **Exits and track record** | Claimed exits or funding outcomes confirmed with a public source or company record; unverified items remain labeled `Self-reported` and can't be used in public impact claims | Reviewer |
| 4 | **Expertise match** | Selected expertise areas are plausible given verified experience (reviewers don't judge teaching style) | Reviewer |
| 5 | **Conflicts of interest** | Declared conflicts (investments in or advising of startups on the platform, competing roles, relationships with investors) are reviewed; managed conflicts get restrictions (for example, can't sign off specific startups) | Reviewer |
| 6 | **Compensation and equity terms** | Fee model and any equity or advisory expectations are within platform rules; the mentor acknowledged the code of conduct and the no-sign-off-for-benefit rule | Reviewer |
| 7 | **Online presence consistency** | Public profile data matches the application; no credible public red flags (reviewers use documented, factual sources only) | Reviewer |
| 8 | **Risk and sanctions screening** | Provider screening for the individual | Provider |
| 9 | **References (if required)** | Optional referee contact via the platform's reference form for mentors with limited public verification | Reviewer |
| 10 | **Capacity and availability** | Declared capacity and availability are reasonable (informational) | Reviewer |

## C.3 Mentor-specific review elements
- **Credential map:** a table of every claim (role, company, years, exit) with its source chip, the evidence link and the reviewer's note. Unverified claims stay visible to the mentor as "Pending verification" and are hidden from startups until verified, or shown as self-reported if the mentor chooses.
- **Conflict panel:** declared conflicts, detected potential conflicts (for example, the mentor appears as an investor or employee linked to a startup applicant, shown as IDs and relation), and **Set restriction** (blocks the mentor from mentoring or signing off specific startups).
- **Impact on sign-offs:** a note that readiness sign-offs carry weight with investors, so rules are stricter: unresolved conflicts or unverified core claims can't be approved.

## C.4 Decision outcomes (mentor)
Approve · Approve with restrictions (listed) · Request changes (items and deadline) · Reject (reason codes and appeal route) · Put on hold · Escalate. Reason codes include `IDENTITY_FAILED`, `CLAIMS_UNVERIFIABLE`, `CONFLICT_UNMANAGEABLE`, `TERMS_NONCOMPLIANT`, `SCREENING_HIT_CONFIRMED`, `INFO_INCONSISTENT`.

## C.5 States and edge cases
- **Mentor has limited public footprint:** reference path (C.2 #9) and an employer or peer letter.
- **Mentor is also a founder or investor on the platform:** the case shows the other roles as linked records; restrictions apply across roles for the same startups.
- **Conflict discovered after approval:** the mentor is flagged for re-review (Part F), with a temporary restriction while it is checked and the reason recorded.

---

# Part D. Investor KYC Review: `/verifications/investors/:id`

## D.1 What this verification means
A **Verified investor** has a confirmed identity (and entity, if applicable) at a stated level, has passed risk screening, and meets any eligibility rules you adopt after legal advice. The platform introduces parties and isn't a broker or adviser unless licensed; verification is a gate, not an endorsement.

### Levels (from the investor designs)

| Level | Unlocks | Main evidence |
|---|---|---|
| **Basic** | Browse startups, shortlist, request intros (limited) | Identity check of the person; email and phone |
| **Full** | Data rooms, meetings, offers, commitments | Basic plus entity or accreditation evidence, source-of-funds declaration (as your counsel requires), enhanced screening |

The case shows the requested level and any upgrade path. Reviewers can approve a lower level than requested.

## D.2 Checklist (default; confirm every item with legal counsel)

| # | Check | Evidence and rule | Source |
|---|---|---|---|
| 1 | **Identity of the individual** | Document authenticity, face and liveness, name match; provider-verified | Provider |
| 2 | **Contact verification** | Email and phone verified | Auto-check |
| 3 | **Entity (for funds and angel groups)** | Registration, legal form, good standing, registered address, tax registration | Provider or public record |
| 4 | **Authority to act for the entity** | Authorization letter or listing as a director, partner or manager | Reviewer |
| 5 | **Beneficial ownership** | Declaration of beneficial owners above the configured threshold, with identity checks for those who meet it (scope set by counsel) | Provider and reviewer |
| 6 | **Investor eligibility** | Evidence of qualification if your rules require it (for example accredited or qualified investor status) | Reviewer |
| 7 | **Source of funds or wealth declaration** | Declaration, with supporting documents only if risk requires | Reviewer |
| 8 | **Risk, sanctions and PEP screening** | Provider screening for individuals, entities and beneficial owners; every hit goes to a human; PEP status leads to enhanced review, not automatic rejection | Provider and reviewer |
| 9 | **Adverse information** | Documented, factual public sources only (for example court or regulator actions), reviewed under written criteria | Reviewer |
| 10 | **Linked accounts and conduct history** | Prior accounts, blocks or reports on the platform | Auto-check and reviewer |
| 11 | **Team members (organizations)** | Each member who will access data rooms is verified individually at the level needed | Provider |
| 12 | **Terms acknowledgment** | Code of conduct, NDA terms, platform disclaimer | Auto-check |

## D.2a Handling sensitive data
- Only the **last 4 characters** of identity numbers are stored in readable form; full documents are held encrypted by the provider or in restricted storage with a retention period set by counsel. Reviewers see masked values and reveal only with a reason.
- Documents and face images are not shown in lists, notifications or search, and aren't downloadable.
- Screening hits show source, match score and the identifying details needed to confirm or dismiss, with a note field; confirmed hits require a second reviewer.

## D.3 Risk tiers
Risk tier comes from documented rules (country, entity complexity, PEP status, screening hits, linked accounts, unusual structures) and is shown with reasons. **High** risk always requires a second reviewer. The tier never uses personal characteristics such as religion, caste, ethnicity, gender or age, and rules are reviewed for bias.

## D.4 Decision outcomes (investor)
Approve at Basic · Approve at Full · Approve with restrictions (for example, no offers above a limit until enhanced checks complete) · Request changes · Reject · Put on hold · Escalate. Reason codes include `IDENTITY_FAILED`, `ENTITY_UNVERIFIED`, `AUTHORITY_UNPROVEN`, `BENEFICIAL_OWNER_UNIDENTIFIED`, `ELIGIBILITY_NOT_MET`, `SCREENING_HIT_CONFIRMED`, `SOURCE_OF_FUNDS_UNSATISFACTORY`, `INFO_INCONSISTENT`.
- **Rejection messages** state what couldn't be verified and how to appeal. They never reveal screening sources or suspicions.
- **Suspicious activity:** if a reviewer believes the case indicates fraud or financial crime, the **Escalate to compliance** button routes it to the compliance officer, who decides on any regulatory reporting. Reviewers don't tell the applicant about internal reports.

## D.5 States and edge cases
- **Provider unavailable:** case stays in queue with `Provider error`; no decision on identity without a successful check or alternative evidence.
- **Name mismatch across documents:** a note and a request for explanatory evidence; not an automatic fail.
- **Applicant outside supported countries:** manual path or "Not supported yet" outcome, with a clear message and a waitlist option.
- **Level upgrade request from an already Basic investor:** shows the existing approval and only the additional checks.
- **Organization member added later:** a separate mini-case for that member.

---

# Part E. Employer Verification Review: `/verifications/employers/:id`

## E.1 What this verification means
A **Verified employer** is a real organization, represented by an authorized person, with an official domain and a legitimate hiring purpose. It unlocks publishing jobs, messaging candidates and the verified-employer badge. It is the main protection for job seekers against fake jobs and fee scams, so the checks lean toward caution, and the manual path stays fair.

## E.2 Checklist (default)

| # | Check | Evidence and rule | Source |
|---|---|---|---|
| 1 | **Organization exists** | Registration number and legal name match the registry; entity active (companies, LLPs, partnerships, proprietorships, institutions, nonprofits, with the right evidence for each) | Provider or public record |
| 2 | **Name and brand match** | Legal name, brand name, website and job posts are consistent | Reviewer |
| 3 | **Registered address and presence** | Address plausible; physical presence not required for remote-first | Reviewer |
| 4 | **Official email domain** | Applicant's email domain matches the company's website domain; if free-mail, require alternative evidence | Auto-check |
| 5 | **Website and online footprint** | Working website, consistent business description, contact details; the domain isn't newly created for this purpose without other evidence | Auto-check and reviewer |
| 6 | **Authorized representative** | The applicant is employed by or authorized to hire for the organization: authorization letter, registry listing, or a verified company email plus a manager confirmation | Reviewer |
| 7 | **Representative identity** | Identity check of the representative at the business level | Provider |
| 8 | **Hiring purpose and type** | Direct employer, staffing agency or recruiter, or franchise; agencies must disclose the client type and follow the agency rules (for example, no fees to candidates) | Reviewer |
| 9 | **Fee and scam risk signals** | Language or history typical of fee scams, unrealistic pay claims, requests to move off-platform, mismatched logos; checked against the policy blocklist | Auto-check and reviewer |
| 10 | **Duplicate or linked organizations** | Other accounts sharing registration, domain, phone, payment instrument or device patterns; previously blocked entities | Auto-check and reviewer |
| 11 | **Risk and sanctions screening** | Provider screening for the entity and representative | Provider |
| 12 | **Policy acknowledgment** | Posting rules, fair hiring and no-fees commitments accepted | Auto-check |
| 13 | **Draft content review (if drafts exist)** | A quick scan of draft jobs for banned content (fee requests, discriminatory criteria, off-platform contact) | Auto-check and reviewer |

## E.3 Employer-specific elements
- **Live drafts waiting:** shows how many drafted jobs are waiting on verification and a sensitivity flag if the company has urgent roles; the queue orders by the platform rule, not by whether the company is a paying customer.
- **Agency path:** if the employer is a staffing or recruitment agency, extra checks apply (agency registration, client disclosure, fee policy acknowledgment), and the badge label says "Verified recruiter" instead of "Verified employer."
- **Startup already verified:** if the company is also a startup on the platform with a verified business, the case reuses that verification and only checks the hiring-specific items (4, 6, 8, 9, 12).

## E.4 Decision outcomes (employer)
Approve · Approve with restrictions (for example, outreach limits or manual review of every job post for 30 days) · Request changes · Reject · Put on hold · Escalate. Reason codes include `ORG_NOT_FOUND`, `DOMAIN_UNVERIFIED`, `AUTHORITY_UNPROVEN`, `IDENTITY_FAILED`, `SCAM_RISK_CONFIRMED`, `AGENCY_DISCLOSURE_MISSING`, `DUPLICATE_OR_BLOCKED_ENTITY`, `INFO_INCONSISTENT`.
- **Scam-risk rejections** use a neutral message ("We couldn't verify your organization") and route to Trust and Safety. They don't reveal the signals.
- An approved employer's **trust standing** begins at "Good standing" and is managed on the employer's Trust and Safety page.

## E.5 States and edge cases
- **Very small employers or sole proprietors:** supported with proportionate evidence (tax registration, local business license, bank-verified identity), with the same checks for authority and domain.
- **Freelance clients hiring one-off help:** not verified as employers; the page explains that employers must represent a hiring organization, and points to the right path.
- **Employer asks for urgent approval:** doesn't change the order; the queue ordering rule applies to everyone.
- **Cases linked to a prior fraud report:** locked to senior reviewers and trust and safety.

---

# Part F. Re-verification and Expiry: `/verifications/expiring`

## F.1 Purpose
Verification is not forever. This page tracks verifications close to expiry and those triggered by changes, so access never lapses by surprise and risky changes get a second look.

## F.2 Validity defaults (configurable)

| Type | Validity | Notes |
|---|---|---|
| Startup | 24 months | Also on legal name, registration or ownership change |
| Mentor | 24 months | Also when claims or conflicts change |
| Investor (Basic) | 24 months | Identity documents expiring earlier trigger earlier review |
| Investor (Full) | 12 months | Enhanced checks refresh yearly |
| Employer | 12 months | Also on domain, legal name or representative change |

## F.3 Triggers
- **Scheduled:** approaching expiry date.
- **Change events:** legal name change, registration change, owner or director change, domain change, representative change, new country, large increase in activity (for example, 10x job posts), new beneficial owner.
- **Risk events:** screening list updates, a relevant report or a fraud signal, repeated policy flags, provider rule updates.
- **Document expiry:** identity document or authorization letter expiry.
- **Platform policy change:** a new rule that needs fresh evidence.

## F.4 Layout
Header with title and summary strip, tabs, toolbar, table, and a side drawer.

### Summary strip
| Card | Example |
|---|---|
| Expiring in 30 days | 18 |
| Expiring in 7 days | 5 (warning tint) |
| Lapsed (grace period) | 3 (error tint) |
| Triggered by change | 7 |

### Tabs
**Scheduled expiry** · **Triggered by change** · **Risk triggers** · **In grace period** · **Lapsed**.

### Table
Case ID, applicant, type and level, trigger and reason, expiry date, days left, applicant status (`Notified`, `Responded`, `No response`), restriction status (what is limited now), risk tier, assigned, and actions (**Open case**, **Send reminder**, **Extend grace** (supervisors), **Start re-review**).

## F.5 Applicant communication schedule (configurable)
Reminders at **30, 14, 7 and 1 days** before expiry, in-app and email, each stating what will happen and the deadline. A **grace period** (default 14 days) follows expiry. Reminders use plain language and a single link to renew. A re-review case is created when the applicant submits updated evidence (or automatically at expiry if no response).

## F.6 What lapses, and what doesn't
| Role | During grace | After lapse |
|---|---|---|
| Startup | Everything continues; banner shown | Profile hidden from investors and mentors until renewed; data and records are kept |
| Mentor | Existing mentorships continue; no new acceptances | Can't accept startups or sign off; existing sign-offs remain on record |
| Investor | Existing deals continue; no new data rooms or offers | Read-only on existing deal records; new data-room requests, offers and intros blocked |
| Employer | Existing pipelines continue; no new jobs | Jobs paused after the end date; no new messages to candidates; existing candidate threads readable; data retained per policy |
Applicants are told this plainly in their reminders. Nothing is deleted because of a lapse.

## F.7 Decision flow
Re-review uses the same checklist and pages as the original case but shows the previous decision, what changed, and only the checks that are due or triggered. Outcomes: **Renew** (new validity period), **Renew with restrictions**, **Request changes**, **Lapse** (with reason), **Escalate**. A downgrade (for example Full to Basic) requires a reason and a notice to the applicant.

## F.8 Quality sampling (on this page's side drawer, supervisors)
A **QA sample** tab shows a random sample (for example 5%) of recent approvals and rejections across types for second review. It reports agreement as a process metric by checklist item and reviewer group (never as an individual ranking), finds unclear checklist items, and feeds checklist improvements. Sampled cases are labeled and handled like second reviews.

## F.9 States
- **Nothing expiring:** "No verifications need attention."
- **Notification failures (email bounced):** flagged with a manual contact path via support.
- **Applicant responded, waiting for review:** appears with a `Responded` chip at the top of the table.
- **Provider rule update affecting many cases:** bulk-triggered cases are created in a **batch** with a label and a staggered notification schedule to avoid flooding applicants and reviewers.
- **Grace extension:** supervisors only, with a reason, up to a configured maximum.

---

# Part G. Applicant-facing statuses and messages (all types)

| Status shown to the applicant | Meaning | What they can do |
|---|---|---|
| Submitted | We received your application | Nothing; expected timeline shown |
| In review | A reviewer is checking your details | Nothing |
| Waiting for you | We need more information | Upload documents or answer questions by the deadline; reminders sent |
| Verified (level shown) | Approved | Use the unlocked features |
| Verified with conditions | Approved with limits and steps | See what's limited and what to do |
| Couldn't verify | Declined, with plain-language reasons | Appeal, or reapply when the issue is fixed |
| Expiring soon | Renewal needed | Renew with updated evidence |
| Lapsed | Verification expired | Renew; what is paused and what isn't is explained |

Message templates are maintained in Configuration, versioned, translatable and reviewed for tone. Examples:
- **Request changes:** "We couldn't confirm {item}. Please upload {document} by {date}. You can reply here if you need help or have a different way to show this."
- **Couldn't verify:** "We couldn't verify {item}. This isn't a judgment of you or your business. If you think we got it wrong, you can appeal here."
Applicants see reason categories, never internal risk notes or screening sources.

---

# Part H. Appeals and escalations (links)

- **Appeal:** every rejection includes an appeal link. The appeal goes to the Appeals queue and is decided by a different reviewer (see the Appeals page). The case page shows appeal status and links.
- **Escalate:** any reviewer can escalate to a senior reviewer (second review), to **compliance** (suspected financial crime or sanctions) or to **trust and safety** (suspected fraud or abuse). Escalation requires a reason and creates a timeline entry.
- **Second review rules:** needed for High risk, confirmed screening hits, overrides of automated flags, conflicts, and a random QA sample. The second reviewer cannot be the first reviewer, and sees the evidence but not the first reviewer's recommendation until they record their own (to avoid anchoring).
- **Overrides:** overriding an automated `Failed` result requires a senior reviewer, a reason and dual control for investors and employers.

---

# Part I. Data model and APIs (for the build)

### Case object (simplified)
```json
{
  "id": "VER-2026-004812",
  "type": "investor",
  "subject": { "userId": "usr_123", "orgId": "org_77" },
  "requestedLevel": "full",
  "status": "in_review",
  "risk": { "tier": "high", "flags": [{ "code": "pep_match", "state": "needs_review" }] },
  "checks": [
    { "key": "identity", "result": "passed", "source": "provider", "evidenceIds": ["ev_1"], "note": "", "by": "system", "at": "..." },
    { "key": "screening", "result": "needs_attention", "source": "provider", "evidenceIds": ["ev_5"], "note": "", "by": null, "at": null }
  ],
  "lock": { "by": "stf_9", "expiresAt": "2026-11-06T14:40:00+05:30" },
  "sla": { "targetAt": "2026-11-08T18:00:00+05:30", "state": "on_track" },
  "decision": null,
  "validUntil": null,
  "timeline": []
}
```

### Endpoints
- `GET /api/verifications` (list, Part A.7), `GET /api/verifications/{id}` (case with masked fields), `GET /api/verifications/{id}/evidence/{evidenceId}` (streams a watermarked view, no download).
- `POST /api/verifications/{id}/claim`, `/release`, `/note`.
- `POST /api/verifications/{id}/reveal` with `{ field, reasonCode, note }` (returns the value once for 60 seconds and writes the audit entry).
- `POST /api/verifications/{id}/decision` with `{ outcome, reasonCodes[], internalNote, applicantMessageId, restrictions[], validUntil }`; for `reject` and high-risk approvals the server requires a second reviewer record; for overrides it requires dual control.
- `POST /api/verifications/{id}/request-changes` with `{ items[], deadline }`.
- `POST /api/verifications/{id}/escalate` with `{ to, reason }`.
- `GET /api/verifications/expiring`, `POST /api/verifications/{id}/reminder`, `POST /api/verifications/{id}/extend-grace`.
- Webhooks from providers (KYC, registry, screening) are verified by signature, idempotent, and write results to the case with raw payloads stored encrypted and restricted.

### Rules enforced on the server
- A case can have one active lock; decisions without a lock by the same reviewer are refused.
- Required fields per decision: reason codes (rejects and request-changes), second-review record where required, applicant message.
- Evidence endpoints enforce watermarking and session limits, and never return raw files for download.
- Time rules and service targets come from configuration (business calendar in IST).

---

# Part J. States and error handling (common)

| State | Behavior |
|---|---|
| Case claimed by someone else | Read-only view with the holder's name; **Request release** (to supervisors) |
| Lock expired mid-review | Banner "Your lock expired" with **Reclaim** (if still available); unsaved notes are kept as a local draft |
| Provider timeout or error | Check shows `Provider error` with **Retry** and a note field; reviewers can proceed with the manual path and mark the source `Reviewer-verified` |
| Document unreadable | **Request a clearer document** (template); the case moves to `Waiting for applicant` |
| Applicant uploads new evidence while in review | Banner "New evidence added" with a diff of what changed; the case stays with the same reviewer |
| Applicant withdraws | Case closes as `Withdrawn`; evidence follows retention rules |
| Conflict of interest declared | Case is reassigned; the declaration and new assignee are logged |
| Reveal requested for a masked field | Reason picker; value shown for 60 seconds; logged |
| Idle on a review page | After 5 minutes documents close; after 15 minutes the session locks (admin session rules) |
| Network loss | Notes autosave locally; decisions require a connection and show "You're offline." |
| Duplicate submission | Case merges with the existing one; the applicant sees a single status |
| Decision conflict (two decisions at once) | The second decision is refused with the first decision's summary |
| Staging | Strip shows STAGING; synthetic applicants and a sandbox provider |

---

# Part K. Accessibility, performance and operations

- **Accessibility:** WCAG 2.1 AA in light and dark themes; checklist and queue are keyboard operable with a visible focus ring; evidence viewer supports keyboard zoom and page navigation; document text alternatives are provided where the file allows; status uses text and icons as well as color; live regions announce lock changes and applicant updates politely.
- **Performance:** queue loads under 1.5 seconds (p75), case page under 2 seconds with the first document rendered under 3 seconds; evidence streamed progressively; payloads exclude document content until opened.
- **Reliability:** if a provider is down, other checks keep working; provider results are stored so a reviewer doesn't need to re-run completed checks; stale provider results (older than a set number of days) show a re-run prompt.
- **Observability:** error and latency tracking without personal data; alerts for provider failure rates and queue age; feature flags per check so a faulty provider integration can be disabled without a deploy.
- **Localization:** English first; applicant messages are translatable; dates and times in IST by default with the time zone shown.
- **Telemetry (internal, aggregate only):** time to decision by type, request-changes rate, rejection reasons distribution, appeal outcomes, second-review agreement. Not used to rank individual reviewers; this is stated in the team handbook.

---

# Part L. Security, privacy and audit

- **Admin app controls (subdomain):** single sign-on, mandatory two-factor (hardware key or authenticator app), 15-minute idle lock, 8-hour absolute session, host-scoped `Secure`, `HttpOnly`, `SameSite=Strict` cookies, strict CSP, no indexing, optional VPN or IP allowlist, server-side permission checks on every request, separate deployment and secrets from the public app.
- **Data minimization:** list and queue views carry no identity numbers, contact details or document names. Case views mask sensitive fields. Documents are watermarked, view-only and auto-closed.
- **Reveal and access logging:** every reveal, document open, download attempt (blocked), claim, release, note, decision, message and export writes an audit entry with staff ID, time, case ID and reason.
- **Dual control and separation of duties:** second review for High risk and confirmed hits; overrides need a senior reviewer plus a second approver for investors and employers; reviewers can't review their own conflicts; configuration changes to checklists and reason codes need a super admin and are versioned.
- **Retention:** verification evidence is kept only as long as needed (periods set with counsel), then deleted or anonymized; decision records, reason codes and audit entries are retained longer per policy. Applicants can request deletion; legally required records are retained and explained. Legal holds (compliance officers) pause deletion.
- **Applicant privacy:** applicants see what data is held, can correct errors and can request deletion through Data rights requests. Evidence is used only for verification and fraud prevention.
- **Fairness safeguards:** checklists and risk rules are fixed, published internally and reviewed for bias; reviewers don't see or use personal characteristics unrelated to the checks; name and format variations are handled by notes, not auto-fails; there is always a manual path.
- **Regulatory:** confirm with counsel the KYC scope, retention periods, screening obligations, reporting duties, eligibility rules for investors, and what the platform may say to applicants. Escalations for suspected financial crime go to compliance.

---

# Part M. Acceptance criteria and QA checklist

**Queue**
- [ ] Order follows risk, time to target, then age; verified in tests across weekends and Indian public holidays.
- [ ] Claiming locks a case; two reviewers can't decide the same case; locks expire and release correctly; a reviewer can't hold more than the limit.
- [ ] Bulk approve, reject and reveal do not exist; bulk reminders only work for `Waiting for applicant`.
- [ ] List responses contain no identity numbers, contact details or document names.

**Review pages**
- [ ] Each type shows the correct checklist version; a checklist change creates a new version without altering past cases.
- [ ] Decisions require reason codes (reject and request changes), the applicant message, and a lock held by the reviewer.
- [ ] High risk, confirmed hits and overrides require a second reviewer or dual control, enforced by the API.
- [ ] Masked fields reveal only with a reason, show for 60 seconds, and write an audit entry.
- [ ] Documents are watermarked, view-only, not downloadable, and close after 5 minutes idle.
- [ ] Name variations and transliterations never cause an automatic fail; the manual path works for each type.
- [ ] Rejection messages never reveal screening sources or suspicions.
- [ ] Conflict-of-interest declaration reassigns the case and is logged.

**Expiry**
- [ ] Reminders go out at 30, 14, 7 and 1 days; grace periods and restriction rules match the table; nothing is deleted at lapse.
- [ ] Change-event and risk triggers create re-review cases; batch triggers are staggered.
- [ ] Only supervisors can extend grace, with a reason and within the configured maximum.
- [ ] QA sampling picks random cases, hides the first reviewer's recommendation, and reports aggregate agreement only.

**Security and privacy**
- [ ] SSO and two-factor are mandatory; idle lock and session limits work; permissions are enforced on the server for every request.
- [ ] Support agents see status and messages only; compliance sees read-only plus holds; moderators see only linked cases.
- [ ] Evidence is encrypted at rest; retention jobs delete or anonymize on schedule; legal holds pause them.
- [ ] No personal data appears in logs, error reports, notifications or analytics payloads.

**Accessibility and performance**
- [ ] Keyboard-only completion of a full review (claim, check, note, decide) is possible; focus order is logical; AA contrast in both themes.
- [ ] Performance targets in Part K are met on a typical office network; provider failure doesn't block unrelated checks.

**Content**
- [ ] Applicant message templates reviewed for tone, plain language and translation; reason codes map to applicant-facing categories.
- [ ] Empty, loading, error, stale, provider-error and offline states are implemented for every page.

---

# Part N. Build order (suggested)

1. **Admin foundation:** subdomain, SSO, two-factor, internal roles with server-side checks, audit log, masking and evidence-view service (watermark, no download). Everything here depends on it.
2. **Verification data model and provider integrations:** case, checks, evidence, decisions; KYC, registry and screening providers behind a common interface with webhooks and retries.
3. **Verification Queue** (list, ordering rule, claiming, locks, filters) and the **review frame** (checklist, evidence viewer, decision panel, timeline).
4. **Startup Verification Review** and **Mentor Credential Review** first, since your proposal says to launch with startups and mentors.
5. **Employer Verification Review** (needed before employers publish jobs) and the applicant-facing messages and request-changes flow.
6. **Investor KYC Review** with levels, beneficial ownership, screening handling, second review and compliance escalation, once your legal review of KYC scope is done and anchor investors are ready.
7. **Re-verification and Expiry:** reminders, grace periods, change and risk triggers, batch handling.
8. QA sampling, telemetry, appeals integration, retention jobs and legal holds.
9. Accessibility, performance and security review against the checklist, then a staged rollout (one reviewer group first).

**Suggested first release:** the foundation, the queue, and the Startup, Mentor and Employer reviews with the manual path and request-changes flow; add Investor KYC and automated re-verification once your legal review and providers are in place. Auto-approval of low-risk cases is optional, and if you adopt it, keep random human sampling.

**Reminder for the build:** the subdomain is an isolation layer, not an access control. Keep mandatory two-factor, server-side permission checks, masking with logged reveals, dual control for sensitive decisions and the append-only audit log in place from day one, and don't store or show more identity data than each check needs. Get legal advice on KYC and eligibility rules, sanctions and risk screening, retention, applicant messaging and any reporting duties before launch.
