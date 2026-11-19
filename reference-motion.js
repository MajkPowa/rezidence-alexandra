(function (){
  'use strict';
  const hero = document.getElementById('residence-journey');
  const video = hero?.querySelector('.journey-film');
  const picture = hero?.querySelector('picture');
  const preferenceButton = document.getElementById('hero-motion-preference');
  if (!video || !picture) return;
  const config = JSON.parse(document.getElementById('journey-config').textContent);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const portrait = matchMedia('(max-width: 700px) and (orientation: portrait)');
  const connection = navigator.connection;
  const preferenceKey = 'alexandra-hero-still';
  let userStill = false;
  try { userStill = localStorage.getItem(preferenceKey) === 'true'; } catch {}
  let inView = false;
  let generation = 0;
  let selecting = false;
  let source;
  let resumeAt = 0;
  let unavailable = false;
  let useH264 = false;
  const allowMotion = () => !userStill && !reduced.matches && !connection?.saveData;
  const shouldPlay = () => inView && !document.hidden && allowMotion() && !unavailable;

  function showPhoto() {
    video.classList.remove('is-ready');
    picture.classList.add('is-visible');
  }
  function releaseSource() {
    generation++;
    selecting = false;
    if (source) {
      resumeAt = video.readyState >= 1 ? video.currentTime : resumeAt;
      source = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    showPhoto();
  }
  async function chooseSource() {
    const mobile = portrait.matches;
    const pixels = Math.max(innerWidth, innerHeight * 16 / 9) * Math.min(devicePixelRatio, 2);
    const constrained = /2g|3g/.test(connection?.effectiveType || '') || (connection?.downlink > 0 && connection.downlink < 2.5) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
    const target = constrained || useH264 ? 1920 : pixels > 2560 ? 3840 : pixels > 1600 ? 2560 : 1920;
    const choices = config.variants.filter(item => item.id.startsWith(mobile ? 'mobile-' : 'desktop-') && item.width <= target && video.canPlayType(item.type)).sort((a, b) => b.width - a.width);
    for (const item of choices) {
      if (item.type.includes('vp9') && navigator.mediaCapabilities?.decodingInfo) {
        try {
          const info = await navigator.mediaCapabilities.decodingInfo({type:'file',video:{contentType:item.type.replace('"vp9"', '"vp09.00.50.08"'),width:item.width,height:item.height,bitrate:item.bitrate,framerate:config.fps}});
          if (!info.supported || !info.smooth || (item.width > 2560 && !info.powerEfficient)) continue;
        } catch { if (item.width > 2560) continue; }
      }
      return item;
    }
    return null;
  }
  async function reconcile() {
    if (!shouldPlay()) {
      video.pause();
      if (!allowMotion()) releaseSource();
      return;
    }
    if (selecting) return;
    const request = generation;
    if (!source) {
      selecting = true;
      const chosen = await chooseSource();
      if (request !== generation) return;
      selecting = false;
      if (!shouldPlay()) return;
      if (!chosen) { unavailable = true; return; }
      source = chosen;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.src = chosen.src;
    }
    try {
      if (video.paused) await video.play();
      if (request === generation && !shouldPlay()) video.pause();
    } catch (error) {
      if (request === generation && error.name !== 'AbortError' && error.name !== 'NotSupportedError') {
        unavailable = true;
        showPhoto();
      }
    }
  }
  function visibility() {
    const rect = hero.getBoundingClientRect();
    inView = rect.bottom > 64 && rect.top < innerHeight - 64;
    if (location.hash && !['#top','#residence-journey'].includes(location.hash) && document.readyState !== 'complete') inView = false;
    document.body.classList.toggle('is-cinematic', rect.bottom > 88);
    reconcile();
  }
  function preferenceChanged() {
    unavailable = false;
    if (preferenceButton) {
      preferenceButton.hidden = reduced.matches || Boolean(connection?.saveData);
      preferenceButton.setAttribute('aria-pressed', String(userStill));
    }
    visibility();
  }
  video.removeAttribute('autoplay');
  video.addEventListener('loadedmetadata', () => {
    if (source && resumeAt > 0 && Number.isFinite(video.duration)) {
      video.currentTime = Math.min(resumeAt, Math.max(0, video.duration - 0.1));
      resumeAt = 0;
    }
  });
  video.addEventListener('playing', () => {
    if (!shouldPlay()) { video.pause(); return; }
    video.classList.add('is-ready');
    picture.classList.remove('is-visible');
  });
  video.addEventListener('error', () => {
    if (!source) return;
    if (source.type.includes('vp9') && !useH264) {
      useH264 = true;
      releaseSource();
      reconcile();
    } else {
      unavailable = true;
      releaseSource();
    }
  });
  preferenceButton?.addEventListener('click', () => {
    userStill = !userStill;
    try { localStorage.setItem(preferenceKey, String(userStill)); } catch {}
    preferenceChanged();
  });
  portrait.addEventListener('change', () => {
    unavailable = false;
    releaseSource();
    visibility();
  });
  reduced.addEventListener('change', preferenceChanged);
  connection?.addEventListener('change', preferenceChanged);
  const observer = new IntersectionObserver(visibility, {threshold:[0, 0.1, 1]});
  observer.observe(hero);
  window.addEventListener('pageshow', visibility);
  window.addEventListener('load', visibility, {once:true});
  document.addEventListener('visibilitychange', visibility);
  preferenceChanged();
})();
