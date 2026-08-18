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
    '.pillar, .deep-copy, .deep-stage, .ws-card, .price, .faq-i, .quote-frame, .wbw-strip, .strip-items, .library-wall'
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

/* ─────────────── Mushaf ink draw-in ─────────────── */
(() => {
  const mushaf = document.querySelector('.mushaf');
  if (!mushaf || !('IntersectionObserver' in window)) {
    mushaf && mushaf.classList.add('ink-play');
    return;
  }
  const io = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          mushaf.classList.add('ink-play');
          io.disconnect();
        }
      });
    },
    { threshold: 0.35 }
  );
  io.observe(mushaf);
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

  const modal   = document.getElementById('beta-modal');
  const form    = document.getElementById('beta-modal-form');
  const input   = document.getElementById('beta-modal-input');
  const errorEl = document.getElementById('beta-modal-error');
  if (!modal || !form || !input || !errorEl) return;

  function openModal() {
    modal.hidden = false;
    errorEl.hidden = true;
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }

  function closeModal() {
    modal.hidden = true;
  }

  // Event delegation — listener lives on document from the moment this
  // script executes, so clicks before DOMContentLoaded still open the modal.
  document.addEventListener('click', e => {
    if (e.target.closest('.js-beta-gate')) {
      e.preventDefault();
      openModal();
    }
  });

  modal.querySelector('.beta-modal-close')?.addEventListener('click', closeModal);
  modal.querySelector('.beta-modal-backdrop')?.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const password = input.value.trim().toUpperCase();
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

  /* Track MUTE, not play/pause. This was written for a click-to-play poster,
     but the video carries `autoplay muted` — so hiding on 'play' hid the
     button on page load, before anyone could reach it, and the sound could
     never be turned on at all. What the button offers is sound, so it is
     visible exactly while there is none: it comes back if the viewer re-mutes
     from the native controls. */
  const syncButton = () => {
    btn.classList.toggle('is-hidden', !vid.muted);
  };
  vid.addEventListener('volumechange', syncButton);
  syncButton();
})();
