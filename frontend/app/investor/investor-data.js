import { CheckCircle2, Info } from 'lucide-react';

export const offers = [
  {
    id: 'offer-104',
    startup: 'Acme Studio',
    logo: 'A',
    round: 'Seed · ₹2 Cr target · 40% committed',
    amount: '₹25L',
    instrument: 'SAFE',
    valuation: '₹10 Cr cap',
    status: 'Countered',
    version: 'v2',
    activity: 'Startup countered · Nov 04',
    expiry: 'Nov 14',
    owner: 'Arjun Mehta',
  },
  {
    id: 'offer-102',
    startup: 'OrbitPay',
    logo: 'O',
    round: 'Seed · ₹4 Cr target · 55% committed',
    amount: '₹40L',
    instrument: 'Equity',
    valuation: '₹18 Cr pre-money',
    status: 'Sent',
    version: 'v1',
    activity: 'Viewed · Nov 03',
    expiry: 'Nov 16',
    owner: 'Mira Shah',
  },
  {
    id: 'offer-097',
    startup: 'GreenLedger',
    logo: 'G',
    round: 'Pre-seed · ₹75L target · 18% committed',
    amount: '₹10L',
    instrument: 'SAFE',
    valuation: '₹5 Cr cap',
    status: 'Accepted',
    version: 'v3',
    activity: 'Accepted · Oct 31',
    expiry: 'Closed',
    owner: 'Arjun Mehta',
  },
];

export const holdings = [
  {
    id: 'acme',
    name: 'Acme Studio',
    logo: 'A',
    stage: 'Prototype',
    sector: 'Fintech · B2B SaaS',
    invested: '₹25L',
    date: 'Nov 2026',
    ownership: '2.4% est.',
    instrument: 'SAFE',
    mrr: '₹4.8L',
    runway: '14 months',
    update: '12 days ago',
    status: 'Active',
    highlight:
      'Expanded to 126 customers; preparing a new reconciliation module.',
  },
  {
    id: 'greenledger',
    name: 'GreenLedger',
    logo: 'G',
    stage: 'Idea',
    sector: 'Climate · Agriculture',
    invested: '₹10L',
    date: 'Oct 2026',
    ownership: '1.8% est.',
    instrument: 'SAFE',
    mrr: 'Not shared',
    runway: 'Not shared',
    update: '4 months ago',
    status: 'Aging',
    highlight: 'Pilot program with 24 farms is underway.',
  },
  {
    id: 'orbitpay',
    name: 'OrbitPay',
    logo: 'O',
    stage: 'Early revenue',
    sector: 'Fintech · Payments',
    invested: '₹40L',
    date: 'Aug 2026',
    ownership: '2.1% est.',
    instrument: 'Equity',
    mrr: '₹12L',
    runway: '18 months',
    update: '8 days ago',
    status: 'Follow-on open',
    highlight: 'Opened a follow-on round; existing investor window is active.',
  },
];

export const events = [
  {
    id: 'fintech-demo-day',
    name: 'Fintech Founder Demo Day',
    date: 'Dec 03, 2026 · 10:00 AM IST',
    format: 'Hybrid · Mumbai / Online',
    host: 'Forma + Fintech Founders Network',
    focus: 'Fintech · Pre-seed and Seed',
    access: 'Priority access',
    summary:
      'Curated showcase for early-stage fintech startups and a group of investors and operators.',
    count: 12,
  },
  {
    id: 'climate-roundtable',
    name: 'Climate Ventures Roundtable',
    date: 'Dec 12, 2026 · 2:00 PM IST',
    format: 'Online',
    host: 'Impact Ventures Forum',
    focus: 'Climate · Idea to Seed',
    access: 'Open',
    summary:
      'A small-group discussion on early climate ventures, financing and measurement.',
    count: 8,
  },
  {
    id: 'founder-office-hours',
    name: 'Investor Office Hours: Early Stage',
    date: 'Jan 14, 2027 · 5:00 PM IST',
    format: 'In person · Bengaluru',
    host: 'Forma Investor Network',
    focus: 'B2B SaaS · Seed',
    access: 'Invite only',
    summary:
      'Small-group office hours for founders preparing to fundraise.',
    count: 6,
  },
];

export const logs = [
  [
    'Nov 05 · 10:42 AM',
    'You',
    'Data room',
    'Viewed “Financial model Q3.xlsx”',
    'Acme Studio · Financials',
    'Success',
    'Chrome · Kolkata',
  ],
  [
    'Nov 05 · 10:20 AM',
    'You',
    'Profile view',
    'Viewed investor profile',
    'GreenLedger',
    'Success',
    'Chrome · Kolkata',
  ],
  [
    'Nov 04 · 4:05 PM',
    'You',
    'Offer',
    'Reviewed counter-offer v2',
    'Acme Studio · offer-104',
    'Success',
    'Chrome · Kolkata',
  ],
  [
    'Nov 04 · 3:58 PM',
    'You',
    'NDA',
    'Signed NDA v2.1',
    'Acme Studio',
    'Success',
    'Chrome · Kolkata',
  ],
  [
    'Nov 03 · 9:12 AM',
    'You',
    'Security',
    'New login · Chrome',
    'Account security',
    'Success',
    'Chrome · Kolkata',
  ],
  [
    'Nov 02 · 2:15 PM',
    'You',
    'Document',
    'Download attempt blocked',
    'OrbitPay · Legal',
    'Blocked',
    'Chrome · Kolkata',
  ],
];

export const threads = [
  {
    id: 'acme',
    name: 'Acme Studio',
    logo: 'A',
    sub: 'Prototype · Diligence',
    type: 'Startups',
    preview:
      'Thanks for the focused diligence questions. We uploaded the revised model.',
    time: '10:42 AM',
    unread: 2,
    messages: [
      ['system', 'Intro accepted · Data room access granted · NDA signed'],
      ['me', 'Could you clarify the revenue reconciliation for Q3?'],
      [
        'them',
        'Thanks for the focused diligence questions. We uploaded the revised model.',
      ],
    ],
  },
  {
    id: 'offer',
    name: 'Acme Studio · Offer',
    logo: 'A',
    sub: 'Seed · Countered v2',
    type: 'Offers',
    preview: 'We countered the valuation cap and discount in v2.',
    time: 'Yesterday',
    unread: 1,
    messages: [
      ['system', 'You sent offer v1 · Startup countered with v2'],
      ['them', 'We countered the valuation cap and discount in v2.'],
    ],
  },
  {
    id: 'green',
    name: 'GreenLedger',
    logo: 'G',
    sub: 'Pre-seed · Intro accepted',
    type: 'Startups',
    preview: 'We can share the pilot overview before the call.',
    time: 'Nov 03',
    unread: 0,
    messages: [
      ['system', 'Intro accepted · Meeting scheduled for Nov 15'],
      ['them', 'We can share the pilot overview before the call.'],
    ],
  },
  {
    id: 'team',
    name: 'Investment team',
    logo: 'T',
    sub: '3 colleagues',
    type: 'Team',
    preview: 'Mira: I reviewed the latest diligence scorecard.',
    time: 'Nov 02',
    unread: 0,
    messages: [['them', 'Mira: I reviewed the latest diligence scorecard.']],
  },
  {
    id: 'support',
    name: 'Forma Support',
    logo: 'F',
    sub: 'Ticket #INV-204 · In progress',
    type: 'Admin and support',
    preview: 'We are checking your access issue.',
    time: 'Nov 01',
    unread: 0,
    messages: [['them', 'We are checking your access issue.']],
  },
];

export function InvestorBadge({ children, gold = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        gold ? 'bg-[#F3EBDD] text-[#806236]' : 'bg-[#E7F3EC] text-[#286749]'
      }`}
    >
      <CheckCircle2 size={12} />
      {children}
    </span>
  );
}

export function InvestorDisclaimer({ onLearnMore }) {
  return (
    <p className="mt-8 flex items-start gap-2 text-xs leading-5 text-[#4A5568]">
      <Info size={14} className="mt-0.5 shrink-0 text-[#806236]" />
      <span>
        The platform introduces startups and investors. It is not a broker or
        adviser unless licensed. Do your own due diligence and take independent
        advice.{' '}
        {onLearnMore && (
          <button
            type="button"
            onClick={onLearnMore}
            className="font-semibold text-[#9A7A45] underline hover:text-ink"
          >
            Learn more
          </button>
        )}
      </span>
    </p>
  );
}
