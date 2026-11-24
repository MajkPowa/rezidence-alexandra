(() => {
  'use strict';
  const root = document.querySelector('#parking-explorer');
  if (!root) return;
  const $ = selector => root.querySelector(selector);
  const map = $('#parking-map');
  map.setAttribute('aria-labelledby','parking-drawing-title');
  map.innerHTML = '<title id="parking-drawing-title">Situační výkres parkování</title><image id="parking-drawing" aria-hidden="true"/><g id="parking-bays"></g>';
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = new Intl.NumberFormat('cs-CZ');
  const dimensionFormat = new Intl.NumberFormat('cs-CZ',{minimumFractionDigits:2,maximumFractionDigits:3});
  const validDimensions = value => value && [value.width,value.length].every(n=>Number.isFinite(n)&&n>0);
  const dimensionLabel = space => validDimensions(space.dimensions) ? `${dimensionFormat.format(space.dimensions.width)} × ${dimensionFormat.format(space.dimensions.length)} m` : '';
  const types = { outdoor:'Venkovní stání', covered:'Kryté stání', garage:'Garáž' };
  const validType = value => typeof value==='string' && Object.prototype.hasOwnProperty.call(types,value);
  const icon = () => window.AlexandraIcons?.svg('arrow-up-right') || '';
  let data, selectedId=null, activeType='all';
  const parkingLabels = { available:'Volné', reserved:'Rezervované', sold:'Prodané', unknown:'Stav nepotvrzen' };
  function status(space) {
    const key = window.AlexandraInventory?.parkingStatus(space.id).key || 'unknown';
    return {key, label:parkingLabels[key]};
  }
  const inDrawing = space => activeType === 'all' || space.type === activeType;
  function updateUrl() {
    const url = new URL(location.href); if (selectedId) url.searchParams.set('parkovani',selectedId); else url.searchParams.delete('parkovani');
    // Older garage links without a layer open the garage detail drawing.
    if (activeType !== 'all' || selectedId?.startsWith('G')) url.searchParams.set('typ-parkovani',activeType); else url.searchParams.delete('typ-parkovani');
    history.replaceState(null,'',url);
  }
  function detail() {
    const space=data.spaces.find(item=>item.id===selectedId);
    if (!space) { $('#parking-detail').innerHTML='<h3>Vyberte parkovací místo</h3><p>Výběrem čísla ve výkresu zobrazíte cenu, rozměry a dostupnost.</p>';return; }
    const s=status(space);
    const area=Number.isFinite(space.area) && space.area > 0 ? `${fmt.format(space.area)} m²` : 'Doplníme';
    const dimensions=dimensionLabel(space);
    const dimensionsHTML=dimensions ? `<div class="parking-dimensions"><dt>Rozměry (šířka × délka)</dt><dd>${dimensions}</dd></div>` : '';
    const areaLabel=space.areaBasis==='width-times-length' ? 'Plocha z rozměrů' : 'Výměra';
    const plan=space.plan;
    const planHTML=plan ? `<figure class="parking-garage-plan"><a href="${esc(plan.image)}" target="_blank" rel="noopener" aria-label="Zvětšit půdorys: ${esc(space.label)}"><img src="${esc(plan.image)}" alt="Původní projektový půdorys: ${esc(space.label)}, včetně skutečných kót" width="${plan.width}" height="${plan.height}" loading="lazy"/></a><figcaption>${esc(space.label)} · původní projektový výřez</figcaption><a class="parking-document-link" href="${esc(plan.pdf)}" target="_blank" rel="noopener">Otevřít celý projektový výkres (PDF) ${icon()}</a></figure>` : '';
    $('#parking-detail').innerHTML=`
      <header class="parking-detail-head"><div><span class="eyebrow">${esc(types[space.type])}</span><h3>${esc(space.label)}</h3></div><button type="button" class="parking-clear" data-clear-parking-unit>Zrušit výběr <span aria-hidden="true">×</span></button></header>
      <span class="status-badge status-${s.key}"><span class="availability-dot" aria-hidden="true"></span>${esc(s.label)}</span><strong class="parking-price">${fmt.format(space.price)} Kč</strong>
      <dl class="parking-facts"><div><dt>Označení</dt><dd>${esc(space.id)}</dd></div>${dimensionsHTML}<div><dt>${areaLabel}</dt><dd>${area}</dd></div><div><dt>Umístění</dt><dd>${esc(space.type==='garage'?'Přízemí':types[space.type])}</dd></div></dl>
      <p class="parking-separate-price">Parkování se kupuje samostatně.</p><a class="button button-dark viewing-cta" href="#kontakt" data-parking-inquiry="${esc(space.id)}">${s.key==='available'?'Domluvit prohlídku':'Ověřit možnosti parkování'} ${icon()}</a>${planHTML}
      <p class="parking-purchase-rule"><strong>${esc(data.purchaseRule)}</strong></p>`;
  }
  function drawBays(view) {
    const image = $('#parking-drawing');
    map.setAttribute('viewBox', `0 0 ${view.width} ${view.height}`);
    $('#parking-drawing-title').textContent = view.label;
    if (image.getAttribute('href') !== view.image && image.getAttribute('href') !== view.original) {
      image.setAttribute('width', view.width);
      image.setAttribute('height', view.height);
      image.setAttribute('href', view.image);
    }
    $('#parking-bays').innerHTML = data.spaces.filter(inDrawing).map(space => {
      const [x,y,width,height] = view.bays[space.id];
      const s = status(space);
      const label = space.type==='garage' ? space.id : space.number;
      const cx=x+width/2, cy=y+height/2;
      const fontSize=Math.min(31, .56*Math.min(width,height));
      return `<g class="parking-space" data-parking-id="${esc(space.id)}" data-status="${s.key}" role="button" tabindex="0" aria-pressed="${space.id===selectedId}" aria-label="${esc(space.label)}, ${esc(types[space.type])}, ${esc(s.label)}, ${fmt.format(space.price)} korun">
        <title>${esc(space.label)} · ${esc(s.label)}</title>
        <rect class="parking-bay" x="${x}" y="${y}" width="${width}" height="${height}" rx="7"/>
        <text aria-hidden="true" x="${cx}" y="${cy}" style="font-size:${fontSize}px">${esc(label)}</text>
      </g>`;
    }).join('');
  }
  $('#parking-drawing').addEventListener('error', () => {
    const view = data?.drawings[activeType];
    const image = $('#parking-drawing');
    if (view && image.getAttribute('href') === view.image) image.setAttribute('href', view.original);
  });
  function revealSelection() {
    const viewport = map.parentElement;
    if (viewport.scrollWidth <= viewport.clientWidth) return;
    const bay = map.querySelector('[aria-pressed=true] .parking-bay');
    if (!bay) return;
    const box = bay.getBoundingClientRect();
    const frame = viewport.getBoundingClientRect();
    if (box.left < frame.left + 6 || box.right > frame.right - 6) {
      viewport.scrollLeft += box.left + box.width / 2 - frame.left - frame.width / 2;
    }
  }
  function render() {
    const focus=document.activeElement?.closest('#parking-map [data-parking-id]')?.dataset.parkingId;
    const clearFocused=document.activeElement?.matches('#parking-detail [data-clear-parking-unit]');
    const view=data.drawings[activeType];
    root.querySelectorAll('[data-park-layer]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.parkLayer === activeType));
    });
    root.dataset.parkingType=activeType;
    document.querySelectorAll('.parking-options [data-parking-type]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.parkingType===activeType)));
    drawBays(view);
    $('#parking-map-note').innerHTML=`<a class="parking-document-link" href="${esc(view.original)}" target="_blank" rel="noopener">Zvětšit výkres ${icon()}</a>`;
    detail();
    if (focus) map.querySelector(`[data-parking-id="${focus}"]`)?.focus({preventScroll:true});
    if (clearFocused) $('#parking-detail [data-clear-parking-unit]')?.focus({preventScroll:true});
    requestAnimationFrame(revealSelection);
  }
  function select(id) {
    const space=data.spaces.find(item=>item.id===id);
    if (!space || !inDrawing(space)) return;
    selectedId=id;
    root.querySelectorAll('[data-parking-id]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.parkingId===id)));
    detail();updateUrl();revealSelection();
    $('#parking-live').textContent=`${space.label}, ${types[space.type]}, ${status(space).label}, ${fmt.format(space.price)} Kč.${dimensionLabel(space)?` Rozměry ${dimensionLabel(space)}.`:''}`;
  }
  root.addEventListener('click',event=>{
    if (!data) return;
    if (event.target.closest('[data-clear-parking-unit]')) {
      const last = selectedId;
      selectedId=null; activeType='all'; render(); updateUrl();
      map.querySelector(`[data-parking-id="${last}"]`)?.focus({preventScroll:true});
      $('#parking-live').textContent='Výběr byl zrušen.';
      return;
    }
    const layer = event.target.closest('[data-park-layer]');
    if (layer) {
      showType(layer.dataset.parkLayer);
      return;
    }
    const space=event.target.closest('[data-parking-id]');if(space) select(space.dataset.parkingId);
    const inquiry=event.target.closest('[data-parking-inquiry]');
    if(inquiry) document.dispatchEvent(new CustomEvent('alexandra:parking-inquiry',{detail:{id:inquiry.dataset.parkingInquiry}}));
  });
  function showType(type) {
    if (type !== 'all' && !validType(type)) return;
    activeType = type;
    const list=data.spaces.filter(inDrawing);
    if (!list.some(space=>space.id===selectedId)) selectedId=list[0]?.id || null;
    render();
    updateUrl();
    $('#parking-live').textContent = data.drawings[activeType].label;
  }
  document.addEventListener('click',event=>{
    const tile=event.target.closest('.parking-options [data-parking-type]');
    if (!data || !tile) return;
    showType(tile.dataset.parkingType);
    root.scrollIntoView?.({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  });
  root.addEventListener('keydown',event=>{const node=event.target.closest('g[data-parking-id]');if(node&&['Enter',' '].includes(event.key)){event.preventDefault();select(node.dataset.parkingId);}});
  document.addEventListener('alexandra:inventory-change',()=>{if(data)render();});
  function fromUrl() {
    const params=new URL(location.href).searchParams, id=params.get('parkovani');
    const space=data.spaces.find(item=>item.id===id);
    const requestedType=params.get('typ-parkovani');
    activeType=requestedType==='all' || validType(requestedType) ? requestedType : (space?.type==='garage'?'garage':'all');
    if(space && activeType!=='all' && space.type!==activeType) activeType=space.type;
    selectedId=space?.id || null;
  }
  window.addEventListener('popstate',()=>{if(data){fromUrl();render();}});
  function validDrawing(view, spaces) {
    if (!view?.bays || !/^assets\/parking\/[\d-]+\/[a-z-]+\.webp$/.test(view.image) || view.original !== view.image.replace(/\.webp$/,'.png')) return false;
    if (![view.width,view.height].every(n=>Number.isFinite(n) && n>0)) return false;
    return spaces.every(space => {
      const box = view.bays[space.id];
      if (!Array.isArray(box) || box.length!==4 || !box.every(Number.isFinite)) return false;
      const [x,y,w,h] = box;
      return x>=0 && y>=0 && w>0 && h>0 && x+w<=view.width && y+h<=view.height;
    });
  }
  fetch('data/parking.json?v=podklady20261124', {cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Parking unavailable');return r.json();}).then(result=>{
    if(!Array.isArray(result.spaces) || !result.spaces.length || !result.drawings)throw new Error('Invalid parking');
    if(!result.spaces.every(p=>/^[PG]\d+$/.test(p.id)&&validType(p.type)&&Number.isFinite(p.price)))throw new Error('Invalid space');
    if(!['all',...Object.keys(types)].every(type=>validDrawing(result.drawings[type],result.spaces.filter(p=>type==='all' || p.type===type))))throw new Error('Invalid parking drawing');
    if(!result.spaces.every(p=>!p.plan || p.type==='garage' && /^assets\/parking\/garage-g[12]-plan\.webp$/.test(p.plan.image) && p.plan.pdf==='plans/floor-1.pdf' && Number.isFinite(p.plan.width) && Number.isFinite(p.plan.height)))throw new Error('Invalid garage plan');
    if(!result.spaces.every(p=>(p.area==null || Number.isFinite(p.area)&&p.area>0) && (!p.dimensions || validDimensions(p.dimensions))))throw new Error('Invalid dimensions');
    data=result;fromUrl();
    if (!selectedId) selectedId=data.spaces.find(inDrawing)?.id || null;
    render();$('#parking-loading').hidden=true;$('#parking-workbench').hidden=false;
  }).catch(()=>{$('#parking-loading').innerHTML='Výběr míst se nepodařilo načíst. <a href="assets/parking/2026-11-23/situace.png" target="_blank" rel="noopener">Otevřít situační výkres parkování</a> nebo <a href="#kontakt">kontaktovat prodejce</a>.';});
})();
