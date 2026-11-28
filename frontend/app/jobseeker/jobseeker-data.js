import { CheckCircle2, Info } from 'lucide-react';

// Step 7u: the `jobs` and `applications` demo arrays were removed — the
// dashboard reads the real API. `threads` stays for the Step 11 messages page.
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
