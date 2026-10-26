(() => {
  'use strict';
  const data = window.ALEXANDRA_DETAILS || { units: {}, standard: [], excluded: [] };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 });
  const area = value => typeof value === 'number' && Number.isFinite(value) ? `${format.format(value)} m²` : 'Výměru upřesníme';
  const featureArea = (value, kind) => value === 0 ? (kind === 'cellar' ? 'Bez sklepa' : 'Bez balkonu') : area(value);
  const get = unit => data.units[String(unit?.id)] || {};
  function areasHTML(unit) {
    const details = get(unit);
    return `<div><dt>Balkon</dt><dd>${featureArea(details.balconyArea, 'balcony')}</dd></div><div><dt>Sklep</dt><dd>${featureArea(details.cellarArea, 'cellar')}</dd></div>`;
  }
  function cardHTML(unit) {
    const details = get(unit);
    return `<div class="unit-standard-preview">${details.locationNote ? `<p class="unit-location-note"><strong>${esc(details.locationNote)}</strong></p>` : ''}<strong>Standard v ceně bytu</strong><p>Vinylové podlahy, dveře, plastová okna, koupelnová sanita a technické přípravy.</p><p class="small">${esc(details.bathroom?.referenceType || 'Konkrétní podobu koupelny upřesníme.')}</p><p class="excluded-line">Bez kuchyňské linky, spotřebičů, volného nábytku a žaluzií. Koupelnové skříňky dle soupisu.</p></div>`;
  }
  function detailHTML(unit) {
    const details = get(unit);
    const bathroom = details.bathroom;
    const pdf = bathroom?.catalogUrl && /^plans\/[a-z0-9-]+\.pdf$/.test(bathroom.catalogUrl) ? bathroom.catalogUrl : null;
    return `<section class="unit-included" aria-label="Vybavení bytu ${esc(unit.id)}">${details.locationNote ? `<p class="unit-location-note"><strong>${esc(details.locationNote)}</strong></p>` : ''}<h3>Co je v ceně tohoto bytu</h3><p>V ceně jsou vinylové podlahy, dveře, plastová okna, koupelnová sanita a uvedené technické přípravy. Úplný soupis pro byt ${esc(unit.id)} najdete níže.</p><details class="ux-disclosure"><summary>Úplný standard v ceně bytu</summary><ul class="equipment-list">${(details.equipment || []).map(item=>`<li>${esc(item)}</li>`).join('')}</ul></details><div class="unit-bathroom"><strong>Koupelna dle dodaného katalogu</strong>${bathroom?.referenceType ? `<p>${esc(bathroom.referenceType)}</p><details class="ux-disclosure"><summary>Konkrétní sanita a materiály</summary><ul>${(bathroom.items || []).map(item=>`<li>${esc(item)}</li>`).join('')}</ul></details>` : ''}<p class="small">${esc(bathroom?.note || 'Konkrétní výrobky a případné odchylky pro tento byt upřesní prodejce.')}</p>${pdf ? `<a class="text-link" href="${esc(pdf)}" target="_blank" rel="noopener">Prohlédnout katalog koupelny (PDF)</a>` : ''}</div><div class="excluded-box"><strong>Není součástí ceny bytu</strong><p>${esc(data.excluded.join(', '))}.</p><p class="small">Koupelnové skříňky a zrcadla uvedené v katalogu jsou popsané samostatně v soupisu koupelny.</p></div><p class="small">${esc(unit.id === 51 ? 'Byt 51 nemá balkon.' : data.balconies?.message)}</p></section>`;
  }
  window.AlexandraDetails = Object.freeze({ get, area, featureArea, areasHTML, cardHTML, detailHTML });

  const guide = document.querySelector('#standard-items');
  if (guide) guide.innerHTML = data.standard.map((group, index) => `<article id="standard-${esc(group.id)}"><span class="standard-number">${String(index+1).padStart(2,'0')}</span><div><h3>${esc(group.title)}</h3><ul>${group.items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div></article>`).join('');
  const catalogs = document.querySelector('#bathroom-catalogs');
  if (catalogs) {
    const variants = [
      { unit: 4, title: '1+kk', image: '1kk-bathroom-05' },
      { unit: 2, title: '2+kk', image: '2kk-bathroom-04' },
      { unit: 1, title: '3+kk', image: '3kk-bathroom-03' },
      { unit: 51, title: 'Byt 51 · pod úrovní terénu' }
    ];
    catalogs.innerHTML = variants.map(variant => {
      const bathroom = data.units[String(variant.unit)]?.bathroom;
      if (!bathroom) return '';
      const pdf = bathroom.catalogUrl && /^plans\/[a-z0-9-]+\.pdf$/.test(bathroom.catalogUrl) ? bathroom.catalogUrl : null;
      const preview = variant.image ? `<a href="interiors.html?typology=${encodeURIComponent(variant.title)}&amp;room=Koupelna#gallery" aria-label="Prohlédnout koupelnu ${esc(variant.title)}"><img src="assets/agency-interiors-20261026/${variant.image}-thumb.webp" alt="Původní vizualizace koupelny ${esc(variant.title)} z podkladů projektu" width="720" height="405" loading="lazy"></a>` : '';
      return `<article class="bathroom-catalog${variant.image ? '' : ' bathroom-catalog-ground'}">${preview}<div>${variant.image ? '<p class="visual-scope">Původní vizualizace. Aktuální vybavení určuje katalog koupelny.</p>' : ''}<p class="eyebrow">${esc(variant.title)}</p><h4>${esc(bathroom.referenceType)}</h4><details class="ux-disclosure"><summary>Sanita a materiály</summary><ul>${(bathroom.items || []).map(item=>`<li>${esc(item)}</li>`).join('')}</ul><p class="small">${esc(bathroom.note)}</p></details>${pdf ? `<a class="text-link" href="${esc(pdf)}" target="_blank" rel="noopener">Katalog koupelny (PDF)</a>` : ''}</div></article>`;
    }).join('');
  }
  const points = [
    { id:'flooring', label:'Vinylová podlaha', x:14,y:84, text:'Vinylové podlahy v obytných místnostech jsou součástí standardu v ceně.' },
    { id:'doors', label:'Interiérové dveře', x:9,y:43, text:'Interiérové dveře včetně zárubní jsou součástí standardu v ceně. Konkrétní dekor a provedení potvrdí prodejce.' },
    { id:'preparations', label:'Příprava kuchyně', x:34,y:43, text:'V ceně jsou rozvody a přípojná místa pro kuchyň. Vyobrazená kuchyňská linka a spotřebiče v ceně nejsou.' },
    { id:'furniture', label:'Volné zařízení', x:75,y:67, text:'Pohovka, stůl, židle a další nábytek ukazují možné zařízení interiéru. Nejsou součástí ceny bytu.' }
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
    const link = event.target.closest('[data-section-link], a[href="#vybaveni"]');
    if (!link) return;
    const sectionId = link.dataset.sectionLink || 'vybaveni';
    const section = document.getElementById(sectionId);
    if (!section) return;
    const selection = document.querySelector('#equipment-unit-context');
    if (section.id === 'vybaveni' && selection) {
      const unit = (window.ALEXANDRA_UNITS || []).find(item=>item.id===Number(link.dataset.unitId));
      selection.hidden = !unit;
      selection.innerHTML = unit ? `Prohlížíte standard pro <strong>byt ${unit.id} · ${esc(unit.layout)}</strong>. <button type="button" class="text-link" data-unit="${unit.id}">Zpět do karty bytu</button>` : '';
    }
    // Ordinary navigation keeps its native anchor behaviour; only links leaving
    // a dialog need explicit closing and focus restoration to the section.
    if (!link.dataset.sectionLink) return;
    event.preventDefault();
    document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
    requestAnimationFrame(()=>{ section.tabIndex=-1; section.focus({preventScroll:true}); section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); });
    history.pushState(null,'',`#${section.id}`);
  });
})();
