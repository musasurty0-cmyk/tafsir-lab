/* ─────────────── Typing demo for editor ─────────────── */
(() => {
  const target = document.getElementById('typed');
  const slash = document.getElementById('slash');
  if (!target) return;

  const phrase =
    "Notice how al-Ṭabarī links the Throne to encompassment — not size — and how this reading anchors ";
  const tail = "/";
  let i = 0;

  const tick = () => {
    if (i <= phrase.length) {
      target.textContent = phrase.slice(0, i);
      i++;
      setTimeout(tick, 22 + Math.random() * 35);
    } else if (i === phrase.length + 1) {
      target.textContent = phrase + tail;
      slash && (slash.style.display = 'block');
      i++;
      setTimeout(tick, 1800);
    } else {
      // restart loop
      target.textContent = '';
      slash && (slash.style.display = 'none');
      i = 0;
      setTimeout(tick, 1200);
    }
  };
  if (slash) slash.style.display = 'none';
  setTimeout(tick, 800);
})();

/* ─────────────── Scroll reveal ─────────────── */
(() => {
  const els = document.querySelectorAll(
    '.pillar, .deep-copy, .deep-stage, .ws-card, .price, .faq-i, .quote-frame, .wbw-strip, .strip-items'
  );
  els.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  els.forEach(el => io.observe(el));
})();

/* ─────────────── Drawer tab toggle ─────────────── */
(() => {
  document.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('drawer-tab-active'));
      tab.classList.add('drawer-tab-active');
    });
  });
})();

/* ─────────────── Ink pen toggle ─────────────── */
(() => {
  document.querySelectorAll('.ink-pen').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('.ink-pen').forEach(x => x.classList.remove('ink-active'));
      p.classList.add('ink-active');
    });
  });
})();

/* ─────────────── Beta gate modal ─────────────── */
(() => {
  const modal   = document.getElementById('beta-modal');
  const form    = document.getElementById('beta-modal-form');
  const input   = document.getElementById('beta-modal-input');
  const errorEl = document.getElementById('beta-modal-error');
  const closeBtn = modal?.querySelector('.beta-modal-close');
  const submitBtn = modal?.querySelector('.beta-modal-btn');
  if (!modal || !form || !input) return;

  // Where to send the user after a successful code — default /login
  let destination = '/login';

  function openModal(dest) {
    destination = dest || '/login';
    modal.hidden = false;
    errorEl.hidden = true;
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }

  function closeModal() {
    modal.hidden = true;
  }

  // Intercept all .js-beta-gate links/buttons
  document.querySelectorAll('.js-beta-gate').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      openModal('/login');
    });
  });

  closeBtn?.addEventListener('click', closeModal);

  // Close on backdrop click
  modal.querySelector('.beta-modal-backdrop')?.addEventListener('click', closeModal);

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const password = input.value.trim();
    if (!password) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="beta-modal-spinner"></span>';
    errorEl.hidden = true;

    try {
      const res  = await fetch('/api/beta/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!data.ok) {
        errorEl.textContent = data.error || 'Invalid access code';
        errorEl.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continue →';
        input.select();
        return;
      }

      // Cookie set by server — navigate to sign in
      window.location.href = destination;
    } catch {
      errorEl.textContent = 'Something went wrong. Please try again.';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue →';
    }
  });
})();

/* ─────────────── Showcase video: play with sound on first click ─────────────── */
(() => {
  const btn = document.querySelector('.showcase-unmute');
  const vid = document.querySelector('.showcase-video');
  if (!btn || !vid) return;

  const start = () => {
    vid.muted = false;
    vid.volume = 1;
    const p = vid.play();
    if (p && typeof p.then === 'function') {
      p.catch(() => { /* user can press the native play */ });
    }
    btn.classList.add('is-hidden');
  };

  btn.addEventListener('click', start);

  vid.addEventListener('play', () => {
    btn.classList.add('is-hidden');
  });
  vid.addEventListener('pause', () => {
    if (vid.currentTime === 0) btn.classList.remove('is-hidden');
  });
})();
