import Link from "next/link";

export default function NotFound() {
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
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>Page not found</h1>
      <p style={{ margin: 0, color: "#6b7280" }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        style={{
          marginTop: "0.5rem",
          padding: "0.5rem 1.25rem",
          background: "#18181b",
          color: "#fff",
          borderRadius: "0.375rem",
          textDecoration: "none",
          fontSize: "0.875rem",
        }}
      >
        Go home
      </Link>
    </div>
  );
}
