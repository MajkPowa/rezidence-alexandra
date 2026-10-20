(() => {
  'use strict';
  const root = document.querySelector('#parking-explorer');
  if (!root) return;
  const $ = selector => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = new Intl.NumberFormat('cs-CZ');
  const types = { outdoor:'Venkovní stání', covered:'Kryté stání', garage:'Garáž' };
  const icon = () => window.AlexandraIcons?.svg('arrow-up-right') || '';
  let data, activeView='site', selectedId=null, filter='all';
  const status = space => window.AlexandraInventory?.parkingStatus(space.id) || {key:'unknown',label:'Dostupnost na dotaz'};
  const matches = space => space.view === activeView && (filter === 'all' || status(space).key === filter);
  function updateUrl() {
    const url = new URL(location.href); if (selectedId) url.searchParams.set('parkovani',selectedId); else url.searchParams.delete('parkovani');
    history.replaceState(null,'',url);
  }
  function detail() {
    const space=data.spaces.find(item=>item.id===selectedId);
    if (!space) { $('#parking-detail').innerHTML='<h3>Vyberte místo</h3><p>Klikněte na číslo ve výkresu nebo v přehledu pod ním.</p>';return; }
    const s=status(space);
    $('#parking-detail').innerHTML=`<span class="eyebrow">${esc(types[space.type])}</span><h3>${esc(space.label)}</h3><span class="status-badge status-${s.key}"><span class="availability-dot" aria-hidden="true"></span>${esc(s.label)}</span><strong class="parking-price">${fmt.format(space.price)} Kč</strong><p>Samostatná cena parkování podle ceníku. Parkovací místo není zahrnuto v ceně bytu.</p><a class="button button-dark" href="#kontakt" data-parking-inquiry="${esc(space.id)}">Ověřit místo ${icon()}</a><p class="visual-scope">${esc(data.purchaseRule)}</p>`;
  }
  function render() {
    const focus=root.contains(document.activeElement) ? {id:document.activeElement.dataset.parkingId,view:document.activeElement.dataset.parkingView,map:!!document.activeElement.closest('#parking-map')} : null;
    const view=data.views.find(item=>item.id===activeView);
    const list=data.spaces.filter(matches);
    if (!list.some(space=>space.id===selectedId)) selectedId=list[0]?.id || null;
    $('#parking-views').innerHTML=data.views.map(item=>`<button type="button" data-parking-view="${esc(item.id)}" aria-pressed="${item.id===activeView}">${esc(item.label)}</button>`).join('');
    const svg=$('#parking-map');svg.setAttribute('viewBox',`0 0 ${view.width} ${view.height}`);
    svg.innerHTML=`<title>${esc(view.label)} s dostupností parkovacích míst</title><image href="${esc(view.image)}" width="${view.width}" height="${view.height}"/>${data.spaces.filter(space=>space.view===activeView).map(space=>{
      const s=status(space),match=matches(space),[x,y]=space.anchor;
      return `<g class="parking-space" data-parking-id="${esc(space.id)}" data-status="${s.key}" tabindex="${match?'0':'-1'}" role="button" aria-label="${esc(space.label)}, ${esc(types[space.type])}, ${esc(s.label)}, ${fmt.format(space.price)} korun" aria-pressed="${space.id===selectedId}" aria-disabled="${!match}" opacity="${match?'1':'.22'}"><circle cx="${x}" cy="${y}" r="${space.type==='garage'?44:31}"/><text x="${x}" y="${y}">${esc(space.type==='garage'?space.id:space.number)}</text></g>`;
    }).join('')}`;
    $('#parking-list').innerHTML=list.map(space=>{const s=status(space);return `<button type="button" data-parking-id="${esc(space.id)}" data-status="${s.key}" aria-pressed="${space.id===selectedId}"><strong>${esc(space.label)}</strong><span class="status-badge status-${s.key}"><i class="availability-dot" aria-hidden="true"></i>${esc(s.label)}</span></button>`;}).join('');
    $('#parking-quick-select').innerHTML=list.length ? list.map(space=>`<option value="${esc(space.id)}">${esc(space.label)} · ${esc(types[space.type])}</option>`).join('') : '<option value="">Žádné místo pro tento filtr</option>';
    $('#parking-quick-select').value=selectedId || '';
    $('#parking-list-count').textContent=`(${list.length})`;
    $('#parking-map-note').innerHTML=`${esc(view.description)} Číslované značky slouží pro výběr místa, nejsou jeho vlastnickou hranicí. Na malém displeji lze výkres posunout; všechna místa jsou i v seznamu. ${view.pdf?`<a href="${esc(view.pdf)}" target="_blank" rel="noopener">Otevřít původní výkres PDF ${icon()}</a>`:''}`;
    $('#parking-empty').hidden=list.length>0;
    detail();
    if (focus?.view) root.querySelector(`[data-parking-view="${focus.view}"]`)?.focus({preventScroll:true});
    else if (focus?.id) $(focus.map ? '#parking-map' : '#parking-list').querySelector(`[data-parking-id="${focus.id}"]`)?.focus({preventScroll:true});
  }
  function select(id) {
    const space=data.spaces.find(item=>item.id===id);
    if (!space || !matches(space)) return;
    selectedId=id;
    root.querySelectorAll('[data-parking-id]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.parkingId===id)));
    detail();updateUrl();
    $('#parking-quick-select').value=selectedId;
    $('#parking-live').textContent=`${space.label}, ${types[space.type]}, ${status(space).label}, ${fmt.format(space.price)} Kč.`;
  }
  root.addEventListener('click',event=>{
    if (!data) return;
    const view=event.target.closest('[data-parking-view]');
    if (view) { activeView=view.dataset.parkingView;selectedId=null;render();updateUrl();return; }
    const space=event.target.closest('[data-parking-id]');if(space) select(space.dataset.parkingId);
    const inquiry=event.target.closest('[data-parking-inquiry]');
    if(inquiry) document.dispatchEvent(new CustomEvent('alexandra:parking-inquiry',{detail:{id:inquiry.dataset.parkingInquiry}}));
  });
  root.addEventListener('keydown',event=>{const node=event.target.closest('g[data-parking-id]');if(node&&['Enter',' '].includes(event.key)){event.preventDefault();select(node.dataset.parkingId);}});
  $('#parking-status-filter').addEventListener('change',event=>{filter=event.target.value;selectedId=null;if(data){render();updateUrl();}});
  $('#parking-quick-select').addEventListener('change',event=>{if(data)select(event.target.value);});
  document.addEventListener('alexandra:inventory-change',()=>{if(data)render();});
  function fromUrl() {
    const id=new URL(location.href).searchParams.get('parkovani');
    const space=data.spaces.find(item=>item.id===id);
    activeView=space?.view || 'site';selectedId=space?.id || null;filter='all';$('#parking-status-filter').value='all';
  }
  window.addEventListener('popstate',()=>{if(data){fromUrl();render();}});
  fetch('data/parking.json?v=corrections-20261020', {cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Parking unavailable');return r.json();}).then(result=>{
    if(!Array.isArray(result.views)||!Array.isArray(result.spaces)||!result.views.length)throw new Error('Invalid parking');
    if(!result.views.every(v=>/^[a-z-]+$/.test(v.id)&&/^assets\/parking\/[a-z-]+\.(svg|webp)$/.test(v.image)&&Number.isFinite(v.width)&&Number.isFinite(v.height)))throw new Error('Invalid view');
    if(!result.spaces.every(p=>/^[PG]\d+$/.test(p.id)&&types[p.type]&&result.views.some(v=>v.id===p.view)&&Number.isFinite(p.price)&&Array.isArray(p.anchor)&&p.anchor.length===2&&p.anchor.every(Number.isFinite)))throw new Error('Invalid space');
    data=result;fromUrl();render();$('#parking-loading').hidden=true;$('#parking-workbench').hidden=false;
  }).catch(()=>{$('#parking-loading').innerHTML='Výkres se nepodařilo načíst. <a href="plans/floor-1.pdf" target="_blank" rel="noopener">Otevřít původní půdorys parkování</a> nebo <a href="#kontakt">kontaktovat prodejce</a>.';});
})();
