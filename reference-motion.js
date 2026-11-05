/* Automatic, pausable film. Native page scrolling never controls the camera. */
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
  if (!Array.isArray(config.chapters) || config.chapters.length !== panels.length || !config.variants || !config.posters) return;
  const chapters = config.chapters, end = Math.max(0, config.duration - 1 / (config.fps || 24));
  const timeFor = key => Math.min(end, config.posters[key]?.time || 0);
  const living = timeFor('living'), kitchen = timeFor('kitchen'), bedroom = timeFor('bedroom'), bathroom = timeFor('bathroom');
  // Readable pauses use the original sharp stills; travel runs at native video speed.
  const filmSequence = [
    {chapter:0,time:0,hold:1200}, {chapter:1,from:0,to:living},
    {chapter:2,time:living,hold:3500}, {chapter:3,from:living,to:kitchen},
    {chapter:3,time:kitchen,hold:3500}, {chapter:4,from:kitchen,to:bedroom},
    {chapter:4,time:bedroom,hold:3500}, {chapter:5,from:bedroom,to:bathroom},
    {chapter:5,time:bathroom,hold:4500}, {chapter:6,time:bathroom,hold:5500}
  ];
  // No camera motion or video download is needed for the automatic still sequence.
  const stillSequence = chapters.map((chapter,index) => ({chapter:index,time:timeFor(chapter.poster),hold:index === 0 ? 1200 : index === chapters.length-1 ? 5500 : 4500}));
  let sequence = preference.matches || saveData() ? stillSequence : filmSequence;
  let segment = 0, currentChapter = -1, visible = false, userPaused = false, focusPaused = false;
  let selected = null, choosing = false, loaded = false, failed = false, fallbackUsed = false;
  let holdTimer = 0, holdStarted = 0, holdRemaining = sequence[0].hold;
  let posterKey = '', posterSerial = 0, playPending = false, resizeTimer = 0, loadTimer = 0, lastMediaTime = 0;
  const slideshow = () => preference.matches || saveData() || failed;
  // Let a direct deep link settle below the hero before starting any download.
  const waitingForAnchor = () => document.readyState !== 'complete' && window.location?.hash && !['#','#top','#residence-journey'].includes(window.location.hash);
  const active = () => visible && !document.hidden && !waitingForAnchor() && !userPaused && !focusPaused;
  const portrait = () => innerWidth <= 700 && innerHeight > innerWidth;
  const current = () => sequence[segment];
  function setLoading(on) { video.setAttribute('aria-busy',String(on)); loadingStatus.hidden = !on; }
  function setPoster(key) {
    const data = config.posters[key];
    if (!data || posterKey === key) return;
    posterKey = key; const serial = ++posterSerial; poster.dataset.key = key;
    const source = (selector,value) => { const node = picture.querySelector(selector); if (node && value) node.srcset = value; };
    source('.journey-poster-mobile-avif',data.avifMobileSrc);
    source('.journey-poster-desktop-avif',data.avifSrc && data.avifSrc + ' 1920w, ' + data.avifSrc2x + ' 3840w');
    source('.journey-poster-mobile-webp',data.mobileSrc);
    poster.srcset = data.src + ' 1920w, ' + data.src2x + ' 3840w'; poster.src = data.src;
    if (poster.decode) poster.decode().then(() => { if (serial === posterSerial && current().hold) picture.classList.add('is-visible'); }).catch(() => {});
  }
  function showChapter(index, announce = false) {
    status.setAttribute('aria-live',announce ? 'polite' : 'off');
    if (index === currentChapter) return;
    currentChapter = index; setPoster(chapters[index].poster);
    panels.forEach((panel,i) => { const shown = i === index; panel.classList.toggle('is-active',shown); panel.setAttribute('aria-hidden',String(!shown)); panel.inert = !shown; });
    buttons.forEach((button,i) => button.setAttribute('aria-pressed',String(i === index)));
    status.textContent = chapters[index].name + ' · ' + (index + 1) + ' / ' + chapters.length;
    journey.dataset.chapter = String(index);
  }
  function updateMode() {
    journey.dataset.mode = slideshow() ? 'slideshow' : 'autoplay'; motionButton.hidden = false;
    journey.dataset.motionReason = preference.matches ? 'reduced-motion' : saveData() ? 'save-data' : failed ? 'video-unavailable' : 'video';
    motionButton.setAttribute('aria-pressed',String(!userPaused));
    motionButton.setAttribute('aria-label',userPaused ? 'Spustit automatickou prohlídku' : 'Pozastavit automatickou prohlídku');
    motionButton.querySelector('span').textContent = userPaused ? 'Spustit' : 'Pozastavit';
    // Automatic changes must not interrupt a screen reader. Manual choices are announced.
    status.setAttribute('aria-live','off');
  }
  function stopHold() {
    if (!holdTimer) return;
    clearTimeout(holdTimer); holdTimer = 0;
    holdRemaining = Math.max(0,holdRemaining-(performance.now()-holdStarted));
  }
  function clearLoadTimer() { clearTimeout(loadTimer); loadTimer = 0; }
  function stop() { stopHold(); clearLoadTimer(); video.pause(); }
  function useStills() {
    if (failed) return;
    failed = true; stop(); playPending = false; loaded = false;
    video.classList.remove('is-ready'); video.classList.remove('is-decoded');
    video.removeAttribute('src'); video.load(); selected = null;
    setLoading(false); updateMode(); sequence = stillSequence;
    enter(Math.max(0,currentChapter));
  }
  function enter(index, announce = false) {
    stop(); segment = index; holdRemaining = current().hold || 0;
    showChapter(current().chapter,announce); picture.classList.add('is-visible');
    if (loaded && !slideshow()) { const target = current().hold ? current().time : current().from; if (Math.abs(video.currentTime-target) > .035) video.currentTime = target; }
    lastMediaTime = video.currentTime;
    if (progress) progress.style.transform = 'scaleX(' + (segment/(sequence.length-1)).toFixed(4) + ')';
    resume();
  }
  function next() { enter((segment+1)%sequence.length); }
  async function chooseVariant() {
    const mobile = portrait(), connection = navigator.connection;
    const constrained = connection && (/(^|-)2g$|3g/.test(connection.effectiveType || '') || connection.downlink > 0 && connection.downlink < 2.5);
    const lowPower = navigator.deviceMemory && navigator.deviceMemory <= 4;
    const pixels = Math.max(innerWidth,innerHeight*16/9)*Math.min(devicePixelRatio || 1,2);
    const maxWidth = constrained || lowPower ? 1920 : pixels > 2560 ? 3840 : pixels > 1600 ? 2560 : 1920;
    let choices = config.variants.filter(v => (mobile ? v.id.startsWith('mobile-') : v.id.startsWith('desktop-')) && video.canPlayType(v.type));
    if (mobile) { journey.dataset.mediaPolicy = 'portrait'; return choices[0] || null; }
    journey.dataset.mediaPolicy = constrained ? 'connection' : lowPower ? 'memory' : 'display';
    choices = choices.filter(v => v.width <= maxWidth).sort((a,b) => b.width-a.width);
    for (const candidate of choices) {
      if (candidate.type.includes('webm') && navigator.mediaCapabilities?.decodingInfo) {
        try {
          const info = await navigator.mediaCapabilities.decodingInfo({type:'file',video:{contentType:candidate.type.replace('"vp9"','"vp09.00.50.08"'),width:candidate.width,height:candidate.height,bitrate:candidate.bitrate,framerate:config.fps || 24}});
          if (!info.supported || !info.smooth || candidate.width > 2560 && !info.powerEfficient) continue;
        } catch (_) { if (candidate.width > 2560) continue; }
      }
      return candidate;
    }
    return config.variants.find(v => v.id === 'desktop-1080-h264') || null;
  }
  function assignSource(candidate) {
    selected = candidate; loaded = false;
    video.classList.remove('is-ready'); video.classList.remove('is-decoded'); picture.classList.add('is-visible');
    video.muted = true; video.defaultMuted = true; video.playsInline = true; video.autoplay = true;
    ['muted','playsinline','webkit-playsinline','autoplay'].forEach(name => video.setAttribute(name,''));
    video.loop = false; video.preload = 'auto'; video.src = candidate.src;
    journey.dataset.quality = candidate.id; setLoading(true); video.load();
    watchVideo();
  }
  function watchVideo() {
    // A stalled decoder, unresolved play promise or buffering stream must not freeze the tour.
    if (!loadTimer && active() && !slideshow() && (choosing || selected) && (!loaded || !current().hold)) {
      loadTimer = setTimeout(() => { loadTimer = 0; if (active() && !slideshow()) useStills(); },8000);
    }
  }
  async function ensureVideo(force = false) {
    if (!active() || slideshow() || choosing || selected && !force) return;
    choosing = true; watchVideo(); const candidate = await chooseVariant(); choosing = false;
    if (!active() || slideshow()) return;
    if (!candidate) { useStills(); return; }
    if (selected?.id === candidate.id) return;
    fallbackUsed = false; assignSource(candidate);
  }
  async function play() {
    if (playPending || !video.paused || !active() || slideshow() || current().hold || !loaded || video.seeking) return;
    playPending = true;
    try {
      await video.play(); playPending = false; if (!active() || slideshow() || current().hold) video.pause();
    } catch (error) {
      playPending = false; if (error?.name === 'AbortError' || slideshow()) return;
      useStills();
    }
  }
  function resume() {
    if (!active()) { stop(); return; }
    ensureVideo(); watchVideo();
    if (current().hold) {
      video.pause();
      if (!holdTimer) { holdStarted = performance.now(); holdTimer = setTimeout(() => { holdTimer = 0; holdRemaining = 0; next(); },holdRemaining); }
    } else play();
  }
  function visibility() {
    const rect = journey.getBoundingClientRect();
    visible = rect.bottom > 100 && rect.top < innerHeight-100;
    journey.dataset.visible = String(visible);
    document.body.classList.toggle('is-cinematic',rect.bottom > 88 && rect.top < 88);
    resume();
  }
  function frameChanged() {
    if (slideshow() || current().hold || !loaded) return;
    if (Math.abs(video.currentTime-lastMediaTime) > .01) { lastMediaTime = video.currentTime; clearLoadTimer(); watchVideo(); }
    if (video.currentTime >= current().to-.04) { next(); return; }
    let chapter = 0;
    chapters.slice(0,-1).forEach((entry,i) => { if (video.currentTime >= entry.mediaStart) chapter = i; });
    showChapter(chapter);
    if (!video.seeking && video.readyState >= 2) { video.classList.add('is-ready'); picture.classList.remove('is-visible'); setLoading(false); }
    if (progress) {
      const part = Math.max(0,Math.min(1,(video.currentTime-current().from)/(current().to-current().from)));
      progress.style.transform = 'scaleX(' + ((segment+part)/(sequence.length-1)).toFixed(4) + ')';
    }
  }
  video.addEventListener('loadeddata',() => {
    if (slideshow()) { video.pause(); return; }
    loaded = true; clearLoadTimer(); setLoading(false);
    const target = current().hold ? current().time : current().from;
    if (Math.abs(video.currentTime-target) > .035) video.currentTime = target;
    resume();
  });
  video.addEventListener('seeked',() => { frameChanged(); resume(); });
  video.addEventListener('timeupdate',frameChanged); video.addEventListener('playing',frameChanged); video.addEventListener('canplay',resume);
  video.addEventListener('ended',() => { if (!slideshow() && !current().hold) next(); });
  ['waiting','stalled'].forEach(name => video.addEventListener(name,() => { if (active() && !slideshow() && !current().hold) { setLoading(true); watchVideo(); } }));
  video.addEventListener('error',() => {
    if (slideshow()) return;
    const fallback = config.variants.find(v => v.id === (portrait() ? 'mobile-1080-h264' : 'desktop-1080-h264'));
    if (!fallbackUsed && fallback && selected?.id !== fallback.id) { fallbackUsed = true; assignSource(fallback); return; }
    useStills();
  });
  function goTo(index, announce = true) {
    if (!Number.isInteger(index) || index < 0 || index >= chapters.length) return;
    const target = slideshow() ? index : [0,1,2,4,6,8,9][index];
    enter(target,announce);
  }
  buttons.forEach(button => button.addEventListener('click',() => goTo(Number(button.dataset.journeyStep))));
  journey.querySelectorAll('[data-journey-next]').forEach(link => link.addEventListener('click',event => {
    if (currentChapter >= panels.length-1) return;
    event.preventDefault(); goTo(currentChapter+1);
    buttons[currentChapter]?.focus({preventScroll:true});
  }));
  motionButton.addEventListener('click',() => { userPaused = !userPaused; updateMode(); focusPaused = false; resume(); });
  journey.addEventListener('focusin',event => { if (event.target === motionButton) return; focusPaused = true; stop(); });
  journey.addEventListener('focusout',event => { if (!journey.contains(event.relatedTarget)) { focusPaused = false; resume(); } });
  panels.forEach(panel => { panel.hidden = false; }); journey.querySelector('.journey-rail').hidden = false;
  document.body.classList.add('has-journey-motion'); updateMode(); showChapter(0); visibility();
  // Scroll only suspends offscreen media; it never seeks or transforms the camera.
  window.addEventListener('scroll',visibility,{passive:true});
  window.addEventListener('resize',() => {
    visibility(); clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (selected && selected.id.startsWith('mobile-') !== portrait()) { stop(); ensureVideo(true); } },180);
  },{passive:true});
  window.addEventListener('load',visibility,{once:true}); window.addEventListener('pageshow',visibility);
  document.addEventListener('visibilitychange',visibility);
  function preferenceChanged() {
    stop(); sequence = slideshow() ? stillSequence : filmSequence; updateMode();
    if (slideshow()) {
      video.removeAttribute('src'); video.load(); selected = null; loaded = false;
      video.classList.remove('is-ready'); setLoading(false);
    }
    goTo(Math.max(0,currentChapter),false);
  }
  preference.addEventListener('change',preferenceChanged);
  navigator.connection?.addEventListener?.('change',preferenceChanged);
})();
