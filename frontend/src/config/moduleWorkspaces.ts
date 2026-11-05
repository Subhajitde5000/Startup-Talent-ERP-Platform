/** Illustrative records for the founder workspace modules. */
export interface ModuleRecord {
  id: string;
  title: string;
  detail: string;
  owner: string;
  status: "Not started" | "In progress" | "Done" | "Review";
  tag: string;
  updated: string;
}

export interface ModuleWorkspaceConfig {
  title: string;
  eyebrow: string;
  purpose: string;
  stats: Array<{ label: string; value: string; hint: string }>;
  recordLabel: string;
  statuses: ModuleRecord["status"][];
  records: ModuleRecord[];
  checklist: string[];
}

const status = (value: ModuleRecord["status"]): ModuleRecord["status"] => value;

export const MODULE_WORKSPACES: Record<string, ModuleWorkspaceConfig> = {
  "idea-validation": {
    title: "Idea Validation",
    eyebrow: "Discovery & Validation · Idea stage",
    purpose:
      "Track hypotheses, experiments and dated evidence before committing engineering effort.",
    stats: [
      { label: "Hypotheses", value: "6", hint: "3 validated so far" },
      { label: "Experiments", value: "9", hint: "2 running this week" },
      { label: "Interviews", value: "12 / 15", hint: "Target for stage exit" },
      { label: "Evidence links", value: "18", hint: "Dated and sourced" },
    ],
    recordLabel: "Hypotheses",
    statuses: ["Not started", "In progress", "Done", "Review"],
    records: [
      {
        id: "hyp-1",
        title: "Assay turnaround time is the top bottleneck",
        detail: "10 of 12 translational labs described turnaround as the dominant pain point.",
        owner: "Claire Chen",
        status: status("Done"),
        tag: "Problem",
        updated: "3 Nov 2026",
      },
      {
        id: "hyp-2",
        title: "Labs will pay for programmable assay planning",
        detail: "Willingness-to-pay interviews in progress with three pilot labs.",
        owner: "Dr. David Park",
        status: status("In progress"),
        tag: "Willingness to pay",
        updated: "2 Nov 2026",
      },
      {
        id: "hyp-3",
        title: "Existing LIMS tools cannot model protein variants",
        detail: "Two in-house tools reviewed; both require manual variant mapping.",
        owner: "Nadia Shaikh",
        status: status("Review"),
        tag: "Competition",
        updated: "30 Oct 2026",
      },
      {
        id: "hyp-4",
        title: "A lightweight web workflow is enough for a first pilot",
        detail: "Test with a clickable prototype before any integration work.",
        owner: "Claire Chen",
        status: status("Not started"),
        tag: "Solution",
        updated: "28 Oct 2026",
      },
    ],
    checklist: [
      "Interview guide reviewed by mentor",
      "Negative cases recorded in synthesis",
      "Each hypothesis has a dated source",
      "Go/no-go criteria agreed with mentor",
    ],
  },
  "customer-research": {
    title: "Customer Research",
    eyebrow: "Discovery & Validation · Idea stage",
    purpose: "One place for discovery interviews, recurring themes and verbatim customer quotes.",
    stats: [
      { label: "Interviews", value: "12", hint: "15 planned" },
      { label: "Personas", value: "3", hint: "Lab lead, PI, CRO" },
      { label: "Themes", value: "7", hint: "5 recurring" },
      { label: "Quotes saved", value: "24", hint: "With consent" },
    ],
    recordLabel: "Interviews",
    statuses: ["Not started", "In progress", "Done", "Review"],
    records: [
      {
        id: "int-1",
        title: "Translational lab · Bengaluru",
        detail: "Turnaround time and manual handoffs dominate the workflow.",
        owner: "Claire Chen",
        status: status("Done"),
        tag: "Lab lead",
        updated: "3 Nov 2026",
      },
      {
        id: "int-2",
        title: "Academic PI · Delhi NCR",
        detail: "Needs reproducible variant records for grant reporting.",
        owner: "Nadia Shaikh",
        status: status("Done"),
        tag: "Principal investigator",
        updated: "1 Nov 2026",
      },
      {
        id: "int-3",
        title: "CRO operations · Hyderabad",
        detail: "Procurement and validation requirements are the main blockers.",
        owner: "Dr. David Park",
        status: status("Review"),
        tag: "CRO",
        updated: "29 Oct 2026",
      },
      {
        id: "int-4",
        title: "Design partner · Pune",
        detail: "Synthesis session scheduled after three more interviews.",
        owner: "Claire Chen",
        status: status("In progress"),
        tag: "Design partner",
        updated: "4 Nov 2026",
      },
    ],
    checklist: [
      "Consent recorded for every interview",
      "Quotes tagged by persona",
      "Negative cases included",
      "Synthesis shared with mentor",
    ],
  },
  "market-analysis": {
    title: "Market Analysis",
    eyebrow: "Discovery & Validation · Idea stage",
    purpose: "Bottom-up market sizing, competitor positioning and dated assumptions.",
    stats: [
      { label: "TAM", value: "₹2,400 Cr", hint: "Bottom-up estimate" },
      { label: "SAM", value: "₹420 Cr", hint: "Target segments" },
      { label: "SOM", value: "₹21 Cr", hint: "3-year base case" },
      { label: "Competitors", value: "3", hint: "Tracked locally" },
    ],
    recordLabel: "Research notes",
    statuses: ["Not started", "In progress", "Done", "Review"],
    records: [
      {
        id: "mkt-1",
        title: "Bottom-up TAM from lab counts",
        detail: "3,200 target labs × ₹7.5L average annual contract value.",
        owner: "Claire Chen",
        status: status("Done"),
        tag: "Sizing",
        updated: "28 Oct 2026",
      },
      {
        id: "mkt-2",
        title: "Competitor capability matrix",
        detail: "Helix Assays, Benchworks and in-house LIMS compared on 8 criteria.",
        owner: "Dr. David Park",
        status: status("Review"),
        tag: "Competition",
        updated: "30 Oct 2026",
      },
      {
        id: "mkt-3",
        title: "Procurement cycle research",
        detail: "Six buyer interviews on budget cycles and approval steps.",
        owner: "Nadia Shaikh",
        status: status("In progress"),
        tag: "Buyer behaviour",
        updated: "2 Nov 2026",
      },
    ],
    checklist: [
      "Assumptions list has sources",
      "Top-down sanity check recorded",
      "Competitor positions dated",
      "Scenario sensitivities reviewed",
    ],
  },
  cofounders: {
    title: "Co-founder Search",
    eyebrow: "Discovery & Validation · Idea stage",
    purpose: "Define complementary profiles and keep candidate conversations orderly.",
    stats: [
      { label: "Role briefs", value: "2", hint: "Technical & commercial" },
      { label: "Candidates", value: "4", hint: "2 in conversation" },
      { label: "Trial sprints", value: "1", hint: "Scheduled for November" },
      { label: "Alignment rubric", value: "80%", hint: "Complete" },
    ],
    recordLabel: "Candidates",
    statuses: ["Not started", "In progress", "Done", "Review"],
    records: [
      {
        id: "cf-1",
        title: "Computational biology lead",
        detail: "Strong assay design background; alignment conversation scheduled.",
        owner: "Claire Chen",
        status: status("In progress"),
        tag: "Technical",
        updated: "2 Nov 2026",
      },
      {
        id: "cf-2",
        title: "Commercial co-founder profile",
        detail: "Looking for life-sciences enterprise sales experience.",
        owner: "Dr. David Park",
        status: status("Review"),
        tag: "Commercial",
        updated: "30 Oct 2026",
      },
      {
        id: "cf-3",
        title: "Trial sprint · assay planning",
        detail: "Two-week scoped collaboration before any equity discussion.",
        owner: "Claire Chen",
        status: status("Not started"),
        tag: "Trial sprint",
        updated: "4 Nov 2026",
      },
    ],
    checklist: [
      "Role brief agreed with mentor",
      "Values and commitment rubric documented",
      "References checked",
      "Legal review before any equity offer",
    ],
  },
  projects: {
    title: "Projects & Sprints",
    eyebrow: "Build & Execution · Prototype stage",
    purpose: "Coordinate sprint cycles, milestones and cross-functional delivery.",
    stats: [
      { label: "Active sprints", value: "2", hint: "Prototype & evidence" },
      { label: "Open tasks", value: "6", hint: "Shared with Tasks" },
      { label: "Milestones", value: "3", hint: "1 due this month" },
      { label: "Completed", value: "11", hint: "Last 30 days" },
    ],
    recordLabel: "Sprints",
    statuses: ["Not started", "In progress", "Done", "Review"],
    records: [
      {
        id: "spr-1",
        title: "Sprint 12 · Assay planner prototype",
        detail: "Clickable workflow for three high-value lab scenarios.",
        owner: "Claire Chen",
        status: status("In progress"),
        tag: "Prototype",
        updated: "4 Nov 2026",
      },
      {
        id: "spr-2",
        title: "Sprint 11 · Evidence pack",
        detail: "Link interview notes and market notes to stage criteria.",
        owner: "Nadia Shaikh",
        status: status("Done"),
        tag: "Evidence",
        updated: "28 Oct 2026",
      },
      {
        id: "spr-3",
        title: "Sprint 13 · Pilot readiness",
        detail: "Prepare go/no-go review with mentor and design partners.",
        owner: "Dr. David Park",
        status: status("Not started"),
        tag: "Pilot",
        updated: "1 Nov 2026",
      },
    ],
    checklist: [
      "Sprint goal documented",
      "Owner assigned for every task",
      "Stage milestone linked",
      "Weekly summary shared with mentor",
    ],
  },
  "prototype-testing": {
    title: "Prototype Testing",
    eyebrow: "Build & Execution · Prototype stage",
    purpose: "Plan usability sessions, capture friction points and decide go/no-go.",
    stats: [
      { label: "Sessions", value: "8", hint: "6 completed" },
      { label: "Participants", value: "11", hint: "3 personas" },
      { label: "Task completion", value: "82%", hint: "Core workflow" },
      { label: "Open issues", value: "4", hint: "2 high priority" },
    ],
    recordLabel: "Test sessions",
    statuses: ["Not started", "In progress", "Done", "Review"],
    records: [
      {
        id: "pt-1",
        title: "Assay planning · first use",
        detail: "Participants completed the core flow in 6 of 8 sessions.",
        owner: "Claire Chen",
        status: status("Done"),
        tag: "Usability",
        updated: "3 Nov 2026",
      },
      {
        id: "pt-2",
        title: "Variant mapping comprehension",
        detail: "Terminology caused confusion; copy changes proposed.",
        owner: "Nadia Shaikh",
        status: status("Review"),
        tag: "Comprehension",
        updated: "2 Nov 2026",
      },
      {
        id: "pt-3",
        title: "Design partner pilot",
        detail: "Two-week pilot with a translational lab scheduled for late November.",
        owner: "Dr. David Park",
        status: status("In progress"),
        tag: "Pilot",
        updated: "4 Nov 2026",
      },
    ],
    checklist: [
      "Consent captured for recordings",
      "Friction points triaged",
      "Go/no-go criteria documented",
      "Mentor review scheduled",
    ],
  },
  sales: {
    title: "Sales Pipeline",
    eyebrow: "Traction & Capital · Early revenue stage",
    purpose: "Track design partners, LOIs and early paid pilots with clear next steps.",
    stats: [
      { label: "Open deals", value: "5", hint: "₹62L pipeline" },
      { label: "Design partners", value: "2", hint: "1 in pilot" },
      { label: "LOIs", value: "3", hint: "2 under review" },
      { label: "Conversion", value: "40%", hint: "Last 90 days" },
    ],
    recordLabel: "Deals",
    statuses: ["Not started", "In progress", "Done", "Review"],
    records: [
      {
        id: "deal-1",
        title: "Translational lab · annual pilot",
        detail: "₹18L · pilot terms shared, legal review pending.",
        owner: "Claire Chen",
        status: status("In progress"),
        tag: "Pilot",
        updated: "4 Nov 2026",
      },
      {
        id: "deal-2",
        title: "Research network · multi-site rollout",
        detail: "₹24L · procurement cycle expected to close in December.",
        owner: "Dr. David Park",
        status: status("Review"),
        tag: "Procurement",
        updated: "1 Nov 2026",
      },
      {
        id: "deal-3",
        title: "CRO · discovery project",
        detail: "₹12L · LOI countersigned; kickoff scheduled.",
        owner: "Claire Chen",
        status: status("Done"),
        tag: "Signed",
        updated: "28 Oct 2026",
      },
      {
        id: "deal-4",
        title: "Academic consortium · grant partnership",
        detail: "₹8L · awaiting budget confirmation.",
        owner: "Nadia Shaikh",
        status: status("Not started"),
        tag: "LOI",
        updated: "25 Oct 2026",
      },
    ],
    checklist: [
      "Every deal has a dated next step",
      "Contract value sources documented",
      "Renewal dates recorded",
      "Channel attribution noted",
    ],
  },
};

export const DEFAULT_MODULE_WORKSPACE: ModuleWorkspaceConfig = {
  title: "Workspace module",
  eyebrow: "Startup Workspace",
  purpose: "Structured local records for this part of the founder workspace.",
  stats: [
    { label: "Records", value: "0", hint: "Add your first record" },
    { label: "In progress", value: "0", hint: "Tracked locally" },
    { label: "Completed", value: "0", hint: "Tracked locally" },
    { label: "Linked tasks", value: "0", hint: "From workspace state" },
  ],
  recordLabel: "Records",
  statuses: ["Not started", "In progress", "Done", "Review"],
  records: [],
  checklist: ["Define the module purpose", "Add a first record", "Review with your mentor"],
};
