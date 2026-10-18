(() => {
  'use strict';
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const units = window.ALEXANDRA_UNITS || [];
  const number = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 });
  const money = value => `${number.format(value)} Kč`;
  const area = value => `${number.format(value)} m²`;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const storageKey = 'alexandra-saved-units-v1';
  let saved = [];
  try { const stored = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(stored)) saved = [...new Set(stored)].filter(id => units.some(unit => unit.id === id)).slice(0,4); } catch (_) { /* Browser may restrict local storage. */ }
  const state = { layout: 'all', floor: 'all', area: 'all', status: 'all', sort: 'floor', favorites: false, all: false };
  const statusOf = unit => window.AlexandraInventory?.status(unit) || { key: 'unknown', label: 'Dostupnost na dotaz', shortLabel: 'Na dotaz' };
  const statusBadge = unit => { const status = statusOf(unit); return `<span class="status-badge status-${status.key}" aria-label="Dostupnost bytu ${unit.id}: ${escape(status.label)}"><span class="availability-dot" aria-hidden="true"></span>${escape(status.label)}</span>`; };
  const findUnit = id => { const value = typeof id === 'number' ? id : typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : NaN; return Number.isSafeInteger(value) ? units.find(unit => unit.id === value) : undefined; };
  let currentUnit = null;
  let toastTimer;
  const dialogFocus = new WeakMap();
  const notify = message => { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3200); };

  const header = $('#header');
  const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 70);
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();
  const menuToggle = $('.menu-toggle');
  function closeMenu() { menuToggle.setAttribute('aria-expanded', 'false'); menuToggle.setAttribute('aria-label', 'Otevřít navigaci'); $('#mobile-nav').hidden = true; header.classList.remove('menu-open'); document.body.classList.remove('menu-is-open'); }
  menuToggle.addEventListener('click', () => { const expanded = menuToggle.getAttribute('aria-expanded') === 'true'; if (expanded) closeMenu(); else { menuToggle.setAttribute('aria-expanded','true'); menuToggle.setAttribute('aria-label','Zavřít navigaci'); $('#mobile-nav').hidden = false; header.classList.add('menu-open'); document.body.classList.add('menu-is-open'); } });
  $$('#mobile-nav a').forEach(link => link.addEventListener('click', closeMenu));
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
  $$('dialog').forEach(dialog => {
    $('[data-close]', dialog).addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); });
    dialog.addEventListener('close', () => restoreFocus(dialogFocus.get(dialog)));
  });
  $('#privacy-open').addEventListener('click', () => openDialog($('#privacy-dialog')));

  const architecture = [
    { src: 'assets/exterior-balconies.webp', caption: 'Levá strana · varianta s balkony', alt: 'Architektonická vizualizace levé strany domu s balkony' },
    { src: 'assets/exterior-no-balconies.webp', caption: 'Levá strana · varianta bez balkonů', alt: 'Architektonická vizualizace levé strany domu bez balkonů' },
    { src: 'assets/exterior-rear.webp', caption: 'Zadní pohled · zdrojová vizualizace', alt: 'Architektonická vizualizace zadní strany domu' },
    { src: 'assets/exterior-rear-no-balconies.webp', caption: 'Zadní pohled · varianta bez balkonů vlevo', alt: 'Zadní strana domu ve variantě bez balkonů vlevo' },
    { src: 'assets/exterior-hero.webp', caption: 'Pravý přední pohled · zdrojová vizualizace', alt: 'Rezidence Alexandra z pravé přední strany' },
    { src: 'assets/balcony-detail.webp', caption: 'Balkon · zdrojová vizualizace', alt: 'Detail návrhu balkonů' },
    { src: 'assets/facade-detail.webp', caption: 'Stínolam · zdrojová vizualizace', alt: 'Detail návrhu stínolamu a fasády' }
  ];
  const interiorSequences = {
    '1': ['01','03','04','02','05','06','07'].map((n,i) => ({ src: `assets/interior-1-${n}.webp`, caption: `1+kk · vizualizace možného zařízení · ${i+1}/7`, alt: `Návrh interiéru bytu 1+kk, pohled ${i+1}` })),
    '2': ['07','06','08','04','05','01','02','03','09','10'].map((n,i) => ({ src: `assets/interior-2-${n}.webp`, caption: `2+kk · vizualizace možného zařízení · ${i+1}/10`, alt: `Návrh interiéru bytu 2+kk, pohled ${i+1}` })),
    '3': ['01','02','03','09','10','07','08','04','05','06'].map((n,i) => ({ src: `assets/interior-3-${n}.webp`, caption: `3+kk · vizualizace možného zařízení · ${i+1}/10`, alt: `Návrh interiéru bytu 3+kk, pohled ${i+1}` }))
  };
  let activeInterior = '3';
  function updateInteriorFeature() {
    const item = interiorSequences[activeInterior][0];
    $('#interior-feature-image').src = item.src;
    $('#interior-feature-image').alt = item.alt;
    $('#interior-feature-caption').textContent = item.featureCaption || `Obývací prostor · ${activeInterior}+kk`;
  }
  fetch('assets/interiors-v2/manifest.json').then(response => {
    if (!response.ok) throw new Error('Collection unavailable');
    return response.json();
  }).then(data => {
    ['1', '2', '3'].forEach(type => {
      const selected = (data.items || []).filter(item => item.typology === `${type}+kk` && typeof item.src === 'string' && /^assets\/[a-zA-Z0-9_./-]+\.(webp|jpe?g|png)$/i.test(item.src) && !item.src.includes('..'));
      selected.sort((a, b) => Number(b.room === 'Obývací pokoj') - Number(a.room === 'Obývací pokoj'));
      if (selected.length) interiorSequences[type] = selected.map((item, index) => ({src:item.src, alt:`${item.room} · ${item.typology}. ${item.title}. Návrhová vizualizace.`, caption:`${item.title} · ${item.typology} · ${index + 1}/${selected.length} · návrh interiéru`, featureCaption:`${item.title} · ${item.typology}`}));
    });
    updateInteriorFeature();
  }).catch(() => { /* The original project visualizations remain available. */ });
  let galleryItems = architecture;
  let galleryIndex = 0;
  $$('[data-variant]').forEach(button => button.addEventListener('click', () => {
    $$('[data-variant]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
    const index = { balconies: 0, 'no-balconies': 1, rear: 2 }[button.dataset.variant];
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
  const renderGallery = () => { const item = galleryItems[galleryIndex]; $('#gallery-image').src = item.src; $('#gallery-image').alt = item.alt; $('#gallery-caption').textContent = item.caption; };
  $$('[data-gallery]').forEach(button => button.addEventListener('click', () => { galleryItems = button.dataset.gallery === 'architecture' ? architecture : interiorSequences[activeInterior]; galleryIndex = Number(button.dataset.index || 0); renderGallery(); openDialog($('#gallery-dialog')); }));
  const stepGallery = step => { galleryIndex = (galleryIndex + step + galleryItems.length) % galleryItems.length; renderGallery(); };
  $('#gallery-prev').addEventListener('click', () => stepGallery(-1));
  $('#gallery-next').addEventListener('click', () => stepGallery(1));
  document.addEventListener('keydown', event => { if ($('#gallery-dialog').open && ['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); stepGallery(event.key === 'ArrowLeft' ? -1 : 1); } if (event.key === 'Escape') closeMenu(); });

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
    const shown = state.all ? filtered : filtered.slice(0,12);
    $('#results-count').textContent = `${unitCount(filtered.length)} v přehledu${shown.length < filtered.length ? ` · zobrazeno ${shown.length}` : ''}`;
    $('#unit-rows').innerHTML = shown.map(unit => `<tr><td>${String(unit.id).padStart(2,'0')}</td><td>${escape(unit.layout)}</td><td>${unit.floor}. NP</td><td>${area(unit.area)}</td><td>${money(unit.price)}</td><td>${statusBadge(unit)}</td><td><button class="favorite-button ${saved.includes(unit.id) ? 'saved' : ''}" data-save="${unit.id}" aria-label="${saved.includes(unit.id) ? 'Odebrat' : 'Uložit'} byt ${unit.id}" aria-pressed="${saved.includes(unit.id)}">${saved.includes(unit.id) ? '♥' : '♡'}</button><button class="unit-detail-button" data-unit="${unit.id}" aria-label="Detail bytu ${unit.id}">Detail <span aria-hidden="true">↗</span></button></td></tr>`).join('');
    $('#empty-results').hidden = filtered.length > 0;
    $('#show-all').hidden = filtered.length <= 12;
    $('#show-all').innerHTML = state.all ? 'Zobrazit méně <span aria-hidden="true">↑</span>' : `Zobrazit všech ${filtered.length} jednotek <span aria-hidden="true">↓</span>`;
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
  $('#reset-filters').addEventListener('click', () => setFilters({layout:'all',floor:'all',area:'all',status:'all',sort:'floor',favorites:false,all:false}));
  $('#clear-saved').addEventListener('click', () => { saved = []; try { localStorage.removeItem(storageKey); } catch (_) {} renderUnits(); notify('Uložené byty byly vymazány.'); });

  function renderUnitDetail(unit) {
    if (!unit) return;
    const directPlan = !!unit.plan;
    const tour = { '1+kk': { id: '1kk', source: '04' }, '2+kk': { id: '2kk', source: '02' }, '3+kk': { id: '3kk', source: '01' } }[unit.layout];
    const conflict = unit.id === 53;
    const planPath = directPlan ? unit.plan : `plans/floor-${unit.floor}.pdf`;
    const previewPath = directPlan ? `assets/plan-unit-${String(unit.id).padStart(2,'0')}.webp` : `assets/plan-floor-${unit.floor}.webp`;
    const notice = conflict ? 'Ceník označuje tuto jednotku číslem 53 v 1. NP. Samostatný dodaný výkres je označen „byt 51 – Suterén“. Jejich shoda není potvrzena. Zde zobrazujeme pouze půdorys 1. NP; konkrétní půdorys bytu si vyžádejte u prodejce.' : directPlan ? 'Samostatný půdorys je dodaný pod číslem tohoto bytu. Konečnou revizi a rozsah ploch potvrďte u prodejce.' : `Zobrazen je půdorys celého ${unit.floor}. NP. Samostatné dodané výkresy bytů 01–10 nepřiřazujeme automaticky k jednotkám ve vyšších podlažích.`;
    $('#unit-dialog-content').innerHTML = `<div class="unit-dialog-grid"><div><a class="unit-plan" href="${planPath}" target="_blank" rel="noopener" aria-label="Otevřít půdorys v PDF"><img src="${previewPath}" alt="${directPlan ? `Zdrojový půdorys bytu ${unit.id}` : `Zdrojový půdorys ${unit.floor}. NP`}" loading="lazy"><span class="plan-caption">${directPlan ? `Půdorys bytu ${String(unit.id).padStart(2,'0')}` : `Půdorys ${unit.floor}. nadzemního podlaží`} · otevřít PDF ↗</span></a><p class="unit-notice">${notice}</p></div><div><p class="eyebrow">REZIDENCE ALEXANDRA · BYDLENÍ</p><h2 id="unit-dialog-title">Byt ${String(unit.id).padStart(2,'0')}</h2><p class="unit-meta">${escape(unit.layout)} <span aria-hidden="true">/</span> ${unit.floor}. nadzemní podlaží</p><dl class="unit-data"><div><dt>Celková plocha</dt><dd>${area(unit.area)}</dd></div><div><dt>Otápěná plocha dle ceníku</dt><dd>${area(unit.heatedArea)}</dd></div><div><dt>Sklep dle ceníku</dt><dd>${unit.cellar === 'ano' ? 'Ano' : 'Neuvedeno'}</dd></div><div><dt>Parkování</dt><dd>Samostatně k dokoupení</dd></div><div><dt>Dostupnost</dt><dd>${statusBadge(unit)}</dd></div></dl><p class="unit-price">${money(unit.price)}</p><span>Orientační cena bytu · ceník k 14. 10. 2026</span><div class="unit-actions"><button class="button button-dark" id="inquire-unit" data-id="${unit.id}">Mám zájem <span aria-hidden="true">↗</span></button><button class="button" data-save="${unit.id}" aria-pressed="${saved.includes(unit.id)}">${saved.includes(unit.id) ? '♥ Uloženo' : '♡ Uložit'}</button><a class="text-link" href="${planPath}" target="_blank" rel="noopener">Půdorys PDF ↗</a>${tour ? `<a class="text-link unit-tour-link" href="tour.html?byt=${tour.id}">Typová 360° prohlídka ${escape(unit.layout)} ↗</a>` : ''}</div>${tour ? `<p class="unit-tour-note">Typová prohlídka vychází z bytu ${tour.source} a ukazuje návrh zařízení. Nemusí odpovídat přesné dispozici vybrané jednotky.</p>` : ''}<p class="unit-footnote">Cena nezahrnuje parkování. Celková a otápěná plocha jsou samostatné údaje z ceníku; jejich rozdíl není automaticky výměrou balkonu nebo sklepa. Konečnou cenu, standard a dostupnost potvrdí prodejce.</p></div></div>`;
    $('#inquire-unit').addEventListener('click', () => { $('#unit-dialog').close(); selectInterest(`Byt ${unit.id} · ${unit.layout} · ${unit.floor}. NP`); $('#contact-message').value = `Dobrý den, mám zájem o byt č. ${unit.id} (${unit.layout}, ${unit.floor}. NP) v Rezidenci Alexandra. Prosím o potvrzení aktuální dostupnosti, ceny a podmínek prodeje.`; $('#kontakt').scrollIntoView({behavior:'smooth'}); setTimeout(() => $('#contact-name').focus({preventScroll:true}), 400); });
  }
  function renderCompare() {
    const selected = saved.map(id => units.find(unit => unit.id === id)).filter(Boolean);
    if (!selected.length) { $('#compare-dialog').close(); return; }
    const rows = [['Dispozice',u=>u.layout],['Podlaží',u=>`${u.floor}. NP`],['Celková plocha',u=>area(u.area)],['Otápěná plocha',u=>area(u.heatedArea)],['Sklep dle ceníku',u=>u.cellar==='ano'?'Ano':'Neuvedeno'],['Cena bytu',u=>money(u.price)],['Dostupnost',u=>statusOf(u).label]];
    $('#compare-content').innerHTML = `<div class="compare-table-wrap"><table class="compare-table"><thead><tr><th scope="col">PARAMETR</th>${selected.map(u=>`<th scope="col">Byt ${String(u.id).padStart(2,'0')}</th>`).join('')}</tr></thead><tbody>${rows.map(([label,fn])=>`<tr><th scope="row">${label}</th>${selected.map(u=>`<td>${label === 'Dostupnost' ? statusBadge(u) : escape(fn(u))}</td>`).join('')}</tr>`).join('')}<tr><th scope="row">Půdorys a podrobnosti</th>${selected.map(u=>`<td><button class="button button-dark" data-unit="${u.id}">Detail bytu ↗</button></td>`).join('')}</tr><tr><th scope="row">Uložený výběr</th>${selected.map(u=>`<td><button class="text-link" data-save="${u.id}">Odebrat ×</button></td>`).join('')}</tr></tbody></table></div><p class="compare-note">Orientační ceny k 14. 10. 2026 bez parkování. Aktuální dostupnost potvrdí prodejce. ${selected.some(u=>u.id===53) ? 'U jednotky 53 není potvrzeno přiřazení samostatného půdorysu.' : ''}</p>`;
  }
  $('#open-compare').addEventListener('click', () => { renderCompare(); openDialog($('#compare-dialog')); });

  function selectInterest(value) { const select = $('#contact-interest'); let option = [...select.options].find(item => item.value === value); if (!option) { option = document.createElement('option'); option.value = value; option.textContent = value; select.appendChild(option); } select.value = value; }
  $('#inquiry-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const name = $('#contact-name').value.trim();
    if (!name) { $('#contact-name').setCustomValidity('Vyplňte prosím své jméno.'); $('#contact-name').reportValidity(); return; }
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
  $('#contact-name').addEventListener('input', () => $('#contact-name').setCustomValidity(''));
  window.AlexandraCatalog = Object.freeze({ snapshot, setFilters, openUnit, isSaved: id => { const unit = findUnit(id); return !!unit && saved.includes(unit.id); } });
  renderUnits();
})();
