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
  const BETA_PASSWORD = 'READY2027';

  const modal    = document.getElementById('beta-modal');
  const form     = document.getElementById('beta-modal-form');
  const input    = document.getElementById('beta-modal-input');
  const errorEl  = document.getElementById('beta-modal-error');
  const closeBtn = modal?.querySelector('.beta-modal-close');
  const submitBtn = modal?.querySelector('.beta-modal-btn');
  if (!modal || !form || !input) return;

  function openModal() {
    modal.hidden = false;
    errorEl.hidden = true;
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }

  function closeModal() {
    modal.hidden = true;
  }

  document.querySelectorAll('.js-beta-gate').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      openModal();
    });
  });

  closeBtn?.addEventListener('click', closeModal);
  modal.querySelector('.beta-modal-backdrop')?.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const password = input.value.trim();
    if (!password) return;

    if (password !== BETA_PASSWORD) {
      errorEl.textContent = 'Invalid access code';
      errorEl.hidden = false;
      input.select();
      return;
    }

    window.location.href = '/login';
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
