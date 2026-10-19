(() => {
  'use strict';
  const icon = (name, variant = 'ui') => window.AlexandraIcons?.svg(name, variant) || '';
  const dialog = document.getElementById('furnished-plan-dialog');
  if (!dialog) return;
  const $ = selector => dialog.querySelector(selector);
  const units = window.ALEXANDRA_UNITS || [];
  const number = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 });
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const findUnit = value => {
    const id = typeof value === 'object' && value ? value.id : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    return Number.isSafeInteger(id) ? units.find(unit => unit.id === id) : null;
  };
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = (value, max = 400) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  const variants = new Map(), assignments = new Map();
  let currentUnit = null, view = '3d', returnFocus = null, globalNote = '', imageRequest = 0;

  function validateManifest(data) {
    if (!object(data) || data.version !== 1 || !object(data.units) || !object(data.variants)) throw new Error('Neplatný přehled zařízených půdorysů.');
    const checkedVariants = new Map(), checkedAssignments = new Map();
    for (const [id, raw] of Object.entries(data.variants)) {
      if (!/^variant-(0[1-9]|10)$/.test(id) || !object(raw) || raw.id !== id || raw.sourceUnit !== Number(id.slice(-2))) throw new Error('Neplatná dispoziční rodina.');
      const expectedImage = `assets/furnished-plans-v2/${id}.webp`;
      const expectedThumb = `assets/furnished-plans-v2/${id}-thumb.webp`;
      const expectedFull = `assets/furnished-plans-v2/${id}-4k.webp`;
      if (raw.fullResolution !== expectedFull || raw.renderer !== 'Blender Cycles') throw new Error('Neplatný 4K náhled.');
      if (raw.image !== expectedImage || (raw.thumbnail != null && raw.thumbnail !== expectedThumb && raw.thumbnail !== expectedImage)) throw new Error('Neplatná cesta náhledu.');
      if (!Array.isArray(raw.rooms) || !raw.rooms.length || raw.rooms.length > 20) throw new Error('Chybí legenda místností.');
      const roomNumbers = new Set();
      const rooms = raw.rooms.map(room => {
        if (!object(room) || !Number.isInteger(room.number) || room.number < 1 || room.number > 99 || roomNumbers.has(room.number) || !text(room.label, 120)) throw new Error('Neplatná legenda místností.');
        roomNumbers.add(room.number);
        const normalized = value => Number.isFinite(value) && value >= 0 && value <= 1;
        return Object.freeze({ number: room.number, label: room.label, ...(normalized(room.x) && normalized(room.y) ? { x: room.x, y: room.y } : {}) });
      });
      checkedVariants.set(id, Object.freeze({ id, sourceUnit: raw.sourceUnit, image: expectedImage, fullResolution: expectedFull, thumbnail: raw.thumbnail || expectedImage, rooms: Object.freeze(rooms), note: text(raw.note) ? raw.note : 'Návrh zařízení · dispozice dle projektových podkladů.' }));
    }
    for (const [unitId, variantId] of Object.entries(data.units)) {
      if (!/^[1-9]\d?$/.test(unitId)) throw new Error('Neplatné číslo jednotky.');
      const unit = findUnit(Number(unitId));
      if (!unit || unit.id < 1 || unit.id > 50 || typeof variantId !== 'string' || !checkedVariants.has(variantId)) throw new Error('Nepotvrzené přiřazení půdorysu.');
      const family = `variant-${String((unit.id - 1) % 10 + 1).padStart(2, '0')}`;
      if (variantId !== family) throw new Error('Náhled neodpovídá ověřené rodině bytu.');
      checkedAssignments.set(unit.id, variantId);
    }
    return { checkedVariants, checkedAssignments, note: text(data.note, 600) ? data.note : '' };
  }

  const variantFor = unit => unit && variants.get(assignments.get(unit.id));
  const pdfFor = unit => unit.id >= 1 && unit.id <= 10 ? `plans/unit-${String(unit.id).padStart(2, '0')}.pdf` : `plans/floor-${unit.floor}.pdf`;
  const sourceFor = unit => unit.id >= 1 && unit.id <= 10 ? `assets/plan-unit-${String(unit.id).padStart(2, '0')}.webp` : `assets/plan-floor-${unit.floor}.webp`;
  const sourceLabel = unit => unit.id >= 1 && unit.id <= 10 ? `Původní půdorys bytu ${unit.id}` : `Původní půdorys ${unit.floor}. nadzemního podlaží`;

  function previewHTML(value, scope = 'map') {
    const unit = findUnit(value), variant = variantFor(unit);
    if (!variant) return '';
    const detail = scope === 'detail';
    return `<button type="button" class="furnished-preview furnished-preview--${detail ? 'detail unit-plan' : 'map map-card-plan'}" data-furnished-unit="${unit.id}" aria-haspopup="dialog" aria-controls="furnished-plan-dialog" aria-label="Zobrazit zařízený 3D půdorys bytu ${unit.id}"><span class="furnished-preview-media"><img src="${escape(variant.thumbnail)}" width="640" height="640" alt="Návrh zařízení dispoziční rodiny bytu ${unit.id}" loading="lazy" decoding="async"><span class="furnished-preview-mark" aria-hidden="true">3D</span></span><span class="furnished-preview-caption"><strong>Návrh zařízení bytu</strong><span>Prohlédnout návrh ${icon('arrow-up-right')}</span></span></button>`;
  }

  function watchImage(image, source = false) {
    const request = ++imageRequest, canvas = $('#furnished-plan-canvas');
    const loading = document.createElement('p');
    loading.className = 'furnished-load-status';
    loading.setAttribute('role', 'status');
    loading.textContent = 'Načítání půdorysu…';
    canvas.append(loading);
    canvas.setAttribute('aria-busy', 'true');
    const finish = ok => {
      if (request !== imageRequest) return;
      loading.hidden = true;
      canvas.setAttribute('aria-busy', 'false');
      if (ok) return;
      if (source) {
        image.hidden = true;
        $('.furnished-source-sheet>span').innerHTML = `Náhled není dostupný. Otevřít původní PDF ${icon('arrow-up-right')}`;
      } else {
        const plane = $('.furnished-image-plane'), error = $('.furnished-image-error');
        if (plane) plane.hidden = true;
        if (error) error.hidden = false;
      }
    };
    image.addEventListener('load', () => finish(true), {once:true});
    image.addEventListener('error', () => finish(false), {once:true});
    if (image.complete) queueMicrotask(() => finish(image.naturalWidth > 0));
  }

  function renderView() {
    const unit = currentUnit, variant = variantFor(unit);
    if (!variant) return;
    dialog.querySelectorAll('[data-furnished-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.furnishedView === view)));
    $('#furnished-plan-workbench').dataset.view = view;
    $('#furnished-room-legend').hidden = view !== '3d';
    $('#furnished-view-note').textContent = view === '3d' ? variant.note : `${sourceLabel(unit)}. Otevřete PDF pro podrobné kóty a původní legendu.`;
    if (view === 'source') {
      $('#furnished-plan-canvas').innerHTML = `<a class="furnished-source-sheet" href="${pdfFor(unit)}" target="_blank" rel="noopener"><img src="${sourceFor(unit)}" alt="${escape(sourceLabel(unit))}" decoding="async"><span>Otevřít původní PDF ${icon('arrow-up-right')}</span></a>`;
      watchImage($('.furnished-source-sheet>img'), true);
      return;
    }
    $('#furnished-plan-canvas').innerHTML = `<div class="furnished-image-plane"><img src="${escape(variant.image)}" srcset="${escape(variant.thumbnail)} 640w, ${escape(variant.image)} 2200w" sizes="(max-width:900px) calc(100vw - 64px), 680px" width="2200" height="2200" alt="Zařízený 3D půdorys dispoziční rodiny bytu ${unit.id}; návrh interiéru bez balkonů" decoding="async" data-furnished-full-image>${variant.rooms.filter(room => own(room, 'x')).map(room => `<span class="furnished-room-pin" style="left:${(room.x * 100).toFixed(3)}%;top:${(room.y * 100).toFixed(3)}%" aria-hidden="true">${room.number}</span>`).join('')}<a class="furnished-zoom" href="${escape(variant.fullResolution)}" target="_blank" rel="noopener" aria-label="Otevřít 4K půdorys bytu ${unit.id} v nové záložce">Otevřít 4K ${icon('arrow-up-right')}</a></div><div class="furnished-image-error" hidden role="status"><p>Náhled se nepodařilo načíst.</p><button type="button" data-furnished-view="source">Zobrazit zdrojový půdorys ${icon('arrow-up-right')}</button></div>`;
    watchImage($('[data-furnished-full-image]'));
  }

  function open(value, trigger = document.activeElement) {
    const unit = findUnit(value), variant = variantFor(unit);
    if (!variant) return false;
    currentUnit = unit;
    view = '3d';
    returnFocus = { element: trigger, scope: trigger?.closest?.('#unit-dialog, #map-unit-card')?.id, unit: unit.id };
    $('#furnished-plan-title').textContent = `Byt ${String(unit.id).padStart(2, '0')}`;
    $('#furnished-plan-meta').innerHTML = `<span class="icon-label">${icon('plan', 'art')} <span>${escape(unit.layout)}</span></span> · ${escape(unit.floor)}. nadzemní podlaží · <span class="icon-label">${icon('area', 'art')} <span>${escape(number.format(unit.area))} m²</span></span>`;
    $('#furnished-plan-status').textContent = window.AlexandraInventory?.status(unit).label || 'Dostupnost na dotaz';
    $('#furnished-plan-price').textContent = `${number.format(unit.price)} Kč`;
    $('#furnished-room-legend').innerHTML = `<p class="furnished-legend-title">MÍSTNOSTI V NÁVRHU</p><ol>${variant.rooms.map(room => `<li><span class="furnished-legend-number">${room.number}</span><span>${escape(room.label)}</span></li>`).join('')}</ol><p class="furnished-legend-note">Kuchyňská linka, domácí spotřebiče, nábytek a předokenní žaluzie nejsou součástí prodejní ceny. <a href="#vybaveni" data-furnished-equipment>Vybavení v ceně bytu</a>.</p>`;
    $('#furnished-plan-pdf').href = pdfFor(unit);
    $('#furnished-plan-pdf').innerHTML = `${unit.id <= 10 ? 'Půdorys bytu PDF' : `Půdorys ${escape(unit.floor)}. NP PDF`} ${icon('arrow-up-right')}`;
    const tour = { '1+kk': '1kk', '2+kk': '2kk', '3+kk': '3kk' }[unit.layout];
    $('#furnished-plan-tour').href = `tour.html?byt=${tour}#walkthrough`;
    $('#furnished-plan-tour').hidden = !tour;
    $('#furnished-plan-caveat').textContent = globalNote || 'Návrh možného zařízení podle dispoziční rodiny. Balkony nejsou součástí 3D náhledu a liší se podle podlaží. Přesné rozměry a závazné provedení ověřte ve zdrojovém výkresu a u prodejce.';
    renderView();
    if (!dialog.open) dialog.showModal();
    dialog.setAttribute('aria-describedby', 'furnished-plan-meta furnished-plan-caveat');
    dialog.scrollTop = 0;
    return true;
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest?.('[data-furnished-unit]');
    if (!trigger) return;
    if (open(trigger.dataset.furnishedUnit, trigger)) event.preventDefault();
  });
  dialog.addEventListener('click', event => {
    if (event.target.closest?.('[data-furnished-equipment]')) {
      const equipment = document.getElementById('vybaveni');
      if (!equipment) return;
      event.preventDefault();
      document.querySelectorAll('dialog[open]').forEach(openDialog => openDialog.close());
      requestAnimationFrame(() => requestAnimationFrame(() => {
        equipment.tabIndex = -1;
        equipment.focus({ preventScroll: true });
        equipment.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        const url = new URL(location.href); url.hash = 'vybaveni'; history.replaceState(null, '', url);
      }));
      return;
    }
    const button = event.target.closest?.('[data-furnished-view]');
    if (button && ['3d', 'source'].includes(button.dataset.furnishedView)) {
      const wasFocused = document.activeElement === button;
      view = button.dataset.furnishedView;
      renderView();
      if (wasFocused && !button.isConnected) $(`.furnished-view-switch [data-furnished-view="${view}"]`)?.focus({preventScroll:true});
      return;
    }
    if (event.target.closest?.('[data-furnished-close]')) { dialog.close(); return; }
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const button = event.target.closest('.furnished-view-switch [data-furnished-view]');
    if (!button) return;
    event.preventDefault();
    view = ['ArrowLeft','Home'].includes(event.key) ? '3d' : 'source';
    renderView();
    $(`.furnished-view-switch [data-furnished-view="${view}"]`)?.focus({preventScroll:true});
  });
  dialog.addEventListener('close', () => {
    if (!returnFocus) return;
    const scope = returnFocus.scope ? document.getElementById(returnFocus.scope) : document;
    const target = returnFocus.element?.isConnected ? returnFocus.element : scope?.querySelector(`[data-furnished-unit="${returnFocus.unit}"]`);
    const otherDialog = document.querySelector('dialog[open]');
    if (target && (!otherDialog || otherDialog.contains(target))) target.focus({ preventScroll: true });
    returnFocus = null;
  });

  document.addEventListener('alexandra:inventory-change', () => {
    if (!currentUnit || !dialog.open) return;
    $('#furnished-plan-status').textContent = window.AlexandraInventory?.status(currentUnit).label || 'Dostupnost na dotaz';
  });

  const ready = fetch('assets/furnished-plans-v2/manifest.json').then(response => {
    if (!response.ok) throw new Error('Zařízené půdorysy nejsou dostupné.');
    return response.json();
  }).then(data => {
    const checked = validateManifest(data);
    checked.checkedVariants.forEach((value, key) => variants.set(key, value));
    checked.checkedAssignments.forEach((value, key) => assignments.set(key, value));
    globalNote = checked.note;
    document.dispatchEvent(new CustomEvent('alexandra:furnished-ready'));
    return true;
  }).catch(error => {
    console.warn('Furnished plans:', error.message);
    return false;
  });
  window.AlexandraFurnishedPlans = Object.freeze({ previewHTML, open, has: value => !!variantFor(findUnit(value)), ready });
})();
