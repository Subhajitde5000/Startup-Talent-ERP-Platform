import { CheckCircle2, Info } from 'lucide-react';

export const jobs = [
  {
    id: 'senior-product-designer',
    title: 'Senior Product Designer',
    company: 'Northstar Labs',
    companyId: 'comp-1',
    logo: 'N',
    loc: 'Remote · India',
    type: 'Full-time',
    salary: '₹18–24 LPA',
    equity: '0.1% – 0.25%',
    stage: 'Series A',
    posted: '2 days ago',
    fit: 'Matches 5 skills · Remote · Within your salary range',
    match: 'Strong fit',
    desc: 'Northstar Labs is looking for a Senior Product Designer to spearhead end-to-end design across our core enterprise collaboration suite.',
    requirements: [
      '5+ years of digital product design experience in high-growth SaaS environments',
      'Proven expertise in complex system design, user testing, and Figma design systems',
      'Strong storytelling and stakeholder communication skills',
      'Portfolio demonstrating shipped products with measurable business impact',
    ],
    skills: ['Figma', 'Design Systems', 'UX Research', 'Rapid Prototyping', 'Product Strategy'],
    benefits: ['Full health insurance for family', 'Remote work equipment stipend (₹75k)', 'Annual learning budget (₹50k)', 'Flexible PTO'],
  },
  {
    id: 'product-designer',
    title: 'Product Designer',
    company: 'Morrow Health',
    companyId: 'comp-2',
    logo: 'M',
    loc: 'Bengaluru · Hybrid',
    type: 'Full-time',
    salary: '₹16–22 LPA',
    equity: '0.05% – 0.15%',
    stage: 'Seed',
    posted: '1 day ago',
    fit: 'Matches your product design and healthcare interests',
    match: 'Good fit',
    desc: 'Join Morrow Health to craft patient-first digital experiences connecting clinical care teams with chronic care patients.',
    requirements: [
      '3+ years experience designing consumer mobile and web applications',
      'Familiarity with healthcare or regulated fintech UX principles',
      'Strong interaction design and micro-animation chops',
    ],
    skills: ['Interaction Design', 'Mobile UI', 'Figma', 'User Journey Mapping'],
    benefits: ['Comprehensive health coverage', 'Mental wellness stipend', 'Daily catered lunches at office'],
  },
  {
    id: 'ux-researcher',
    title: 'UX Researcher',
    company: 'Fieldnote',
    companyId: 'comp-3',
    logo: 'F',
    loc: 'Kolkata · Hybrid',
    type: 'Full-time',
    salary: '₹14–18 LPA',
    equity: '0.05%',
    stage: 'Series B',
    posted: '4 days ago',
    fit: 'Matches 4 skills · Within your salary range',
    match: 'Good fit',
    desc: 'Lead generative and evaluative research studies for Fieldnote’s field intelligence platform.',
    requirements: [
      '3+ years leading qualitative and quantitative user research studies',
      'Expertise in usability lab testing, diary studies, and survey analysis',
      'Ability to translate raw customer insights into actionable product roadmaps',
    ],
    skills: ['Qualitative Research', 'Usability Testing', 'Card Sorting', 'Data Synthesis'],
    benefits: ['Hybrid work model (2 days office)', 'Travel allowance', 'Health & wellness package'],
  },
  {
    id: 'lead-frontend-engineer',
    title: 'Lead Frontend Engineer',
    company: 'OrbitPay',
    companyId: 'comp-4',
    logo: 'O',
    loc: 'Bengaluru · Remote',
    type: 'Full-time',
    salary: '₹32–42 LPA',
    equity: '0.2% – 0.5%',
    stage: 'Series A',
    posted: '3 days ago',
    fit: 'Matches Next.js, React and performance optimization strengths',
    match: 'Strong fit',
    desc: 'Architect next-generation cross-border payment checkout experiences handling millions in daily volume.',
    requirements: [
      '6+ years frontend engineering with deep React, Next.js, and TypeScript mastery',
      'Experience optimizing Core Web Vitals, accessibility, and bundle performance',
      'Track record leading small, autonomous squads',
    ],
    skills: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'Performance Optimization'],
    benefits: ['Top-tier health & dental', '₹1.5L annual home office setup budget', 'Stock option grant'],
  },
];

export const applications = [
  {
    id: 'app-1',
    jobId: 'senior-product-designer',
    company: 'Northstar Labs',
    title: 'Senior Product Designer',
    logo: 'N',
    status: 'Interview',
    appliedDate: 'Nov 01, 2026',
    updated: 'Today · Interview confirmed',
    next: 'Thu, Nov 12 · 11:00 AM IST',
    salaryExpectation: '₹22 LPA',
    resumeUsed: 'Senior Product Designer (v2)',
    timeline: [
      { date: 'Nov 01', text: 'Application submitted with customized portfolio' },
      { date: 'Nov 03', text: 'Application reviewed by hiring manager Rhea Mukherjee' },
      { date: 'Nov 05', text: 'Passed initial recruiter screening call' },
      { date: 'Nov 07', text: 'Technical portfolio review scheduled for Nov 12' },
    ],
    notes: 'Prepare deep-dive case study on design system migration and measurable metrics.',
  },
  {
    id: 'app-2',
    jobId: 'product-designer',
    company: 'Morrow Health',
    title: 'Product Designer',
    logo: 'M',
    status: 'Shortlisted',
    appliedDate: 'Nov 03, 2026',
    updated: 'Shortlisted · 2 days ago',
    next: 'Awaiting interview schedule link',
    salaryExpectation: '₹18 LPA',
    resumeUsed: 'Product Designer · General (v1)',
    timeline: [
      { date: 'Nov 03', text: 'Application submitted' },
      { date: 'Nov 06', text: 'Shortlisted for clinical UX design squad' },
    ],
    notes: 'Review patient monitoring workflow diagrams.',
  },
  {
    id: 'app-3',
    jobId: 'ux-researcher',
    company: 'Fieldnote',
    title: 'UX Researcher',
    logo: 'F',
    status: 'Applied',
    appliedDate: 'Nov 04, 2026',
    updated: 'Application sent · 4 days ago',
    next: 'Review in progress',
    salaryExpectation: '₹16 LPA',
    resumeUsed: 'UX Researcher & Strategy (v1)',
    timeline: [
      { date: 'Nov 04', text: 'Application submitted via platform' },
    ],
    notes: 'Reached out to design recruiter on LinkedIn as follow-up.',
  },
  {
    id: 'app-4',
    jobId: 'design-lead',
    company: 'Lattice Works',
    title: 'Design Lead',
    logo: 'L',
    status: 'Not selected',
    appliedDate: 'Oct 20, 2026',
    updated: 'Not selected · 1 week ago',
    next: 'Role closed · Similar roles recommended',
    salaryExpectation: '₹24 LPA',
    resumeUsed: 'Senior Product Designer (v1)',
    timeline: [
      { date: 'Oct 20', text: 'Application submitted' },
      { date: 'Oct 28', text: 'Portfolio screening completed' },
      { date: 'Nov 01', text: 'Position filled by internal candidate' },
    ],
    notes: 'Received positive feedback on visual craftsmanship.',
  },
];

export const resumes = [
  {
    id: 'res-1',
    title: 'Senior Product Designer (Primary)',
    role: 'Product Designer',
    updated: 'Oct 30, 2026',
    atsScore: 88,
    isDefault: true,
    views: 42,
    downloads: 14,
    summary: 'Senior Product Designer with 6+ years driving UX strategy, design systems, and product metrics across B2B SaaS and enterprise marketplaces.',
    skills: ['Figma', 'Design Systems', 'User Research', 'Information Architecture', 'Interaction Design', 'Prototyping'],
    experience: [
      {
        role: 'Senior Product Designer',
        company: 'Vanguard Systems',
        period: '2023 – Present',
        bullets: [
          'Spearheaded enterprise dashboard redesign, reducing task completion time by 34%.',
          'Architected unified multi-brand design system in Figma adopted by 18 engineering squads.',
        ],
      },
      {
        role: 'Product Designer',
        company: 'Pulse Digital',
        period: '2020 – 2023',
        bullets: [
          'Led end-to-end design for consumer fintech onboarding with 22% conversion increase.',
          'Conducted 50+ qualitative user research sessions to map key churn triggers.',
        ],
      },
    ],
    education: {
      degree: 'B.Des in Interaction Design',
      school: 'National Institute of Design (NID)',
      year: '2020',
    },
  },
  {
    id: 'res-2',
    title: 'UX Researcher & Strategy',
    role: 'UX Researcher',
    updated: 'Oct 15, 2026',
    atsScore: 82,
    isDefault: false,
    views: 18,
    downloads: 5,
    summary: 'UX Researcher focused on qualitative discovery, usability testing, and cross-functional product roadmap alignment.',
    skills: ['User Interviews', 'Usability Testing', 'Quantitative Surveys', 'Persona Development', 'Storyboarding'],
    experience: [
      {
        role: 'UX Research Associate',
        company: 'Pulse Digital',
        period: '2020 – 2023',
        bullets: [
          'Planned and executed foundational discovery studies for mobile payment features.',
        ],
      },
    ],
    education: {
      degree: 'B.Des in Interaction Design',
      school: 'National Institute of Design (NID)',
      year: '2020',
    },
  },
];

export const drills = [
  {
    id: 'drill-1',
    category: 'Product Thinking',
    title: 'Design an ATM for children',
    difficulty: 'Medium',
    duration: '15 min',
    desc: 'Demonstrate first-principles user empathy, safety constraints, cognitive load mitigation, and physical-digital interface synthesis.',
    prompts: [
      'Who are the primary target users and what are their cognitive capabilities?',
      'What are the core safety, parental control, and physical security parameters?',
      'How does the interface handle financial literacy and gamified feedback?',
    ],
  },
  {
    id: 'drill-2',
    category: 'Behavioral & Leadership',
    title: 'Resolving Engineering vs Design Tradeoffs',
    difficulty: 'Hard',
    duration: '10 min',
    desc: 'Structure your response using the STAR framework to explain how you negotiated a critical deadline compromise with engineering leadership.',
    prompts: [
      'Describe the context and the technical constraint that forced the tradeoff.',
      'How did you evaluate user impact versus technical debt?',
      'What was the final outcome and how did you measure success?',
    ],
  },
  {
    id: 'drill-3',
    category: 'Visual & System Design',
    title: 'Color Contrast & Accessible Token Architecture',
    difficulty: 'Medium',
    duration: '12 min',
    desc: 'Explain how you design a multi-theme design system token structure complying strictly with WCAG 2.1 AA contrast standards.',
    prompts: [
      'How do you decouple semantic token naming from raw primitive hex values?',
      'What process ensures dark mode contrast ratios meet minimum 4.5:1 requirements?',
    ],
  },
];

export const practiceSessions = [
  {
    id: 'sess-1',
    title: 'Product Design Deep Dive · Series A Scenario',
    date: 'Nov 05, 2026 · 4:15 PM IST',
    score: 86,
    duration: '22 min',
    feedback: 'Strong articulation of design tradeoffs. Excellent communication of user research synthesis. Minor hesitation observed in handling technical constraint questions.',
    breakdown: {
      clarity: 90,
      structure: 85,
      empathy: 88,
      technicalRigor: 80,
    },
  },
  {
    id: 'sess-2',
    title: 'Behavioral Executive Leadership Practice',
    date: 'Oct 28, 2026 · 11:30 AM IST',
    score: 79,
    duration: '18 min',
    feedback: 'Good STAR framing. Recommend focusing on measurable metric outcomes rather than general process narratives.',
    breakdown: {
      clarity: 82,
      structure: 80,
      empathy: 78,
      technicalRigor: 76,
    },
  },
];

export const alerts = [
  {
    id: 'al-1',
    title: 'Senior Product Designer · Remote',
    criteria: 'Remote · Full-time · ₹18L+ · Series A/B',
    frequency: 'Daily email digest & In-app',
    matches: 6,
    active: true,
  },
  {
    id: 'al-2',
    title: 'Staff UX Lead · Bengaluru',
    criteria: 'Bengaluru / Hybrid · ₹25L+ · Fintech / Health',
    frequency: 'Instant alert',
    matches: 2,
    active: true,
  },
];

export const threads = [
  {
    id: 'th-1',
    sender: 'Rhea Mukherjee',
    company: 'Northstar Labs',
    role: 'VP Product Design',
    avatar: 'RM',
    unread: 1,
    time: '10:45 AM',
    lastMessage: 'Hi Arjun! We were impressed with your portfolio case study. Looking forward to our discussion on Thursday.',
    messages: [
      { sender: 'them', time: '10:45 AM', text: 'Hi Arjun! We were impressed with your portfolio case study. Looking forward to our discussion on Thursday.' },
      { sender: 'me', time: '11:15 AM', text: 'Thank you Rhea! Really excited about the enterprise collaboration vision at Northstar Labs. See you Thursday.' },
    ],
  },
  {
    id: 'th-2',
    sender: 'Pooja Sharma',
    company: 'Morrow Health',
    role: 'Talent Lead',
    avatar: 'PS',
    unread: 0,
    time: 'Yesterday',
    lastMessage: 'Your application has been shortlisted by the clinical squad lead. We will send through availability times shortly.',
    messages: [
      { sender: 'them', time: 'Yesterday', text: 'Your application has been shortlisted by the clinical squad lead. We will send through availability times shortly.' },
    ],
  },
];

export function JobseekerBadge({ children, variant = 'neutral' }) {
  const styles = {
    neutral: 'bg-[#F3F4F6] text-[#4A5568]',
    success: 'bg-[#E7F3EC] text-[#286749]',
    gold: 'bg-[#F3EBDD] text-[#806236]',
    alert: 'bg-[#FFF3D6] text-[#8A5700]',
    danger: 'bg-red-50 text-red-700',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        styles[variant] || styles.neutral
      }`}
    >
      {variant === 'success' && <CheckCircle2 size={12} />}
      {children}
    </span>
  );
}

export function JobseekerDisclaimer({ onLearnMore }) {
  return (
    <p className="mt-8 flex items-start gap-2 text-xs leading-5 text-[#4A5568]">
      <Info size={14} className="mt-0.5 shrink-0 text-[#806236]" />
      <span>
        Forma Careers matches talent directly with verified venture-backed startups and hiring managers.
        Salary benchmarks and readiness signals are contextual guidelines, not guarantees.{' '}
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
