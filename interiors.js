(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
  const params = new URLSearchParams(location.search);
  const typologies = ['1+kk', '2+kk', '3+kk'];
  const rooms = ['Obývací pokoj', 'Kuchyně', 'Ložnice', 'Koupelna', 'Odpočinkový kout', 'Předsíň', 'Komora', 'Samostatné WC'];
  const state = {typology:typologies.includes(params.get('typology')) ? params.get('typology') : 'all', room:rooms.includes(params.get('room')) ? params.get('room') : 'all'};
  let items = [], filtered = [], dialogItems = [], dialogIndex = 0, lastFocus = null, heroItem = null;
  const dialog = $('#interior-dialog');
  const imageAlt = item => `${item.typology} · ${item.title}`;
  const countText = n => `${n} ${n === 1 ? 'vizualizace' : n > 1 && n < 5 ? 'vizualizace' : 'vizualizací'}`;
  const isLocalAsset = path => typeof path === 'string' && /^assets\/agency-interiors-20261026\/[a-zA-Z0-9_-]+\.(?:webp|jpe?g|png)$/i.test(path);
  const imageSet = item => item.thumb ? `${item.thumb} ${item.thumbWidth || 720}w, ${item.src} ${item.width}w` : `${item.src} ${item.width}w`;
  const dimensions = item => Number.isInteger(item.width) && Number.isInteger(item.height) && item.width > 0 && item.height > 0 ? [item.width, item.height] : [1620, 911];
  const cardSizes = '(max-width: 600px) calc(100vw - 40px), (min-width: 1800px) 816px, 44vw';
  function setImage(element, item, sizes) {
    const [width, height] = dimensions(item);
    element.srcset = imageSet(item); element.sizes = sizes;
    element.src = item.src; element.alt = imageAlt(item);
    element.width = width; element.height = height;
  }

  function syncFilters() {
    $$('[data-typology]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.typology === state.typology)));
    $$('[data-room]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.room === state.room)));
    $('#clear-filters').hidden = state.typology === 'all' && state.room === 'all';
  }
  function render() {
    filtered = items.filter(item => (state.typology === 'all' || item.typology === state.typology) && (state.room === 'all' || item.room === state.room));
    syncFilters();
    $('#gallery-status').textContent = `${countText(filtered.length)}${state.typology !== 'all' ? ` · ${state.typology}` : ''}${state.room !== 'all' ? ` · ${state.room}` : ''}`;
    $('#empty-state').hidden = filtered.length !== 0;
    $('#interior-grid').innerHTML = filtered.map((item, index) => `<article class="interior-card"><button class="card-image" type="button" data-image-index="${index}" aria-label="Zvětšit: ${escape(item.title)}, ${escape(item.typology)}"><img src="${escape(item.thumb || item.src)}" srcset="${escape(imageSet(item))}" sizes="${cardSizes}" alt="${escape(imageAlt(item))}" loading="lazy" decoding="async" width="${dimensions(item)[0]}" height="${dimensions(item)[1]}"><span class="image-arrow" aria-hidden="true">${window.AlexandraArrows.svg('arrow-up-right')}</span></button><div class="card-text"><div class="card-meta"><span>${escape(item.typology)}</span></div><h3>${escape(item.title)}</h3></div></article>`).join('');
  }
  function updateQuery() {
    const url = new URL(location.href);
    ['typology', 'room'].forEach(key => state[key] === 'all' ? url.searchParams.delete(key) : url.searchParams.set(key, state[key]));
    if (url.href !== location.href) history.pushState(null, '', url);
  }
  function filter(key, value) { state[key] = value; render(); updateQuery(); }
  $$('[data-typology]').forEach(button => button.addEventListener('click', () => filter('typology', button.dataset.typology)));
  $$('[data-room]').forEach(button => button.addEventListener('click', () => filter('room', button.dataset.room)));
  function resetFilters() { state.typology = state.room = 'all'; render(); updateQuery(); $('#typology-filters button').focus({preventScroll:true}); }
  $('#reset-filters').addEventListener('click', resetFilters);
  $('#clear-filters').addEventListener('click', resetFilters);
  window.addEventListener('popstate', () => {
    const query = new URLSearchParams(location.search);
    const wasDialogOpen = dialog.open, previousRoom = state.room;
    state.typology = typologies.includes(query.get('typology')) ? query.get('typology') : 'all';
    state.room = rooms.includes(query.get('room')) ? query.get('room') : 'all';
    if (wasDialogOpen) { lastFocus = null; dialog.close(); }
    if (items.length) render(); else syncFilters();
    if (wasDialogOpen) $(`#${previousRoom !== state.room ? 'room' : 'typology'}-filters [aria-pressed="true"]`).focus();
  });

  function renderDetail() {
    const item = dialogItems[dialogIndex];
    $('.detail-image-wrap').setAttribute('aria-busy', 'true');
    $('#detail-image-status').textContent = 'Načítání interiéru…';
    $('#detail-image-status').hidden = false;
    setImage($('#detail-image'), item, '(min-width: 1548px) 1500px, calc(100vw - 20px)');
    $('#detail-title').textContent = item.title;
    $('#detail-meta').textContent = `${item.typology} / ${item.room} / INTERIÉR`;
    $('#detail-description').textContent = '';
    $('#detail-description').hidden = true;
    $('#detail-source').textContent = `Zdroj: ${item.source || 'PDF dodané realitní kanceláří'}.`;
    $('#detail-position').textContent = `${String(dialogIndex + 1).padStart(2,'0')} / ${String(dialogItems.length).padStart(2,'0')}`;
    const full = item.fullResolution || item.src;
    $('#detail-download').href = full;
    $('#detail-download').setAttribute('download', full.split('/').pop());
    $('#detail-download-label').textContent = 'Stáhnout původní obrázek';
    $('#detail-resolution').textContent = `${item.fullWidth || item.width} × ${item.fullHeight || item.height} px · ${item.downloadFormat || 'původní rozlišení'}`;
    const tourRoom = item.tourRoom || {'Obývací pokoj':'living','Kuchyně':'kitchen','Ložnice':'bedroom','Koupelna':'bathroom','Odpočinkový kout':'living','Předsíň':'hall','Samostatné WC':'wc'}[item.room];
    $('#detail-tour').href = `tour.html?byt=${item.typology.replace('+','')}&mistnost=${tourRoom}#walkthrough`;
    $('#detail-tour').innerHTML = `Typová 360° prohlídka ${window.AlexandraArrows.svg('arrow-up-right')}`;
    $('#detail-prev').hidden = $('#detail-next').hidden = dialogItems.length < 2;
    const next = dialogItems[(dialogIndex + 1) % dialogItems.length];
    if (next) { const preload = new Image(); preload.src = next.src; }
    if ($('#detail-image').complete && $('#detail-image').naturalWidth) imageReady();
  }
  function imageReady() { $('.detail-image-wrap').setAttribute('aria-busy', 'false'); $('#detail-image-status').hidden = true; }
  $('#detail-image').addEventListener('load', imageReady);
  $('#detail-image').addEventListener('error', () => {
    $('.detail-image-wrap').setAttribute('aria-busy', 'false');
    $('#detail-image-status').textContent = 'Náhled se nepodařilo načíst. Zkuste další pohled nebo odkaz ke stažení níže.';
    $('#detail-image-status').hidden = false;
  });
  function openDetail(collection, index) {
    dialogItems = collection; dialogIndex = index; lastFocus = document.activeElement;
    renderDetail(); dialog.showModal(); dialog.scrollTop = 0; $('#detail-close').focus({preventScroll:true});
  }
  function step(amount) { dialogIndex = (dialogIndex + amount + dialogItems.length) % dialogItems.length; renderDetail(); }
  $('#interior-grid').addEventListener('click', event => { const button = event.target.closest('[data-image-index]'); if (button) openDetail(filtered, Number(button.dataset.imageIndex)); });
  $('#hero-open').addEventListener('click', () => { if (heroItem) openDetail(items, items.indexOf(heroItem)); });
  $('#detail-close').addEventListener('click', () => dialog.close());
  $('#detail-prev').addEventListener('click', () => step(-1));
  $('#detail-next').addEventListener('click', () => step(1));
  dialog.addEventListener('click', event => { if (event.target !== dialog) return; const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); });
  dialog.addEventListener('close', () => { if (lastFocus?.isConnected) lastFocus.focus({preventScroll:true}); });
  document.addEventListener('keydown', event => { if (dialog.open && !event.altKey && !event.ctrlKey && !event.metaKey && ['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); } });

  async function load() {
    $('#load-error').hidden = true; $('#empty-state').hidden = true;
    $('#interior-grid').setAttribute('aria-busy', 'true');
    $('#gallery-status').textContent = 'Načítání kolekce interiérů…';
    try {
      const response = await fetch('assets/agency-interiors-20261026/manifest.json?v=agency20261026', {cache:'no-cache'});
      if (!response.ok) throw new Error('Collection unavailable');
      const data = await response.json();
      items = (Array.isArray(data.items) ? data.items : []).filter(item => item && item.sourceKind === 'agency_original' && isLocalAsset(item.src) && (!item.thumb || isLocalAsset(item.thumb)) && typologies.includes(item.typology) && rooms.includes(item.room)).map(item => ({...item, fullResolution:isLocalAsset(item.fullResolution) ? item.fullResolution : null}));
      if (!items.length) throw new Error('Empty collection');
      heroItem = items.find(item => item.typology === '3+kk' && item.room === 'Obývací pokoj') || items[0];
      setImage($('#hero-image'), heroItem, '(min-width: 1800px) 1608px, (max-width: 500px) 100vw, 89.2vw');
      $('#hero-open').disabled = false; $('#hero-open').setAttribute('aria-label', `Zvětšit: ${heroItem.title}, ${heroItem.typology}`);
      $('#hero-caption').textContent = `${heroItem.title} · ${heroItem.typology}`;
      render();
    } catch (_) {
      $('#gallery-status').textContent = 'Kolekce není právě dostupná';
      $('#load-error').hidden = false;
    } finally { $('#interior-grid').setAttribute('aria-busy', 'false'); }
  }
  $('#retry-load').addEventListener('click', load);
  syncFilters(); load();
})();
