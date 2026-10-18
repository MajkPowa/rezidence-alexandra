(() => {
  'use strict';
  const root = document.querySelector('.companion-page');
  if (!root) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const videos = [...root.querySelectorAll('video')];

  // Native controls stay available; starting another clip never mixes its audio.
  for (const video of videos) {
    video.addEventListener('play', () => {
      videos.forEach(other => { if (other !== video) other.pause(); });
    });
    const showError = () => {
      if (video.nextElementSibling?.classList.contains('media-error')) return;
      const source = video.querySelector('source')?.getAttribute('src');
      const note = document.createElement('p');
      note.className = 'media-error';
      note.setAttribute('role', 'status');
      note.textContent = 'Video se nepodařilo přehrát. ';
      if (source && /^assets\/[a-z0-9/_-]+\.mp4$/i.test(source)) {
        const link = document.createElement('a');
        link.href = source;
        link.textContent = 'Otevřít soubor MP4';
        note.append(link);
      }
      video.after(note);
    };
    video.addEventListener('error', showError);
    video.querySelector('source')?.addEventListener('error', showError);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) videos.forEach(video => video.pause());
  });
  if ('IntersectionObserver' in window) {
    const visibility = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting && document.pictureInPictureElement !== entry.target &&
            document.fullscreenElement !== entry.target) entry.target.pause();
      }
    });
    videos.forEach(video => visibility.observe(video));
  }
  document.querySelector('[data-print-storyboard]')?.addEventListener('click', () => window.print());

  const chapterLinks = [...root.querySelectorAll('.chapter-navigation a, .companion-section-nav a')]
    .filter(link => link.getAttribute('href')?.startsWith('#'));
  function syncCurrentSection() {
    chapterLinks.forEach(link => {
      if (link.hash === location.hash) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange', syncCurrentSection);
  syncCurrentSection();

  const model = document.querySelector('#building');
  if (!model) return;
  const variant = document.querySelector('#variant');
  const status = document.querySelector('#building-status');
  const loading = document.querySelector('#building-loading');
  const error = document.querySelector('#building-error');
  const rotate = document.querySelector('#rotate');
  const stage = document.querySelector('.building-stage');
  const viewButtons = [...document.querySelectorAll('[data-orbit]')];
  const cameraButtons = [...document.querySelectorAll('[data-camera-action], [data-orbit]')];
  let ready = false;
  let loadTimer;
  const srcForVariant = () => `assets/3d/exterior-${variant.value === 'with' ? 'with' : 'no'}-balconies.glb`;
  const variantName = () => variant.value === 'with' ? 'Varianta B · s bočními balkony' : 'Varianta A · bez bočních balkonů';

  function setRotation(on) {
    on = Boolean(on && ready && !motion.matches);
    model.toggleAttribute('auto-rotate', on);
    rotate.setAttribute('aria-pressed', String(on));
    rotate.textContent = on ? 'Zastavit otáčení' : 'Automaticky otáčet';
  }
  function setBusy(busy) {
    ready = !busy;
    model.setAttribute('aria-busy', String(busy));
    loading.hidden = !busy;
    cameraButtons.forEach(button => { button.disabled = busy; });
    rotate.disabled = busy || motion.matches;
  }
  function showLoadError() {
    clearTimeout(loadTimer);
    setRotation(false);
    setBusy(true);
    loading.hidden = true;
    error.hidden = false;
    status.textContent = 'Model se nepodařilo načíst.';
  }
  function beginLoad() {
    clearTimeout(loadTimer);
    setRotation(false);
    setBusy(true);
    error.hidden = true;
    status.textContent = `Načítání modelu — ${variantName()}.`;
    model.alt = `Prostorový model domu Rezidence Alexandra. ${variantName()}.`;
    loadTimer = setTimeout(showLoadError, 45000);
  }
  function clearPreset() {
    viewButtons.forEach(button => button.setAttribute('aria-pressed', 'false'));
  }
  function setOrbit(orbit) {
    setRotation(false);
    model.resetTurntableRotation?.();
    model.cameraOrbit = orbit;
    if (motion.matches) model.jumpCameraToGoal?.();
  }
  model.addEventListener('load', () => {
    clearTimeout(loadTimer);
    setBusy(false);
    error.hidden = true;
    status.textContent = `Připraveno k prohlížení — ${variantName()}.`;
  });
  model.addEventListener('error', showLoadError);
  model.addEventListener('camera-change', event => {
    if (event.detail?.source === 'user-interaction') {
      setRotation(false);
      clearPreset();
    }
  });
  ['pointerdown', 'pointerenter', 'focusin'].forEach(name => model.addEventListener(name, () => setRotation(false)));
  document.querySelector('.building-controls').addEventListener('focusin', event => {
    if (event.target !== rotate) setRotation(false);
  });
  variant.addEventListener('change', () => {
    beginLoad();
    model.src = srcForVariant();
  });
  rotate.addEventListener('click', () => {
    setRotation(!model.hasAttribute('auto-rotate'));
    clearPreset();
  });
  viewButtons.forEach(button => button.addEventListener('click', () => {
    setOrbit(button.dataset.orbit);
    clearPreset();
    button.setAttribute('aria-pressed', 'true');
  }));
  document.querySelectorAll('[data-camera-action]').forEach(button => button.addEventListener('click', () => {
    const orbit = model.getCameraOrbit?.();
    if (!orbit) return;
    const { theta, phi, radius } = orbit;
    const action = button.dataset.cameraAction;
    const nextTheta = theta + (action === 'left' ? -.26 : action === 'right' ? .26 : 0);
    const nextRadius = Math.max(28, Math.min(115, radius * (action === 'in' ? .82 : action === 'out' ? 1.22 : 1)));
    setOrbit(`${nextTheta}rad ${phi}rad ${nextRadius}m`);
    clearPreset();
  }));
  document.querySelector('#building-retry').addEventListener('click', () => {
    beginLoad();
    model.removeAttribute('src');
    requestAnimationFrame(() => { model.src = srcForVariant(); });
  });
  motion.addEventListener('change', () => {
    setRotation(false);
    rotate.disabled = !ready || motion.matches;
    rotate.title = motion.matches ? 'Vypnuto podle nastavení omezeného pohybu.' : '';
    model.interpolationDecay = motion.matches ? 0 : 120;
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setRotation(false); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting) setRotation(false);
    }).observe(stage);
  }
  beginLoad();
  rotate.title = motion.matches ? 'Vypnuto podle nastavení omezeného pohybu.' : '';
  model.interpolationDecay = motion.matches ? 0 : 120;
  // The component may already be ready when the deferred page script executes.
  customElements.whenDefined('model-viewer').then(() => {
    if (model.loaded) {
      clearTimeout(loadTimer);
      setBusy(false);
      status.textContent = `Připraveno k prohlížení — ${variantName()}.`;
    }
  });
})();
