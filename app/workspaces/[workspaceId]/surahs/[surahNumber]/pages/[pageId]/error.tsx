"use client";

import Link from "next/link";

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "1rem",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        color: "#374151",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
        Failed to load page
      </h1>
      <p style={{ margin: 0, color: "#6b7280", fontSize: "0.875rem" }}>
        {error.message ?? "An unexpected error occurred."}
      </p>
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1.25rem",
            background: "#18181b",
            color: "#fff",
            borderRadius: "0.375rem",
            border: "none",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            padding: "0.5rem 1.25rem",
            background: "transparent",
            color: "#374151",
            borderRadius: "0.375rem",
            border: "1px solid #d1d5db",
            textDecoration: "none",
            fontSize: "0.875rem",
          }}
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
