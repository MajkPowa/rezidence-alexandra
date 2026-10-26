/* One continuous camera timeline; native scroll remains under the visitor's control. */
(() => {
  'use strict';
  const journey = document.querySelector('#residence-journey');
  if (!journey) return;
  const stage = journey.querySelector('.journey-stage');
  const video = journey.querySelector('.journey-film');
  const poster = journey.querySelector('.journey-poster');
  const panels = Array.from(journey.querySelectorAll('[data-chapter]'));
  const buttons = Array.from(journey.querySelectorAll('[data-journey-step]'));
  const progress = journey.querySelector('.journey-progress');
  const motionButton = journey.querySelector('.journey-motion-toggle');
  const credit = journey.querySelector('.journey-credit');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  const stops = [0, .08, .26, .39, .61, .9];
  const destinations = [0, .17, .34, .5, .77, .995];
  const stills = ['assets/exterior-no-balconies.webp', 'assets/exterior-no-balconies.webp', 'assets/agency-interiors-20261026/3kk-interior-01.webp', 'assets/agency-interiors-20261026/3kk-interior-03.webp', 'assets/agency-interiors-20261026/3kk-interior-01.webp', 'assets/exterior-no-balconies.webp'];
  const credits = ['Původní vizualizace projektu · ilustrační pohyb kamery', 'Navazující pohyb od fasády do interiéru · ilustrace', 'Interiér podle původní vizualizace · 3+kk', 'Kuchyně podle původní vizualizace · 3+kk', 'Stejná kamerová trasa zpět k domu · ilustrace', '51 bytových jednotek · dostupnost na dotaz'];
  let target = 0, position = 0, manual = 0, frame = 0, lastTime = 0, currentChapter = -1;
  let userPaused = false, paused = preference.matches, visible = true, measuredTop = 0, measuredRange = 1, failed = false;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const staticMode = () => preference.matches || saveData || failed;

  function loadVideo() {
    if (!video || video.src || paused || staticMode() || !visible || document.hidden || document.readyState !== 'complete') return;
    video.muted = true;
    video.preload = 'auto';
    video.src = matchMedia('(max-width: 700px)').matches ? video.dataset.mobileSrc : video.dataset.src;
    video.addEventListener('loadeddata', () => { video.classList.add('is-ready'); schedule(); }, { once: true });
    video.addEventListener('error', () => { failed = true; video.classList.remove('is-ready'); syncControls(); schedule(); }, { once: true });
    video.addEventListener('seeked', () => { if (visible && !paused) schedule(); });
    video.load();
  }
  function seek(fraction, time) {
    if (!video || paused || staticMode() || !Number.isFinite(video.duration) || video.readyState < 2) return false;
    const desired = clamp(fraction, 0, .998) * video.duration;
    if (Math.abs(video.currentTime - desired) <= .055 || video.seeking) return false;
    if (time - (video._lastJourneySeek || 0) <= 65) return true;
    video.currentTime = desired;
    video._lastJourneySeek = time;
    return false;
  }
  function measure() {
    const rect = journey.getBoundingClientRect();
    measuredTop = window.scrollY + rect.top;
    measuredRange = Math.max(1, journey.offsetHeight - stage.offsetHeight);
    visible = rect.bottom > 0 && rect.top < innerHeight;
    journey.dataset.visible = String(visible);
    document.body.classList.toggle('is-cinematic', rect.top < 80 && rect.bottom > 80);
    target = preference.matches ? manual : clamp((window.scrollY - measuredTop) / measuredRange, 0, 1);
  }
  function render(p, time) {
    let active = 0;
    stops.forEach((stop, i) => { if (p >= stop) active = i; });
    if (active !== currentChapter) {
      currentChapter = active;
      panels.forEach((panel, i) => {
        panel.style.opacity = i === active ? '1' : '0';
        panel.style.transform = 'none';
        panel.classList.toggle('is-active', i === active);
        panel.setAttribute('aria-hidden', String(i !== active));
        panel.inert = i !== active;
      });
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === active)));
      credit.textContent = credits[active];
      journey.dataset.chapter = String(active);
    }
    // Still images are an explicit reduced-motion/data-saving fallback only.
    if (staticMode() && poster.dataset.chapter !== String(active)) {
      poster.src = stills[active];
      poster.dataset.chapter = String(active);
    }
    if (progress) progress.style.transform = 'scaleX(' + p.toFixed(5) + ')';
    if (visible) { loadVideo(); return seek(p, time); }
    return false;
  }
  function tick(time) {
    frame = 0;
    const dt = Math.min(50, lastTime ? time - lastTime : 16);
    lastTime = time;
    position = paused || preference.matches ? target : position + (target - position) * (1 - Math.exp(-dt / 72));
    if (Math.abs(target - position) < .00015) position = target;
    const pending = render(position, time);
    if (visible && (Math.abs(target - position) >= .00015 || pending)) frame = requestAnimationFrame(tick);
    else lastTime = 0;
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(tick); }
  function update() { measure(); schedule(); }
  buttons.forEach(button => button.addEventListener('click', () => {
    const p = destinations[Number(button.dataset.journeyStep)];
    if (preference.matches) { manual = p; target = p; schedule(); }
    else window.scrollTo({ top: measuredTop + measuredRange * p, behavior: paused ? 'auto' : 'smooth' });
  }));
  function syncControls() {
    paused = preference.matches || userPaused;
    motionButton.hidden = staticMode();
    motionButton.setAttribute('aria-pressed', String(!paused));
    motionButton.setAttribute('aria-label', paused ? 'Zapnout pohyb obrazu' : 'Pozastavit pohyb obrazu');
    if (video && preference.matches) video.classList.remove('is-ready');
    else if (video && video.readyState >= 2 && !failed) video.classList.add('is-ready');
  }
  motionButton.addEventListener('click', () => {
    userPaused = !userPaused;
    syncControls();
    if (video && paused) video.pause();
    schedule();
  });
  panels.forEach((panel, index) => { panel.hidden = false; panel.inert = index !== 0; });
  journey.querySelector('.journey-rail').hidden = false;
  document.body.classList.add('has-journey-motion');
  syncControls();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  window.addEventListener('pageshow', update);
  window.addEventListener('load', update, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; if (video) video.pause(); }
    else update();
  });
  preference.addEventListener('change', () => { syncControls(); update(); });
  update();
})();
