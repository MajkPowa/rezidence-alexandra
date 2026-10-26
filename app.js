(() => {
  'use strict';
  const icon = (name, variant = 'ui') => window.AlexandraIcons?.svg(name, variant) || '';
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const units = window.ALEXANDRA_UNITS || [];
  const floorLabel = window.AlexandraFloorLabels.label;
  const number = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 });
  const money = value => `${number.format(value)} Kč`;
  const area = value => `${number.format(value)} m²`;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const storageKey = 'alexandra-saved-units-v1';
  let saved = [];
  try { const stored = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(stored)) saved = [...new Set(stored.map(id => id === 53 ? 51 : id))].filter(id => units.some(unit => unit.id === id)).slice(0,4); } catch (_) { /* Browser may restrict local storage. */ }
  const state = { layout: 'all', floor: 'all', area: 'all', status: 'all', sort: 'floor', favorites: false, all: false };
  const statusOf = unit => window.AlexandraInventory?.status(unit) || { key: 'unknown', label: 'Dostupnost na dotaz', shortLabel: 'Na dotaz' };
  const statusBadge = unit => { const status = statusOf(unit); return `<span class="status-badge status-${status.key}" aria-label="Dostupnost bytu ${unit.id}: ${escape(status.label)}"><span class="availability-dot" aria-hidden="true"></span>${escape(status.label)}</span>`; };
  const findUnit = id => { const value = typeof id === 'number' ? id : typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : NaN; return Number.isSafeInteger(value) ? units.find(unit => unit.id === value) : undefined; };
  let currentUnit = null;
  let toastTimer;
  const dialogFocus = new WeakMap();
  const notify = message => { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3200); };

  const header = $('#header');
  const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 24);
  let headerFrame = 0;
  window.addEventListener('scroll', () => { if (!headerFrame) headerFrame = requestAnimationFrame(() => { updateHeader(); headerFrame = 0; }); }, { passive: true });
  updateHeader();
  const menuToggle = $('.menu-toggle');
  const mobileNav = $('#mobile-nav');
  const menuBackground = [$('#main'), $('.site-footer'), $('.brand', header), $('.header-contact', header)];
  function closeMenu(restore = false) {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Otevřít navigaci');
    mobileNav.hidden = true; header.classList.remove('menu-open'); document.body.classList.remove('menu-is-open');
    menuBackground.forEach(element => { if (element) element.inert = false; });
    if (restore) menuToggle.focus({preventScroll:true});
  }
  menuToggle.addEventListener('click', () => {
    if (menuToggle.getAttribute('aria-expanded') === 'true') { closeMenu(true); return; }
    menuToggle.setAttribute('aria-expanded','true'); menuToggle.setAttribute('aria-label','Zavřít navigaci');
    mobileNav.hidden = false; header.classList.add('menu-open'); document.body.classList.add('menu-is-open');
    menuBackground.forEach(element => { if (element) element.inert = true; });
    $('a', mobileNav).focus({preventScroll:true});
  });
  $$('#mobile-nav a').forEach(link => link.addEventListener('click', () => {
    closeMenu();
    const section = document.querySelector(link.hash);
    if (section) { section.tabIndex = -1; section.focus({preventScroll:true}); }
  }));
  document.addEventListener('keydown', event => {
    if (mobileNav.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); return; }
    if (event.key !== 'Tab') return;
    const controls = [menuToggle,...$$('a', mobileNav)];
    const index = controls.indexOf(document.activeElement);
    event.preventDefault(); controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 900) closeMenu(); });

  function captureFocus(element = document.activeElement) {
    const control = element?.closest?.('[data-save], [data-unit], [data-map-unit], button, a, input, select, textarea') || element;
    const scope = control?.closest?.('#map-unit-card, #unit-dialog, #compare-dialog, #unit-rows');
    const attr = ['data-save', 'data-unit', 'data-map-unit'].find(name => control?.hasAttribute?.(name));
    return { element: control, id: control?.id, scopeId: scope?.id, attr, value: attr ? control.getAttribute(attr) : null };
  }
  function restoreFocus(token) {
    if (!token) return;
    const activeDialog = $('dialog[open]');
    const scope = token.scopeId ? document.getElementById(token.scopeId) : document;
    let target = token.element?.isConnected ? token.element : token.id ? document.getElementById(token.id) : null;
    if (!target && token.attr && /^\d+$/.test(token.value || '')) target = scope?.querySelector(`[${token.attr}="${token.value}"]`);
    if (!target && scope !== document) target = scope?.querySelector('[data-close], button, a, input, select');
    if (!target) target = $('#floor-filter');
    // Closing one dialog must never steal focus from another open dialog.
    if (target && (!activeDialog || activeDialog.contains(target))) target.focus({ preventScroll: true });
  }
  function openDialog(dialog, returnFocus = captureFocus()) { dialogFocus.set(dialog, returnFocus); if (!dialog.open) dialog.showModal(); }
  $$('dialog:not([data-furnished-dialog])').forEach(dialog => {
    $('[data-close]', dialog).addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); });
    dialog.addEventListener('close', () => restoreFocus(dialogFocus.get(dialog)));
  });
  $('#privacy-open').addEventListener('click', () => openDialog($('#privacy-dialog')));

  const architecture = [
    { src: 'assets/exterior-no-balconies.webp', caption: 'Levá strana · bez bočních balkonů', alt: 'Architektonická vizualizace levé strany domu bez bočních balkonů' },
    { src: 'assets/exterior-rear-no-balconies.webp', caption: 'Zadní pohled · bez bočních balkonů', alt: 'Zadní strana domu bez bočních balkonů' },
    { src: 'assets/exterior-hero.webp', caption: 'Pravý přední pohled · zdrojová vizualizace', alt: 'Rezidence Alexandra z pravé přední strany' },
    { src: 'assets/balcony-detail.webp', caption: 'Balkon · zdrojová vizualizace', alt: 'Detail návrhu balkonů' },
    { src: 'assets/facade-detail.webp', caption: 'Stínolam · zdrojová vizualizace', alt: 'Detail návrhu stínolamu a fasády' }
  ];
  const interiorSequences = {
    '1': ['01','03','04','02','05','06','07'].map((n,i) => ({ src: `assets/interior-1-${n}.webp`, caption: `1+kk · původní vizualizace z podkladů · ${i+1}/7`, alt: `Návrh interiéru bytu 1+kk, pohled ${i+1}` })),
    '2': ['07','06','08','04','05','01','02','03','09','10'].map((n,i) => ({ src: `assets/interior-2-${n}.webp`, caption: `2+kk · původní vizualizace z podkladů · ${i+1}/10`, alt: `Návrh interiéru bytu 2+kk, pohled ${i+1}` })),
    '3': ['01','02','03','09','10','07','08','04','05','06'].map((n,i) => ({ src: `assets/interior-3-${n}.webp`, caption: `3+kk · původní vizualizace z podkladů · ${i+1}/10`, alt: `Návrh interiéru bytu 3+kk, pohled ${i+1}` }))
  };
  let activeInterior = '3';
  function updateInteriorFeature() {
    const item = interiorSequences[activeInterior][0];
    $('#interior-feature-image').src = item.src;
    $('#interior-feature-image').alt = item.alt;
    $('#interior-feature-image').width = item.width || 1620;
    $('#interior-feature-image').height = item.height || 911;
    $('#interior-feature-caption').textContent = item.featureCaption || `Obývací prostor · ${activeInterior}+kk`;
  }
  fetch('assets/agency-interiors-20261026/manifest.json?v=agency20261026', {cache:'no-cache'}).then(response => {
    if (!response.ok) throw new Error('Collection unavailable');
    return response.json();
  }).then(data => {
    ['1', '2', '3'].forEach(type => {
      const selected = (data.items || []).filter(item => item.sourceKind === 'agency_original' && item.typology === `${type}+kk` && typeof item.src === 'string' && /^assets\/agency-interiors-20261026\/[a-zA-Z0-9_-]+\.(webp|jpe?g|png)$/i.test(item.src));
      selected.sort((a, b) => Number(b.room === 'Obývací pokoj') - Number(a.room === 'Obývací pokoj'));
      if (selected.length) interiorSequences[type] = selected.map((item, index) => ({src:item.src, fullResolution:typeof item.fullResolution === 'string' && /^assets\/agency-interiors-20261026\/[a-zA-Z0-9_-]+-original\.(png|jpe?g)$/.test(item.fullResolution) ? item.fullResolution : null, width:item.width, height:item.height, alt:`${item.room} · ${item.typology}. ${item.title}. Původní vizualizace z podkladů realitní kanceláře.`, caption:`${item.title} · ${item.typology} · ${index + 1}/${selected.length} · původní vizualizace${item.scopeNote ? ` · ${item.scopeNote}` : (item.room === 'Koupelna' || item.room === 'Samostatné WC' ? ' · aktuální vybavení určuje katalog koupelny' : '')}`, featureCaption:`${item.title} · ${item.typology}`}));
    });
    updateInteriorFeature();
  }).catch(() => { /* The original project visualizations remain available. */ });
  let galleryItems = architecture;
  let galleryIndex = 0;
  $$('[data-variant]').forEach(button => button.addEventListener('click', () => {
    $$('[data-variant]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
    const index = { 'no-balconies': 0, rear: 1 }[button.dataset.variant];
    $('#architecture-image').src = architecture[index].src;
    $('#architecture-image').alt = architecture[index].alt;
    $('#architecture-caption').textContent = architecture[index].caption;
    $('[data-gallery="architecture"]').dataset.index = index;
  }));
  $$('[data-interior]').forEach(button => button.addEventListener('click', () => {
    activeInterior = button.dataset.interior;
    $$('[data-interior]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
    updateInteriorFeature();
  }));
  const renderGallery = () => {
    const item = galleryItems[galleryIndex];
    $('#gallery-image').src = item.src; $('#gallery-image').alt = item.alt;
    $('#gallery-caption').innerHTML = `${escape(item.caption)}${item.fullResolution ? `<br><a class="text-link" href="${escape(item.fullResolution)}" download>Stáhnout původní obrázek ${icon('download')}</a>` : ''}`;
  };
  $$('[data-gallery]').forEach(button => button.addEventListener('click', () => { galleryItems = button.dataset.gallery === 'architecture' ? architecture : interiorSequences[activeInterior]; galleryIndex = Number(button.dataset.index || 0); renderGallery(); openDialog($('#gallery-dialog')); }));
  const stepGallery = step => { galleryIndex = (galleryIndex + step + galleryItems.length) % galleryItems.length; renderGallery(); };
  $('#gallery-prev').addEventListener('click', () => stepGallery(-1));
  $('#gallery-next').addEventListener('click', () => stepGallery(1));
  document.addEventListener('keydown', event => { if ($('#gallery-dialog').open && ['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); stepGallery(event.key === 'ArrowLeft' ? -1 : 1); } });

  function filteredUnits() {
    return units.filter(unit => {
      if (state.layout !== 'all' && unit.layout !== state.layout) return false;
      if (state.floor !== 'all' && unit.floor !== Number(state.floor)) return false;
      if (state.area === 'small' && unit.area > 40) return false;
      if (state.area === 'medium' && (unit.area <= 40 || unit.area > 55)) return false;
      if (state.area === 'large' && unit.area <= 55) return false;
      if (state.status !== 'all' && statusOf(unit).key !== state.status) return false;
      return !state.favorites || saved.includes(unit.id);
    }).sort((a,b) => ({ 'price-up': () => a.price-b.price, 'price-down': () => b.price-a.price, 'area-up': () => a.area-b.area, 'area-down': () => b.area-a.area, floor: () => a.floor-b.floor || a.id-b.id }[state.sort] || (()=>0))());
  }
  const unitCount = n => n === 1 ? '1 jednotka' : n > 1 && n < 5 ? `${n} jednotky` : `${n} jednotek`;
  function snapshot() { return { filters: { ...state }, filteredIds: filteredUnits().map(unit => unit.id), savedIds: [...saved] }; }
  function setFilters(patch = {}) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return snapshot();
    const allowed = { layout: ['all', '1+kk', '2+kk', '3+kk'], floor: ['all', '1', '2', '3', '4', '5', '6'], area: ['all', 'small', 'medium', 'large'], status: ['all', 'available', 'reserved', 'sold', 'unknown'], sort: ['floor', 'price-up', 'price-down', 'area-up', 'area-down'] };
    let filterChanged = false;
    Object.entries(allowed).forEach(([key, values]) => {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) return;
      const value = key === 'floor' && Number.isSafeInteger(patch[key]) ? String(patch[key]) : patch[key];
      if (values.includes(value)) { filterChanged ||= state[key] !== value; state[key] = value; }
    });
    if (Object.prototype.hasOwnProperty.call(patch, 'favorites') && typeof patch.favorites === 'boolean') { filterChanged ||= state.favorites !== patch.favorites; state.favorites = patch.favorites; }
    if (filterChanged) state.all = false;
    if (Object.prototype.hasOwnProperty.call(patch, 'all') && typeof patch.all === 'boolean') state.all = patch.all;
    $$('[data-layout]').forEach(button => { const active = button.dataset.layout === state.layout; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    [['floor-filter', 'floor'], ['area-filter', 'area'], ['status-filter', 'status'], ['sort-filter', 'sort']].forEach(([id, key]) => { const control = document.getElementById(id); if (control) control.value = state[key]; });
    $('#favorites-only').checked = state.favorites;
    renderUnits();
    return snapshot();
  }
  function renderUnits() {
    const filtered = filteredUnits();
    const shown = filtered;
    $('#results-count').textContent = `${unitCount(filtered.length)} v přehledu${shown.length < filtered.length ? ` · zobrazeno ${shown.length}` : ''}`;
    $('#unit-rows').innerHTML = shown.map(unit => `<tr><td data-label="BYT">${String(unit.id).padStart(2,'0')}</td><td data-label="DISPOZICE">${escape(unit.layout)}</td><td data-label="PODLAŽÍ">${floorLabel(unit.floor)}</td><td data-label="CELKOVÁ PLOCHA">${area(unit.area)}</td><td data-label="ORIENTAČNÍ CENA">${money(unit.price)}</td><td data-label="DOSTUPNOST">${statusBadge(unit)}</td><td data-label="AKCE"><button class="favorite-button ${saved.includes(unit.id) ? 'saved' : ''}" data-save="${unit.id}" aria-label="${saved.includes(unit.id) ? 'Odebrat' : 'Uložit'} byt ${unit.id}" aria-pressed="${saved.includes(unit.id)}">${icon(saved.includes(unit.id) ? 'favorite-filled' : 'favorite')}</button><button class="unit-detail-button" data-unit="${unit.id}" aria-label="Detail bytu ${unit.id}">Detail ${icon('arrow-up-right')}</button></td></tr>`).join('');
    $('#empty-results').hidden = filtered.length > 0;
    $('#show-all').hidden = true;
    $('#show-all').innerHTML = state.all ? `Zobrazit méně ${icon('arrow-up')}` : `Zobrazit všech ${filtered.length} jednotek ${icon('arrow-down')}`;
    $('#saved-count').textContent = saved.length;
    $('#compare-bar').hidden = saved.length === 0;
    $('#compare-count').textContent = `${saved.length} ${saved.length === 1 ? 'uložený byt' : 'uložené byty'}`;
    document.dispatchEvent(new CustomEvent('alexandra:catalog-change', { detail: snapshot(), bubbles: true }));
  }
  function saveUnit(id) {
    if (!findUnit(id)) return;
    const existed = saved.includes(id);
    if (!existed && saved.length >= 4) { notify('Pro přehledné porovnání lze uložit nejvýše 4 byty. Nejprve některý odeberte.'); return; }
    saved = existed ? saved.filter(item => item !== id) : [...saved,id];
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch (_) { /* Choice still works for this visit. */ }
    renderUnits();
    if ($('#unit-dialog').open && currentUnit) renderUnitDetail(currentUnit);
    if ($('#compare-dialog').open) renderCompare();
    notify(existed ? `Byt ${id} byl odebrán z výběru.` : `Byt ${id} byl uložen k porovnání.`);
  }
  document.addEventListener('click', event => {
    const saveButton = event.target.closest('[data-save]');
    if (saveButton) { const unit = findUnit(saveButton.dataset.save); if (!unit) return; const focus = captureFocus(saveButton); saveUnit(unit.id); restoreFocus(focus); return; }
    const unitButton = event.target.closest('[data-unit]');
    if (unitButton) openUnit(unitButton.dataset.unit);
  });
  function openUnit(id) {
    const unit = findUnit(id);
    if (!unit) return false;
    const returnFocus = $('#compare-dialog').open ? dialogFocus.get($('#compare-dialog')) : captureFocus();
    if ($('#compare-dialog').open) $('#compare-dialog').close();
    currentUnit = unit;
    renderUnitDetail(unit);
    openDialog($('#unit-dialog'), returnFocus);
    return true;
  }
  $$('[data-layout]').forEach(button => button.addEventListener('click', () => setFilters({ layout: button.dataset.layout, all: false })));
  [['floor-filter','floor'], ['area-filter','area'], ['status-filter','status'], ['sort-filter','sort']].forEach(([id,key]) => $(`#${id}`)?.addEventListener('change', event => setFilters({ [key]: event.target.value, all: false })));
  $('#favorites-only').addEventListener('change', event => setFilters({ favorites: event.target.checked, all: false }));
  $('#show-all').addEventListener('click', () => { setFilters({ all: !state.all }); if (!state.all) $('#byty').scrollIntoView({behavior:'smooth'}); });
  $('#reset-filters').addEventListener('click', () => {
    setFilters({layout:'all',floor:'all',area:'all',status:'all',sort:'floor',favorites:false,all:false});
    $('[data-layout="all"]').focus({ preventScroll: true });
  });
  $('#clear-saved').addEventListener('click', () => {
    saved = [];
    try { localStorage.removeItem(storageKey); } catch (_) {}
    setFilters({ favorites: false });
    const focusTarget = $('#cenik').hidden ? $('[data-layout="all"]') : $('#favorites-only');
    focusTarget.focus({ preventScroll: true });
    notify('Uložené byty byly vymazány.');
  });

  function renderUnitDetail(unit) {
    if (!unit) return;
    const directPlan = !!unit.plan;
    const tour = unit.id === 51 ? null : { '1+kk': { id: '1kk', source: '04' }, '2+kk': { id: '2kk', source: '02' }, '3+kk': { id: '3kk', source: '01' } }[unit.layout];

    const planPath = directPlan ? unit.plan : `plans/floor-${unit.floor}.pdf`;
    const previewPath = directPlan ? `assets/plan-unit-${String(unit.id).padStart(2,'0')}.webp` : `assets/plan-floor-${unit.floor}.webp`;
    const notice = directPlan ? 'Samostatný půdorys je dodaný pod číslem tohoto bytu. Konečnou revizi a rozsah ploch potvrďte u prodejce.' : `Zobrazen je původní půdorys podlaží ${window.AlexandraFloorLabels.source(unit.floor)}. Samostatné dodané výkresy bytů 01–10 nepřiřazujeme automaticky k jednotkám ve vyšších podlažích.`;
    $('#unit-dialog-content').innerHTML = `<header class="unit-dialog-identity"><p class="eyebrow">REZIDENCE ALEXANDRA · BYDLENÍ</p><h2 id="unit-dialog-title">Byt ${String(unit.id).padStart(2,'0')}</h2><p class="unit-meta">${escape(unit.layout)} <span aria-hidden="true">/</span> ${floorLabel(unit.floor)}${unit.belowGroundLevel ? " · pod úrovní terénu" : ""}</p></header><div class="unit-dialog-grid"><div><a class="unit-plan" href="${planPath}" target="_blank" rel="noopener" aria-label="Otevřít půdorys v PDF"><img src="${previewPath}" alt="${directPlan ? `Zdrojový půdorys bytu ${unit.id}` : `Zdrojový půdorys ${floorLabel(unit.floor)}`}" loading="lazy"><span class="plan-caption">${directPlan ? `Půdorys bytu ${String(unit.id).padStart(2,'0')}` : `Půdorys · ${floorLabel(unit.floor)}`} · otevřít PDF ${icon('arrow-up-right')}</span></a><p class="unit-notice">${notice}</p></div><div><dl class="unit-data"><div><dt><span class="icon-label">${icon('area', 'art')} <span>Celková plocha</span></span></dt><dd>${area(unit.area)}</dd></div><div><dt>Otápěná plocha dle ceníku</dt><dd>${area(unit.heatedArea)}</dd></div>${window.AlexandraDetails?.areasHTML(unit) || ''}<div><dt><span class="icon-label">${icon('parking-open', 'art')} <span>Parkování</span></span></dt><dd>Samostatně k dokoupení</dd></div><div><dt>Dostupnost</dt><dd>${statusBadge(unit)}</dd></div></dl><p class="unit-price">${money(unit.price)}</p><span>Orientační cena bytu · ceník k 19. 10. 2026</span><div class="unit-purchase-links"><a class="text-link" href="#parkovani" data-section-link="parkovani" data-unit-id="${unit.id}">Parkování ${icon('arrow-up-right')}</a><a class="text-link" href="#vybaveni" data-section-link="vybaveni" data-unit-id="${unit.id}">Vybavení v ceně ${icon('arrow-up-right')}</a></div><div class="unit-actions"><button class="button button-dark" id="inquire-unit" data-id="${unit.id}">Mám zájem ${icon('arrow-up-right')}</button><button class="button" data-save="${unit.id}" aria-label="${saved.includes(unit.id) ? 'Odebrat' : 'Uložit'} byt ${unit.id}" aria-pressed="${saved.includes(unit.id)}">${icon(saved.includes(unit.id) ? 'favorite-filled' : 'favorite')} <span>${saved.includes(unit.id) ? 'Uloženo' : 'Uložit'}</span></button><a class="text-link" href="${planPath}" target="_blank" rel="noopener">Půdorys PDF ${icon('arrow-up-right')}</a>${tour ? `<a class="text-link unit-tour-link" href="tour.html?byt=${tour.id}">Typová 360° prohlídka ${escape(unit.layout)} ${icon('arrow-up-right')}</a>` : ''}</div>${tour ? `<p class="unit-tour-note">Typová prohlídka vychází z bytu ${tour.source} a ukazuje návrh zařízení. Nemusí odpovídat přesné dispozici vybrané jednotky.</p>` : ''}<p class="unit-footnote">Cena nezahrnuje parkování. Celková a otápěná plocha jsou samostatné údaje z ceníku; jejich rozdíl není automaticky výměrou balkonu nebo sklepa. Konečnou cenu, individuální variantu standardu a dostupnost potvrdí prodejce.</p>${window.AlexandraDetails?.detailHTML(unit) || ''}</div></div>`;
    const furnished = window.AlexandraFurnishedPlans?.previewHTML(unit, 'detail');
    if (furnished) {
      $('.unit-plan', $('#unit-dialog-content')).outerHTML = furnished;
      $('.unit-notice', $('#unit-dialog-content')).textContent = 'Návrh zařízení vychází z dispoziční rodiny tohoto bytu. Kliknutím jej zvětšíte a můžete přepnout na původní výkres. Balkony se liší podle podlaží a nejsou součástí 3D náhledu.';
    }
    $('#inquire-unit').addEventListener('click', () => { $('#unit-dialog').close(); selectInterest(`Byt ${unit.id} · ${unit.layout} · ${floorLabel(unit.floor)}`); $('#contact-message').value = `Dobrý den, mám zájem o byt č. ${unit.id} (${unit.layout}, ${floorLabel(unit.floor)}) v Rezidenci Alexandra. Prosím o potvrzení aktuální dostupnosti, ceny a podmínek prodeje.`; $('#kontakt').scrollIntoView({behavior:'smooth'}); setTimeout(() => $('#contact-name').focus({preventScroll:true}), 400); });
  }
  document.addEventListener('alexandra:furnished-ready', () => { if (currentUnit && $('#unit-dialog').open) renderUnitDetail(currentUnit); });
  function renderCompare() {
    const selected = saved.map(id => units.find(unit => unit.id === id)).filter(Boolean);
    if (!selected.length) { $('#compare-dialog').close(); return; }
    const rows = [['Dispozice',u=>u.layout],['Podlaží',u=>floorLabel(u.floor)],['Celková plocha',u=>area(u.area)],['Otápěná plocha',u=>area(u.heatedArea)],['Balkon',u=>window.AlexandraDetails.featureArea(window.AlexandraDetails.get(u).balconyArea,'balcony')],['Sklep',u=>window.AlexandraDetails.featureArea(window.AlexandraDetails.get(u).cellarArea,'cellar')],['Cena bytu',u=>money(u.price)],['Dostupnost',u=>statusOf(u).label]];
    $('#compare-content').innerHTML = `<div class="compare-table-wrap"><table class="compare-table"><thead><tr><th scope="col">PARAMETR</th>${selected.map(u=>`<th scope="col">Byt ${String(u.id).padStart(2,'0')}</th>`).join('')}</tr></thead><tbody>${rows.map(([label,fn])=>`<tr><th scope="row">${label}</th>${selected.map(u=>`<td>${label === 'Dostupnost' ? statusBadge(u) : escape(fn(u))}</td>`).join('')}</tr>`).join('')}<tr><th scope="row">Půdorys a podrobnosti</th>${selected.map(u=>`<td><button class="button button-dark" data-unit="${u.id}">Detail bytu ${icon('arrow-up-right')}</button></td>`).join('')}</tr><tr><th scope="row">Uložený výběr</th>${selected.map(u=>`<td><button class="text-link" data-save="${u.id}" aria-label="Odebrat byt ${u.id}" aria-pressed="true">${icon('favorite-filled')} Odebrat</button></td>`).join('')}</tr></tbody></table></div><p class="compare-note">Orientační ceny k 19. 10. 2026 bez parkování. Aktuální dostupnost potvrdí prodejce. </p>`;
  }
  $('#open-compare').addEventListener('click', () => { renderCompare(); openDialog($('#compare-dialog')); });

  function selectInterest(value) { const select = $('#contact-interest'); let option = [...select.options].find(item => item.value === value); if (!option) { option = document.createElement('option'); option.value = value; option.textContent = value; select.appendChild(option); } select.value = value; }
  const inquiryForm = $('#inquiry-form');
  inquiryForm.noValidate = true;
  const formErrors = document.createElement('div');
  formErrors.className = 'form-errors'; formErrors.id = 'form-errors'; formErrors.hidden = true;
  formErrors.tabIndex = -1; formErrors.setAttribute('role', 'alert');
  inquiryForm.prepend(formErrors);
  const fields = [$('#contact-name'),$('#contact-email')];
  fields.forEach(field => {
    const error = document.createElement('span'); error.id = `${field.id}-error`; error.className = 'field-error'; error.hidden = true;
    field.insertAdjacentElement('afterend',error); field.setAttribute('aria-describedby',error.id);
  });
  function fieldMessage(field) {
    if (!field.value.trim()) return field.id === 'contact-name' ? 'Vyplňte prosím své jméno.' : 'Vyplňte prosím e-mail.';
    if (field.validity.typeMismatch) return 'Zadejte platnou e-mailovou adresu.';
    return field.validity.valid ? '' : 'Zkontrolujte prosím vyplněný údaj.';
  }
  function updateFieldError(field) {
    const message = fieldMessage(field), element = $(`#${field.id}-error`);
    element.textContent = message; element.hidden = !message;
    if (message) field.setAttribute('aria-invalid','true'); else field.removeAttribute('aria-invalid');
    return message;
  }
  fields.forEach(field => field.addEventListener('input', () => {
    if (field.hasAttribute('aria-invalid')) updateFieldError(field);
    if (fields.every(item => !fieldMessage(item))) formErrors.hidden = true;
  }));
  inquiryForm.addEventListener('submit', event => {
    event.preventDefault();
    const errors = fields.map(field => ({field,message:updateFieldError(field)})).filter(item => item.message);
    if (errors.length) {
      formErrors.innerHTML = `<p>Ještě doplňte kontaktní údaje</p><ul>${errors.map(({field,message}) => `<li><a href="#${field.id}">${escape(message)}</a></li>`).join('')}</ul>`;
      formErrors.hidden = false; formErrors.focus(); return;
    }
    formErrors.hidden = true;
    const name = $('#contact-name').value.trim();
    const email = $('#contact-email').value.trim();
    const phone = $('#contact-phone').value.trim();
    const interest = $('#contact-interest').value;
    const message = $('#contact-message').value.trim();
    const body = `Dobrý den,\n\nmám zájem: ${interest}.\n\n${message}\n\nJméno: ${name}\nE-mail: ${email}${phone ? `\nTelefon: ${phone}` : ''}\n\nDěkuji za informace k Rezidenci Alexandra.`;
    const href = `mailto:hebelka@dumrealit.cz?subject=${encodeURIComponent(`Rezidence Alexandra — ${interest}`)}&body=${encodeURIComponent(body)}`;
    $('#form-status').replaceChildren(document.createTextNode('Zpráva je připravena. Pokud se e-mailový program neotevřel, '));
    const link = document.createElement('a'); link.href = href; link.textContent = 'otevřete návrh zde'; link.style.textDecoration='underline'; $('#form-status').append(link,document.createTextNode('. Zpráva nebyla automaticky odeslána.'));
    window.location.href = href;
  });

  document.addEventListener('alexandra:inventory-change', () => {
    const focus = captureFocus();
    renderUnits();
    if (currentUnit && $('#unit-dialog').open) renderUnitDetail(currentUnit);
    if ($('#compare-dialog').open) renderCompare();
    restoreFocus(focus);
  });
  document.querySelector('[data-finance-inquiry]')?.addEventListener('click', () => {
    selectInterest('Financování bytu');
    $('#contact-message').value = 'Dobrý den, prosím o informace k možnostem financování a platebnímu harmonogramu Rezidence Alexandra.';
  });
  document.addEventListener('alexandra:parking-inquiry', event => {
    selectInterest(`Parkovací místo ${event.detail.id}`);
    $('#contact-message').value = `Dobrý den, mám zájem o parkovací místo ${event.detail.id}. Prosím o potvrzení dostupnosti, ceny a podmínek přiřazení k bytu.`;
  });
  const legacyUrl = new URL(location.href);
  if (legacyUrl.searchParams.get('byt') === '53') { legacyUrl.searchParams.set('byt','51'); legacyUrl.searchParams.set('podlazi','1'); history.replaceState(null,'',legacyUrl); }
  window.AlexandraCatalog = Object.freeze({ snapshot, setFilters, openUnit, isSaved: id => { const unit = findUnit(id); return !!unit && saved.includes(unit.id); } });
  renderUnits();
})();
