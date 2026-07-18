"use client";

import { pushWithSplash } from "@/lib/nav-splash";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function JoinWorkspaceModal({ onClose }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError("Enter an invite code"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json() as { workspace?: { id: string }; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to join workspace");
        return;
      }
      if (data.workspace?.id) {
        pushWithSplash(router, `/workspaces/${data.workspace.id}`);
        router.refresh();
        onClose();
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="join-modal-overlay" onClick={onClose}>
      <div className="join-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 className="join-modal-title">Join a workspace</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", display: "flex", alignItems: "center" }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 16 }}>
          Enter the invite code shared by a workspace admin.
        </p>
        <form onSubmit={handleJoin}>
          <input
            className="join-modal-input"
            placeholder="e.g. A1B2C3D4E5"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={loading}
            maxLength={20}
            autoFocus
            autoCapitalize="characters"
            spellCheck={false}
          />
          {error && <p className="join-modal-error">{error}</p>}
          <button
            type="submit"
            className="join-modal-btn"
            disabled={loading || !code.trim()}
          >
            {loading ? "Joining…" : "Join workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
