/* Tafsir Lab · launch page behaviour. */
document.documentElement.classList.add("js");

/* ── Private-beta gate ──────────────────────────────────────────────────────
   Every "Open Tafsir Lab" and "Sign in" asks for the access code first. The
   code is checked on the server (/api/beta/unlock), which sets a cookie; /login
   and new-account sign-up both require it, so the gate cannot be skipped by
   typing the URL. */
(() => {
  const modal = document.getElementById("beta-modal");
  const form = document.getElementById("beta-modal-form");
  const input = document.getElementById("beta-modal-input");
  const error = document.getElementById("beta-modal-error");
  if (!modal || !form || !input || !error) return;

  let opener = null;
  const open = (from) => {
    opener = from;
    modal.hidden = false;
    error.hidden = true;
    input.value = "";
    setTimeout(() => input.focus(), 50);
  };
  const close = () => {
    modal.hidden = true;
    opener?.focus?.();
  };

  // On the document from the start, so a click before the page settles still opens it.
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".js-beta-gate");
    if (trigger) { e.preventDefault(); open(trigger); }
  });
  modal.querySelector(".gate-close")?.addEventListener("click", close);
  modal.querySelector(".gate-backdrop")?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });

  const go = modal.querySelector(".gate-go");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = input.value.trim();
    if (!code) return;
    error.hidden = true;
    if (go) go.disabled = true;
    try {
      const res = await fetch("/api/beta/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        error.textContent = data.error || "That code isn’t right.";
        error.hidden = false;
        input.select();
        return;
      }
      window.location.href = "/login";
    } catch {
      error.textContent = "Could not reach the server. Try again.";
      error.hidden = false;
    } finally {
      if (go) go.disabled = false;
    }
  });
})();

/* ── Film: offer the sound ──────────────────────────────────────────────────
   Browsers refuse autoplay with sound, so the film starts muted. The button
   is shown exactly while there is no sound, and comes back if the viewer
   mutes again from the native controls. */
(() => {
  const btn = document.querySelector(".film-sound");
  const vid = document.querySelector(".film-video");
  if (!btn || !vid) return;
  btn.addEventListener("click", () => {
    vid.muted = false;
    vid.volume = 1;
    if (vid.currentTime > 1 && vid.loop) vid.currentTime = 0;
    vid.play()?.catch?.(() => { /* the native play button still works */ });
  });
  const sync = () => btn.classList.toggle("is-hidden", !vid.muted);
  vid.addEventListener("volumechange", sync);
  sync();
})();

/* ── Sections rise into view as they are reached ───────────────────────── */
(() => {
  const els = document.querySelectorAll(".band .h2, .band .sub, .tile, .faq, .free-list, .film");
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  els.forEach((el) => { el.classList.add("rise"); io.observe(el); });
})();
