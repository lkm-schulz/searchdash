import { formatClock } from "../format";

interface RefreshControlsProps {
  intervalMs: number;
  onIntervalChange: (ms: number) => void;
  autoRefresh: boolean;
  onAutoRefreshChange: (on: boolean) => void;
  onManualRefresh: () => void;
  lastUpdated: number | null;
}

/** Poll-interval input, auto-refresh toggle, manual refresh, last-updated stamp. */
export default function RefreshControls({
  intervalMs,
  onIntervalChange,
  autoRefresh,
  onAutoRefreshChange,
  onManualRefresh,
  lastUpdated,
}: RefreshControlsProps) {
  const seconds = Math.round(intervalMs / 1000);
  return (
    <div className="refresh-controls">
      <label className="checkbox">
        <input type="checkbox" checked={autoRefresh} onChange={(e) => onAutoRefreshChange(e.target.checked)} />
        Auto
      </label>
      <label className="interval">
        every
        <input
          type="number"
          min={1}
          value={seconds}
          onChange={(e) => onIntervalChange(Math.max(1, Number(e.target.value)) * 1000)}
        />
        s
      </label>
      <button className="btn refresh-now" onClick={onManualRefresh} title="Refresh now" aria-label="Refresh now">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
      <span className="last-updated">
        {lastUpdated ? `updated ${formatClock(lastUpdated)}` : "—"}
      </span>
    </div>
  );
}
