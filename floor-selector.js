(() => {
  'use strict';
  const icon = (name, variant = 'ui') => window.AlexandraIcons?.svg(name, variant) || '';
  const root = document.querySelector('#floor-explorer');
  if (!root) return;
  const $ = selector => root.querySelector(selector);
  const units = window.ALEXANDRA_UNITS || [];
  const floorLabel = window.AlexandraFloorLabels.label;
  const catalog = window.AlexandraCatalog;
  const inventory = window.AlexandraInventory;
  const number = new Intl.NumberFormat('cs-CZ', {maximumFractionDigits:2});
  const price = value => `${number.format(value)} Kč`;
  const area = value => `${number.format(value)} m²`;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const status = unit => inventory.status(unit);
  let floors = [], activeFloor = 2, selectedId = null, unitPicker;
  let step = 1, planLayout = 'all', facadeSide = 'front', roomIndex = 0;
  let orientation = { confirmed:false, northDegrees:null };
  const safeImage = path => typeof path === 'string' && /^assets\/floors\/[a-z0-9-]+\.webp$/.test(path);
  const validPoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  const path = points => points.map((p,i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ') + 'Z';
  const normalized = (f, points) => points.map(([x,y]) => [x * 1000 / f.width, y * 1000 / f.width]);
  const floorData = () => floors.find(f => f.floor === activeFloor);
  const matching = unit => planLayout === 'all' || unit.layout === planLayout;
  const polygonData = id => floorData()?.units.find(u => u.id === id);
  const badge = unit => `<span class="status-badge status-${status(unit).key}"><span class="availability-dot" aria-hidden="true"></span>${esc(status(unit).label)}</span>`;
  function orientationHTML() {
    if (orientation.confirmed !== true || !Number.isFinite(orientation.northDegrees)) return '<p class="floor-orientation is-pending">Orientaci ke světovým stranám doplníme.</p>';
    const labels = [['S',0],['V',90],['J',180],['Z',270]].map(([label,offset]) => {
      const angle=(orientation.northDegrees+offset-90)*Math.PI/180;
      return `<text x="${(44+34*Math.cos(angle)).toFixed(2)}" y="${(44+34*Math.sin(angle)).toFixed(2)}">${label}</text>`;
    }).join('');
    return `<div class="floor-orientation is-confirmed" data-north-degrees="${orientation.northDegrees}"><svg viewBox="0 0 88 88" role="img" aria-label="Světové strany ve zobrazeném půdorysu; S označuje sever"><circle cx="44" cy="44" r="24"/><g transform="rotate(${orientation.northDegrees} 44 44)"><path class="compass-axis" d="M44 16V72M16 44H72"/><path class="compass-north" d="M44 16 51 47 44 43 37 47Z"/></g>${labels}</svg><span>S = sever</span></div>`;
  }
  function locationHTML(unit) {
    const f = floors.find(floor => floor.floor === unit?.floor);
    const selected = f?.units.find(item => item.id === unit?.id);
    if (!f || !selected) return '';
    const title = `Umístění bytu ${unit.id} · ${floorLabel(unit.floor)}`;
    const levels = [...floors].reverse().map((floor, index) => {
      const y = 14 + index * 22, active = floor.floor === unit.floor;
      return `<g class="${active ? 'is-active' : ''}" data-location-floor="${floor.floor}"><rect x="6" y="${y}" width="104" height="19" rx="2"/><text x="58" y="${y+13}">${esc(floorLabel(floor.floor))}</text></g>`;
    }).join('');
    const plan = f.units.map(item => `<path class="${item.id === unit.id ? 'is-active' : ''}" data-location-unit="${item.id}" d="${path(item.polygon)}"/>`).join('');
    return `<figure class="unit-location" data-unit-location="${unit.id}" data-orientation-state="${orientation.confirmed ? 'confirmed' : 'pending'}"><figcaption>${esc(title)}</figcaption><div class="unit-location-views"><svg class="unit-location-building" viewBox="0 0 116 158" role="img" aria-label="Zvýrazněné podlaží: ${esc(floorLabel(unit.floor))}"><title>${esc(floorLabel(f.floor))}</title>${levels}</svg><svg class="unit-location-plan" viewBox="0 0 ${f.width} ${f.height}" role="img" aria-label="Byt ${unit.id} zvýrazněný v půdorysu ${esc(floorLabel(f.floor))}"><title>Poloha bytu ${unit.id} v podlaží</title><image href="${esc(f.mapImage || f.image)}" width="${f.width}" height="${f.height}"/>${plan}</svg></div>${orientationHTML()}</figure>`;
  }
  window.AlexandraUnitLocation = Object.freeze({ html: locationHTML });
  const facades = {
    front: {
      src: 'assets/exterior-no-balconies.webp',
      viewBox: '465 65 1000 660',
      levels: [
        [[548,245],[812,92],[1304,282]], [[548,329],[812,236],[1304,357]],
        [[548,406],[812,333],[1304,429]], [[548,482],[812,431],[1304,500]],
        [[548,556],[812,529],[1304,570]], [[548,629],[812,626],[1304,639]],
        [[548,674],[812,682],[1304,683]]
      ]
    },
    rear: {
      src: 'assets/exterior-rear-no-balconies.webp',
      viewBox: '314 40 1190 730',
      levels: [
        [[415,142],[1268,84]], [[415,246],[1275,211]], [[413,338],[1277,312]],
        [[411,427],[1279,412]], [[408,518],[1282,514]], [[406,611],[1286,614]],
        [[405,702],[1288,698]]
      ]
    }
  };
  function drawFacade(side) {
    facadeSide = side;
    const {src, viewBox, levels} = facades[side];
    const svg = $('#building-stack');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('aria-describedby', 'building-selection-caption');
    const floorShapes = [...floors].reverse().map(f => {
      const i = 6 - f.floor;
      const upper = levels[i], lower = levels[i + 1];
      const y = (upper.at(-1)[1] + lower.at(-1)[1]) / 2;
      const outline = [...upper, ...[...lower].reverse()];
      const label = floorLabel(f.floor);
      return `<g class="stack-floor building-selection-floor" role="button" tabindex="0" data-map-floor="${f.floor}" aria-label="Vybrat patro: ${esc(label)}" aria-pressed="${activeFloor === f.floor}">
        <path class="building-selection-zone" d="${path(outline)}"/>
        <path class="building-selection-leader" d="M${upper.at(-1)[0]} ${y}H1340"/>
        <rect class="building-selection-label" x="1334" y="${y-24}" width="124" height="48" rx="7"/>
        <text class="building-selection-number" x="1396" y="${y+1}"${f.floor===1?' style="font-size:23px"':''}>${label}</text></g>`;
    });
    svg.innerHTML = `<title>${side==='front'?'Přední':'Zadní'} pohled · výběr patra</title><image href="${src}" width="1672" height="941" id="building-selection-image"/>${floorShapes.join('')}`;
  }
  function drawStack() {
    drawFacade(facadeSide);
    const buttons = [...floors].reverse().map(f =>
      `<button type="button" data-map-floor="${f.floor}" aria-pressed="${f.floor===activeFloor}"><span class="building-floor-name">${floorLabel(f.floor)}</span><span class="building-floor-availability" data-floor-summary="${f.floor}"></span></button>`
    ).join('');
    $('#floor-buttons').innerHTML = buttons;
    $('#plan-floor-buttons').innerHTML = buttons;
    updateBuildingSummary();
  }

  function updateBuildingSummary() {
    root.querySelectorAll('[data-floor-summary]').forEach(target => {
      const floor = Number(target.dataset.floorSummary), list = units.filter(u => u.floor === floor);
      const counts = {available:0,reserved:0,sold:0,unknown:0};
      list.forEach(u => counts[status(u).key]++);
      const labels = {available:'volné',reserved:'rezervované',sold:'prodané',unknown:'na dotaz'};
      target.innerHTML = Object.entries(counts).filter(([,count])=>count).map(([key,count])=>`<span class="building-status-count status-${key}"><i aria-hidden="true"></i>${count} <span>${labels[key]}</span></span>`).join('');
      target.parentElement.setAttribute('aria-label', `${floorLabel(floor)}: ${Object.entries(counts).filter(([,count])=>count).map(([key,count])=>`${count} ${labels[key]}`).join(', ')}`);
    });
  }

  function floorTransform() {
    const f = floorData(), height = f.height * 1000 / f.width;
    return `translate(22px, ${Math.max(22,(760-height*.956)/2)}px) scale(.956)`;
  }

  function fitFloorViewport() {
    const f = floorData();
    if (!f) return;
    const height = f.height * 1000 / f.width;
    // Match floorTransform without changing the survey/image coordinates.
    const matrix = [.956, 0, 0, .956, 22, Math.max(22,(760-height*.956)/2)];
    const points = [[0,0],[1000,0],[1000,height],[0,height], ...normalized(f,f.outline)];
    f.units.forEach(unit => {
      points.push(...normalized(f,unit.polygon));
      const [x,y] = normalized(f,[unit.labelPoint])[0];
      // Cover both desktop labels (118 × 66) and larger mobile labels (124 × 80).
      points.push([x-62,y-39],[x+62,y-39],[x+62,y+41],[x-62,y+41]);
    });
    const [a,b,c,d,e,g] = matrix;
    const transformed = points.map(([x,y]) => [a*x+c*y+e,b*x+d*y+g]);
    const xs = transformed.map(point => point[0]), ys = transformed.map(point => point[1]);
    const left = Math.floor(Math.min(...xs)-24), top = Math.floor(Math.min(...ys)-24);
    const width = Math.ceil(Math.max(...xs)+24)-left, fittedHeight = Math.ceil(Math.max(...ys)+24)-top;
    const canvas = $('#floor-canvas');
    canvas.setAttribute('viewBox', `${left} ${top} ${width} ${fittedHeight}`);
    canvas.style.aspectRatio = `${width} / ${fittedHeight}`;
  }

  function drawFloor() {
    const f = floorData();
    $('#map-floor-title').textContent = `${floorLabel(activeFloor)}`;
    $('#map-floor-pdf').href = `plans/floor-sheet-${activeFloor}-20261103.pdf`;
    $('#map-floor-pdf').setAttribute('aria-label', `Půdorys podlaží: ${floorLabel(activeFloor)}`);
    $('#map-floor-pdf').title = `Půdorys ${floorLabel(activeFloor)}`;
    $('#map-floor-pdf').innerHTML = `Půdorys podlaží ${icon('arrow-up-right')}`;
    const originalLink = $('#map-floor-original');
    if (originalLink) { originalLink.href = `plans/floor-${activeFloor}.pdf`; originalLink.title = window.AlexandraFloorLabels.source(activeFloor); originalLink.setAttribute('aria-label', `Původní projektový výkres: ${window.AlexandraFloorLabels.source(activeFloor)}`); }
    const normalizedOutline = normalized(f,f.outline);
    $('#floor-canvas').innerHTML = `<title>Půdorys · ${floorLabel(activeFloor)} · výběr bytů</title><g class="floor-projection" style="transform:${floorTransform()}"><path class="floor-sheet" d="${path(normalizedOutline)}"/><image class="floor-linework" href="${esc(f.mapImage || f.image)}" width="1000" height="${f.height*1000/f.width}"/>${f.units.map(p => {
      const u=units.find(unit=>unit.id===p.id);
      const s=status(u), center=normalized(f,[p.labelPoint])[0];
      return `<g class="map-apartment" role="button" tabindex="0" data-map-unit="${u.id}" data-status="${s.key}" aria-label="Byt ${u.id}, ${esc(u.layout)}, ${area(u.area)}, ${esc(s.label)}" aria-pressed="false"><path class="unit-shape" d="${path(normalized(f,p.polygon))}"/><g transform="translate(${center[0]},${center[1]})" pointer-events="none"><rect class="unit-tag-bg" x="-59" y="-32" width="118" height="66" rx="8"/><text class="unit-tag-number" y="-7">${String(u.id).padStart(2,'0')}</text><text class="unit-tag-layout" y="19">${esc(u.layout)}</text></g></g>`;
    }).join('')}</g>`;
    fitFloorViewport();
    const compass = $('#map-floor-orientation');
    if (compass) compass.innerHTML=orientationHTML();
    $('#map-floor-description').textContent = activeFloor === 1 ? 'Byt 51 · přízemí' : 'Vyberte byt přímo v půdorysu.';
    $('#map-floor-special').hidden = true;
    const picker = unitPicker;
    if (picker) picker.innerHTML = '<option value="">Vyberte byt</option>' + units.filter(u => u.floor === activeFloor).map(u => `<option value="${u.id}">Byt ${String(u.id).padStart(2,'0')} · ${esc(u.layout)} · ${area(u.area)}</option>`).join('');
    updatePlanState();
  }

  function updatePlanState() {
    root.querySelectorAll('[data-map-floor]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.mapFloor)===activeFloor)));
    root.querySelectorAll('[data-map-unit]').forEach(b=>{
      const id=Number(b.dataset.mapUnit);
      const unit=units.find(u=>u.id===id), match=unit && matching(unit);
      if (unit) {
        b.dataset.status=status(unit).key;
        b.setAttribute('aria-label',`Byt ${unit.id}, ${unit.layout}, ${area(unit.area)}, ${status(unit).label}`);
      }
      b.setAttribute('aria-pressed',String(id===selectedId));
      b.dataset.filtered=String(!match);
      b.setAttribute('aria-disabled',String(!match));
      b.setAttribute('tabindex',match?'0':'-1');
    });
    const floorUnits=units.filter(u=>u.floor===activeFloor), visible=floorUnits.filter(matching);
    const unitCount = n => n === 1 ? '1 jednotka' : n >= 2 && n <= 4 ? `${n} jednotky` : `${n} jednotek`;
    $('#map-floor-count').textContent = planLayout === 'all' ? unitCount(floorUnits.length) : `${visible.length} z ${floorUnits.length} · ${planLayout}`;
    root.querySelectorAll('[data-plan-layout]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.planLayout === planLayout)));
    $('#map-no-results').hidden=visible.length>0;
    const picker = unitPicker;
    if (picker) {
      Array.from(picker.options).forEach(option => { option.disabled = option.value !== '' && !visible.some(unit => unit.id === Number(option.value)); });
      picker.value = selectedId === null ? '' : String(selectedId);
      picker.disabled = visible.length === 0;
    }
    const counts={available:0,reserved:0,sold:0,unknown:0};
    floorUnits.forEach(u=>counts[status(u).key]++);
    Object.keys(counts).forEach(key=>$('#legend-'+key).textContent=String(counts[key]));
    updateBuildingSummary();
  }

  function selectedPlan(unit) {
    const furnished = window.AlexandraFurnishedPlans?.previewHTML(unit, 'selection');
    if (furnished) return furnished;
    const f=floorData(), shape=polygonData(unit.id);
    if(!shape) return `<a class="map-card-plan" href="plans/floor-sheet-${unit.floor}-20261103.pdf" target="_blank" rel="noopener"><img src="${esc(f.image)}" alt="Původní půdorys · ${floorLabel(unit.floor)}"><span>Celé podlaží · otevřít PDF ${icon('arrow-up-right')}</span></a>`;
    const points=shape.polygon, xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y,pad=Math.min(w,h)*.045;
    const pdf=unit.plan || `plans/floor-sheet-${unit.floor}-20261103.pdf`;
    return `<a class="map-card-plan" href="${esc(pdf)}" target="_blank" rel="noopener" aria-label="Otevřít ${unit.plan?'půdorys bytu':'zdrojový půdorys podlaží'} v PDF"><svg viewBox="${x-pad} ${y-pad} ${w+pad*2} ${h+pad*2}" role="img" aria-label="Výřez rozložení bytu ${unit.id} ze zdrojového půdorysu · ${floorLabel(unit.floor)}"><defs><clipPath id="selected-unit-clip"><path d="${path(points)}"/></clipPath></defs><image href="${esc(f.image)}" width="${f.width}" height="${f.height}" clip-path="url(#selected-unit-clip)"/></svg><span>Rozložení bytu · půdorys podlaží ${icon('arrow-up-right')}</span></a>`;
  }

  function roomGallery(unit) {
    const rooms = unit.id === 51 ? [] : catalog.roomPhotos(unit.layout);
    if (!rooms.length) {
      const plan = unit.plan || `plans/floor-sheet-${unit.floor}-20261103.pdf`;
      const img = unit.plan ? `assets/plan-unit-${String(unit.id).padStart(2,'0')}.webp` : floorData().image;
      return `<figure class="unit-source-plan"><a href="${esc(plan)}" target="_blank" rel="noopener"><img alt="Projektový půdorys pro byt ${unit.id}" src="${esc(img)}"><span>Otevřít půdorys v PDF ${icon('arrow-up-right')}</span></a></figure>`;
    }
    const photo = rooms[roomIndex] || rooms[0];
    const thumbs = rooms.map((item,index) =>
      `<button type="button" data-room-photo="${index}" aria-pressed="${item===photo}" aria-label="${esc(item.room)}"><img src="${esc(item.thumb)}" width="160" height="90" loading="lazy" alt=""><span>${esc(item.room)}</span></button>`
    ).join('');
    return `<figure class="unit-room-frame"><img class="unit-room-main" src="${esc(photo.src)}" alt="${esc(photo.alt)}" width="${photo.width}" height="${photo.height}" decoding="async">
      <figcaption><strong>Byt ${unit.id} · ${esc(unit.layout)}</strong><span data-room-caption>${esc(photo.room)}</span></figcaption></figure>
      <div class="unit-room-thumbs" role="group" aria-label="Místnosti pro dispozici ${esc(unit.layout)}">${thumbs}</div>
      <p class="room-scope">Typová vizualizace. Rozsah vybavení určuje standard bytu.</p>`;
  }
  function changeRoom(button) {
    const unit = units.find(item => item.id === selectedId);
    const index = Number(button.dataset.roomPhoto);
    const photo = unit && catalog.roomPhotos(unit.layout)[index];
    if (!photo) return;
    roomIndex = index;
    $('.unit-room-main').src = photo.src;
    $('.unit-room-main').alt = photo.alt;
    $('[data-room-caption]').textContent = photo.room;
    root.querySelectorAll('[data-room-photo]').forEach(b => b.setAttribute('aria-pressed',String(b===button)));
  }
  function drawCard() {
    const card = $('#map-unit-card');
    const unit = units.find(item => item.id === selectedId);
    if (step !== 3 || !unit) return;
    const focused = document.activeElement;
    const focusKey = card.contains(focused) && ['data-room-photo','data-save','data-unit','data-furnished-unit','data-pick-back','href'].find(key => focused.hasAttribute(key));
    const details = window.AlexandraDetails.get(unit);
    const saved = catalog.isSaved(unit.id);
    const plan = unit.id === 51 ? '' : selectedPlan(unit);
    const tour = unit.id === 51 ? '' : `<a class="text-link detail-tour" href="${esc(window.AlexandraDetails.tourHref(unit))}">Typová 360° prohlídka ${icon('arrow-up-right')}</a>`;
    card.innerHTML = `<div class="unit-detail-back"><button type="button" class="pick-back" data-pick-back="2">${icon('arrow-left')}Zpět na výběr jednotky</button></div>
      <div class="unit-photos">${roomGallery(unit)}${plan}</div>
      <div class="map-card-overview">
        <div class="map-card-topline"><p class="eyebrow">Vybraný byt</p><button type="button" class="favorite-button${saved?' saved':''}" data-save="${unit.id}" aria-pressed="${saved}" aria-label="${saved?'Odebrat':'Uložit'} byt ${unit.id}">${icon(saved?'favorite-filled':'favorite')}</button></div>
        <h3 id="picked-unit-title" tabindex="-1">Byt ${String(unit.id).padStart(2,'0')}</h3>${badge(unit)}
        <p class="map-unit-meta">${esc(unit.layout)} / ${esc(floorLabel(unit.floor))}${details.locationNote?' · '+esc(details.locationNote):''}</p>
        <p class="map-card-price">${price(unit.price)}</p><p class="map-price-note">Orientační cena · bez parkování</p>
        <div class="map-card-actions"><a class="button viewing-cta" href="#kontakt" data-viewing-unit="${unit.id}">Domluvit prohlídku ${icon('arrow-up-right')}</a>
          <button type="button" class="unit-detail-button" data-unit="${unit.id}">Detail bytu ${icon('arrow-up-right')}</button>
          <div class="map-card-links"><a class="text-link" href="#hypoteka" data-mortgage-unit="${unit.id}">Spočítat hypotéku ${icon('arrow-up-right')}</a><a class="text-link" href="#parkovani" data-section-link="parkovani" data-unit-id="${unit.id}">Parkování ${icon('arrow-up-right')}</a><a class="text-link" href="#vybaveni" data-section-link="vybaveni" data-unit-id="${unit.id}">Vybavení v ceně ${icon('arrow-up-right')}</a></div>
        </div>
        <dl class="map-card-data"><div><dt>Dispozice</dt><dd>${esc(unit.layout)}</dd></div><div><dt>Celková plocha</dt><dd>${area(unit.area)}</dd></div>${window.AlexandraDetails.areasHTML(unit)}</dl>
        ${locationHTML(unit)}<section class="map-standard-disclosure">${window.AlexandraDetails.cardHTML(unit)}</section>${tour}
      </div>`;
    if (focusKey && !document.querySelector('dialog[open]')) {
      card.querySelector(`[${focusKey}="${CSS.escape(focused.getAttribute(focusKey))}"]`)?.focus({preventScroll:true});
    }
  }

  function updateSteps() {
    root.querySelectorAll('[data-pick-panel]').forEach(panel => { panel.hidden = Number(panel.dataset.pickPanel) !== step; });
    $('#map-legend').hidden = step !== 2;
    root.querySelectorAll('[data-pick-step]').forEach(button => {
      const n = Number(button.dataset.pickStep);
      const label = ['Vyberte si patro', step >= 2 ? `Vyberte si jednotku · ${floorLabel(activeFloor)}` : 'Vyberte si jednotku', step === 3 ? `Byt ${String(selectedId).padStart(2,'0')}` : 'Detail jednotky'][n-1];
      button.querySelector('.step-label').textContent = label;
      button.querySelector('.step-number').innerHTML = n < step ? icon('check') : String(n).padStart(2,'0');
      button.toggleAttribute('disabled', n > step);
      if (n === step) button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
      button.dataset.complete = String(n < step);
    });
    root.dataset.step = String(step);
    root.dataset.floor = String(activeFloor);
    root.dataset.pickedUnit = selectedId === null ? '' : String(selectedId);
  }
  function writeSelection(method, setAnchor) {
    const url = new URL(location.href);
    if (step >= 2) url.searchParams.set('podlazi', String(activeFloor));
    else url.searchParams.delete('podlazi');
    if (step === 3) url.searchParams.set('byt',String(selectedId));
    else url.searchParams.delete('byt');
    if (setAnchor) url.hash = 'vyber-v-dome';
    if (location.href !== url.href) history[method](null,'',url);
  }
  function displayStep(next, options = {}) {
    const {focus = false, historyMethod, anchor = true} = options;
    step = next;
    if (step === 2) drawFloor();
    else if (step === 1) updatePlanState();
    updateSteps();
    if (step === 3) drawCard();
    document.dispatchEvent(new CustomEvent('alexandra:picker-unit',{detail:{id:step===3 ? selectedId : null}}));
    if (historyMethod) writeSelection(historyMethod, anchor);
    if (focus) {
      const heading = $(['#pick-floor-title','#map-floor-title','#picked-unit-title'][step-1]);
      heading?.focus({preventScroll:true});
      root.scrollIntoView({block:'start',behavior:'instant'});
    }
  }
  function chooseFloor(number) {
    if (!floors.some(f => f.floor === number)) return;
    if (step === 1) planLayout = 'all';
    if (activeFloor !== number) selectedId = null;
    activeFloor = number;
    displayStep(2,{focus:true,historyMethod:'pushState'});
  }
  function chooseUnit(id) {
    const unit = units.find(item => item.id === id);
    if (!unit || unit.floor !== activeFloor || !matching(unit)) return;
    if (id !== selectedId) roomIndex = 0;
    selectedId = id;
    displayStep(3,{focus:true,historyMethod:'pushState'});
  }
  function openUnit(id) {
    const unit = units.find(item => item.id === id);
    if (!floors.length || !unit) return false;
    document.dispatchEvent(new Event('alexandra:show-picker'));
    activeFloor = unit.floor;
    planLayout = 'all';
    chooseUnit(id);
    return true;
  }
  function restoreSelectionFromURL() {
    if (!floors.length) return;
    const params = new URL(location.href).searchParams;
    const unit = units.find(item => item.id === Number(params.get('byt')));
    const floor = floors.find(item => item.floor === Number(params.get('podlazi')));
    activeFloor = unit?.floor || floor?.floor || 2;
    selectedId = unit?.id ?? null;
    planLayout = 'all';
    roomIndex = 0;
    displayStep(unit ? 3 : floor ? 2 : 1);
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('button, g[role="button"]');
    if (!button) return;
    if (button.hasAttribute('data-pick-back') || button.hasAttribute('data-pick-step')) {
      const target = Number(button.dataset.pickBack || button.dataset.pickStep);
      if (target < step) displayStep(target,{focus:true,historyMethod:'pushState'});
    } else if (button.hasAttribute('data-map-floor')) chooseFloor(Number(button.dataset.mapFloor));
    else if (button.hasAttribute('data-map-unit')) chooseUnit(Number(button.dataset.mapUnit));
    else if (button.hasAttribute('data-room-photo')) changeRoom(button);
    else if (button.hasAttribute('data-facade')) drawFacade(button.dataset.facade);
    else if (button.hasAttribute('data-plan-layout') || button.hasAttribute('data-map-reset')) {
      planLayout = button.dataset.planLayout || 'all';
      if (!units.some(unit => unit.id === selectedId && matching(unit))) selectedId = null;
      updatePlanState();
    }
  });
  root.addEventListener('change', event => {
    if (event.target === unitPicker && unitPicker.value) chooseUnit(Number(unitPicker.value));
  });

  root.addEventListener('keydown',event=>{
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target=event.target.closest('[data-map-floor],g[data-map-unit]');
    if (!target) return;
    if (['Enter',' '].includes(event.key) && target.tagName.toLowerCase()==='g') {
      event.preventDefault();
      if(target.dataset.mapFloor) chooseFloor(Number(target.dataset.mapFloor));else chooseUnit(Number(target.dataset.mapUnit));
      return;
    }
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    event.preventDefault();
    if (target.dataset.mapFloor) {
      const index=floors.findIndex(f=>f.floor===Number(target.dataset.mapFloor));
      const step=['ArrowRight','ArrowUp'].includes(event.key)?1:-1;
      const next=event.key==='Home'?floors[0]:event.key==='End'?floors.at(-1):floors[Math.max(0,Math.min(floors.length-1,index+step))];
      const context = target.closest('#building-stack') ? '#building-stack' : target.closest('#plan-floor-buttons') ? '#plan-floor-buttons' : '#floor-buttons';
      $(`${context} [data-map-floor="${next.floor}"]`)?.focus({preventScroll:true});
      return;
    }
    const pool=floorData().units.filter(u => matching(units.find(item => item.id === u.id))).sort((a,b)=>a.id-b.id);
    const current=pool.find(u=>u.id===Number(target.dataset.mapUnit));
    if (!current) return;
    let next=event.key==='Home'?pool[0]:event.key==='End'?pool.at(-1):null;
    if (!next) {
      const axis=['ArrowLeft','ArrowRight'].includes(event.key)?0:1;
      const sign=['ArrowRight','ArrowDown'].includes(event.key)?1:-1;
      next=pool.filter(u=>(u.labelPoint[axis]-current.labelPoint[axis])*sign>1).sort((a,b)=>{
        const score=u=>Math.abs(u.labelPoint[axis]-current.labelPoint[axis])+Math.abs(u.labelPoint[1-axis]-current.labelPoint[1-axis])*2;
        return score(a)-score(b);
      })[0];
    }
    if (next) $(`#floor-canvas [data-map-unit="${next.id}"]`)?.focus({preventScroll:true});
  });
  ['alexandra:furnished-ready','alexandra:room-photos-ready','alexandra:catalog-change'].forEach(name => document.addEventListener(name, () => {
    if (floors.length && step === 3) drawCard();
  }));
  document.addEventListener('alexandra:inventory-change', () => {
    if (floors.length) { updatePlanState(); drawCard(); }
  });
  document.addEventListener('alexandra:picker-start', () => {
    if (!floors.length) return;
    selectedId = null; planLayout = 'all';
    displayStep(1,{historyMethod:'replaceState',anchor:false});
  });

  async function initialize() {
    root.setAttribute('aria-busy','true');
    if(!catalog||!inventory)throw new Error('Katalog bytů není dostupný.');
    const response=await fetch('data/floors.json');
    if(!response.ok)throw new Error('Půdorysy se nepodařilo načíst.');
    const data=await response.json();
    if(!Array.isArray(data.floors)||data.floors.length!==6)throw new Error('Neúplná data podlaží.');
    for(const f of data.floors){
      if(!Number.isInteger(f.floor)||f.floor<1||f.floor>6||!Number.isFinite(f.width)||!Number.isFinite(f.height)||f.width<=0||f.height<=0||!safeImage(f.image)||(f.mapImage&&!safeImage(f.mapImage))||!Array.isArray(f.outline)||f.outline.length<3||!f.outline.every(validPoint)||!Array.isArray(f.units))throw new Error('Neplatná geometrie podlaží.');
      for(const u of f.units) if(!units.some(unit=>unit.id===u.id&&unit.floor===f.floor)||!Array.isArray(u.polygon)||u.polygon.length<3||!u.polygon.every(validPoint)||!validPoint(u.labelPoint))throw new Error('Neplatná geometrie bytu.');
    }
    floors=data.floors.sort((a,b)=>a.floor-b.floor);
    try {
      const directionResponse = await fetch('data/orientation.json?v=20261105',{cache:'no-cache'});
      const direction = directionResponse.ok ? await directionResponse.json() : null;
      if (direction?.confirmed === true && Number.isFinite(direction.northDegrees) && direction.northDegrees >= 0 && direction.northDegrees < 360 && typeof direction.source === 'string' && direction.source.trim()) orientation = {confirmed:true,northDegrees:direction.northDegrees};
    } catch (_) { /* Pending orientation never blocks the apartment selection. */ }
    if (!$('#map-floor-original')) {
      const originalLink = document.createElement('a'); originalLink.id = 'map-floor-original'; originalLink.className = 'floor-source-original'; originalLink.target = '_blank'; originalLink.rel = 'noopener'; originalLink.innerHTML = `Původní projektový výkres ${icon('arrow-up-right')}`; $('#map-floor-pdf').insertAdjacentElement('afterend', originalLink);
    }
    if (!$('#map-floor-orientation')) {
      const compass=document.createElement('div');compass.id='map-floor-orientation';
      $('#floor-canvas').insertAdjacentElement('beforebegin',compass);
    }
    const picker = document.createElement('label');
    picker.className='map-unit-picker';
    picker.htmlFor='map-unit-select';
    picker.innerHTML='Nebo vyberte byt ze seznamu<select id="map-unit-select" aria-describedby="map-floor-description"></select>';
    $('#floor-canvas').insertAdjacentElement('afterend',picker);
    unitPicker=picker.querySelector('select');
    $('#map-status-live').setAttribute('aria-atomic','true');
    drawStack();
    drawFloor();
    $('#explorer-loading').hidden = true;
    $('#explorer-workbench').hidden = false;
    $('.picker-steps').hidden = false;
    restoreSelectionFromURL();
    window.addEventListener('popstate', restoreSelectionFromURL);
    window.AlexandraPicker = Object.freeze({openUnit});
    root.setAttribute('aria-busy','false');
    document.dispatchEvent(new CustomEvent('alexandra:floor-selector-ready'));
  }
  initialize().catch(error=>{
    root.setAttribute('aria-busy','false');
    $('#explorer-loading').hidden=false;$('#explorer-workbench').hidden=true;$('#map-legend').hidden=true;
    $('#explorer-loading').innerHTML=`<p>Interaktivní mapu se nepodařilo načíst.</p><a href="#cenik">Pokračovat do seznamu bytů ${icon('arrow-down')}</a>`;
    console.warn('Apartment selector:',error.message);
  });
})();
