/* Alexandra: guided native scroll, a forward-only film, and sharp resting frames. */
(() => {
  'use strict';
  const journey = document.querySelector('#residence-journey');
  if (!journey) return;
  const stage = journey.querySelector('.journey-stage');
  const video = journey.querySelector('.journey-film');
  const picture = journey.querySelector('.journey-picture');
  const poster = journey.querySelector('.journey-poster');
  const panels = Array.from(journey.querySelectorAll('[data-chapter]'));
  const buttons = Array.from(journey.querySelectorAll('[data-journey-step]'));
  const progress = journey.querySelector('.journey-progress');
  const motionButton = journey.querySelector('.journey-motion-toggle');
  const stepStatus = journey.querySelector('.journey-step-status');
  const loadingStatus = journey.querySelector('.journey-load-status');
  const credit = journey.querySelector('.journey-credit');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  let config;
  try { config = JSON.parse(document.querySelector('#journey-config').textContent); } catch (_) { config = { variants:[], posters:{}, fps:24, duration:15 }; }
  const fps = config.fps || 24;
  const validProgress = value => Number.isFinite(value) && value >= 0 && value <= 1;
  const validMediaTime = value => Number.isFinite(value) && value >= 0 && value <= config.duration;
  const customSchedule = Array.isArray(config.timeline) && config.timeline.length >= 2 &&
    config.timeline[0]?.progress === 0 && config.timeline[0]?.time === 0 &&
    config.timeline.at(-1)?.progress === 1 &&
    config.timeline.every((point, i, points) => point && validProgress(point.progress) && validMediaTime(point.time) &&
      (!i || point.progress > points[i - 1].progress && point.time >= points[i - 1].time)) &&
    Array.isArray(config.chapters) && config.chapters.length === panels.length && config.chapters.length > 0 &&
    config.chapters[0]?.start === 0 && config.chapters[0]?.mediaStart === 0 &&
    config.chapters.every((chapter, i, chapters) => chapter && typeof chapter.name === 'string' && chapter.name.trim() &&
      typeof chapter.poster === 'string' && config.posters && config.posters[chapter.poster] &&
      validProgress(chapter.start) && validProgress(chapter.destination) && validMediaTime(chapter.mediaStart) &&
      (chapter.minProgress === undefined || validProgress(chapter.minProgress)) &&
      (!i || chapter.start >= chapters[i - 1].start && chapter.mediaStart >= chapters[i - 1].mediaStart));
  const names = customSchedule ? config.chapters.map(chapter => chapter.name) : ['Dům', 'Vstup', 'Obývací pokoj', 'Kuchyně', 'Výběr bytu'];
  const destinations = customSchedule ? config.chapters.map(chapter => chapter.destination) : [0, .30, .56, .79, .95];
  const stops = customSchedule ? config.chapters.map(chapter => chapter.start) : [0, .08, .50, .65, .89];
  let target = 0, position = 0, manual = 0, frame = 0, lastTime = 0, currentChapter = -1;
  let top = 0, range = 1, totalHeight = 1, visible = true;
  let started = false, loading = false, failed = false, userPaused = false, pauseOrigin = 0, pauseStill = false;
  let selected = null, choosing = 0, loaded = false, presentedTime = 0, lastSeek = -100;
  let videoFrame = 0, posterKey = 'house', posterReady = true, resizeTimer = 0, fallbackUsed = false;
  let navigationFrame = 0, navigationSerial = 0;

  const baseStatic = () => preference.matches || saveData;
  const paused = () => baseStatic() || userPaused;
  const portrait = () => innerWidth <= 700 && innerHeight > innerWidth;
  function timeAt(p) {
    if (customSchedule) {
      const progress = clamp(p, 0, 1);
      for (let i = 1; i < config.timeline.length; i++) {
        const from = config.timeline[i - 1], to = config.timeline[i];
        if (progress <= to.progress) return from.time + (to.time - from.time) * (progress - from.progress) / (to.progress - from.progress);
      }
      return config.timeline.at(-1).time;
    }
    if (p <= .06) return 0;
    if (p < .50) return (p - .06) / .44 * 10;
    if (p <= .64) return 10;
    if (p < .88) return 10 + (p - .64) / .24 * 5;
    return 15;
  }
  function desiredTime() {
    const duration = Number.isFinite(video.duration) ? video.duration : config.duration;
    const end = Math.max(0, Math.round(duration * fps) - 1) / fps;
    return clamp(Math.round(timeAt(position) * fps) / fps, 0, end);
  }
  function chapterAt(p, time, useStills) {
    if (customSchedule && !useStills) {
      let i = 0;
      config.chapters.forEach((chapter, index) => {
        if (time >= chapter.mediaStart && p >= (chapter.minProgress || 0)) i = index;
      });
      return i;
    }
    if (useStills) {
      let i = 0;
      stops.forEach((stop, index) => { if (p >= stop) i = index; });
      return i;
    }
    // The caption follows the decoded scene, rather than jumping ahead of the film.
    if (time < .20 && p < .08) return 0;
    if (time < 9.45) return 1;
    if (time < 10.20) return 2;
    if (time < 14.70) return 3;
    return p >= .89 ? 4 : 3;
  }
  function posterFor(chapter) { return customSchedule ? config.chapters[chapter].poster : chapter < 2 ? 'house' : chapter === 2 ? 'living' : 'kitchen'; }
  function isResting(p) {
    if (!customSchedule) return p <= .06 || p >= .50 && p <= .64 || p >= .88;
    return config.timeline.some((from, i, points) => {
      const to = points[i + 1];
      return to && from.time === to.time && p >= from.progress && p <= to.progress;
    });
  }
  function setPoster(key) {
    const data = config.posters[key];
    if (!data || key === posterKey && poster.dataset.key === key) return;
    posterKey = key;
    posterReady = false;
    poster.dataset.key = key;
    const set = (selector, value) => { const node = picture.querySelector(selector); if (node && value) node.srcset = value; };
    set('.journey-poster-mobile-avif', data.avifMobileSrc);
    set('.journey-poster-desktop-avif', data.avifSrc ? data.avifSrc + ' 1920w, ' + data.avifSrc2x + ' 3840w' : null);
    set('.journey-poster-mobile-webp', data.mobileSrc);
    poster.srcset = data.src + ' 1920w, ' + data.src2x + ' 3840w';
    poster.src = data.src;
    if (poster.decode) poster.decode().then(() => { if (posterKey === key) { posterReady = true; schedule(); } }).catch(() => {});
  }
  poster.addEventListener('load', () => { posterReady = true; schedule(); });
  function setLoading(value) {
    loading = value;
    video.setAttribute('aria-busy', String(value));
    loadingStatus.hidden = !value;
  }
  function currentMode() {
    journey.dataset.mode = baseStatic() ? 'static' : 'scroll';
    motionButton.hidden = baseStatic() || failed;
    motionButton.setAttribute('aria-pressed', String(!userPaused));
    motionButton.setAttribute('aria-label', userPaused ? 'Zapnout animaci prohlídky' : 'Vypnout animaci prohlídky');
    motionButton.querySelector('span').textContent = userPaused ? 'Bez pohybu' : 'Animace';
  }
  function measure() {
    const rect = journey.getBoundingClientRect();
    top = window.scrollY + rect.top;
    totalHeight = journey.offsetHeight;
    range = Math.max(1, totalHeight - stage.offsetHeight);
    updateTarget();
  }
  function updateTarget() {
    const y = window.scrollY;
    visible = y + innerHeight > top && y < top + totalHeight;
    journey.dataset.visible = String(visible);
    document.body.classList.toggle('is-cinematic', y > top - 80 && y < top + totalHeight - 80);
    target = baseStatic() ? manual : clamp((y - top) / range, 0, 1);
    if (target > .005) started = true;
    schedule();
  }
  function mediaURL(path) {
    // The legacy 8765 preview cannot seek byte ranges. The auxiliary preview
    // serves the same workspace with proper ranges, without replacing that server.
    if ((location.hostname === '127.0.0.1' || location.hostname === 'localhost') && location.port === '8765') {
      return 'http://' + location.hostname + ':8766/' + path;
    }
    return path;
  }
  async function chooseVariant() {
    const mobile = portrait();
    const connection = navigator.connection;
    const localPreview = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
    const constrained = !localPreview && connection && /(^|-)2g$|3g/.test(connection.effectiveType || '');
    const limitedBandwidth = !localPreview && connection && connection.downlink > 0 && connection.downlink < 2.5;
    const pixels = Math.max(innerWidth, innerHeight * 16 / 9) * Math.min(devicePixelRatio || 1, 2);
    const lowPower = navigator.deviceMemory && navigator.deviceMemory <= 4;
    let choices = config.variants.filter(v => (mobile ? v.id.startsWith('mobile-') : v.id.startsWith('desktop-')) && video.canPlayType(v.type));
    if (!choices.length) return null;
    if (mobile) { journey.dataset.mediaPolicy = 'portrait'; return choices[0]; }
    const width = constrained || lowPower ? 1920 : pixels > 2560 && !limitedBandwidth ? 3840 : pixels > 1600 ? 2560 : 1920;
    journey.dataset.mediaPolicy = constrained || limitedBandwidth ? 'connection' : lowPower ? 'memory' : 'display';
    choices = choices.filter(v => v.width <= width).sort((a, b) => b.width - a.width);
    for (const candidate of choices) {
      if (candidate.type.indexOf('webm') >= 0 && navigator.mediaCapabilities && navigator.mediaCapabilities.decodingInfo) {
        try {
          const contentType = candidate.type.replace('"vp9"', '"vp09.00.50.08"');
          const result = await navigator.mediaCapabilities.decodingInfo({type:'file',video:{contentType:contentType,width:candidate.width,height:candidate.height,bitrate:candidate.bitrate,framerate:fps}});
          if (!result.supported || !result.smooth || candidate.width > 2560 && !result.powerEfficient) { journey.dataset.mediaPolicy = 'decoder'; continue; }
        } catch (_) { if (candidate.width > 2560) continue; }
      }
      if (candidate.width < width) journey.dataset.mediaPolicy = 'decoder';
      return candidate;
    }
    return config.variants.find(v => v.id === 'desktop-1080-h264') || null;
  }
  function resetPresentation() {
    loaded = false;
    video.classList.remove('is-ready');
    video.classList.remove('is-decoded');
    if (videoFrame && video.cancelVideoFrameCallback) { video.cancelVideoFrameCallback(videoFrame); videoFrame = 0; }
  }
  async function loadVideo(force) {
    if (baseStatic() || userPaused || failed || !visible || document.hidden || document.readyState !== 'complete' || !started) return;
    if (selected && !force || choosing) return;
    const ticket = ++choosing;
    const next = await chooseVariant();
    if (ticket !== choosing) return;
    choosing = 0;
    if (!next) { failed = true; currentMode(); schedule(); return; }
    if (!visible || document.hidden || baseStatic() || userPaused) return;
    if (selected && selected.id === next.id) return;
    selected = next;
    resetPresentation();
    fallbackUsed = false;
    video.muted = true;
    video.preload = 'auto';
    video.src = mediaURL(next.src);
    journey.dataset.quality = next.id;
    setLoading(true);
    video.load();
  }
  function acceptFrame(time) {
    presentedTime = time;
    if (video.classList.contains('is-ready') || Math.abs(time - desiredTime()) < .12) {
      video.classList.add('is-ready');
      setLoading(false);
    }
    schedule();
  }
  function observeFrames() {
    if (!video.requestVideoFrameCallback || videoFrame) return;
    videoFrame = video.requestVideoFrameCallback((_, metadata) => {
      videoFrame = 0;
      acceptFrame(metadata.mediaTime);
      observeFrames();
    });
  }
  video.addEventListener('loadeddata', () => {
    loaded = true;
    video.classList.add('is-decoded');
    if (Math.abs(video.currentTime - desiredTime()) < .09) {
      presentedTime = video.currentTime;
      video.classList.add('is-ready');
      setLoading(false);
    }
    observeFrames();
    schedule();
  });
  video.addEventListener('seeked', () => {
    if (!video.requestVideoFrameCallback) {
      const decoded = video.currentTime;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!video.seeking && Math.abs(video.currentTime - decoded) < .021) acceptFrame(decoded);
      }));
    }
    schedule();
  });
  video.addEventListener('progress', schedule);
  video.addEventListener('canplay', schedule);
  video.addEventListener('error', () => {
    const fallback = config.variants.find(v => v.id === (portrait() ? 'mobile-1080-h264' : 'desktop-1080-h264'));
    if (!fallbackUsed && fallback) {
      fallbackUsed = true;
      resetPresentation();
      selected = fallback;
      journey.dataset.quality = fallback.id;
      // A missing local helper can safely use the already published media.
      video.src = location.port === '8765' ? 'https://majkpowa.github.io/rezidence-alexandra/' + fallback.src : mediaURL(fallback.src);
      setLoading(true);
      video.load();
      schedule();
      return;
    }
    failed = true;
    resetPresentation();
    setLoading(false);
    currentMode();
    schedule();
  });
  function seek(time) {
    if (!loaded || paused() || failed || video.readyState < 2 || !Number.isFinite(video.duration)) return false;
    const wanted = desiredTime();
    if (Math.abs(video.currentTime - wanted) < .021 || video.seeking) return false;
    // One latest target, at up to the source frame rate; never a backlog of seeks.
    if (time - lastSeek < 1000 / fps) return true;
    lastSeek = time;
    video.currentTime = wanted;
    return false;
  }
  function render(time) {
    if (userPaused && Math.abs(position - pauseOrigin) > .008) pauseStill = true;
    const stillMode = baseStatic() || failed || pauseStill || !loaded || !video.classList.contains('is-ready');
    const shownTime = userPaused && !pauseStill ? presentedTime : stillMode ? timeAt(position) : presentedTime;
    const chapter = chapterAt(position, shownTime, stillMode);
    const resting = isResting(position);
    const key = posterFor(chapter);
    setPoster(key);
    const aligned = Math.abs(shownTime - timeAt(position)) < .12;
    picture.classList.toggle('is-visible', !video.classList.contains('is-ready') || stillMode || resting && aligned && posterReady);
    if (chapter !== currentChapter) {
      currentChapter = chapter;
      panels.forEach((panel, i) => {
        const active = i === chapter;
        panel.classList.toggle('is-active', active);
        panel.setAttribute('aria-hidden', String(!active));
        panel.inert = !active;
      });
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === chapter)));
      stepStatus.textContent = names[chapter] + ' · ' + (chapter + 1) + ' / ' + names.length;
      credit.textContent = 'Vizualizace projektu';
      journey.dataset.chapter = String(chapter);
    }
    if (progress) progress.style.transform = 'scaleX(' + position.toFixed(5) + ')';
    if (visible) { loadVideo(false); return seek(time); }
    return false;
  }
  function tick(time) {
    frame = 0;
    const dt = Math.min(50, lastTime ? time - lastTime : 16);
    lastTime = time;
    position = paused() ? target : position + (target - position) * (1 - Math.exp(-dt / 36));
    if (Math.abs(target - position) < .00015) position = target;
    const pending = render(time);
    if (visible && (Math.abs(target - position) >= .00015 || pending)) frame = requestAnimationFrame(tick);
    else lastTime = 0;
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(tick); }
  function cancelNavigation() {
    navigationSerial++;
    if (navigationFrame) cancelAnimationFrame(navigationFrame);
    navigationFrame = 0;
  }
  function goTo(index) {
    if (!Number.isInteger(index) || index < 0 || index >= destinations.length) return;
    cancelNavigation();
    started = true;
    if (baseStatic()) {
      manual = destinations[index];
      target = manual;
      schedule();
      return;
    }
    const destination = destinations[index];
    const destinationY = top + range * destination;
    const fromY = window.scrollY;
    if (userPaused || Math.abs(destinationY - fromY) < 1) {
      window.scrollTo({top:destinationY,behavior:'instant'});
      return;
    }
    const duration = clamp(Math.abs(timeAt(destination) - desiredTime()) * 250, 900, 1700);
    const serial = navigationSerial;
    let began = null;
    function advanceNavigation(now) {
      if (serial !== navigationSerial) return;
      navigationFrame = 0;
      if (began === null) began = now;
      const amount = clamp((now - began) / duration, 0, 1);
      const eased = (1 - Math.cos(Math.PI * amount)) / 2;
      window.scrollTo({top:fromY + (destinationY - fromY) * eased,behavior:'instant'});
      if (amount < 1) navigationFrame = requestAnimationFrame(advanceNavigation);
    }
    navigationFrame = requestAnimationFrame(advanceNavigation);
  }
  buttons.forEach(button => button.addEventListener('click', () => goTo(Number(button.dataset.journeyStep))));
  journey.querySelectorAll('[data-journey-next]').forEach(link => link.addEventListener('click', event => {
    if (currentChapter >= panels.length - 1) return;
    event.preventDefault();
    goTo(currentChapter + 1);
  }));
  motionButton.addEventListener('click', () => {
    cancelNavigation();
    userPaused = !userPaused;
    pauseOrigin = position;
    pauseStill = false;
    if (userPaused) video.pause();
    currentMode();
    if (!userPaused) loadVideo(true);
    schedule();
  });
  panels.forEach(panel => { panel.hidden = false; });
  journey.querySelector('.journey-rail').hidden = false;
  document.body.classList.add('has-journey-motion');
  currentMode();
  measure();
  window.addEventListener('scroll', updateTarget, {passive:true});
  ['wheel','touchstart','pointerdown'].forEach(type => window.addEventListener(type, cancelNavigation, {passive:true}));
  window.addEventListener('keydown', cancelNavigation);
  window.addEventListener('hashchange', cancelNavigation);
  window.addEventListener('resize', () => {
    cancelNavigation();
    const keepPosition = visible && !baseStatic() && window.scrollY >= top && window.scrollY <= top + range;
    const previousPosition = position;
    const previousRange = range;
    measure();
    if (keepPosition && Math.abs(previousRange - range) > 1) {
      window.scrollTo({top:top + range * previousPosition,behavior:'instant'});
      updateTarget();
    }
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!selected || !started || !visible) return;
      const mobileNow = portrait();
      const wasMobile = selected.id.startsWith('mobile-');
      if (mobileNow !== wasMobile || !mobileNow && innerWidth * Math.min(devicePixelRatio || 1, 2) > selected.width * 1.4) loadVideo(true);
    }, 180);
  }, {passive:true});
  window.addEventListener('load', () => { measure(); schedule(); }, {once:true});
  window.addEventListener('pageshow', measure);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelNavigation(); if (frame) cancelAnimationFrame(frame); frame = 0; video.pause(); }
    else { measure(); observeFrames(); }
  });
  preference.addEventListener('change', () => { cancelNavigation(); pauseStill = false; currentMode(); measure(); if (!baseStatic()) loadVideo(true); });
})();
