/* Continuous, pausable film. Native scrolling never seeks or moves the camera. */
(() => {
  'use strict';
  const journey = document.querySelector('#residence-journey');
  if (!journey) return;
  const video = journey.querySelector('.journey-film'), picture = journey.querySelector('.journey-picture'), poster = journey.querySelector('.journey-poster');
  const panels = Array.from(journey.querySelectorAll('[data-chapter]')), buttons = Array.from(journey.querySelectorAll('[data-journey-step]'));
  const motionButton = journey.querySelector('.journey-motion-toggle'), status = journey.querySelector('.journey-step-status'), progress = journey.querySelector('.journey-progress'), loadingStatus = journey.querySelector('.journey-load-status');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = () => Boolean(navigator.connection && navigator.connection.saveData);
  let config;
  try { config = JSON.parse(document.querySelector('#journey-config').textContent); } catch (_) { return; }
  if (!video || !picture || !poster || !motionButton || !Array.isArray(config.chapters) || !config.chapters.length || config.chapters.length !== panels.length || !Array.isArray(config.variants) || !config.posters || !(config.duration > 0)) return;
  const chapters = config.chapters, end = Math.max(0, config.duration - 1 / (config.fps || 24));
  const clampTime = time => Math.max(0, Math.min(end, Number(time) || 0));
  const chapterTimes = chapters.map(chapter => clampTime(Number.isFinite(chapter.mediaStart) ? chapter.mediaStart : config.posters[chapter.poster]?.time));
  const chapterSeekTimes = chapters.map((chapter, index) => {
    const start = chapterTimes[index], next = chapterTimes[index + 1] ?? config.duration;
    const target = Number.isFinite(chapter.seekTo) ? clampTime(chapter.seekTo) : start;
    // A manual seek must stay within its chapter so the paused title remains truthful.
    return target >= start && target < next ? target : start;
  });
  const stillDuration = index => Math.max(1500, Number(chapters[index].stillDurationMs) || Number(config.stillDurationMs) || 4500);
  let currentChapter = -1, visible = false, userPaused = false, focusPaused = false, keyboardInput = false;
  let selected = null, choosing = false, loaded = false, failed = false, fallbackUsed = false;
  let stillTimer = 0, stillStarted = 0, stillRemaining = stillDuration(0);
  let posterKey = '', posterSerial = 0, playPending = false, resizeTimer = 0, loadTimer = 0, lastMediaTime = 0, desiredTime = 0, pendingSeek = null;
  const suppliedStills = config.presentation === 'supplied-stills';
  const slideshow = () => suppliedStills || preference.matches || saveData() || failed;
  const pausedByVisitor = () => userPaused || focusPaused;
  const waitingForAnchor = () => document.readyState !== 'complete' && window.location.hash && !['#','#top','#residence-journey'].includes(window.location.hash);
  const active = () => visible && !document.hidden && !waitingForAnchor() && !pausedByVisitor();
  const portrait = () => innerWidth <= 700 && innerHeight > innerWidth;
  function setLoading(on) { video.setAttribute('aria-busy', String(on)); if (loadingStatus) loadingStatus.hidden = !on; }
  function setPoster(key) {
    const data = config.posters[key];
    if (!data || posterKey === key) return;
    posterKey = key; const serial = ++posterSerial; poster.dataset.key = key;
    const width = data.width || 1920, width2x = data.width2x || width * 2;
    const source = (selector, value) => { const node = picture.querySelector(selector); if (node) { if (value) node.srcset = value; else node.removeAttribute('srcset'); } };
    source('.journey-poster-mobile-avif', data.avifMobileSrc);
    source('.journey-poster-desktop-avif', data.avifSrc ? data.avifSrc + ' ' + width + 'w' + (data.avifSrc2x ? ', ' + data.avifSrc2x + ' ' + width2x + 'w' : '') : null);
    source('.journey-poster-mobile-webp', data.mobileSrc);
    poster.srcset = data.src + ' ' + width + 'w' + (data.src2x ? ', ' + data.src2x + ' ' + width2x + 'w' : '');
    poster.src = data.src;
    if (poster.decode) poster.decode().then(() => { if (serial === posterSerial && (slideshow() || !loaded)) picture.classList.add('is-visible'); }).catch(() => {});
  }
  function showChapter(index, announce = false) {
    if (index < 0 || index >= chapters.length) return;
    if (index === currentChapter) { if (announce) status.setAttribute('aria-live', 'polite'); return; }
    status.setAttribute('aria-live', announce ? 'polite' : 'off');
    currentChapter = index; setPoster(chapters[index].poster);
    panels.forEach((panel, i) => { const shown = i === index; panel.classList.toggle('is-active', shown); panel.setAttribute('aria-hidden', String(!shown)); panel.inert = !shown; });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.journeyStep) === index)));
    status.textContent = chapters[index].name + ' · ' + (index + 1) + ' / ' + chapters.length;
    journey.dataset.chapter = String(index);
  }
  function updateMode() {
    const paused = pausedByVisitor();
    journey.dataset.mode = slideshow() ? 'slideshow' : 'autoplay';
    journey.dataset.motionReason = suppliedStills ? 'supplied-visuals' : preference.matches ? 'reduced-motion' : saveData() ? 'save-data' : failed ? 'video-unavailable' : 'video';
    journey.dataset.pauseReason = userPaused ? 'user' : focusPaused ? 'keyboard-focus' : '';
    motionButton.hidden = false;
    motionButton.setAttribute('aria-pressed', String(!paused));
    motionButton.setAttribute('aria-label', paused ? 'Spustit automatickou prohlídku' : 'Pozastavit automatickou prohlídku');
    motionButton.querySelector('span').textContent = paused ? 'Spustit' : 'Pozastavit';
  }
  function stopStill() {
    if (!stillTimer) return;
    clearTimeout(stillTimer); stillTimer = 0;
    stillRemaining = Math.max(0, stillRemaining - (performance.now() - stillStarted));
  }
  function clearLoadTimer() { clearTimeout(loadTimer); loadTimer = 0; }
  function stop() { stopStill(); clearLoadTimer(); video.pause(); }
  function releaseVideo() {
    video.removeAttribute('src'); video.load(); selected = null; loaded = false; playPending = false;
    video.classList.remove('is-ready', 'is-decoded'); picture.classList.add('is-visible'); setLoading(false);
  }
  function useStills() {
    if (failed) return;
    failed = true; stop(); releaseVideo(); updateMode();
    stillRemaining = stillDuration(Math.max(0, currentChapter)); resume();
  }
  async function chooseVariant() {
    const mobile = portrait(), connection = navigator.connection;
    const constrained = connection && (/(^|-)2g$|3g/.test(connection.effectiveType || '') || connection.downlink > 0 && connection.downlink < 2.5);
    const lowPower = navigator.deviceMemory && navigator.deviceMemory <= 4;
    const pixels = Math.max(innerWidth, innerHeight * 16 / 9) * Math.min(devicePixelRatio || 1, 2);
    const maxWidth = constrained || lowPower ? 1920 : pixels > 2560 ? 3840 : pixels > 1600 ? 2560 : 1920;
    let choices = config.variants.filter(v => (mobile ? v.id.startsWith('mobile-') : v.id.startsWith('desktop-')) && video.canPlayType(v.type));
    if (mobile) { journey.dataset.mediaPolicy = 'portrait'; return choices[0] || null; }
    journey.dataset.mediaPolicy = constrained ? 'connection' : lowPower ? 'memory' : 'display';
    choices = choices.filter(v => v.width <= maxWidth).sort((a, b) => b.width - a.width);
    for (const candidate of choices) {
      if (candidate.type.includes('webm') && navigator.mediaCapabilities?.decodingInfo) {
        try {
          const info = await navigator.mediaCapabilities.decodingInfo({type:'file', video:{contentType:candidate.type.replace('"vp9"', '"vp09.00.50.08"'), width:candidate.width, height:candidate.height, bitrate:candidate.bitrate, framerate:config.fps || 24}});
          if (!info.supported || !info.smooth || candidate.width > 2560 && !info.powerEfficient) continue;
        } catch (_) { if (candidate.width > 2560) continue; }
      }
      return candidate;
    }
    return config.variants.find(v => v.id === 'desktop-1080-h264' && video.canPlayType(v.type)) || null;
  }
  function assignSource(candidate) {
    selected = candidate; loaded = false; pendingSeek = desiredTime;
    video.classList.remove('is-ready', 'is-decoded'); picture.classList.add('is-visible');
    video.muted = true; video.defaultMuted = true; video.playsInline = true;
    // Explicit play() is gated by visibility and visitor intent on every source change.
    video.autoplay = false; video.removeAttribute('autoplay');
    ['muted', 'playsinline', 'webkit-playsinline'].forEach(name => video.setAttribute(name, ''));
    video.loop = true; video.preload = 'auto'; video.src = candidate.src;
    journey.dataset.quality = candidate.id; setLoading(true); video.load(); watchVideo();
  }
  function watchVideo() {
    if (!loadTimer && active() && !slideshow() && (choosing || selected)) {
      loadTimer = setTimeout(() => { loadTimer = 0; if (active() && !slideshow()) useStills(); }, 8000);
    }
  }
  async function ensureVideo(force = false) {
    if (!active() || slideshow() || choosing || selected && !force) return;
    choosing = true; watchVideo();
    const candidate = await chooseVariant(); choosing = false;
    if (!active() || slideshow()) return;
    if (!candidate) { useStills(); return; }
    if (selected?.id === candidate.id) { resume(); return; }
    fallbackUsed = false; assignSource(candidate);
  }
  async function play() {
    if (playPending || !video.paused || !active() || slideshow() || !loaded || video.seeking) return;
    playPending = true;
    try {
      await video.play(); playPending = false;
      if (!active() || slideshow()) video.pause();
    } catch (error) {
      playPending = false;
      if (error?.name !== 'AbortError' && !slideshow()) useStills();
    }
  }
  function resume() {
    if (!active()) { stop(); return; }
    if (slideshow()) {
      video.pause(); picture.classList.add('is-visible');
      if (!stillTimer) {
        stillStarted = performance.now();
        stillTimer = setTimeout(() => { stillTimer = 0; goTo((currentChapter + 1) % chapters.length, false); }, stillRemaining);
      }
      return;
    }
    // A rotation can happen while paused or offscreen; reselect on the next resume too.
    if (selected && selected.id.startsWith('mobile-') !== portrait()) {
      video.pause(); ensureVideo(true); watchVideo(); return;
    }
    ensureVideo(); watchVideo(); play();
  }
  function visibility() {
    const rect = journey.getBoundingClientRect();
    visible = rect.bottom > 100 && rect.top < innerHeight - 100;
    journey.dataset.visible = String(visible);
    document.body.classList.toggle('is-cinematic', rect.bottom > 88 && rect.top < 88);
    resume();
  }
  function frameChanged() {
    if (slideshow() || !loaded || video.seeking) return;
    desiredTime = clampTime(video.currentTime);
    if (Math.abs(video.currentTime - lastMediaTime) > .01) { lastMediaTime = video.currentTime; clearLoadTimer(); watchVideo(); }
    let index = 0;
    chapterTimes.forEach((time, i) => { if (video.currentTime >= time) index = i; });
    showChapter(index);
    if (video.readyState >= 2) { video.classList.add('is-ready'); picture.classList.remove('is-visible'); setLoading(false); }
    if (progress) progress.style.transform = 'scaleX(' + Math.min(1, video.currentTime / config.duration).toFixed(4) + ')';
  }
  function applySeek() {
    if (pendingSeek === null || video.readyState < 1) return;
    const target = pendingSeek; pendingSeek = null;
    if (Math.abs(video.currentTime - target) > .025) video.currentTime = target;
    else frameChanged();
  }
  video.addEventListener('loadeddata', () => {
    if (slideshow()) { video.pause(); return; }
    loaded = true; clearLoadTimer(); setLoading(false); applySeek(); frameChanged(); resume();
  });
  video.addEventListener('seeked', () => { frameChanged(); resume(); });
  video.addEventListener('timeupdate', frameChanged); video.addEventListener('playing', frameChanged); video.addEventListener('canplay', resume);
  video.addEventListener('ended', () => { if (!slideshow()) { desiredTime = 0; pendingSeek = 0; applySeek(); resume(); } });
  ['waiting', 'stalled'].forEach(name => video.addEventListener(name, () => { if (active() && !slideshow()) { setLoading(true); watchVideo(); } }));
  video.addEventListener('error', () => {
    if (slideshow()) return;
    const fallback = config.variants.find(v => v.id === (portrait() ? 'mobile-1080-h264' : 'desktop-1080-h264'));
    if (!fallbackUsed && fallback && selected?.id !== fallback.id) { fallbackUsed = true; assignSource(fallback); return; }
    useStills();
  });
  function goTo(index, announce = true) {
    if (!Number.isInteger(index) || index < 0 || index >= chapters.length) return;
    stop(); desiredTime = chapterSeekTimes[index]; pendingSeek = desiredTime;
    stillRemaining = stillDuration(index); showChapter(index, announce); picture.classList.add('is-visible');
    if (progress) progress.style.transform = 'scaleX(' + (slideshow() ? index / Math.max(1, chapters.length - 1) : desiredTime / config.duration).toFixed(4) + ')';
    if (!slideshow() && loaded) applySeek();
    updateMode(); resume();
  }
  document.addEventListener('keydown', event => { if (!event.metaKey && !event.ctrlKey && !event.altKey) keyboardInput = true; }, true);
  document.addEventListener('pointerdown', event => {
    keyboardInput = false;
    // Keep focus-pause until the motion button can explicitly resume it.
    if (focusPaused && !motionButton.contains(event.target)) { focusPaused = false; updateMode(); resume(); }
  }, true);
  buttons.forEach(button => button.addEventListener('click', event => {
    if (event.detail > 0) { focusPaused = false; keyboardInput = false; }
    goTo(Number(button.dataset.journeyStep));
  }));
  journey.querySelectorAll('[data-journey-next]').forEach(link => link.addEventListener('click', event => {
    if (currentChapter >= chapters.length - 1) return;
    event.preventDefault();
    if (event.detail > 0) { focusPaused = false; keyboardInput = false; }
    goTo(currentChapter + 1);
    if (keyboardInput) buttons.find(button => Number(button.dataset.journeyStep) === currentChapter)?.focus({preventScroll:true});
  }));
  motionButton.addEventListener('click', () => {
    const resumeRequested = pausedByVisitor();
    userPaused = !resumeRequested; focusPaused = false;
    updateMode(); resume();
  });
  journey.addEventListener('focusin', event => {
    if (event.target !== motionButton && keyboardInput) { focusPaused = true; updateMode(); stop(); }
  });
  journey.addEventListener('focusout', event => {
    if (!journey.contains(event.relatedTarget)) { focusPaused = false; updateMode(); resume(); }
  });
  panels.forEach(panel => { panel.hidden = false; }); journey.querySelector('.journey-rail').hidden = false;
  document.body.classList.add('has-journey-motion'); updateMode(); showChapter(0); visibility();
  // Scrolling only suspends offscreen media; it never changes the film time.
  window.addEventListener('scroll', visibility, {passive:true});
  window.addEventListener('resize', () => {
    visibility(); clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (selected && selected.id.startsWith('mobile-') !== portrait()) { stop(); ensureVideo(true); } }, 180);
  }, {passive:true});
  window.addEventListener('load', visibility, {once:true}); window.addEventListener('pageshow', visibility);
  document.addEventListener('visibilitychange', visibility);
  function preferenceChanged() {
    const wasSlideshow = journey.dataset.mode === 'slideshow';
    stop();
    if (slideshow()) { releaseVideo(); stillRemaining = stillDuration(Math.max(0, currentChapter)); }
    else if (wasSlideshow) { desiredTime = chapterTimes[Math.max(0, currentChapter)]; pendingSeek = desiredTime; }
    updateMode(); resume();
  }
  preference.addEventListener('change', preferenceChanged);
  navigator.connection?.addEventListener?.('change', preferenceChanged);
})();
