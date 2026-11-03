# Analytics Page Design: `/startup/analytics`

One analytics hub for the startup, split into four tabs:

| Tab | Question it answers |
|---|---|
| **Overview** | How are we doing overall, and what needs attention? |
| **Journey** | Are we progressing through stages, mentoring, funding and hiring? |
| **Business** | How healthy are our revenue, costs, customers and unit economics? |
| **Market** | How big is our market, who are we up against, and how do we compare? |

It uses the same visual language as the other pages: ink, ivory, one gold accent.

## 1. Design principles

- **Answers before charts:** every chart has a plain-language headline ("MRR grew 12% this month") so a founder gets the point without reading axes.
- **Honest data:** each number shows where it comes from (entered by the team, calculated by the platform, benchmark, or external source) and when it was last updated. No unlabeled estimates.
- **Calm color:** ink for the main series, gold for the highlight, stone for comparison. Never more than three colors per chart. Positive and negative trends use text and arrows as well as green and red.
- **Stage-aware:** default metrics change with the startup's stage; irrelevant ones are hidden, not greyed out.
- **Privacy-safe benchmarks:** comparisons use anonymized, aggregated data from groups of at least 10 startups.

## 2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary chart series, primary buttons |
| `--ink-soft` | `#1C2B42` | Hover / pressed |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Highlight series, current point, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Insight callouts, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Comparison series, disabled |
| `--stone-200` | `#E5E1D8` | Borders, gridlines |
| `--success` | `#2E7D5B` | Positive change |
| `--warning` | `#B7791F` | Watch |
| `--error` | `#B42318` | Negative change, risk |

## 3. Typography

- **Page title and KPI numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`.

| Element | Size / weight |
|---|---|
| Page title | 28px serif 600 |
| KPI number | 32px serif 600 |
| Card title | 16px Inter 600 |
| Insight headline | 14px Inter 500 |
| Axis / caption | 12px Inter 400, `--stone-700` |

Numbers use tabular figures. Currency is shown in ₹ with Indian grouping by default (for example, ₹4.8L, ₹1.2 Cr) and is configurable in Settings.

## 4. Layout

### Desktop (≥ 1200px)
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar                                       │
│          ├────────────────────────────────────────────────┤
│          │  Title "Analytics"     [Date range] [Export]   │
│          ├────────────────────────────────────────────────┤
│          │  Tabs: Overview · Journey · Business · Market  │
│          ├────────────────────────────────────────────────┤
│          │  Filter bar (compare, segment, refresh)        │
│          ├────────────────────────────────────────────────┤
│          │  Insight strip (2–3 key insights)              │
│          ├────────────────────────────────────────────────┤
│          │  KPI row                                       │
│          ├──────────────────────────┬─────────────────────┤
│          │  Charts grid (8 col)     │  Side (4 col)       │
│          │                          │  Data sources, tips │
└──────────┴──────────────────────────┴─────────────────────┘
```
- 12-column grid, 24px gutters, max content width 1280px.
- Cards: white, 1px `--stone-200` border, radius 12px, padding 24px.

### Tablet
Side column moves to the bottom. Charts go to a two-column grid.

### Mobile
Single column. KPI cards scroll horizontally. Tabs become a scrollable segmented control. Charts simplify (fewer gridlines, tap for tooltips). Export is in the overflow menu.

## 5. Page header and global controls

- Title: "Analytics". Subtitle: "Understand your progress, your business and your market."
- **Date range:** Last 30 days, 90 days, This quarter, 12 months, Custom.
- **Compare to:** Previous period, Same period last year, Target. Comparison series appear in `--stone-400`.
- **Export:** CSV (data), PDF (report with insights). **Share report** creates a view-only link for mentors or investors (respects data-sharing permissions).
- **Last updated** caption with a **Refresh** button.

## 6. Shared components

### KPI card
- Label (caption), big serif number, change chip (arrow + percent, for example "▲ 12%"), small sparkline (ink, last point gold).
- Hover shows a tooltip with the definition and the formula. Click opens a drill-down drawer.
- Optional target marker: "Target ₹6L · 80% there" with a gold progress bar.

### Chart card
- Title, one-line **insight headline** (auto-generated, editable by admins), chart, footer with source and "How is this calculated?" link.
- Chart types: line (trends), bar (comparisons), stacked bar (composition), funnel (conversion), donut (only for 2–4 parts), table with inline bars (rankings).
- Gridlines in `--stone-200`; axis text 12px; tooltips white with soft shadow; legends only when more than one series.

### Insight strip
Two or three cards with `--gold-tint` background: icon, headline ("Runway dropped to 7 months"), one-line reason, **View details** link. Insights are generated from data and labeled "Auto insight". Never presented as advice.

### Data source chip
Small chip on each card: `Entered by team`, `Calculated`, `Platform benchmark`, `External`. Includes "Updated 2 days ago".

### Table
Sticky header, sortable columns, row hover `#F4F1EA`, CSV export per table.

### Buttons and inputs
Primary: ink, white text, radius 10px. Secondary: white with stone border. Inputs and selects 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

---

# Tab 1. Overview

**Purpose:** a one-screen summary pulled from the other three tabs.

### KPI row (4 cards, stage-aware)
| Card | Example |
|---|---|
| Readiness score | 72 / 100, +5 this month |
| MRR | ₹4.8L, ▲ 12% |
| Runway | 9 months |
| Active pipeline | ₹18L across 14 deals |

### Charts
1. **Stage progress:** stage stepper with exit criteria met (links to `/startup/stage`).
2. **Revenue vs burn (last 6 months):** bars for revenue (ink) and burn (stone-400), runway line (gold, dashed).
3. **Goal tracker:** list of three to five goals with progress bars (gold on stone-200), owners and dates.
4. **Attention list:** items needing action (overdue milestones, expiring data room access, pending mentor reviews) with links.

### Side column
Data completeness meter ("78% of analytics inputs filled") with a list of missing inputs, for example "Add March revenue".

---

# Tab 2. Journey

**Purpose:** track the platform journey: stage, mentoring, investors and hiring. This tab delivers the analytics listed in your ERP core: stage progress, funnel from registration to funding or hire, and usage.

### KPI row
Readiness score, criteria met in current stage, mentor sessions held, investor views.

### Sections

#### 2.1 Stage progress
- Horizontal timeline with the four stages, dates entered and time spent in each (days).
- Exit criteria burndown: criteria remaining over time (ink line, gold current point).
- Benchmark chip: "Median time in Prototype for similar startups: 74 days" (aggregated, labeled `Platform benchmark`).

#### 2.2 Readiness score breakdown
- Stacked bar: checklist completion, traction data, mentor feedback, with the trend over time.
- Table of readiness checklist items with mentor sign-off status.

#### 2.3 Mentor impact
- Sessions held per month (bars), average sessions per plan, deliverables completed on time (percent).
- Sign-off progress: "4 of 6 items".
- Readiness score change before and after mentor sessions (simple paired line, with a note that correlation is not proof of cause).

#### 2.4 Investor funnel
- Funnel: Profile views → Shortlisted → Messages → Meetings → Term sheets → Closed.
- Conversion rate between steps; time spent at each step.
- Table: investor type (angel, fund, group), views, interest, last activity. Shows only investors who opted to be visible. Hidden entirely if the profile is not shared.

#### 2.5 Hiring funnel
- Funnel: Applied → Shortlisted → Interview → Offer → Hired.
- Per job: applicants, time to hire, offer acceptance rate, source of applicants.
- Open roles by stage hiring request.

#### 2.6 Workspace usage
- Active team members per week, tasks completed per week, documents added, data room views. Counts only; no individual monitoring.

---

# Tab 3. Business analytics

**Purpose:** measure the health of the business itself. Data comes from the stage toolkits (revenue and burn dashboard, sales pipeline, KPI tracker, finance) and manual or imported entries.

### Stage-aware defaults
| Stage | Metrics shown first |
|---|---|
| Idea | Interviews done, validated problems, pilot interest |
| Prototype | Test users, activation, satisfaction, feedback resolved |
| Early revenue | MRR, customers, churn, CAC, payback |
| Mature | Revenue growth, margins, headcount cost, cash, forecast |

Founders can switch to "All metrics" at any time.

### KPI row (early revenue example)
MRR, Growth MoM, Cash balance, Runway.

### Sections

#### 3.1 Revenue
- **MRR / ARR trend:** line (ink), with the current month point in gold; breakdown toggle: New, Expansion, Contraction, Churned (stacked bars).
- **Revenue by plan or product** (bar) and **by customer segment** (bar).
- Top customers table (top 5 share of revenue) with a concentration warning when one customer exceeds 30%.
- Forecast: simple projection line (dashed) with the assumption shown ("Based on the last 3 months' growth rate").

#### 3.2 Costs, burn and runway
- Burn by category (stacked bar: Salaries, Marketing, Tools, Operations, Other).
- Net burn and gross burn lines; **runway** gauge in months with scenarios: Current, If revenue grows 10%, If we hire 2 people.
- Budget vs actual table with variance chips.

#### 3.3 Customers and retention
- Customers over time (line) and new vs churned (bars).
- **Cohort retention:** heatmap table (months since signup vs cohort), shaded in ink tints; hover shows exact numbers.
- Churn rate, net revenue retention, average revenue per customer.

#### 3.4 Sales and marketing
- **Sales funnel:** Lead → Contacted → Demo → Proposal → Won; conversion at each step; average cycle length.
- Win rate by source (table with inline bars).
- Channel performance: spend, leads, cost per lead, customers acquired, CAC by channel.

#### 3.5 Unit economics
- Cards: CAC, LTV, LTV:CAC ratio, payback period, gross margin.
- Chart: CAC vs LTV over time (two lines).
- Plain definitions shown under each card, with the formula. A "Healthy range" note is shown as general guidance, not a verdict.

#### 3.6 Product and operations
- Activation rate, weekly active users, feature usage (top 5 features), support tickets and response time, NPS trend.
- Prototype stage: sprint velocity and bug count trends.

#### 3.7 Team and hiring
- Headcount over time, cost per department (bar), revenue per employee, open roles and time-to-fill.

#### 3.8 Goals and KPIs
- Custom KPI list (from the KPI tracker): target, current, trend, owner. **+ Add KPI** and **Edit targets** for Owners and Admins.

---

# Tab 4. Market analytics

**Purpose:** put the startup's performance in context: market size, demand, competitors, industry trends and peer benchmarks. Market data is more uncertain than business data, so every figure carries a source and a confidence label.

### Confidence labels
| Label | Meaning |
|---|---|
| `High` | From a cited, recent report or the platform's aggregated data |
| `Medium` | Team estimate with a documented method and source |
| `Low` | Rough estimate; method missing or older than 12 months |

A banner at the top of the tab: "Market figures are estimates. Check the source before you use them in a pitch."

### KPI row
Market size (SAM), Estimated market share, Market growth rate (CAGR), Competitors tracked.

### Sections

#### 4.1 Market size
- Nested bars for **TAM → SAM → SOM** (ink, gold, stone-400) with values, year and source for each.
- Assumptions panel: population, price, adoption rate, with the formula and an **Edit assumptions** button (links to the market sizing tool in the Idea toolkit).
- Scenario toggle: Conservative / Base / Optimistic (changes adoption assumptions; label clearly which is shown).

#### 4.2 Market growth and trends
- Line chart of market size over time with a forecast (dashed). Source and confidence label shown.
- Trend list: up to 6 industry trends, each with a short description, direction arrow, relevance tag (Opportunity, Risk, Watch), source link and date. Added by the team or curated by the platform.
- Search interest or demand indicator chart (if an external data connection exists), labeled `External`.

#### 4.3 Competitor landscape
- **Competitor table:** name, type (Direct, Indirect, Substitute), target customer, pricing, funding raised, strengths, weaknesses, last updated.
- **Positioning map:** scatter plot with two chosen axes (for example, price vs feature depth). The startup is a gold point; competitors are ink points. Axis choices are editable.
- **Feature comparison matrix:** checks and dashes across competitors; the startup's row highlighted with `--gold-tint`.
- Change log: "Added {Competitor} · 3 days ago". Competitor entries are entered by the team; the platform never scrapes private data.

#### 4.4 Customer demand and segments
- Segment table: size, growth, willingness to pay, share of current customers, fit score (1–5, team-assigned).
- Demand signals from the startup's own data: waitlist signups, inbound leads by segment, interview pain-level scores (from the Idea toolkit).
- Geography: a simple ranked bar by city or state (maps are optional and only used if the data supports it).

#### 4.5 Peer benchmarks (platform aggregated)
- Compare the startup with anonymous groups of similar startups (same stage and sector, minimum 10 startups): MRR growth, time in stage, readiness score, runway, team size, conversion rates.
- Each metric shown as a horizontal range bar (25th to 75th percentile, median tick) with the startup's value as a gold marker. Shows "Top quartile", "Typical" or "Below typical" in text.
- Opt-in: a startup must agree to contribute anonymized data to see benchmarks. Individual startups are never identifiable.

#### 4.6 Funding and investor landscape
- Funding activity in the sector: number of deals and average round size by quarter (bars), from platform data and cited sources.
- Investor interest in the sector on the platform: active investors by stage and ticket size (aggregated).
- "Investors active in your sector": count and a link to the relevant filtered view in the Investor module. Not a list of names.

#### 4.7 Opportunities and risks
- A simple SWOT-style board: Opportunities, Threats, Strengths, Weaknesses, each as editable cards linked to evidence (competitor entry, trend, metric).
- Exports into the pitch and data room as a one-page market summary.

---

## 7. Drill-down drawer

Clicking a KPI or chart opens a right-side drawer (520px) with:
- Detailed chart at full size with a table of the underlying values.
- Definition and formula.
- Breakdown by segment or period.
- **Edit data** (for manually entered metrics) and **Add note** (annotations appear as small markers on the chart for the team).

## 8. Manual data entry and imports

- **Add data** button opens a form per metric group (revenue, costs, customers, KPIs, market assumptions).
- **Import:** CSV or spreadsheet upload with column mapping and a preview; later, accounting or payment tool connections.
- Every imported value shows its source and the user who added it. Edits are logged.

## 9. States

| State | Behavior |
|---|---|
| Loading | Skeleton KPI cards and chart placeholders |
| Empty (no data) | Card per section: "Add your first month of revenue to see this chart." with **Add data**. Charts show a faint example outline, never fake numbers |
| Partial data | Chart renders with available periods; missing months marked with a dashed gap and a "Missing data" caption |
| Low sample size | Banner: "Too few data points for a reliable trend." |
| Benchmark unavailable | "Not enough similar startups yet." with an opt-in link |
| Error | Card message with **Retry**; other cards stay usable |
| Stale data | Warning chip when inputs are older than 35 days: "Revenue last updated 42 days ago" |
| Export in progress | Toast and a progress indicator; download starts automatically |
| No permission | Cards hidden or shown locked with "Ask an Owner or Admin." |

## 10. Role-based views

- **Owner / Admin:** all tabs, data entry, export, share report.
- **Member:** Overview, Journey and the Business and Market sections they have access to; financial detail (cash, burn, cap table) hidden unless allowed.
- **Viewer:** read-only dashboards.
- **Mentor (viewing the startup):** read-only on the shared tabs plus the ability to add annotations and comments.
- **Investor (via shared report only):** sees only the metrics the founders chose to share, with a "Shared by {Startup} · date" label.

## 11. Motion

- 150–200ms ease-out for hover and focus; charts animate once on load (600ms).
- Drill-down drawer slides in over 200ms. Number counters do not animate for finance values.
- Respect `prefers-reduced-motion` (no animations, instant render).

## 12. Accessibility

- WCAG 2.1 AA; gold text uses `--gold-dark` on light backgrounds.
- Every chart has a text summary and a **View as table** toggle; the data table is keyboard-navigable.
- Chart series are distinguished by shape, dash pattern or direct labels as well as color.
- Trend changes use arrows and signed numbers, not color alone.
- Tabs use `role="tablist"`; drawer and modals trap focus and close with Esc.
- Tooltips are available on keyboard focus and are not the only place information lives.
- Touch targets at least 44×44px.

## 13. Data, definitions and rules

| Metric | Definition (shown in the tooltip) |
|---|---|
| MRR | Sum of monthly recurring revenue from active subscriptions |
| Growth MoM | (This month MRR − last month MRR) ÷ last month MRR |
| Gross burn | Total cash spent per month |
| Net burn | Gross burn − revenue received |
| Runway | Cash balance ÷ net burn (months) |
| CAC | Sales and marketing spend ÷ new customers |
| LTV | Average revenue per customer × gross margin ÷ churn rate |
| Payback | CAC ÷ (monthly revenue per customer × gross margin) |
| Churn rate | Customers lost in period ÷ customers at start of period |
| Net revenue retention | (Start MRR + expansion − contraction − churn) ÷ start MRR |
| Readiness score | Weighted: checklist completion, traction data, mentor feedback |

**Rules**
- Currency, fiscal year start and date format set in Settings.
- Benchmarks require at least 10 startups per group; values are rounded and never shown for fewer.
- Market figures must have a source (text or link) to be marked `High` or `Medium`.
- Shared reports respect the visibility and consent settings from the startup profile and data room.
- Data protection: aggregated benchmarking is opt-in, anonymized, and complies with the platform's privacy policy and applicable law (for example, India's DPDP Act).
- Auto insights and forecasts are labeled as automated, show their assumptions, and are not financial advice.

## 14. Data connections

| Section | Source |
|---|---|
| Stage and readiness | Stage module, mentor sign-offs |
| Mentor impact | Mentor module (sessions, deliverables) |
| Investor funnel | Investor module (views, shortlists, messages, rounds) |
| Hiring funnel | Jobs module |
| Revenue, burn, KPIs | Early revenue and Mature toolkits, manual entry, imports |
| Pipeline and sales | Sales pipeline tool |
| Market size and assumptions | Idea toolkit (market sizing) |
| Competitors, trends | Team entries plus curated platform content |
| Benchmarks | Aggregated, anonymized platform data |
| Usage | Workspace activity log (counts only) |

## 15. CSS tokens

```css
:root {
  --ink: #0F1B2D;
  --ink-soft: #1C2B42;
  --ivory: #FAF8F4;
  --white: #FFFFFF;
  --gold: #B8955A;
  --gold-dark: #9A7A45;
  --gold-tint: #F3EBDD;
  --stone-700: #4A5568;
  --stone-400: #A0A7B4;
  --stone-200: #E5E1D8;
  --success: #2E7D5B;
  --warning: #B7791F;
  --error: #B42318;
  --radius-card: 12px;
  --radius-control: 10px;

  /* chart palette */
  --chart-1: var(--ink);
  --chart-2: var(--gold);
  --chart-3: var(--stone-400);
}
```

## 16. Build order (suggested)

1. Page shell, tabs, date range control and KPI card component.
2. Chart card component (line, bar, funnel, table) with insight headline, source chip and "View as table".
3. **Business** tab: revenue, burn and runway first (most used), then customers, sales, unit economics.
4. **Overview** tab (pulls from the Business tab).
5. **Journey** tab: stage progress and readiness first, then mentor, investor and hiring funnels.
6. **Market** tab: market size and competitors first, then trends, segments, benchmarks and the funding landscape.
7. Drill-down drawer, manual entry and CSV import, export and share report.
8. Empty, partial-data, stale-data and error states, then mobile layouts.

**Suggested first release:** Overview and Business (revenue, burn, runway). Add Market after founders have filled in their market sizing, and benchmarks once enough startups have opted in.
