(() => {
  'use strict';
  const data = window.ALEXANDRA_DETAILS || { units: {}, standard: [], excluded: [] };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 });
  const crown = new Intl.NumberFormat('cs-CZ', {style:'currency', currency:'CZK', maximumFractionDigits:0});
  const formatPrice = value => Number.isFinite(value) ? crown.format(Math.trunc(value)) : 'Cena neuvedena';
  const salesPortrait = '<img class="unit-sales-portrait" src="assets/podklady-20261126/pavel-dvorak.webp" width="600" height="857" alt="Pavel Dvořák, prodej bytů" decoding="async">';
  const callSales = '<a class="button unit-call" href="tel:+420734358581" aria-label="Zavolat Pavlu Dvořákovi na 734 358 581"><span>Zavolat</span><span class="unit-call-number">734 358 581</span></a>';
  const area = value => typeof value === 'number' && Number.isFinite(value) ? `${format.format(value)} m²` : 'Výměru upřesníme';
  const featureArea = (value, kind) => value === 0 ? (kind === 'cellar' ? 'Bez sklepa' : 'Bez balkonu') : area(value);
  const get = unit => data.units[String(unit?.id)] || {};
  const pdfPath = value => typeof value === 'string' && /^plans\/[a-z0-9-]+\.pdf$/.test(value) ? value : null;
  const bathroomKey = unit => get(unit).bathroom?.id || (Number(unit?.id) === 51 ? '51' : window.AlexandraLayouts.mediaId(unit?.layout));
  const bathroomTarget = unit => `#bathroom-${bathroomKey(unit)}`;
  function bathroomLinkHTML(unit, { pdf = false } = {}) {
    const bathroom = get(unit).bathroom;
    if (!bathroom) return '';
    if (Number(unit.id) === 51) pdf = true;
    const target = pdf ? pdfPath(bathroom.catalogUrl) : bathroomTarget(unit);
    if (!target) return '';
    return `<a class="bathroom-direct-link" href="${esc(target)}" ${pdf ? 'target="_blank" rel="noopener"' : `data-section-link="${esc(target.slice(1))}" data-unit-id="${esc(unit.id)}"`}>${pdf ? 'Prohlédnout katalog koupelny' : 'Vybavení vaší koupelny'} <span>${esc(bathroom.label)}</span><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 19 19 5M8 5h11v11"/></svg></a>`;
  }
  function tourHref(unit) {
    const id = window.AlexandraLayouts.mediaId(unit?.layout);
    if (!id || Number(unit.id) === 51) return null;
    return `tour.html?byt=${id}&jednotka=${Number(unit.id)}&podlazi=${Number(unit.floor)}#walkthrough`;
  }
  function productsHTML(bathroom) {
    if (!bathroom) return '';
    return `<dl class="bathroom-product-list">${(bathroom.products || []).map(product=>`<div><dt>${esc(product.code)}</dt><dd>${esc(product.title)}${product.specification ? `<small>${esc(product.specification)}</small>` : ''}</dd></div>`).join('')}${bathroom.tiles ? `<div><dt>${esc(bathroom.tiles.code)}</dt><dd>${esc(bathroom.tiles.title)}</dd></div>` : ''}</dl>`;
  }
  function areasHTML(unit) {
    const details = get(unit);
    return `<div><dt>Balkon</dt><dd>${featureArea(details.balconyArea, 'balcony')}</dd></div><div><dt>Sklep</dt><dd>${featureArea(details.cellarArea, 'cellar')}</dd></div>`;
  }
  const includedEquipment = [
    'Vinylová podlaha v dubovém dekoru.',
    'Bílé bezpečnostní vstupní dveře s černým kováním a kukátkem.',
    'Bílé interiérové dveře se zárubněmi a černým kováním.',
    'Sprchový kout nebo sprchová zástěna podle dispozice bytu, včetně sprchové baterie.',
    'Umyvadlo s baterií a skříňkou, zrcadlová skříňka a otopný žebřík.',
    'Závěsné WC se sedátkem s pomalým sklápěním. U dispozic se samostatnou toaletou také umývátko se skříňkou a zrcadlem.',
    'Vypínače a zásuvky v matném provedení.',
    'Stropní svítidla s možností volby odstínu světla.',
    'Plastová okna s přípravou pro předokenní žaluzie.',
    'Rozvody a přípojky pro instalaci kuchyňské linky.',
    'Příprava pro připojení pračky a sušičky.'
  ];
  function detailHTML(unit) {
    const standardPdf = pdfPath(data.technicalCatalog?.url);
    return `<section id="unit-equipment" class="unit-included" aria-labelledby="unit-equipment-title">
      <h3 id="unit-equipment-title" tabindex="-1">Vybavení v ceně bytu</h3>
      <ul class="equipment-list">${includedEquipment.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
      <div class="unit-equipment-documents">${standardPdf ? `<a class="equipment-document-link" href="${esc(standardPdf)}" target="_blank" rel="noopener">Technické listy standardního vybavení (PDF)</a>` : ''}${bathroomLinkHTML(unit,{pdf:true})}</div>
      <div class="excluded-box"><h4>Není součástí ceny bytu</h4><p>${esc(data.excluded.join(', '))}.</p></div></section>`;
  }
  window.AlexandraDetails = Object.freeze({ get, area, formatPrice, salesPortrait, callSales, featureArea, areasHTML, detailHTML, bathroomKey, bathroomTarget, bathroomLinkHTML, tourHref });

  function renderStandards(selector, ids) {
    const target = document.querySelector(selector);
    if (!target) return;
    target.innerHTML = ids.map(id => {
      const group = data.standard.find(item => item.id === id);
      if (!group) return '';
      const source = pdfPath(group.sourceUrl);
      const sheet = source ? `<a class="text-link" href="${esc(source)}${group.sourcePage ? '#page='+Number(group.sourcePage) : ''}" target="_blank" rel="noopener">Technický list (PDF)</a>` : '';
      const extra = id === 'preparations' ? '<p>Možnosti individuálních úprav interiéru <a href="#kontakt">proberte s prodejcem</a>.</p>' : '';
      const tiles = id === 'flooring' ? '<p>Ve společných chodbách a na schodišti je dlažba OI11511, 60 × 60 cm. <a href="plans/vybaveni-a-obklady-20261124.pdf#page=15" target="_blank" rel="noopener">Katalog dlažeb (PDF)</a></p>' : '';
      return `<details id="standard-${esc(id)}"><summary>${esc(group.title)}</summary><div class="equipment-spec"><ul>${group.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>${tiles}${sheet}${extra}</div></details>`;
    }).join('');
  }
  renderStandards('#standard-items', ['flooring', 'doors', 'preparations', 'windows', 'electrical']);
  renderStandards('#standard-bath-items', ['bathroom', 'toilet']);

  const catalogs = document.getElementById('bathroom-catalogs');
  if (catalogs) {
    for (const card of catalogs.querySelectorAll('[data-bathroom-type]')) {
      const bathroom = data.bathroomCatalogs[card.dataset.bathroomType];
      if (!bathroom) continue;
      card.insertAdjacentHTML('beforeend', `<details class="bathroom-products"><summary>Seznam vybavení<span class="sr-only"> ${esc(bathroom.label)}</span></summary><div class="equipment-spec"><p>${esc(bathroom.referenceType)}</p>${productsHTML(bathroom)}</div></details>`);
    }
  }
  function showCatalogForUnit(id) {
    const bathroom = data.units[String(id)]?.bathroom;
    for (const card of catalogs?.querySelectorAll('[data-bathroom-type]') || []) {
      if (card.dataset.bathroomType === bathroom?.id) card.setAttribute('aria-current', 'true');
      else card.removeAttribute('aria-current');
    }
    const special = document.getElementById('bathroom-51');
    if (special) special.hidden = bathroom?.id !== '51' && location.hash !== '#bathroom-51';
  }
  showCatalogForUnit(new URLSearchParams(location.search).get('byt'));
  document.addEventListener('alexandra:picker-unit', event => showCatalogForUnit(event.detail?.id));
  function revealEquipment(target) {
    if (!target?.closest('#vybaveni')) return;
    for (let node = target; node && node.id !== 'vybaveni'; node = node.parentElement) {
      if (node.tagName === 'DETAILS') node.open = true;
    }
  }
  function revealLinkedEquipment() {
    const target = document.getElementById(location.hash.slice(1));
    if (target?.matches('#vybaveni details, .bathroom-option, #bathroom-51')) {
      if (target.id === 'bathroom-51') target.hidden = false;
      revealEquipment(target);
      requestAnimationFrame(() => target.scrollIntoView({block:'start'}));
    }
  }
  window.addEventListener('hashchange', revealLinkedEquipment);
  revealLinkedEquipment();
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-section-link], a[href="#vybaveni"]');
    if (!link) return;
    const sectionId = link.dataset.sectionLink || 'vybaveni';
    const section = document.getElementById(sectionId);
    if (!section) return;
    const selection = document.querySelector('#equipment-unit-context');
    if ((section.id === 'vybaveni' || section.closest('#vybaveni')) && selection) {
      const unit = (window.ALEXANDRA_UNITS || []).find(item=>item.id===Number(link.dataset.unitId));
      if (unit) showCatalogForUnit(unit.id);
      selection.hidden = !unit;
      selection.innerHTML = unit ? `Prohlížíte standard pro <strong>byt ${unit.id} · ${esc(unit.layout)}</strong>. <button type="button" class="text-link" data-unit="${unit.id}">Zpět do karty bytu</button>` : '';
    }
    // Ordinary navigation keeps its native anchor behaviour; only links leaving
    // a dialog need explicit closing and focus restoration to the section.
    if (!link.dataset.sectionLink) return;
    event.preventDefault();
    revealEquipment(section);
    document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
    requestAnimationFrame(()=>{ section.tabIndex=-1; section.focus({preventScroll:true}); section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); });
    history.pushState(null,'',`#${section.id}`);
  });
})();
