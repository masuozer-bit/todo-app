/** A 16 px ring instead of a progress bar: it says the same thing quietly. */
export default function ProgressRing({ percent }: { percent: number }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, percent)) / 100;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="flex-none" aria-hidden="true">
      <circle cx="8" cy="8" r={r} fill="none" stroke="var(--border-strong)" strokeWidth="2" />
      <circle
        cx="8" cy="8" r={r} fill="none"
        stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"
        strokeDasharray={`${c * filled} ${c}`}
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}
