(() => {
  'use strict';
  const root = document.querySelector('#floor-explorer');
  if (!root) return;
  const $ = selector => root.querySelector(selector);
  const units = window.ALEXANDRA_UNITS || [];
  const catalog = window.AlexandraCatalog;
  const inventory = window.AlexandraInventory;
  const number = new Intl.NumberFormat('cs-CZ', {maximumFractionDigits:2});
  const price = value => `${number.format(value)} Kč`;
  const area = value => `${number.format(value)} m²`;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const status = unit => inventory.status(unit);
  let floors = [], activeFloor = 2, selectedId = null, projection = window.matchMedia('(max-width:600px)').matches ? 'plan' : 'space', snapshot;
  const safeImage = path => typeof path === 'string' && /^assets\/floors\/[a-z0-9-]+\.webp$/.test(path);
  const validPoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  const path = points => points.map((p,i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ') + 'Z';
  const normalized = (f, points) => points.map(([x,y]) => [x * 1000 / f.width, y * 1000 / f.width]);
  const floorData = () => floors.find(f => f.floor === activeFloor);
  const matching = unit => snapshot.filteredIds.includes(unit.id);
  const polygonData = id => floorData()?.units.find(u => u.id === id);
  const badge = unit => `<span class="status-badge status-${status(unit).key}"><span class="availability-dot" aria-hidden="true"></span>${esc(status(unit).label)}</span>`;
  const signature = () => `${activeFloor}:${selectedId}:${projection}`;
  let lastURLSignature = '';

  function updateURL() {
    if (signature() === lastURLSignature) return;
    const url = new URL(location.href);
    url.searchParams.set('podlazi', String(activeFloor));
    if (selectedId !== null) url.searchParams.set('byt', String(selectedId)); else url.searchParams.delete('byt');
    lastURLSignature = signature();
    history.replaceState(null, '', url);
  }

  function drawStack() {
    const project = (p, floor) => [31 + p[0] * .235 + p[1] * .11, 502 - (floor - 1) * 67 - p[0] * .043 + p[1] * .092];
    $('#building-stack').innerHTML = `<defs><filter id="plate-shadow" x="-20%" y="-20%" width="150%" height="180%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#66755b" flood-opacity=".13"/></filter></defs>` + floors.map(f => {
      const outline = normalized(f, f.outline).map(p => project(p, f.floor));
      const side = outline.map(p => [p[0],p[1]+10]);
      const count = units.filter(u => u.floor === f.floor).length;
      const y = 521 - (f.floor - 1) * 67;
      return `<g class="stack-floor" role="button" tabindex="0" data-map-floor="${f.floor}" aria-label="Zobrazit ${f.floor}. nadzemní podlaží, ${count === 1 ? '1 jednotka' : `${count} jednotek`}" aria-pressed="${f.floor === activeFloor}"><g filter="url(#plate-shadow)"><path class="stack-side" d="${path(side)}"/><path class="stack-top" d="${path(outline)}"/></g>${f.units.map(u=>`<path class="stack-plan-line" d="${path(normalized(f,u.polygon).map(p=>project(p,f.floor)))}"/>`).join('')}<path class="stack-label-line" d="M306 ${y-5} L348 ${y-5}"/><text x="359" y="${y-3}" class="stack-floor-number">${f.floor}. NP</text><text x="359" y="${y+13}" class="stack-floor-count">${count === 1 ? '1 jednotka' : `${count} jednotek`}</text></g>`;
    }).join('');
    $('#floor-buttons').innerHTML = floors.map(f=>`<button type="button" data-map-floor="${f.floor}" aria-label="${f.floor}. podlaží" aria-pressed="${f.floor === activeFloor}">${f.floor}. NP</button>`).join('');
  }

  function floorTransform() {
    const f = floorData(), height = f.height * 1000 / f.width;
    if (projection === 'plan') return `translate(22px, ${Math.max(22,(760-height*.956)/2)}px) scale(.956)`;
    return `translate(20px, ${Math.max(175,(760-height*.60)/2+45)}px) matrix(.76,-.14,.26,.60,0,0)`;
  }

  function drawFloor() {
    const f = floorData();
    $('#map-floor-title').textContent = `${activeFloor}. nadzemní podlaží`;
    $('#map-floor-pdf').href = `plans/floor-${activeFloor}.pdf`;
    $('#map-floor-pdf').textContent = 'Původní výkres ↗';
    const normalizedOutline = normalized(f,f.outline);
    const edges = normalizedOutline.map((p,i)=>{
      const q = normalizedOutline[(i+1)%normalizedOutline.length];
      return `<path class="floor-slab" d="${path([p,q,[q[0],q[1]+15],[p[0],p[1]+15]])}"/>`;
    }).join('');
    $('#floor-canvas').innerHTML = `<title>Půdorys ${activeFloor}. nadzemního podlaží s výběrem bytů</title><g class="floor-projection" style="transform:${floorTransform()}"><g class="floor-depth"${projection==='plan'?' visibility="hidden"':''}>${edges}</g><path class="floor-sheet" d="${path(normalizedOutline)}"/><image class="floor-linework" href="${esc(f.mapImage || f.image)}" width="1000" height="${f.height*1000/f.width}"/>${f.units.map(p => {
      const u=units.find(unit=>unit.id===p.id);
      const s=status(u), center=normalized(f,[p.labelPoint])[0];
      return `<g class="map-apartment" role="button" tabindex="0" data-map-unit="${u.id}" data-status="${s.key}" aria-label="Byt ${u.id}, ${esc(u.layout)}, ${area(u.area)}, ${esc(s.label)}" aria-pressed="false"><path class="unit-shape" d="${path(normalized(f,p.polygon))}"/><g transform="translate(${center[0]},${center[1]})" pointer-events="none"><rect class="unit-tag-bg" x="-59" y="-32" width="118" height="66" rx="8"/><text class="unit-tag-number" y="-7">${String(u.id).padStart(2,'0')}</text><text class="unit-tag-layout" y="19">${esc(u.layout)}</text></g></g>`;
    }).join('')}</g>`;
    $('#map-floor-description').textContent = activeFloor === 1 ? 'Původní půdorys přízemí. Poloha jednotky 53 čeká na potvrzení.' : 'Vyberte byt přímo v půdorysu.';
    $('#map-floor-special').hidden = activeFloor !== 1;
    updatePlanState();
  }

  function updatePlanState() {
    root.querySelectorAll('[data-map-floor]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.mapFloor)===activeFloor)));
    root.querySelectorAll('[data-map-unit]').forEach(b=>{
      const id=Number(b.dataset.mapUnit), match=snapshot.filteredIds.includes(id);
      b.setAttribute('aria-pressed',String(id===selectedId));
      b.dataset.filtered=String(!match);
      b.setAttribute('aria-disabled',String(!match));
      b.setAttribute('tabindex',match?'0':'-1');
    });
    const floorUnits=units.filter(u=>u.floor===activeFloor), visible=floorUnits.filter(matching);
    $('#map-floor-count').textContent = `${visible.length} z ${floorUnits.length} ${floorUnits.length===1?'jednotky':'jednotek'} ve filtru`;
    $('#map-no-results').hidden=visible.length>0;
    const counts={available:0,reserved:0,sold:0,unknown:0};
    floorUnits.forEach(u=>counts[status(u).key]++);
    Object.keys(counts).forEach(key=>$('#legend-'+key).textContent=String(counts[key]));
    const unknown=units.filter(u=>status(u).key==='unknown').length;
    const note=document.querySelector('#availability-note');
    if(note) note.textContent=unknown===units.length?'Stavy prodeje zatím nejsou potvrzené. Dostupnost jednotlivých bytů ověří prodejce.':`Barevné označení ukazuje potvrzené stavy. ${unknown ? `U ${unknown} jednotek je dostupnost na dotaz.` : ''}`;
  }

  function selectedPlan(unit) {
    const furnished = window.AlexandraFurnishedPlans?.previewHTML(unit, 'map');
    if (furnished) return furnished;
    const f=floorData(), shape=polygonData(unit.id);
    if(!shape) return `<a class="map-card-plan" href="plans/floor-${unit.floor}.pdf" target="_blank" rel="noopener"><img src="${esc(f.image)}" alt="Původní půdorys ${unit.floor}. NP"><span>Celé podlaží · otevřít PDF ↗</span></a>`;
    const points=shape.polygon, xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y,pad=Math.min(w,h)*.045;
    const pdf=unit.plan || `plans/floor-${unit.floor}.pdf`;
    return `<a class="map-card-plan" href="${esc(pdf)}" target="_blank" rel="noopener" aria-label="Otevřít ${unit.plan?'půdorys bytu':'zdrojový půdorys podlaží'} v PDF"><svg viewBox="${x-pad} ${y-pad} ${w+pad*2} ${h+pad*2}" role="img" aria-label="Výřez rozložení bytu ${unit.id} ze zdrojového půdorysu ${unit.floor}. NP"><defs><clipPath id="selected-unit-clip"><path d="${path(points)}"/></clipPath></defs><image href="${esc(f.image)}" width="${f.width}" height="${f.height}" clip-path="url(#selected-unit-clip)"/></svg><span>Rozložení bytu · zdrojový výkres ↗</span></a>`;
  }

  function drawCard() {
    const unit=units.find(u=>u.id===selectedId), card=$('#map-unit-card');
    if(!unit){
      card.innerHTML=`<div class="map-card-empty"><p class="explorer-step"><b>03</b> VÁŠ VÝBĚR</p><h3>${snapshot.filteredIds.some(id=>units.find(u=>u.id===id)?.floor===activeFloor)?'Prohlédněte si byt.':'Zkuste jiný výběr.'}</h3><p>Vyberte byt v půdorysu, jiné podlaží nebo upravte filtry dispozice a dostupnosti.</p><button class="button button-dark" data-map-reset>Zrušit filtry ↗</button></div>`;
      return;
    }
    card.innerHTML=`<div class="map-card-topline"><p class="eyebrow">03 / VYBRANÝ BYT</p><button class="favorite-button ${catalog.isSaved(unit.id)?'saved':''}" data-save="${unit.id}" aria-pressed="${catalog.isSaved(unit.id)}" aria-label="${catalog.isSaved(unit.id)?'Odebrat':'Uložit'} byt ${unit.id}">${catalog.isSaved(unit.id)?'♥':'♡'}</button></div><h3>Byt ${String(unit.id).padStart(2,'0')}</h3>${badge(unit)}<p class="map-unit-meta">${esc(unit.layout)} <span aria-hidden="true">/</span> ${unit.floor}. nadzemní podlaží</p>${selectedPlan(unit)}<dl class="map-card-data"><div><dt>Dispozice</dt><dd>${esc(unit.layout)}</dd></div><div><dt>Celková plocha</dt><dd>${area(unit.area)}</dd></div></dl><p class="map-card-price">${price(unit.price)}</p><p class="map-price-note">Orientační cena · bez parkování</p><div class="map-card-actions"><button class="button" data-unit="${unit.id}">Detail bytu <span aria-hidden="true">↗</span></button><a class="text-link" href="tour.html?byt=${unit.layout.replace('+','')}#walkthrough">Typová 360° prohlídka ↗</a></div>${unit.id===53?'<p class="map-card-caveat">Ceník uvádí jednotku 53. Její poloha není ve výkresu potvrzena; byt 51 jí automaticky nepřiřazujeme.</p>':''}`;
  }

  function sync(detail, force=false) {
    snapshot=detail || catalog.snapshot();
    const next=Number(snapshot.filters.floor);
    const changed=Number.isInteger(next)&&next>=1&&next<=6&&next!==activeFloor;
    if(changed) activeFloor=next;
    const candidates=units.filter(u=>u.floor===activeFloor&&matching(u));
    if(!candidates.some(u=>u.id===selectedId)) selectedId=candidates[0]?.id??null;
    if(changed||force) drawFloor(); else updatePlanState();
    drawCard(); updateURL();
  }

  function chooseFloor(floor) {
    if(!floors.some(f=>f.floor===floor)) return;
    catalog.setFilters({floor:String(floor)});
    $('#map-status-live').textContent=`Zobrazeno ${floor}. podlaží. Vyberte byt v půdorysu.`;
  }
  function chooseUnit(id) {
    if(!snapshot.filteredIds.includes(id)) return;
    const unit=units.find(u=>u.id===id);
    if(!unit||unit.floor!==activeFloor) return;
    selectedId=id; updatePlanState(); drawCard(); updateURL();
    $('#map-status-live').textContent=`Vybrán byt ${id}, ${unit.layout}, ${area(unit.area)}, ${status(unit).label}. Detail je pod půdorysem nebo vpravo.`;
  }

  root.addEventListener('click', event=>{
    const floor=event.target.closest('[data-map-floor]');
    if(floor){chooseFloor(Number(floor.dataset.mapFloor));return;}
    const unit=event.target.closest('[data-map-unit]');
    if(unit){chooseUnit(Number(unit.dataset.mapUnit));return;}
    if(event.target.closest('[data-map-reset]')){catalog.setFilters({layout:'all',floor:String(activeFloor),status:'all',area:'all',favorites:false,sort:'floor'});return;}
    const view=event.target.closest('[data-map-view]');
    if(view){projection=view.dataset.mapView;root.querySelectorAll('[data-map-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===view)));const group=$('.floor-projection');if(group)group.style.transform=floorTransform();const depth=$('.floor-depth');if(depth)depth.setAttribute('visibility',projection==='space'?'visible':'hidden');return;}
  });
  root.addEventListener('keydown',event=>{
    const target=event.target.closest('g[data-map-floor],g[data-map-unit]');
    if(!target||!['Enter',' '].includes(event.key))return;
    event.preventDefault();
    if(target.dataset.mapFloor) chooseFloor(Number(target.dataset.mapFloor));else chooseUnit(Number(target.dataset.mapUnit));
  });
  document.addEventListener('alexandra:furnished-ready', () => { if (snapshot && floors.length) drawCard(); });

  async function initialize() {
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
    const url=new URL(location.href), requestedUnit=units.find(u=>u.id===Number(url.searchParams.get('byt'))), requestedFloor=Number(url.searchParams.get('podlazi'));
    activeFloor=requestedUnit?.floor||(Number.isInteger(requestedFloor)&&floors.some(f=>f.floor===requestedFloor)?requestedFloor:2);selectedId=requestedUnit?.id??null;
    $('#explorer-loading').hidden=true;$('#explorer-workbench').hidden=false;$('#map-legend').hidden=false;
    root.querySelectorAll('[data-map-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapView===projection)));
    drawStack();
    document.addEventListener('alexandra:catalog-change',event=>sync(event.detail));
    catalog.setFilters({floor:String(activeFloor)});
    sync(null,true);
  }
  initialize().catch(error=>{
    $('#explorer-loading').hidden=false;$('#explorer-workbench').hidden=true;$('#map-legend').hidden=true;
    $('#explorer-loading').innerHTML='<p>Interaktivní mapu se nepodařilo načíst.</p><a href="#catalog-list">Pokračovat do seznamu bytů ↓</a>';
    document.querySelector('#catalog-list').open=true;
    console.warn('Apartment selector:',error.message);
  });
})();
