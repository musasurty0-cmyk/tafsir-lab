"use client";

import { useRouter } from "next/navigation";

/** Forget this device: clears both gate cookies and returns to the gate. */
export default function LeaveButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="ym-link-btn"
      onClick={async () => {
        await fetch("/api/youth-majlis/unlock", { method: "DELETE" }).catch(() => null);
        router.push("/youth-majlis");
        router.refresh();
      }}
    >
      Leave
    </button>
  );
}
