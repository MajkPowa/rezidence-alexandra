(() => {
  'use strict';
  const data = window.ALEXANDRA_DETAILS || { units: {}, standard: [], excluded: [] };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 });
  const area = value => typeof value === 'number' && Number.isFinite(value) ? `${format.format(value)} m²` : 'Výměru upřesníme';
  const get = unit => data.units[String(unit?.id)] || {};
  function areasHTML(unit) {
    const details = get(unit);
    return `<div><dt>Balkon</dt><dd>${area(details.balconyArea)}</dd></div><div><dt>Sklep</dt><dd>${area(details.cellarArea)}</dd></div>`;
  }
  function cardHTML(unit) {
    const details = get(unit);
    return `<div class="unit-standard-preview"><strong>Standard v ceně bytu</strong><p>Vinylové podlahy, dveře, plastová okna, koupelnová sanita a technické přípravy.</p><p class="small">${esc(details.bathroom?.referenceType || 'Konkrétní podobu koupelny upřesníme.')} ${details.bathroom?.referenceType ? '— varianta z projektového podkladu, k potvrzení.' : ''}</p><p class="excluded-line">Bez kuchyňské linky, spotřebičů, nábytku a žaluzií.</p></div>`;
  }
  function detailHTML(unit) {
    const details = get(unit);
    const bathroom = details.bathroom;
    return `<section class="unit-included" aria-label="Vybavení bytu ${esc(unit.id)}"><h3>Co je v ceně tohoto bytu</h3><p>Standard pro byt ${esc(unit.id)} podle dokumentu Vybavení bytu.</p><ul class="equipment-list">${(details.equipment || []).map(item=>`<li>${esc(item)}</li>`).join('')}</ul><div class="unit-bathroom"><strong>Projektový návrh koupelny</strong>${bathroom?.referenceType ? `<p>${esc(bathroom.referenceType)}</p><ul>${(bathroom.items || []).map(item=>`<li>${esc(item)}</li>`).join('')}</ul>` : ''}<p class="small">${esc(bathroom?.note || 'Konkrétní výrobky a případné odchylky pro tento byt upřesní prodejce.')} Individuální soupis potvrzený pro tuto jednotku zatím nebyl dodán.</p></div><div class="excluded-box"><strong>Není součástí ceny bytu</strong><p>${esc(data.excluded.join(', '))}.</p></div><p class="small">${esc(data.balconies?.message)}</p></section>`;
  }
  window.AlexandraDetails = Object.freeze({ get, area, areasHTML, cardHTML, detailHTML });

  const guide = document.querySelector('#standard-items');
  if (guide) guide.innerHTML = data.standard.map((group, index) => `<article id="standard-${esc(group.id)}"><span class="standard-number">${String(index+1).padStart(2,'0')}</span><div><h3>${esc(group.title)}</h3><ul>${group.items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div></article>`).join('');
  const points = [
    { id:'flooring', label:'Vinylová podlaha', x:45,y:85, text:'Vinylové podlahy v obytných místnostech jsou součástí standardu v ceně.' },
    { id:'doors', label:'Interiérové dveře', x:13,y:42, text:'Interiérové dveře včetně zárubní jsou součástí standardu v ceně. Konkrétní dekor a provedení potvrdí prodejce.' },
    { id:'preparations', label:'Příprava kuchyně', x:45,y:43, text:'V ceně jsou rozvody a přípojná místa pro kuchyň. Vyobrazená kuchyňská linka a spotřebiče v ceně nejsou.' },
    { id:'furniture', label:'Volné zařízení', x:81,y:72, text:'Pohovka, stůl, židle a další nábytek ukazují možné zařízení interiéru. Nejsou součástí ceny bytu.' }
  ];
  const stage = document.querySelector('#standard-hotspots');
  const detail = document.querySelector('#standard-hotspot-detail');
  function showPoint(id, announce = true) {
    const point = points.find(item=>item.id===id); if (!point || !detail) return;
    stage.querySelectorAll('[data-standard-point]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.standardPoint===id)));
    document.querySelectorAll('[data-standard-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.standardTab===id)));
    detail.innerHTML = `<span class="standard-tag ${id === 'furniture' ? 'is-extra' : ''}">${id === 'furniture' ? 'MIMO CENU BYTU' : id === 'preparations' ? 'V CENĚ POUZE PŘÍPRAVA' : 'SOUČÁST STANDARDU'}</span><h3>${esc(point.label)}</h3><p>${esc(point.text)}</p>`;
  }
  if (stage && detail) {
    stage.innerHTML = points.map((point,index)=>`<button type="button" class="standard-hotspot" style="--x:${point.x}%;--y:${point.y}%" data-standard-point="${point.id}" aria-label="${esc(point.label)} — zobrazit rozsah dodávky" aria-pressed="false" aria-controls="standard-hotspot-detail">${index+1}</button>`).join('');
    const tabs = document.querySelector('#standard-hotspot-tabs');
    tabs.innerHTML = points.map((point,index)=>`<button type="button" data-standard-tab="${point.id}" aria-pressed="false" aria-controls="standard-hotspot-detail">${index+1}. ${esc(point.label)}</button>`).join('');
    document.addEventListener('click', event=>{ const b=event.target.closest('[data-standard-point],[data-standard-tab]'); if(b) showPoint(b.dataset.standardPoint || b.dataset.standardTab); });
    showPoint('flooring',false);
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-section-link]');
    if (!link) return;
    const section = document.getElementById(link.dataset.sectionLink);
    if (!section) return;
    event.preventDefault();
    document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
    if (section.id === 'vybaveni' && link.dataset.unitId) {
      const unit = (window.ALEXANDRA_UNITS || []).find(item=>item.id===Number(link.dataset.unitId));
      const selection = document.querySelector('#equipment-unit-context');
      if (unit && selection) { selection.hidden=false; selection.innerHTML=`Prohlížíte standard pro <strong>byt ${unit.id} · ${esc(unit.layout)}</strong>. <button type="button" class="text-link" data-unit="${unit.id}">Zpět do karty bytu</button>`; }
    }
    requestAnimationFrame(()=>{ section.tabIndex=-1; section.focus({preventScroll:true}); section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); });
    history.pushState(null,'',`#${section.id}`);
  });
})();
