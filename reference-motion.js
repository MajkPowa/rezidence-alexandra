/* Original motion choreography for Alexandra. No wheel/touch interception. */
(() => {
  'use strict';
  const journey = document.querySelector('#residence-journey');
  if (!journey) return;
  const stage = journey.querySelector('.journey-stage');
  const layers = Array.from(journey.querySelectorAll('.journey-layer'));
  const panels = Array.from(journey.querySelectorAll('[data-chapter]'));
  const buttons = Array.from(journey.querySelectorAll('[data-journey-step]'));
  const progress = journey.querySelector('.journey-progress');
  const motionButton = journey.querySelector('.journey-motion-toggle');
  const credit = journey.querySelector('.journey-credit');
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  const source = [0, 0, 1, 2, 3, 0];
  const credits = ['Architektonický návrh · vizualizace', 'Přízemí domu · návrhová vizualizace', 'Typový interiér · návrh zařízení', 'Koupelna 3+kk · katalog 20. 10. 2026', 'Architektonický návrh · zadní pohled', '51 bytových jednotek · dostupnost na dotaz'];
  let target = 0;
  let position = 0;
  let manual = 0;
  let frame = 0;
  let lastTime = 0;
  let currentChapter = -1;
  let paused = motionPreference.matches;
  let userPaused = false;
  let visible = true;
  let measuredTop = 0;
  let measuredRange = 1;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const smooth = n => n * n * (3 - 2 * n);
  const videos = layers.map(layer => layer.querySelector('video'));

  function loadVideo(video) {
    if (!video || video.src || paused || motionPreference.matches || saveData || !visible || document.hidden || document.readyState !== 'complete') return;
    video.muted = true;
    video.preload = 'auto';
    video.src = matchMedia('(max-width: 700px)').matches && video.dataset.mobileSrc ? video.dataset.mobileSrc : video.dataset.src;
    video.addEventListener('loadeddata', () => { video.classList.add('is-ready'); schedule(); }, { once: true });
    video.addEventListener('error', () => { video.classList.remove('is-ready'); }, { once: true });
    video.addEventListener('seeked', () => { if (visible && !paused) schedule(); });
    video.load();
  }
  function seek(video, fraction, time) {
    if (!video || paused || motionPreference.matches || !Number.isFinite(video.duration) || video.readyState < 2) return false;
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
    target = motionPreference.matches ? manual : clamp((window.scrollY - measuredTop) / measuredRange, 0, 1);
  }
  function render(p, time) {
    const phase = Math.min(5.9999, p * 6);
    const index = Math.floor(phase);
    const local = phase - index;
    const transition = index < 5 ? smooth(clamp((local - .76) / .24, 0, 1)) : 0;
    const opacity = [0, 0, 0, 0];
    opacity[source[index]] = 1 - transition;
    if (index < 5) opacity[source[index + 1]] += transition;
    layers.forEach((layer, i) => {
      layer.style.opacity = opacity[i].toFixed(4);
      let scale = 1.02;
      let x = 0;
      let y = 0;
      if (!paused && !motionPreference.matches) {
        if (i === 0 && index < 2) { scale = 1.02 + phase * .065; x = -phase * .5; y = -phase * .25; }
        if (i === 0 && index === 5) { scale = 1.14 - local * .12; }
        if (i === 1) { scale = 1.025 + local * .025; x = local * -.45; }
        if (i === 2) { scale = 1.02 + local * .06; x = local * -.5; }
        if (i === 3) { scale = 1.11 + local * .035; y = 2.3 - local * 4.6; }
      }
      if (!paused || motionPreference.matches) layer.style.transform = 'translate3d(' + x.toFixed(3) + '%,' + y.toFixed(3) + '%,0) scale(' + scale.toFixed(4) + ')';
      if (opacity[i] > .01) loadVideo(videos[i]);
    });
    const active = transition > .65 ? Math.min(5, index + 1) : index;
    // A visitor may stop anywhere in the film fade. Keep the active caption legible.
    const textOpacity = 1;
    panels.forEach((panel, i) => {
      panel.style.opacity = i === active ? String(textOpacity) : '0';
      panel.style.transform = paused || motionPreference.matches ? 'none' : 'translate3d(0,' + (i === active ? (1 - textOpacity) * 14 : 14).toFixed(2) + 'px,0)';
      if (i !== active) panel.inert = true;
    });
    if (active !== currentChapter) {
      currentChapter = active;
      panels.forEach((panel, i) => { panel.classList.toggle('is-active', i === active); panel.setAttribute('aria-hidden', String(i !== active)); panel.inert = i !== active; });
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === active)));
      credit.textContent = credits[active];
      journey.dataset.chapter = String(active);
    }
    if (progress) progress.style.transform = 'scaleX(' + p.toFixed(5) + ')';
    let seekPending = false;
    if (visible) {
      if (index < 2) seekPending = seek(videos[0], phase / 2, time);
      if (index === 2) seekPending = seek(videos[1], local, time);
      if (index === 5) seekPending = seek(videos[0], 1 - local, time);
    }
    return seekPending;
  }
  function tick(time) {
    frame = 0;
    const dt = Math.min(50, lastTime ? time - lastTime : 16);
    lastTime = time;
    const difference = target - position;
    position = paused || motionPreference.matches ? target : position + difference * (1 - Math.exp(-dt / 72));
    if (Math.abs(target - position) < .00015) position = target;
    const seekPending = render(position, time);
    if (visible && (Math.abs(target - position) >= .00015 || seekPending)) frame = requestAnimationFrame(tick);
    else lastTime = 0;
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(tick); }
  function update() { measure(); schedule(); }
  function goToChapter(index) {
    const chapterProgress = index === 5 ? .93 : (index + .26) / 6;
    if (motionPreference.matches) { manual = chapterProgress; target = manual; schedule(); }
    else window.scrollTo({ top: measuredTop + measuredRange * chapterProgress, behavior: paused ? 'auto' : 'smooth' });
  }
  buttons.forEach(button => button.addEventListener('click', () => goToChapter(Number(button.dataset.journeyStep))));
  function syncMotionControls() {
    paused = motionPreference.matches || userPaused;
    motionButton.hidden = motionPreference.matches;
    motionButton.setAttribute('aria-pressed', String(!paused));
    motionButton.setAttribute('aria-label', paused ? 'Zapnout pohyb obrazu' : 'Pozastavit pohyb obrazu');
  }
  motionButton.addEventListener('click', () => {
    userPaused = !userPaused;
    syncMotionControls();
    videos.forEach(video => { if (video) { if (paused) video.pause(); else loadVideo(video); } });
    schedule();
  });
  panels.forEach((panel, index) => { panel.hidden = false; panel.inert = index !== 0; });
  journey.querySelector('.journey-rail').hidden = false;
  document.body.classList.add('has-journey-motion');
  syncMotionControls();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  window.addEventListener('pageshow', update);
  window.addEventListener('load', update, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; videos.forEach(video => { if (video) video.pause(); }); }
    else update();
  });
  motionPreference.addEventListener('change', () => { syncMotionControls(); update(); });
  update();
})();
