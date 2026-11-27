(() => {
  'use strict';
  const icon = (name, variant = 'ui') => window.AlexandraIcons?.svg(name, variant) || '';
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const units = window.ALEXANDRA_UNITS || [];
  const floorLabel = window.AlexandraFloorLabels.label;
  const number = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 });
  const money = window.AlexandraDetails.formatPrice;
  const area = value => `${number.format(value)} m²`;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const storageKey = 'alexandra-saved-units-v1';
  let saved = [];
  try { const stored = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(stored)) saved = [...new Set(stored.map(id => id === 53 ? 51 : id))].filter(id => units.some(unit => unit.id === id)).slice(0,4); } catch (_) { /* Browser may restrict local storage. */ }
  const state = { layout: 'all', floor: 'all', area: 'all', status: 'all', sort: 'floor', favorites: false, all: false };
  const statusOf = unit => window.AlexandraInventory?.status(unit) || { key: 'unknown', label: 'Dostupnost se ověřuje', shortLabel: 'Neověřeno' };
  const statusBadge = unit => { const status = statusOf(unit); return `<span class="status-badge status-${status.key}" aria-label="Dostupnost bytu ${unit.id}: ${escape(status.label)}"><span class="availability-dot" aria-hidden="true"></span>${escape(status.label)}</span>`; };
  const findUnit = id => { const value = typeof id === 'number' ? id : typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : NaN; return Number.isSafeInteger(value) ? units.find(unit => unit.id === value) : undefined; };
  let currentUnit = null;
  let pendingDetail = null;
  let parkingUnit = null;
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
  const menuBackground = [$('#main'), $('.site-footer'), $('.dr-lockup', header), $('.header-contact', header)];
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
  const mobileMenuQuery = window.matchMedia('(max-width: 1100px)');
  window.addEventListener('resize', () => { if (!mobileMenuQuery.matches) closeMenu(); });

  function captureFocus(element = document.activeElement) {
    const control = element?.closest?.('[data-save], [data-unit], [data-map-unit], button, a, input, select, textarea') || element;
    const scope = control?.closest?.('#map-unit-card, #unit-dialog, #compare-dialog, #unit-rows');
    const attr = ['data-detail-section', 'data-save', 'data-unit', 'data-map-unit', 'data-detail-neighbor', 'data-furnished-unit'].find(name => control?.hasAttribute?.(name));
    return { element: control, id: control?.id, scopeId: scope?.id, attr, value: attr ? control.getAttribute(attr) : null };
  }
  function restoreFocus(token) {
    if (!token) return;
    const activeDialog = $('dialog[open]');
    const scope = token.scopeId ? document.getElementById(token.scopeId) : document;
    let target = token.element?.isConnected ? token.element : token.id ? document.getElementById(token.id) : null;
    if (!target && token.attr && /^[\w-]+$/.test(token.value || '')) target = scope?.querySelector(`[${token.attr}="${token.value}"]`);
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

  const interiorSequences = {};
  for (const [type, layout] of Object.entries(window.AlexandraLayouts.labels)) {
    const base = `assets/interiery-20261124/${type}-interior-01`;
    const caption = `Obývací pokoj · ${layout}`;
    interiorSequences[type] = [{src:base+'.webp',thumb:base+'-thumb.webp',width:1600,height:900,room:'Obývací pokoj',alt:caption,caption,featureCaption:caption}];
  }
  const roomOrder = ['Obývací pokoj','Kuchyně','Ložnice','Koupelna','Předsíň','Pracovna','Komora','Jídelní kout','Samostatné WC'];
  function roomPhotos(layout) {
    const photos = interiorSequences[window.AlexandraLayouts.mediaId(layout)] || [];
    return roomOrder.map(room => photos.find(photo => photo.room === room)).filter(Boolean);
  }
  const galleryAsset = path => typeof path === 'string' && /^assets\/interiery-20261124\/[a-z0-9-]+\.webp$/.test(path);
  fetch('assets/interiery-20261124/manifest.json?v=hebelka20261125c').then(response => {
    if (!response.ok) throw new Error('Collection unavailable');
    return response.json();
  }).then(data => {
    Object.entries(window.AlexandraLayouts.labels).forEach(([type, layout]) => {
      const selected = (data.items || []).filter(item => item.sourceKind === 'agency_original' && item.typology === layout && galleryAsset(item.src) && galleryAsset(item.thumb));
      selected.sort((a, b) => Number(b.room === 'Obývací pokoj') - Number(a.room === 'Obývací pokoj'));
      if (selected.length) interiorSequences[type] = selected.map((item, index) => ({...item, fullResolution:galleryAsset(item.fullResolution) ? item.fullResolution : null, downloadLabel:'Stáhnout vizualizaci', alt:`${item.title} · ${item.typology}`, caption:`${item.title} · ${item.typology} · ${index + 1}/${selected.length}`, featureCaption:`${item.title} · ${item.typology}`}));
    });
    document.dispatchEvent(new Event('alexandra:room-photos-ready'));
  }).catch(() => { /* The supplied cover for each layout is also available offline. */ });
  function filteredUnits() {
    return units.filter(unit => {
      if (state.layout !== 'all' && unit.layout !== state.layout) return false;
      if (state.floor !== 'all' && unit.floor !== Number(state.floor)) return false;
      if (state.area === 'small' && unit.area > 40) return false;
      if (state.area === 'medium' && (unit.area <= 40 || unit.area > 55)) return false;
      if (state.area === 'large' && unit.area <= 55) return false;
      if (state.status !== 'all' && statusOf(unit).key !== state.status) return false;
      return !state.favorites || saved.includes(unit.id);
    }).sort((a,b) => ({ 'price-up': () => (a.price ?? Infinity) - (b.price ?? Infinity), 'price-down': () => (b.price ?? -Infinity) - (a.price ?? -Infinity), 'area-up': () => a.area-b.area, 'area-down': () => b.area-a.area, floor: () => a.floor-b.floor || a.id-b.id }[state.sort] || (()=>0))());
  }
  const unitCount = n => n === 1 ? '1 jednotka' : n > 1 && n < 5 ? `${n} jednotky` : `${n} jednotek`;
  function snapshot() { return { filters: { ...state }, filteredIds: filteredUnits().map(unit => unit.id), savedIds: [...saved] }; }
  function setFilters(patch = {}) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return snapshot();
    const allowed = { layout: ['all', '1+kk', '2+kk', '2,5+kk'], floor: ['all', '1', '2', '3', '4', '5', '6'], area: ['all', 'small', 'medium', 'large'], status: ['all', 'available', 'reserved', 'sold'], sort: ['floor', 'price-up', 'price-down', 'area-up', 'area-down'] };
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
    const clearParkingUnit = event.target.closest('[data-clear-parking-unit]');
    if (clearParkingUnit) parkingUnit = null;
    const parkingLink = event.target.closest('[data-section-link="parkovani"][data-unit-id]');
    if (parkingLink) {
      const unit = findUnit(parkingLink.dataset.unitId);
      if (unit) parkingUnit = unit;
    }
    const viewingButton = event.target.closest('[data-viewing-unit]');
    if (viewingButton) {
      const unit = findUnit(viewingButton.dataset.viewingUnit);
      if (!unit) return;
      event.preventDefault();
      requestViewing(unit);
      return;
    }
    const saveButton = event.target.closest('[data-save]');
    if (saveButton) { const unit = findUnit(saveButton.dataset.save); if (!unit) return; const focus = captureFocus(saveButton); saveUnit(unit.id); restoreFocus(focus); return; }
    const returnToPicker = event.target.closest('[data-return-unit]');
    if (returnToPicker && window.AlexandraPicker?.openUnit(Number(returnToPicker.dataset.returnUnit))) {
      event.preventDefault();
      return;
    }
    const unitButton = event.target.closest('[data-unit]');
    if (!unitButton) return;
    if (unitButton.getAttribute('aria-controls') === 'unit-dialog') {
      const unit = findUnit(unitButton.dataset.unit);
      if (unit) {
        event.preventDefault();
        showUnitDialog(unit, captureFocus(unitButton));
        if (unitButton.dataset.detailSection === 'unit-equipment') {
          const heading = $('#unit-equipment h3');
          heading.focus({preventScroll:true});
          heading.scrollIntoView({block:'start', behavior:'instant'});
        }
      }
      return;
    }
    openUnit(unitButton.dataset.unit);
  });
  function openUnit(id) {
    const unit = findUnit(id);
    if (!unit) return false;
    const returnFocus = $('#compare-dialog').open ? dialogFocus.get($('#compare-dialog')) : captureFocus();
    if ($('#compare-dialog').open) {
      dialogFocus.delete($('#compare-dialog'));
      $('#compare-dialog').close();
    }
    if (window.AlexandraPicker?.openUnit(unit.id)) return true;
    if (document.getElementById('floor-explorer')?.getAttribute('aria-busy') === 'true') {
      pendingDetail = unit.id;
      return true;
    }
    // Keep the unit, its plan and contact details available if the floor data cannot load.
    showUnitDialog(unit, returnFocus);
    return true;
  }
  function showUnitDialog(unit, returnFocus) {
    currentUnit = unit;
    renderUnitDetail(unit);
    const dialog = $('#unit-dialog');
    openDialog(dialog, returnFocus);
    dialog.scrollTop = 0;
  }
  function chooseDetailNeighbor(id) {
    const next = findUnit(id);
    if (!next || next.floor !== currentUnit?.floor || next.id === currentUnit.id) return;
    window.AlexandraPicker?.openUnit(next.id, {focus:false});
  }
  const unitDialog = $('#unit-dialog');
  unitDialog.addEventListener('click', event => {
    const choice = event.target.closest('[data-detail-neighbor]');
    if (choice) chooseDetailNeighbor(choice.dataset.detailNeighbor);
  });
  unitDialog.addEventListener('keydown', event => {
    const choice = event.target.closest('[data-detail-neighbor]');
    if (choice && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      chooseDetailNeighbor(choice.dataset.detailNeighbor);
    }
  });
  unitDialog.addEventListener('change', event => {
    if (event.target.matches('[data-detail-floor-select]')) chooseDetailNeighbor(event.target.value);
  });
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
    const focusTarget = $('#cenik').hidden ? $('[data-pick-step][aria-current="step"]') : $('#favorites-only');
    focusTarget?.focus({ preventScroll: true });
    notify('Uložené byty byly vymazány.');
  });

  function openPendingDetail() {
    if (pendingDetail === null) return;
    const id = pendingDetail;
    pendingDetail = null;
    openUnit(id);
  }
  document.addEventListener('alexandra:floor-selector-ready', openPendingDetail);
  document.addEventListener('alexandra:floor-selector-error', openPendingDetail);
  function renderUnitDetail(unit) {
    if (!unit) return;
    const details = window.AlexandraDetails;
    const plan = escape(unit.plan || `plans/byty-20261124/podlazi-${unit.floor}.pdf`);
    const preview = escape(unit.planPreview || `assets/floors/floor-${unit.floor}.webp`);
    const furnished = window.AlexandraFurnishedPlans?.previewHTML(unit, 'detail');
    const originalPlan = `<a class="detail-original-plan" href="${plan}" target="_blank" rel="noopener" aria-label="Otevřít projektový půdorys bytu ${unit.id} v PDF"><img src="${preview}" alt="Projektový půdorys pro byt ${unit.id}"></a>`;
    const tour = details.tourHref(unit);
    const isSaved = saved.includes(unit.id);
    const arrow = icon('arrow-up-right');
    $('#unit-dialog-content').innerHTML = `<p class="eyebrow detail-kicker">REZIDENCE ALEXANDRA · BYDLENÍ</p>
      <div class="detail-columns">
        <div class="detail-intro">
          <header class="detail-identity">
            <div class="detail-heading"><h2 id="unit-dialog-title" tabindex="-1">Byt ${String(unit.id).padStart(2,'0')}</h2>
              <p class="unit-meta">${escape(unit.layout)} / ${floorLabel(unit.floor)}${unit.belowGroundLevel ? ' · pod úrovní terénu' : ''}</p>
              ${statusBadge(unit)}<p class="unit-price">${money(unit.price)}</p>${Number.isFinite(unit.price) ? '<p class="unit-price-note">Orientační cena · bez parkování</p>' : ''}
            </div>${details.salesPortrait}
          </header>
          <div class="unit-contact-actions"><button type="button" class="button viewing-cta" id="inquire-unit" data-id="${unit.id}">Domluvit prohlídku ${arrow}</button>${details.callSales}</div>
          <div class="detail-tools"><button type="button" class="button" data-save="${unit.id}" aria-label="${isSaved ? 'Odebrat' : 'Uložit'} byt ${unit.id}" aria-pressed="${isSaved}">${icon(isSaved ? 'favorite-filled' : 'favorite')} <span>${isSaved ? 'Uloženo' : 'Uložit'}</span></button>
            <a class="text-link" href="${plan}" target="_blank" rel="noopener">Půdorys PDF ${arrow}</a></div>
        </div>
        <div class="detail-drawings">${furnished || originalPlan}${window.AlexandraUnitLocation?.floorHTML(unit) || ''}</div>
        <div class="detail-terms">
          <dl class="unit-data"><div><dt>Celková plocha</dt><dd>${area(unit.area)}</dd></div>
            <div><dt>Otápěná plocha dle ceníku</dt><dd>${area(unit.heatedArea)}</dd></div>${details.areasHTML(unit)}
            <div><dt>Parkování</dt><dd>Samostatně k dokoupení</dd></div></dl>
          <div class="detail-shortcuts">
            <a class="text-link" href="#hypoteka" data-mortgage-unit="${Number.isFinite(unit.price) ? unit.id : 'custom'}">Spočítat hypotéku ${arrow}</a>
            <a class="text-link" href="#parkovani" data-section-link="parkovani" data-unit-id="${unit.id}">Parkování ${arrow}</a>
            <a class="text-link" href="#vybaveni" data-section-link="vybaveni" data-unit-id="${unit.id}">Vybavení v ceně ${arrow}</a></div>
          ${tour ? `<a class="unit-tour-link" href="${escape(tour)}">Typová 360° prohlídka ${escape(unit.layout)} ${arrow}</a>` : ''}
        </div></div>
      ${details.detailHTML(unit)}`;
    $('#inquire-unit').addEventListener('click', () => requestViewing(unit));
  }
  function requestViewing(unit) {
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    prepareInquiry(`Byt ${unit.id} · ${unit.layout} · ${floorLabel(unit.floor)}`, `Dobrý den, mám zájem o byt č. ${unit.id} (${unit.layout}, ${floorLabel(unit.floor)}) v Rezidenci Alexandra a rád/a bych si domluvil/a prohlídku. Prosím o návrh termínu a potvrzení aktuální dostupnosti.`);
    $('#kontakt').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    setTimeout(() => $('#contact-name').focus({preventScroll:true}), 400);
  }
  document.addEventListener('alexandra:floor-selector-ready', () => { if (currentUnit && $('#unit-dialog').open) renderUnitDetail(currentUnit); });
  document.addEventListener('alexandra:furnished-ready', () => { if (currentUnit && $('#unit-dialog').open) renderUnitDetail(currentUnit); });
  function renderCompare() {
    const selected = saved.map(id => units.find(unit => unit.id === id)).filter(Boolean);
    if (!selected.length) { $('#compare-dialog').close(); return; }
    const rows = [['Dispozice',u=>u.layout],['Podlaží',u=>floorLabel(u.floor)],['Celková plocha',u=>area(u.area)],['Otápěná plocha',u=>area(u.heatedArea)],['Balkon',u=>window.AlexandraDetails.featureArea(window.AlexandraDetails.get(u).balconyArea,'balcony')],['Sklep',u=>window.AlexandraDetails.featureArea(window.AlexandraDetails.get(u).cellarArea,'cellar')],['Cena bytu',u=>money(u.price)],['Dostupnost',u=>statusOf(u).label]];
    $('#compare-content').innerHTML = `<div class="compare-table-wrap"><table class="compare-table"><thead><tr><th scope="col">PARAMETR</th>${selected.map(u=>`<th scope="col" class="compare-unit-heading">Byt ${String(u.id).padStart(2,'0')}</th>`).join('')}</tr></thead><tbody>${rows.map(([label,fn])=>`<tr><th scope="row">${label}</th>${selected.map(u=>`<td>${label === 'Dostupnost' ? statusBadge(u) : escape(fn(u))}</td>`).join('')}</tr>`).join('')}<tr><th scope="row">Půdorys a podrobnosti</th>${selected.map(u=>`<td><button class="button button-dark" data-unit="${u.id}">Detail bytu ${icon('arrow-up-right')}</button></td>`).join('')}</tr><tr><th scope="row">Uložený výběr</th>${selected.map(u=>`<td><button class="text-link" data-save="${u.id}" aria-label="Odebrat byt ${u.id}" aria-pressed="true">${icon('favorite-filled')} Odebrat</button></td>`).join('')}</tr></tbody></table></div><p class="compare-note">Ceny bez parkování. </p>`;
  }
  $('#open-compare').addEventListener('click', () => { renderCompare(); openDialog($('#compare-dialog')); });

  function selectInterest(value) { const select = $('#contact-interest'); let option = [...select.options].find(item => item.value === value); if (!option) { option = document.createElement('option'); option.value = value; option.textContent = value; select.appendChild(option); } select.value = value; }
  let lastInquiryTemplate = null;
  function prepareInquiry(interest, template) {
    selectInterest(interest);
    const message = $('#contact-message');
    const mayReplace = !message.value.trim() || message.value === lastInquiryTemplate;
    if (mayReplace) { message.value = template; lastInquiryTemplate = template; }
    // Keep the selected context in the interest field and the outgoing e-mail,
    // without changing a visitor's own wording or stacking notifications.
    const status = $('#form-status');
    const feedback = mayReplace ? '' : `Vybráno: ${interest}. Váš rozepsaný text zůstává zachován.`;
    if (status.textContent !== feedback) status.textContent = feedback;
  }
  document.addEventListener('alexandra:picker-unit', event => {
    parkingUnit = findUnit(event.detail?.id) || null;
    if (!unitDialog.open) return;
    if (!parkingUnit) { unitDialog.close(); return; }
    if (currentUnit?.id !== parkingUnit.id) {
      const returnButton = $('#map-unit-card button[aria-controls="unit-dialog"]');
      showUnitDialog(parkingUnit, captureFocus(returnButton));
      $('#unit-dialog-title').focus({preventScroll:true});
    }
  });
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
    const href = `mailto:dvorak@dumrealit.cz?subject=${encodeURIComponent(`Rezidence Alexandra — ${interest}`)}&body=${encodeURIComponent(body)}`;
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
    prepareInquiry('Financování bytu', 'Dobrý den, prosím o informace k možnostem financování a platebnímu harmonogramu Rezidence Alexandra.');
  });
  document.addEventListener('alexandra:parking-inquiry', event => {
    const id = event.detail?.id;
    if (typeof id !== 'string' || !/^[PG]\d+$/.test(id)) return;
    const interest = parkingUnit ? `Byt ${parkingUnit.id} · ${parkingUnit.layout} · ${floorLabel(parkingUnit.floor)} + parkovací místo ${id}` : `Parkovací místo ${id}`;
    const subject = parkingUnit ? `byt č. ${parkingUnit.id} (${parkingUnit.layout}, ${floorLabel(parkingUnit.floor)}) a parkovací místo ${id}` : `parkovací místo ${id}`;
    prepareInquiry(interest, `Dobrý den, mám zájem o ${subject}. Prosím o potvrzení dostupnosti, ceny a podmínek přiřazení k bytu.`);
  });
  const legacyUrl = new URL(location.href);
  if (legacyUrl.searchParams.get('byt') === '53') { legacyUrl.searchParams.set('byt','51'); legacyUrl.searchParams.set('podlazi','1'); history.replaceState(null,'',legacyUrl); }
  window.AlexandraCatalog = Object.freeze({ snapshot, setFilters, openUnit, roomPhotos, isSaved: id => { const unit = findUnit(id); return !!unit && saved.includes(unit.id); } });
  renderUnits();
})();
