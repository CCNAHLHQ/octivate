export function RouteLoading({ label = "Loading workspace…" }: { label?: string }) {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <p className="font-mono text-[10px] uppercase tracking-widest text-faint mb-4">{label}</p>
      <div className="route-loading-grid">
        <div className="route-loading-card" />
        <div className="route-loading-card" />
        <div className="route-loading-card" />
        <div className="route-loading-card" />
      </div>
    </div>
  );
}
