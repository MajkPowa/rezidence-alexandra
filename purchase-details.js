(() => {
  'use strict';
  const data = window.ALEXANDRA_DETAILS || { units: {}, standard: [], excluded: [] };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 });
  const area = value => typeof value === 'number' && Number.isFinite(value) ? `${format.format(value)} m²` : 'Výměru upřesníme';
  const featureArea = (value, kind) => value === 0 ? (kind === 'cellar' ? 'Bez sklepa' : 'Bez balkonu') : area(value);
  const get = unit => data.units[String(unit?.id)] || {};
  const pdfPath = value => typeof value === 'string' && /^plans\/[a-z0-9-]+\.pdf$/.test(value) ? value : null;
  const bathroomKey = unit => get(unit).bathroom?.id || (Number(unit?.id) === 51 ? '51' : String(unit?.layout || '').replace('+',''));
  const bathroomTarget = unit => `#bathroom-${bathroomKey(unit)}`;
  function bathroomLinkHTML(unit, { pdf = false } = {}) {
    const bathroom = get(unit).bathroom;
    if (!bathroom) return '';
    const target = pdf ? pdfPath(bathroom.catalogUrl) : bathroomTarget(unit);
    if (!target) return '';
    return `<a class="bathroom-direct-link" href="${esc(target)}" ${pdf ? 'target="_blank" rel="noopener"' : `data-section-link="${esc(target.slice(1))}" data-unit-id="${esc(unit.id)}"`}>${pdf ? 'Prohlédnout katalog koupelny' : 'Vybavení vaší koupelny'} <span>${esc(bathroom.label)}</span><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 19 19 5M8 5h11v11"/></svg></a>`;
  }
  function tourHref(unit) {
    if (!unit || Number(unit.id) === 51 || !['1+kk','2+kk','3+kk'].includes(unit.layout)) return null;
    return `tour.html?byt=${unit.layout.replace('+','')}&jednotka=${Number(unit.id)}&podlazi=${Number(unit.floor)}#walkthrough`;
  }
  function productsHTML(bathroom) {
    if (!bathroom) return '';
    return `<dl class="bathroom-product-list">${(bathroom.products || []).map(product=>`<div><dt>${esc(product.code)}</dt><dd>${esc(product.title)}${product.specification ? `<small>${esc(product.specification)}</small>` : ''}</dd></div>`).join('')}${bathroom.tiles ? `<div><dt>${esc(bathroom.tiles.code)}</dt><dd>${esc(bathroom.tiles.title)}</dd></div>` : ''}</dl>`;
  }
  function areasHTML(unit) {
    const details = get(unit);
    return `<div><dt>Balkon</dt><dd>${featureArea(details.balconyArea, 'balcony')}</dd></div><div><dt>Sklep</dt><dd>${featureArea(details.cellarArea, 'cellar')}</dd></div>`;
  }
  function cardHTML(unit) {
    const details = get(unit);
    return `<div class="unit-standard-preview">${details.locationNote ? `<p class="unit-location-note"><strong>${esc(details.locationNote)}</strong></p>` : ''}<h4>Standard v ceně bytu</h4><p>Vinylová podlaha Ultimo, dveře, elektroinstalace, koupelnová sanita a technické přípravy.</p><p class="included-confirmation"><strong>Koupelnové skříňky a zrcadla jsou v ceně.</strong></p><p>${esc(details.bathroom?.referenceType || 'Koupelna podle katalogu bytu.')}</p>${bathroomLinkHTML(unit)}<p class="excluded-line">Kuchyň, spotřebiče, volný nábytek a žaluzie nejsou v ceně.</p></div>`;
  }
  function detailHTML(unit) {
    const details = get(unit);
    const bathroom = details.bathroom;
    const standardPdf = pdfPath(data.technicalCatalog?.url);
    return `<section class="unit-included" aria-label="Vybavení bytu ${esc(unit.id)}">${details.locationNote ? `<p class="unit-location-note"><strong>${esc(details.locationNote)}</strong></p>` : ''}<h3>Co je v ceně tohoto bytu</h3><ul class="equipment-list">${(details.equipment || []).map(item=>`<li>${esc(item)}</li>`).join('')}</ul>${standardPdf ? `<a class="equipment-document-link" href="${esc(standardPdf)}" target="_blank" rel="noopener">Technické listy standardního vybavení (PDF)</a>` : ''}<section class="unit-bathroom" aria-label="Koupelna pro byt ${esc(unit.id)}"><h4>Vaše koupelna · ${esc(bathroom?.label || unit.layout)}</h4><p class="included-confirmation"><strong>Skříňky, umyvadla, zrcadla i sanita podle tohoto katalogu jsou součástí ceny bytu.</strong></p>${bathroom?.referenceType ? `<p>${esc(bathroom.referenceType)}</p>${productsHTML(bathroom)}` : ''}${bathroomLinkHTML(unit,{pdf:true})}</section><div class="excluded-box"><h4>Není součástí ceny bytu</h4><p>${esc(data.excluded.join(', '))}.</p></div></section>`;
  }
  window.AlexandraDetails = Object.freeze({ get, area, featureArea, areasHTML, cardHTML, detailHTML, bathroomKey, bathroomTarget, bathroomLinkHTML, tourHref });

  const guide = document.querySelector('#standard-items');
  if (guide) guide.innerHTML = data.standard.map((group, index) => `<article id="standard-${esc(group.id)}"><span class="standard-number">${String(index+1).padStart(2,'0')}</span><div><h3>${esc(group.title)}</h3><ul>${group.items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>${pdfPath(group.sourceUrl) ? `<a class="equipment-document-link" href="${esc(group.sourceUrl)}${group.sourcePage ? '#page='+Number(group.sourcePage) : ''}" target="_blank" rel="noopener">Technický list ${esc(group.title.toLocaleLowerCase('cs'))} (PDF)</a>` : ''}</div></article>`).join('');
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
      const pdf = pdfPath(bathroom.catalogUrl);
      const preview = variant.image ? `<a href="interiors.html?typology=${encodeURIComponent(variant.title)}&amp;room=Koupelna#gallery" aria-label="Prohlédnout koupelnu ${esc(variant.title)}"><img src="assets/agency-interiors-20261026/${variant.image}-thumb.webp" alt="Původní vizualizace koupelny ${esc(variant.title)} z podkladů projektu" width="720" height="405" loading="lazy"></a>` : '';
      return `<article id="bathroom-${esc(bathroom.id)}" class="bathroom-catalog${variant.image ? '' : ' bathroom-catalog-ground'}" tabindex="-1">${preview}<div><p class="eyebrow">${esc(variant.title)}</p><h4>${esc(bathroom.referenceType)}</h4><p class="included-confirmation"><strong>Koupelnové skříňky a zrcadla jsou v ceně.</strong></p>${productsHTML(bathroom)}${pdf ? `<a class="bathroom-direct-link" href="${esc(pdf)}" target="_blank" rel="noopener">Prohlédnout katalog koupelny <span>${esc(bathroom.label)}</span><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 19 19 5M8 5h11v11"/></svg></a>` : ''}</div></article>`;
    }).join('');
  }
  const points = [
    { id:'flooring', label:'Vinylová podlaha', x:14,y:84, text:'Vinylová podlaha je v ceně bytu.' },
    { id:'doors', label:'Interiérové dveře', x:9,y:43, text:'Interiérové dveře včetně zárubní jsou v ceně.' },
    { id:'preparations', label:'Příprava kuchyně', x:34,y:43, text:'Rozvody a přípojky jsou v ceně. Kuchyň a spotřebiče se pořizují samostatně.' },
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
    if ((section.id === 'vybaveni' || section.closest('#vybaveni')) && selection) {
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
