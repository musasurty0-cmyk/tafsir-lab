/**
 * WorkspaceLoadingSkeleton — contextual skeleton for workspace/surah/page routes.
 *
 * Replaces the full-screen LoadingVerse splash for internal navigation so the
 * user sees a layout that matches where they're going, not a generic splash.
 */

export default function WorkspaceLoadingSkeleton() {
  return (
    <div className="wls-root" aria-label="Loading…" aria-busy="true">
      {/* Rail */}
      <div className="wls-rail">
        <div className="wls-rail-logo skeleton" />
        <div className="wls-rail-btn skeleton" />
        <div className="wls-rail-btn skeleton" />
        <div className="wls-rail-btn skeleton" />
        <div style={{ flex: 1 }} />
        <div className="wls-rail-btn skeleton" />
      </div>

      {/* Sidebar */}
      <div className="wls-sidebar">
        <div className="wls-sb-header">
          <div className="wls-sb-title skeleton" />
        </div>
        <div className="wls-sb-section skeleton" />
        {[80, 60, 70, 55, 65].map((w, i) => (
          <div key={i} className="wls-sb-row">
            <div className="skeleton" style={{ width: `${w}%`, height: 12, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div className="wls-canvas">
        <div className="wls-topbar">
          <div className="skeleton" style={{ width: 160, height: 14, borderRadius: 4 }} />
          <div style={{ flex: 1 }} />
          <div className="skeleton" style={{ width: 64, height: 26, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 64, height: 26, borderRadius: 6 }} />
        </div>

        <div className="wls-content">
          {/* Page title */}
          <div className="skeleton" style={{ width: "55%", height: 28, borderRadius: 6, marginBottom: 32 }} />
          {/* Body lines */}
          {[90, 75, 85, 60, 78, 50].map((w, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ width: `${w}%`, height: 14, borderRadius: 4, marginBottom: 14 }}
            />
          ))}
          {/* Gap */}
          <div style={{ marginTop: 28 }} />
          {[80, 65, 72].map((w, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ width: `${w}%`, height: 14, borderRadius: 4, marginBottom: 14 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
