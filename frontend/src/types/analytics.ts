/** Shared analytics data model used by the page and its demo fixture. */
export type AnalyticsTab = "overview" | "journey" | "business" | "market";
export type DateRange = "30d" | "90d" | "quarter" | "12m" | "custom";
export type CompareTo = "previous" | "last-year" | "target";

export type MonthlyMetric = {
  id: string;
  period: string;
  mrr?: number;
  revenue?: number;
  grossBurn?: number;
  cashBalance?: number;
  activeCustomers?: number;
  customersAtStart?: number;
  newCustomers?: number;
  churnedCustomers?: number;
  marketingSpend?: number;
  grossMarginPercent?: number;
  source: string;
  addedBy: string;
  updatedAt: string;
};

export type MarketEntry = {
  tam?: number;
  sam?: number;
  som?: number;
  year?: string;
  source?: string;
  population?: number;
  averagePrice?: number;
  adoptionPercent?: number;
  updatedAt?: string;
};

export type Competitor = {
  id: string;
  name: string;
  type: "Direct" | "Indirect" | "Substitute";
  targetCustomer: string;
  pricing: string;
  strengths: string;
  weaknesses: string;
  positionX: number;
  positionY: number;
  source: string;
  updatedAt: string;
};

export type AnalyticsKpi = {
  id: string;
  name: string;
  target: string;
  current: string;
  owner: string;
  note?: string;
};

export type SwotNote = { id: string; text: string; evidence?: string; createdAt: string };

export type AnalyticsState = {
  monthly: MonthlyMetric[];
  market: MarketEntry;
  competitors: Competitor[];
  kpis: AnalyticsKpi[];
  swot: Record<"Strengths" | "Weaknesses" | "Opportunities" | "Threats", SwotNote[]>;
  notes: Record<string, string>;
};
