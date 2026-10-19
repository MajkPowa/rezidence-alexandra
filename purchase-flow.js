(() => {
  'use strict';
  const catalog = window.AlexandraCatalog;
  if (!catalog) return;
  const list = document.querySelector('#cenik');
  const model = document.querySelector('#building-purchase-panel');
  const buttons = [...document.querySelectorAll('[data-purchase-view]')];
  const summary = document.querySelector('#active-filter-summary');
  const clear = document.querySelector('#clear-all-filters');
  function setView(view) {
    list.hidden = view === 'model';
    model.hidden = view !== 'model';
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.purchaseView === view)));
  }
  function fromHash() {
    if (['#vyber-v-dome','#map-unit-card','#floor-explorer'].includes(location.hash)) setView('model');
    else if (['#byty','#cenik'].includes(location.hash) || !location.hash) setView('catalog');
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    setView(button.dataset.purchaseView);
    const url = new URL(location.href);
    url.hash = button.dataset.purchaseView === 'model' ? 'vyber-v-dome' : 'byty';
    history.replaceState(null, '', url);
  }));
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    if (['#vyber-v-dome','#map-unit-card','#floor-explorer'].includes(link.hash)) setView('model');
    else if (['#byty','#cenik'].includes(link.hash)) setView('catalog');
  });
  function describeFilters() {
    const {filters: state} = catalog.snapshot();
    const labels = [];
    if (state.layout !== 'all') labels.push(state.layout);
    if (state.floor !== 'all') labels.push(`${state.floor}. NP`);
    for (const [key,id] of [['status','status-filter'],['area','area-filter']]) {
      if (state[key] !== 'all') labels.push(document.getElementById(id).selectedOptions[0].textContent);
    }
    if (state.favorites) labels.push('Jen uložené');
    summary.textContent = labels.length ? `Výběr: ${labels.join(' · ')}` : '';
    clear.hidden = !labels.length && state.sort === 'floor';
    const advanced = Number(state.status !== 'all') + Number(state.area !== 'all') + Number(state.sort !== 'floor');
    document.querySelector('#advanced-filter-count').textContent = advanced ? `(${advanced})` : '';
  }
  clear.addEventListener('click', () => {
    catalog.setFilters({layout:'all',floor:'all',area:'all',status:'all',sort:'floor',favorites:false,all:false});
    document.querySelector('[data-layout="all"]').focus({preventScroll:true});
  });
  window.addEventListener('hashchange', fromHash);
  window.addEventListener('popstate', fromHash);
  document.addEventListener('alexandra:catalog-change', describeFilters);
  setView('catalog'); fromHash(); describeFilters();
})();
