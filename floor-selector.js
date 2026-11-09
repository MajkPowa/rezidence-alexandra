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
  let floors = [], activeFloor = 2, selectedId = null, projection = 'plan', snapshot, unitPicker;
  let orientation = { confirmed:false, northDegrees:null };
  const safeImage = path => typeof path === 'string' && /^assets\/floors\/[a-z0-9-]+\.webp$/.test(path);
  const validPoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  const path = points => points.map((p,i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ') + 'Z';
  const normalized = (f, points) => points.map(([x,y]) => [x * 1000 / f.width, y * 1000 / f.width]);
  const floorData = () => floors.find(f => f.floor === activeFloor);
  const matching = unit => snapshot.filteredIds.includes(unit.id);
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
  const signature = () => `${activeFloor}:${selectedId}:${projection}`;
  let lastURLSignature = '', selectionInteracted = false, restoringURL = false;

  function updateURL() {
    if (!selectionInteracted || restoringURL) return;
    if (signature() === lastURLSignature) return;
    const url = new URL(location.href);
    url.searchParams.set('podlazi', String(activeFloor));
    if (selectedId !== null) url.searchParams.set('byt', String(selectedId)); else url.searchParams.delete('byt');
    lastURLSignature = signature();
    history.replaceState(null, '', url);
  }

  function drawStack() {
    // Whole-floor regions registered to the November 2026 exterior (1920 × 1080).
    // The two front wings have different perspective slopes; the intermediate
    // vertices follow the recessed central facade instead of cutting across it.
    // Apartment boundaries are shown only in the surveyed floor-plan polygons below.
    const levels = [
      [[320,373],[615,198],[1058,297],[1177,343],[1407,385]],
      [[320,471],[615,346],[1058,415],[1177,448],[1407,484]],
      [[320,568],[615,470],[1058,521],[1177,546],[1407,576]],
      [[320,664],[615,594],[1058,626],[1177,642],[1407,664]],
      [[320,757],[615,716],[1058,731],[1177,737],[1407,751]],
      [[320,833],[615,831],[1058,836],[1177,836],[1407,837]],
      [[320,934],[615,950],[1058,947],[1177,942],[1407,930]]
    ];
    const stack = $('#building-stack');
    stack.setAttribute('viewBox', '280 170 1370 904.2');
    stack.setAttribute('aria-label', 'Vyberte jedno ze šesti podlaží na vizualizaci domu');
    stack.setAttribute('aria-describedby', 'building-selection-caption');
    stack.innerHTML = `<title>Rezidence Alexandra · výběr podlaží</title><image id="building-selection-image" href="assets/exterior-20261109/alexandra-1920.webp" width="1920" height="1080"/>` + [...floors].reverse().map(f => {
      const index = 6 - f.floor, upper = levels[index], lower = levels[index + 1];
      const count = units.filter(u => u.floor === f.floor).length;
      const y = (upper[upper.length - 1][1] + lower[lower.length - 1][1]) / 2;
      const polygon = [...upper, ...[...lower].reverse()];
      return `<g class="stack-floor building-selection-floor" role="button" tabindex="0" data-map-floor="${f.floor}" aria-label="Zobrazit ${floorLabel(f.floor)}, ${count === 1 ? '1 jednotka' : `${count} jednotek`}" aria-pressed="${f.floor === activeFloor}"><path class="building-selection-zone" d="${path(polygon)}"/><path class="building-selection-leader" d="M1407 ${y}H1450"/><rect class="building-selection-label" x="1440" y="${y-28}" width="180" height="56" rx="8"/><text class="building-selection-number" x="1530" y="${y+1}" style="font-size:${f.floor === 1 ? 29 : 33}px">${floorLabel(f.floor)}</text></g>`;
    }).join('');
    $('#floor-buttons').innerHTML = [...floors].reverse().map(f=>`<button type="button" data-map-floor="${f.floor}" aria-pressed="${f.floor === activeFloor}"><span class="building-floor-name">${floorLabel(f.floor)}</span><span class="building-floor-availability" data-floor-summary="${f.floor}"></span></button>`).join('');
    const caption = $('.building-caption');
    caption.id = 'building-selection-caption';
    caption.textContent = 'Dům bez bočních balkonů.';
    caption.hidden = true;
    if (!$('#building-selection-units')) {
      const strip=document.createElement('div');
      strip.id='building-selection-units';
      strip.className='building-selection-units';
      $('.building-picker').insertBefore(strip, caption);
    }
    if (!$('#selection-summary')) {
      const confirmation=document.createElement('div');
      confirmation.id='selection-summary'; confirmation.className='selection-summary';
      confirmation.innerHTML=`<p><strong data-selection-name></strong><span data-selection-price></span></p><a class="map-mobile-jump" href="#map-unit-card">Zobrazit vybraný byt ${icon('arrow-down')}</a>`;
      $('.building-picker').insertBefore(confirmation, caption);
    }
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
    const strip=$('#building-selection-units');
    if (strip) {
      const focusedId=strip.contains(document.activeElement)?document.activeElement.dataset.buildingUnit:null;
      strip.innerHTML=`<p>Byty ${window.AlexandraFloorLabels.location(activeFloor)}</p><div role="group" aria-label="Byty a dostupnost ${window.AlexandraFloorLabels.location(activeFloor)}">${units.filter(u=>u.floor===activeFloor).map(u=>{
        const s=status(u), filtered=snapshot && !snapshot.filteredIds.includes(u.id);
        return `<button type="button" class="building-unit-chip status-${s.key}" data-building-unit="${u.id}" aria-label="Byt ${u.id}, ${esc(u.layout)}, ${area(u.area)}, ${esc(s.label)}" aria-pressed="${u.id===selectedId}" ${filtered?'disabled':''}><strong>${String(u.id).padStart(2,'0')}</strong><span><i aria-hidden="true"></i>${esc(s.shortLabel||s.label)}</span></button>`;
      }).join('')}</div>`;
      if (focusedId) strip.querySelector(`[data-building-unit="${focusedId}"]`)?.focus({preventScroll:true});
    }
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
      const id=Number(b.dataset.mapUnit), match=snapshot.filteredIds.includes(id);
      const unit=units.find(u=>u.id===id);
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
    $('#map-floor-count').textContent = `${visible.length} z ${floorUnits.length} ${floorUnits.length===1?'jednotky':'jednotek'} ve filtru`;
    $('#map-no-results').hidden=visible.length>0;
    const picker = unitPicker;
    if (picker) {
      Array.from(picker.options).forEach(option => { option.disabled = option.value !== '' && !snapshot.filteredIds.includes(Number(option.value)); });
      picker.value = selectedId === null ? '' : String(selectedId);
      picker.disabled = visible.length === 0;
    }
    const counts={available:0,reserved:0,sold:0,unknown:0};
    floorUnits.forEach(u=>counts[status(u).key]++);
    Object.keys(counts).forEach(key=>$('#legend-'+key).textContent=String(counts[key]));
    updateBuildingSummary();
  }

  function selectedPlan(unit) {
    const furnished = window.AlexandraFurnishedPlans?.previewHTML(unit, 'map');
    if (furnished) return furnished;
    const f=floorData(), shape=polygonData(unit.id);
    if(!shape) return `<a class="map-card-plan" href="plans/floor-sheet-${unit.floor}-20261103.pdf" target="_blank" rel="noopener"><img src="${esc(f.image)}" alt="Původní půdorys · ${floorLabel(unit.floor)}"><span>Celé podlaží · otevřít PDF ${icon('arrow-up-right')}</span></a>`;
    const points=shape.polygon, xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y,pad=Math.min(w,h)*.045;
    const pdf=unit.plan || `plans/floor-sheet-${unit.floor}-20261103.pdf`;
    return `<a class="map-card-plan" href="${esc(pdf)}" target="_blank" rel="noopener" aria-label="Otevřít ${unit.plan?'půdorys bytu':'zdrojový půdorys podlaží'} v PDF"><svg viewBox="${x-pad} ${y-pad} ${w+pad*2} ${h+pad*2}" role="img" aria-label="Výřez rozložení bytu ${unit.id} ze zdrojového půdorysu · ${floorLabel(unit.floor)}"><defs><clipPath id="selected-unit-clip"><path d="${path(points)}"/></clipPath></defs><image href="${esc(f.image)}" width="${f.width}" height="${f.height}" clip-path="url(#selected-unit-clip)"/></svg><span>Rozložení bytu · půdorys podlaží ${icon('arrow-up-right')}</span></a>`;
  }

  function drawCard() {
    const unit=units.find(u=>u.id===selectedId), card=$('#map-unit-card');
    const previousFocus = document.activeElement;
    const focusAttribute = card.contains(previousFocus) && ['data-save','data-unit','data-furnished-unit','data-map-reset','href'].find(name => previousFocus.hasAttribute(name));
    const restoreCardFocus = () => {
      if (!focusAttribute || previousFocus.isConnected || document.querySelector('dialog[open]')) return;
      const value = previousFocus.getAttribute(focusAttribute);
      const target = card.querySelector(`[${focusAttribute}="${CSS.escape(value)}"]`) || card.querySelector('[data-unit]');
      target?.focus({preventScroll:true});
    };
    const confirmation=$('#selection-summary');
    if (confirmation) {
      confirmation.hidden=!unit;
      if (unit) {
        confirmation.querySelector('[data-selection-name]').textContent=`Byt ${String(unit.id).padStart(2,'0')} · ${unit.layout} · ${area(unit.area)}`;
        confirmation.querySelector('[data-selection-price]').textContent=`${price(unit.price)} · ${status(unit).label} · bez parkování`;
      }
    }
    if(!unit){
      card.innerHTML=`<div class="map-card-empty"><p class="explorer-step"><b>03</b> VÁŠ VÝBĚR</p><h3>${snapshot.filteredIds.some(id=>units.find(u=>u.id===id)?.floor===activeFloor)?'Prohlédněte si byt.':'Zkuste jiný výběr.'}</h3><p>Vyberte byt v půdorysu, jiné podlaží nebo upravte filtry dispozice a dostupnosti.</p><button class="button button-dark" data-map-reset>Zrušit filtry ${icon('arrow-up-right')}</button></div>`;
      restoreCardFocus();
      return;
    }
    const details=window.AlexandraDetails?.get(unit) || {};
    card.innerHTML=`<div class="map-card-overview"><div class="map-card-topline"><p class="eyebrow">03 / VYBRANÝ BYT</p><button class="favorite-button ${catalog.isSaved(unit.id)?'saved':''}" data-save="${unit.id}" aria-pressed="${catalog.isSaved(unit.id)}" aria-label="${catalog.isSaved(unit.id)?'Odebrat':'Uložit'} byt ${unit.id}">${icon(catalog.isSaved(unit.id) ? 'favorite-filled' : 'favorite')}</button></div><h3>Byt ${String(unit.id).padStart(2,'0')}</h3>${badge(unit)}<p class="map-unit-meta">${esc(unit.layout)} <span aria-hidden="true">/</span> ${floorLabel(unit.floor)}</p>${details.locationNote?`<p class="unit-location-note"><strong>${esc(details.locationNote)}</strong></p>`:''}${locationHTML(unit)}<p class="map-card-price">${price(unit.price)}</p><p class="map-price-note">Orientační cena · bez parkování</p><div class="map-card-actions"><a class="button viewing-cta" href="#kontakt" data-viewing-unit="${unit.id}">Domluvit prohlídku ${icon('arrow-up-right')}</a><button class="unit-detail-button" data-unit="${unit.id}">Detail bytu ${icon('arrow-up-right')}</button><div class="map-card-links"><a class="text-link" href="#hypoteka" data-mortgage-unit="${unit.id}">Spočítat hypotéku ${icon('arrow-up-right')}</a><a class="text-link" href="#parkovani" data-section-link="parkovani" data-unit-id="${unit.id}">Parkování ${icon('parking')}</a><a class="text-link" href="#vybaveni" data-section-link="vybaveni" data-unit-id="${unit.id}">Vybavení v ceně ${icon('arrow-up-right')}</a></div></div><dl class="map-card-data"><div><dt>Dispozice</dt><dd>${esc(unit.layout)}</dd></div><div><dt>Celková plocha</dt><dd>${area(unit.area)}</dd></div>${window.AlexandraDetails?.areasHTML(unit) || ''}</dl></div><div class="map-card-visuals">${selectedPlan(unit)}<section class="map-standard-disclosure">${window.AlexandraDetails?.cardHTML(unit) || ''}</section>${unit.id !== 51 ? `<div class="map-card-links"><a class="text-link" href="${window.AlexandraDetails?.tourHref?.(unit) || `tour.html?byt=${unit.layout.replace('+','')}&jednotka=${unit.id}&podlazi=${unit.floor}#walkthrough`}">Typová 360° prohlídka ${icon('arrow-up-right')}</a></div>` : ''}</div>`;
    restoreCardFocus();
  }

  function sync(detail, force=false) {
    const previousFloor=snapshot?.filters.floor;
    snapshot=detail || catalog.snapshot();
    const next=Number(snapshot.filters.floor);
    const changed=Number.isInteger(next)&&next>=1&&next<=6&&next!==activeFloor;
    if(changed) { activeFloor=next; selectionInteracted=true; }
    if (!restoringURL && detail && snapshot.filters.floor==='all' && previousFloor && previousFloor!=='all') {
      selectionInteracted=false;
      const url=new URL(location.href);
      url.searchParams.delete('podlazi');url.searchParams.delete('byt');
      history.replaceState(null,'',url);lastURLSignature='';
    }
    const candidates=units.filter(u=>u.floor===activeFloor&&matching(u));
    if(!candidates.some(u=>u.id===selectedId)) selectedId=candidates[0]?.id??null;
    if(changed||force) drawFloor(); else updatePlanState();
    drawCard(); updateURL();
  }

  function chooseFloor(floor) {
    if(!floors.some(f=>f.floor===floor)) return;
    selectionInteracted=true;
    catalog.setFilters({floor:String(floor)});
    $('#map-status-live').textContent=`Zobrazené podlaží: ${floorLabel(floor)}. Vyberte byt v půdorysu.`;
  }

  function restoreSelectionFromURL() {
    if (!floors.length) return;
    const url = new URL(location.href);
    const requestedUnit = units.find(unit => unit.id === Number(url.searchParams.get('byt')));
    const requestedFloor = Number(url.searchParams.get('podlazi'));
    const validFloor = Number.isInteger(requestedFloor) && floors.some(floor => floor.floor === requestedFloor);
    // History carries the selected floor/unit, not transient catalogue filters.
    // Reset those filters so a valid deep-linked unit cannot remain disabled.
    restoringURL = true;
    activeFloor = requestedUnit?.floor || (validFloor ? requestedFloor : 2);
    selectedId = requestedUnit?.id ?? null;
    selectionInteracted = Boolean(requestedUnit || validFloor);
    try {
      catalog.setFilters({ floor: selectionInteracted ? String(activeFloor) : 'all', layout: 'all', area: 'all', status: 'all', favorites: false });
      sync(null, true);
      lastURLSignature = selectionInteracted ? signature() : '';
    } finally {
      restoringURL = false;
    }
  }
  function chooseUnit(id) {
    if(!snapshot.filteredIds.includes(id)) return;
    const unit=units.find(u=>u.id===id);
    if(!unit||unit.floor!==activeFloor) return;
    selectionInteracted=true;
    selectedId=id; updatePlanState(); drawCard(); updateURL();
    $('#map-status-live').textContent=`Vybrán byt ${id}, ${unit.layout}, ${area(unit.area)}, ${status(unit).label}. Detail je pod půdorysem nebo vpravo.`;
  }

  root.addEventListener('click', event=>{
    const buildingUnit=event.target.closest('[data-building-unit]');
    if (buildingUnit) { chooseUnit(Number(buildingUnit.dataset.buildingUnit)); return; }
    const jump = event.target.closest('.map-mobile-jump');
    if (jump) {
      event.preventDefault();
      const card = $('#map-unit-card');
      card.tabIndex = -1;
      card.focus({preventScroll:true});
      card.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      return;
    }
    const floor=event.target.closest('[data-map-floor]');
    if(floor){chooseFloor(Number(floor.dataset.mapFloor));return;}
    const unit=event.target.closest('[data-map-unit]');
    if(unit){chooseUnit(Number(unit.dataset.mapUnit));return;}
    if(event.target.closest('[data-map-reset]')){catalog.setFilters({layout:'all',floor:String(activeFloor),status:'all',area:'all',favorites:false,sort:'floor'});return;}
  });
  root.addEventListener('change', event => { if (event.target.id === 'map-unit-select' && event.target.value) chooseUnit(Number(event.target.value)); });
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
      chooseFloor(next.floor);
      const context=target.closest('#building-stack')?'#building-stack':'#floor-buttons';
      $(`${context} [data-map-floor="${next.floor}"]`)?.focus({preventScroll:true});
      return;
    }
    const pool=floorData().units.filter(u=>snapshot.filteredIds.includes(u.id)).sort((a,b)=>a.id-b.id);
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
    if (next) { chooseUnit(next.id); $(`#floor-canvas [data-map-unit="${next.id}"]`)?.focus({preventScroll:true}); }
  });
  document.addEventListener('alexandra:furnished-ready', () => { if (snapshot && floors.length) drawCard(); });
  document.addEventListener('alexandra:inventory-change', () => { if (snapshot && floors.length) sync(); });

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
    const url=new URL(location.href), requestedUnit=units.find(u=>u.id===Number(url.searchParams.get('byt'))), requestedFloor=Number(url.searchParams.get('podlazi'));
    activeFloor=requestedUnit?.floor||(Number.isInteger(requestedFloor)&&floors.some(f=>f.floor===requestedFloor)?requestedFloor:2);selectedId=requestedUnit?.id??null;
    selectionInteracted=Boolean(requestedUnit || (Number.isInteger(requestedFloor)&&floors.some(f=>f.floor===requestedFloor)));
    $('#explorer-loading').hidden=true;$('#explorer-workbench').hidden=false;$('#map-legend').hidden=false;
    drawStack();
    document.addEventListener('alexandra:catalog-change',event=>sync(event.detail));
    window.addEventListener('popstate', restoreSelectionFromURL);
    // Opening the catalogue must retain the complete offer. Filter by floor only
    // when a visitor explicitly selects it, or follows a deep link to a floor/unit.
    if (requestedUnit || (Number.isInteger(requestedFloor) && floors.some(f=>f.floor===requestedFloor))) catalog.setFilters({floor:String(activeFloor)});
    sync(null,true);
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
