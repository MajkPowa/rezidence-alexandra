(() => {
  'use strict';
  const catalog = window.AlexandraCatalog;
  if (!catalog) return;
  const list = document.querySelector('#cenik');
  const model = document.querySelector('#building-purchase-panel');
  const buttons = [...document.querySelectorAll('[data-purchase-view]')];
  const summary = document.querySelector('#active-filter-summary');
  const clear = document.querySelector('#clear-all-filters');
  const layoutField = document.querySelector('.layout-filter');
  const layoutHome = layoutField?.parentElement;
  const layoutNext = layoutField?.nextSibling;
  const floorControls = document.querySelector('.building-picker .floor-buttons');
  let modelLayout;
  function positionLayout(view) {
    if (!layoutHome || !floorControls) return;
    if (view === 'model') {
      if (!modelLayout) {
        modelLayout = document.createElement('div');
        modelLayout.className = 'model-layout-choice';
        floorControls.insertAdjacentElement('afterend', modelLayout);
      }
      modelLayout.hidden = false;
      modelLayout.appendChild(layoutField);
    } else {
      layoutHome.insertBefore(layoutField, layoutNext?.parentNode === layoutHome ? layoutNext : null);
      if (modelLayout) modelLayout.hidden = true;
    }
  }
  function scrollCatalog() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (list.hidden) return;
      // This navigation names the start of the price list explicitly. Jump after
      // its layout has settled so a long animated scroll cannot leave it offscreen.
      list.scrollIntoView({block:'start', behavior:'instant'});
    }));
  }
  function setView(view) {
    document.querySelector('#byty').dataset.purchaseMode = view;
    list.hidden = view === 'model';
    model.hidden = view !== 'model';
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.purchaseView === view)));
    positionLayout(view);
    describeFilters();
  }
  function fromHash() {
    if (['#byty','#vyber-v-dome','#map-unit-card','#floor-explorer'].includes(location.hash) || !location.hash) setView('model');
    else if (location.hash === '#cenik') { setView('catalog'); scrollCatalog(); }
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    setView(button.dataset.purchaseView);
    const url = new URL(location.href);
    url.hash = button.dataset.purchaseView === 'model' ? 'vyber-v-dome' : 'cenik';
    history.replaceState(null, '', url);
    if (button.dataset.purchaseView === 'catalog') scrollCatalog();
  }));
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    if (['#byty','#vyber-v-dome','#map-unit-card','#floor-explorer'].includes(link.hash)) setView('model');
    else if (link.hash === '#cenik') {
      event.preventDefault();
      setView('catalog');
      if (location.hash !== '#cenik') {
        const url = new URL(location.href); url.hash = 'cenik'; history.pushState(null, '', url);
      }
      scrollCatalog();
    }
  });
  function describeFilters() {
    const {filters: state} = catalog.snapshot();
    const labels = [];
    if (state.layout !== 'all') labels.push(state.layout);
    if (state.floor !== 'all') labels.push(window.AlexandraFloorLabels.label(state.floor));
    for (const [key,id] of [['status','status-filter'],['area','area-filter']]) {
      if (state[key] !== 'all') labels.push(document.getElementById(id).selectedOptions[0].textContent);
    }
    if (state.favorites) labels.push('Jen uložené');
    summary.textContent = labels.length ? `Výběr: ${labels.join(' · ')}` : '';
    clear.hidden = !labels.length && state.sort === 'floor';
    const advanced = Number(state.status !== 'all') + Number(state.area !== 'all') + Number(document.querySelector('#byty').dataset.purchaseMode !== 'model' && state.sort !== 'floor');
    document.querySelector('#advanced-filter-count').textContent = advanced ? `(${advanced})` : '';
  }
  clear.addEventListener('click', () => {
    catalog.setFilters({layout:'all',floor:'all',area:'all',status:'all',sort:'floor',favorites:false,all:false});
    document.querySelector('[data-layout="all"]').focus({preventScroll:true});
  });
  window.addEventListener('hashchange', fromHash);
  window.addEventListener('popstate', fromHash);
  document.addEventListener('alexandra:catalog-change', describeFilters);
  setView('model'); fromHash(); describeFilters();
})();
