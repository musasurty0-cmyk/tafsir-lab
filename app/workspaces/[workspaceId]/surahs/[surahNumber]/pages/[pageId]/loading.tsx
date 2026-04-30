/**
 * Workspace page loading skeleton.
 * Shows the 3-column shell instantly while server data loads.
 */
export default function WorkspacePageLoading() {
  return (
    <div className="workspace-page">
      {/* Rail */}
      <div className="rail" style={{ background: "var(--panel)", borderRight: "1px solid var(--line)" }} />

      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ padding: "14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="skeleton" style={{ height: 32, borderRadius: 7 }} />
          <div className="skeleton" style={{ height: 28, borderRadius: 6 }} />
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 28, borderRadius: 5 }} />
            ))}
          </div>
        </div>
      </aside>

      {/* Canvas / editor area */}
      <div className="canvas-area">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", gap: 8 }}>
          <div className="skeleton" style={{ width: 120, height: 28, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 80, height: 28, borderRadius: 6 }} />
        </div>
        <div style={{ flex: 1, padding: "32px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 24, borderRadius: 5, width: `${85 - i * 6}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
