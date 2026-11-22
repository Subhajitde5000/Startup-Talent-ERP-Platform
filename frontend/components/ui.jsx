export function Card({
  title,
  children,
  action,
  className = '',
  id,
  headerClassName = '',
}) {
  return (
    <section
      id={id}
      className={`rounded-xl border border-[#E5E1D8] bg-white p-5 sm:p-6 ${className}`}
    >
      {title && (
        <div className={`mb-4 flex items-center justify-between gap-3 ${headerClassName}`}>
          <h2 className="text-[15px] font-semibold text-[#0F1B2D]">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  secondary = false,
  type = 'button',
  className = '',
  disabled = false,
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] px-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        secondary
          ? 'border border-[#E5E1D8] bg-white text-ink hover:bg-[#F4F1EA]'
          : 'bg-ink text-white hover:bg-[#1C2B42]'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export const Btn = Button;

export function StatusBadge({ status, size = 'sm', className = '' }) {
  const statusStyles = {
    Active: 'bg-[#E7F3EC] text-[#286749]',
    Open: 'bg-[#E7F3EC] text-[#286749]',
    Done: 'bg-[#E7F3EC] text-[#286749]',
    'Signed off': 'bg-[#E7F3EC] text-[#286749]',
    'On track': 'bg-[#E7F3EC] text-[#286749]',
    Pending: 'bg-[#FFF3D6] text-[#8A5700]',
    'In review': 'bg-[#FFF3D6] text-[#8A5700]',
    'At risk': 'bg-[#FFF3D6] text-[#8A5700]',
    'In progress': 'bg-[#EBF1FA] text-[#1E40AF]',
    Draft: 'bg-[#F3F4F6] text-[#4A5568]',
    'To do': 'bg-[#F3F4F6] text-[#4A5568]',
    Deactivated: 'bg-[#F3F4F6] text-[#4A5568]',
    Closed: 'bg-[#F3F4F6] text-[#4A5568]',
    Urgent: 'bg-[#FDE8E8] text-[#B42318]',
    High: 'bg-[#FFF3D6] text-[#8A5700]',
    // Step 9f–9l domain statuses (engagement / offers / commitments /
    // portfolio / diligence). Additive so existing pages keep their look.
    Accepted: 'bg-[#E7F3EC] text-[#286749]',
    Confirmed: 'bg-[#E7F3EC] text-[#286749]',
    Completed: 'bg-[#E7F3EC] text-[#286749]',
    Cleared: 'bg-[#E7F3EC] text-[#286749]',
    Answered: 'bg-[#E7F3EC] text-[#286749]',
    Funded: 'bg-[#E7F3EC] text-[#286749]',
    Documented: 'bg-[#E7F3EC] text-[#286749]',
    Pledged: 'bg-[#E7F3EC] text-[#286749]',
    Active: 'bg-[#E7F3EC] text-[#286749]',
    Strength: 'bg-[#E7F3EC] text-[#286749]',
    Proposed: 'bg-[#FFF3D6] text-[#8A5700]',
    Sent: 'bg-[#FFF3D6] text-[#8A5700]',
    Countered: 'bg-[#EBF1FA] text-[#1E40AF]',
    Awaiting: 'bg-[#FFF3D6] text-[#8A5700]',
    Needs_info: 'bg-[#FFF3D6] text-[#8A5700]',
    In_progress: 'bg-[#EBF1FA] text-[#1E40AF]',
    Declined: 'bg-[#FDE8E8] text-[#B42318]',
    Cancelled: 'bg-[#FDE8E8] text-[#B42318]',
    Withdrawn: 'bg-[#FDE8E8] text-[#B42318]',
    Expired: 'bg-[#FDE8E8] text-[#B42318]',
    Concern: 'bg-[#FDE8E8] text-[#B42318]',
    Written_off: 'bg-[#F3F4F6] text-[#4A5568]',
    Exited: 'bg-[#F3F4F6] text-[#4A5568]',
    Partially_exited: 'bg-[#F3F4F6] text-[#4A5568]',
    Not_started: 'bg-[#F3F4F6] text-[#4A5568]',
    Na: 'bg-[#F3F4F6] text-[#4A5568]',
    Medium: 'bg-[#FFF3D6] text-[#8A5700]',
    Low: 'bg-[#F3F4F6] text-[#4A5568]',
  };

  const style = statusStyles[status] || 'bg-[#F3F4F6] text-[#4A5568]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
        size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
      } ${style} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-xl"
    >
      <span>{message}</span>
    </div>
  );
}
