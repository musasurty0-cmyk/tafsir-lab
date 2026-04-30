export default function HomeLoading() {
  return (
    <div className="home-shell">
      {/* Rail skeleton */}
      <div className="rail" style={{ background: "var(--panel)", borderRight: "1px solid var(--line)" }} />

      {/* Main content skeleton */}
      <div className="home-content" style={{ padding: "40px 48px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
          <div className="skeleton" style={{ width: 160, height: 28, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: "50%" }} />
        </div>

        {/* Resume card */}
        <div className="skeleton" style={{ width: "100%", height: 80, borderRadius: 10, marginBottom: 32 }} />

        {/* Section label */}
        <div className="skeleton" style={{ width: 120, height: 16, borderRadius: 4, marginBottom: 16 }} />

        {/* Workspace cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {[1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 10 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
