/**
 * Progress indicators. Prefer determinate when the work is measurable; start indeterminate and
 * switch to determinate once a total is known, but never switch bar ↔ circular. // HIG: progress-indicators
 */
interface ProgressProps {
  /** 0..1. Omit (or null) for indeterminate. */
  value?: number | null;
  label: string;
  className?: string;
}

export function ProgressBar({ value, label, className = "" }: ProgressProps) {
  const determinate = value !== undefined && value !== null;
  const pct = determinate ? Math.round(Math.max(0, Math.min(1, value)) * 100) : undefined;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={pct}
      className={`relative h-1.5 w-full overflow-hidden rounded-full bg-fill-secondary ${className}`}
    >
      {determinate ? (
        <div className="h-full rounded-full bg-accent transition-[width] duration" style={{ width: `${pct}%` }} />
      ) : (
        <div className="absolute inset-y-0 w-2/5 rounded-full bg-accent" style={{ animation: "dp-indeterminate 1.4s var(--ease) infinite" }} />
      )}
    </div>
  );
}

export function ProgressCircle({ value, label, className = "", size = 16 }: ProgressProps & { size?: number }) {
  const determinate = value !== undefined && value !== null;
  const r = 7;
  const c = 2 * Math.PI * r;
  const pct = determinate ? Math.max(0, Math.min(1, value)) : 0.3;
  return (
    <svg
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? Math.round(pct * 100) : undefined}
      viewBox="0 0 18 18"
      width={size}
      height={size}
      className={className}
      style={determinate ? undefined : { animation: "dp-spin 1s linear infinite" }}
    >
      <circle cx="9" cy="9" r={r} fill="none" stroke="var(--system-fill)" strokeWidth="2.5" />
      <circle cx="9" cy="9" r={r} fill="none" stroke="rgb(var(--accent))" strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 9 9)" />
    </svg>
  );
}
