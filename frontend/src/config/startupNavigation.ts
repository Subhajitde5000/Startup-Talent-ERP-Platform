import { StartupStageId } from "@/types/startup";

export interface StartupNavItem {
  pageNumber?: number;
  id: string;
  label: string;
  href: string;
  description: string;
  recommendedStage?: StartupStageId;
}

export interface StartupNavGroup {
  id: string;
  label: string;
  items: StartupNavItem[];
}

export const STARTUP_NAV_GROUPS: StartupNavGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        pageNumber: 14,
        id: "dashboard",
        label: "Dashboard",
        href: "/startup/dashboard",
        description: "Overview, stage progression, readiness checklist and priorities.",
      },
      {
        id: "tasks",
        label: "Tasks",
        href: "/startup/tasks",
        description: "Day-to-day tasks, milestones, assignments and stage deliverables.",
      },
      {
        id: "notifications",
        label: "Notifications",
        href: "/startup/notifications",
        description: "Workspace activity, task reminders and notification preferences.",
      },
      {
        pageNumber: 15,
        id: "profile",
        label: "Startup Profile",
        href: "/startup/profile",
        description: "Company details, industry, description and legal information.",
      },
      {
        pageNumber: 16,
        id: "team",
        label: "Team Management",
        href: "/startup/team",
        description: "Founders, employees, roles and workspace permissions.",
      },
      {
        pageNumber: 17,
        id: "roadmap",
        label: "Stage Roadmap",
        href: "/startup/stage",
        description: "Four-stage startup journey, stage tools and exit criteria.",
      },
    ],
  },
  {
    id: "discovery",
    label: "Discovery & Validation",
    items: [
      {
        pageNumber: 18,
        id: "idea-validation",
        label: "Idea Validation",
        href: "/startup/idea-validation",
        description: "Problem canvas, hypotheses and validation experiments.",
        recommendedStage: "idea",
      },
      {
        pageNumber: 19,
        id: "customer-research",
        label: "Customer Research",
        href: "/startup/customer-research",
        description: "Discovery interview logs, synthesis and user quotes.",
        recommendedStage: "idea",
      },
      {
        pageNumber: 20,
        id: "market-analysis",
        label: "Market Analysis",
        href: "/startup/market-analysis",
        description: "TAM / SAM / SOM market sizing and ideal customer profile.",
        recommendedStage: "idea",
      },
      {
        pageNumber: 21,
        id: "cofounders",
        label: "Co-founder Search",
        href: "/startup/cofounders",
        description: "Discover complementary technical and commercial co-founders.",
        recommendedStage: "idea",
      },
    ],
  },
  {
    id: "build",
    label: "Build & Execution",
    items: [
      {
        pageNumber: 22,
        id: "projects",
        label: "Projects & Sprints",
        href: "/startup/projects",
        description: "Execution tasks, sprint cycles and product milestones.",
        recommendedStage: "prototype",
      },
      {
        pageNumber: 23,
        id: "prototype-testing",
        label: "Prototype Testing",
        href: "/startup/prototype-testing",
        description: "MVP usability sessions, cohort feedback and iteration logs.",
        recommendedStage: "prototype",
      },
    ],
  },
  {
    id: "hiring",
    label: "Hiring",
    items: [
      {
        pageNumber: 26,
        id: "hiring",
        label: "Overview",
        href: "/startup/hiring",
        description: "Hiring requests, jobs and next actions.",
        recommendedStage: "prototype",
      },
      {
        id: "hiring-talent",
        label: "Talent",
        href: "/startup/hiring/talent",
        description: "Search candidates who opted in to discovery.",
      },
      {
        id: "hiring-interviews",
        label: "Interviews",
        href: "/startup/hiring/interviews",
        description: "Schedule interviews and review feedback.",
      },
      {
        id: "hiring-offers",
        label: "Offers",
        href: "/startup/hiring/offers",
        description: "Prepare and track hiring offers.",
      },
      {
        id: "hiring-employer",
        label: "Employer page",
        href: "/startup/hiring/employer-page",
        description: "Edit the candidate-facing company page and verification details.",
      },
    ],
  },
  {
    id: "mentorship",
    label: "Mentorship & Readiness",
    items: [
      {
        id: "mentors",
        label: "Mentors",
        href: "/startup/mentors",
        description: "Find mentors, manage requests and view mentoring progress.",
      },
      {
        id: "mentors-find",
        label: "Find mentors",
        href: "/startup/mentors/find",
        description: "Browse the mentor directory and send a mentorship request.",
      },
      {
        id: "sessions",
        label: "Sessions",
        href: "/startup/sessions",
        description: "Book and review mentor sessions.",
      },
      {
        id: "readiness",
        label: "Readiness",
        href: "/startup/readiness",
        description: "Prepare and submit readiness evidence for mentor sign-off.",
      },
    ],
  },
  {
    id: "investors",
    label: "Investors & Fundraising",
    items: [
      {
        id: "investors",
        label: "Investor hub",
        href: "/startup/investors",
        description: "Investor interest, preparation status and fundraising overview.",
      },
      {
        id: "investors-discover",
        label: "Find investors",
        href: "/startup/investors/discover",
        description: "Browse the investor directory when connected.",
      },
      {
        id: "investors-pipeline",
        label: "Investor pipeline",
        href: "/startup/investors/pipeline",
        description: "Privately track investor conversations and stages.",
      },
      {
        id: "data-room",
        label: "Data room",
        href: "/startup/data-room",
        description: "Organize documents and configure access controls.",
      },
      {
        id: "investor-messages",
        label: "Investor messages",
        href: "/startup/messages",
        description: "Investor conversations and locally saved drafts.",
      },
      {
        id: "investor-meetings",
        label: "Investor meetings",
        href: "/startup/meetings",
        description: "Schedule and track investor meetings.",
      },
      {
        id: "rounds",
        label: "Fundraising rounds",
        href: "/startup/rounds",
        description: "Plan rounds and record offers or commitments.",
      },
      {
        id: "investors-settings",
        label: "Visibility settings",
        href: "/startup/investors/settings",
        description: "Control startup visibility and investor access defaults.",
      },
    ],
  },
  {
    id: "traction",
    label: "Traction & Capital",
    items: [
      {
        pageNumber: 24,
        id: "sales",
        label: "Sales Pipeline",
        href: "/startup/sales",
        description: "Pilot accounts, deal stages and early customer conversion.",
        recommendedStage: "early-revenue",
      },
      {
        pageNumber: 25,
        id: "analytics",
        label: "Business Analytics",
        href: "/startup/analytics",
        description: "Monthly revenue, net burn, runway and unit economics.",
        recommendedStage: "early-revenue",
      },
    ],
  },
];

export const ALL_STARTUP_NAV_ITEMS: StartupNavItem[] = STARTUP_NAV_GROUPS.flatMap(
  (group) => group.items,
);
