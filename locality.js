/* Exact project pin and verified nearby places. No location tracking or geocoding. */
(() => {
  'use strict';
  const section = document.querySelector('#lokalita');
  if (!section) return;
  const canvas = section.querySelector('#locality-map');
  const status = section.querySelector('#locality-map-status');
  const list = section.querySelector('#locality-places');
  const detail = section.querySelector('#locality-detail');
  const filters = [...section.querySelectorAll('[data-locality-filter]')];
  const movement = section.querySelector('#locality-movement');
  const categories = {education:'Školy',shopping:'Obchody',health:'Zdraví',transport:'Doprava',leisure:'Volný čas'};
  const paths = {
    education:'M3 10 12 5l9 5-9 5-9-5Zm4 3v5c3 2 7 2 10 0v-5M21 10v7',
    shopping:'M4 9h16l-1 11H5L4 9Zm4 0V7a4 4 0 0 1 8 0v2',
    health:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z',
    transport:'M6 4h12v13H6V4Zm0 6h12M9 17v3m6-3v3M9 14h.01M15 14h.01',
    leisure:'M12 3 5 12h4l-5 6h16l-5-6h4L12 3Zm0 15v3'
  };
  const icon = category => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[category] || paths.leisure}"/></svg>`;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mapURL = point => `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lon}#map=18/${point.lat}/${point.lon}`;
  const compactLayout = matchMedia('(max-width:760px)');
  let data, map, markers = [], currentFilter = 'all', selected = 'project', started = false, mobileMovement = false;
  function filtered() { return data.points.filter(p => currentFilter === 'all' || p.category === currentFilter); }
  function showDetail(point) {
    const project = point.id === undefined;
    detail.innerHTML = `<span class="locality-detail-kind">${project ? 'Váš nový domov' : escape(categories[point.category])}</span><h3>${escape(point.name)}</h3><p>${escape(point.address)}</p>${project ? '<p class="locality-distance">Přesná poloha rezidence na mapě.</p>' : `<p class="locality-distance">${escape(point.distanceLabel)}</p>`}<a class="text-link" href="${mapURL(point)}" target="_blank" rel="noopener noreferrer">Otevřít v mapách <span class="locality-arrow" aria-hidden="true"></span></a>`;
  }
  function select(id, move = true) {
    selected = id;
    const point = id === 'project' ? data.project : data.points.find(p => p.id === id);
    if (!point) return;
    showDetail(point);
    list.querySelectorAll('[data-locality-place]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.localityPlace === id)));
    markers.forEach(({id: markerId, marker}) => {
      marker.getElement()?.classList.toggle('is-selected', markerId === id);
      marker.getElement()?.setAttribute('aria-pressed',String(markerId === id));
      marker.setZIndexOffset(markerId === id ? 1000 : markerId === 'project' ? 800 : 0);
    });
    if (map && move) map.setView([point.lat,point.lon], Math.max(map.getZoom(), 16), {animate:false});
  }
  function renderList() {
    const points = filtered();
    list.innerHTML = points.map(p => `<li><button type="button" data-locality-place="${escape(p.id)}" aria-pressed="${p.id === selected}"><span class="locality-place-icon">${icon(p.category)}</span><span><strong>${escape(p.name)}</strong><small>${escape(categories[p.category])} · ${Math.round(p.distanceMeters / 10) * 10} m</small></span><span class="locality-place-number" aria-hidden="true">${data.points.indexOf(p)+1}</span></button></li>`).join('');
    const countLabel = points.length === 1 ? 'místo' : points.length >= 2 && points.length <= 4 ? 'místa' : 'míst';
    section.querySelector('#locality-count').textContent = `${points.length} ${countLabel} v okolí`;
  }
  function drawMarkers() {
    if (!map) return;
    markers.forEach(item => item.marker.remove()); markers = [];
    [{...data.project,id:'project'}, ...filtered()].forEach(point => {
      const home = point.id === 'project';
      const number = data.points.findIndex(p => p.id === point.id) + 1;
      const marker = L.marker([point.lat,point.lon], {
        keyboard:true, title:point.name, alt:point.name,
        icon:L.divIcon({className:`locality-marker${home ? ' locality-marker--home' : ''}${point.id === selected ? ' is-selected' : ''}`,
          html:home ? '<span aria-hidden="true">A</span>' : `<span aria-hidden="true">${number}</span>`,iconSize:home ? [44,44] : [36,36],iconAnchor:home ? [22,22] : [18,18]})
      }).addTo(map).on('click', () => select(point.id));
      const element = marker.getElement();
      if (element) {
        element.setAttribute('role','button');element.setAttribute('aria-pressed',String(point.id === selected));
        element.setAttribute('aria-label',home ? 'Rezidence Alexandra – přesná poloha' : `${point.name}, ${point.distanceLabel}`);
        element.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();event.stopPropagation();
            if (event.key === 'Enter' && !event.repeat) select(point.id);
          }
        });
        element.addEventListener('keyup', event => { if (event.key === ' ') { event.preventDefault();event.stopPropagation();select(point.id); } });
      }
      marker.setZIndexOffset(home ? 800 : 0);
      markers.push({id:point.id,marker});
    });
  }
  function overview() {
    if (!map) return;
    // A neighbourhood-wide fit makes nearby pins overlap on a narrow phone.
    if (compactLayout.matches && currentFilter === 'all') map.setView([data.project.lat,data.project.lon],16,{animate:false});
    else map.fitBounds([[data.project.lat,data.project.lon],...filtered().map(p => [p.lat,p.lon])],{padding:[48,48],maxZoom:16,animate:false});
  }
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = 'vendor/leaflet/leaflet.js'; script.onload = resolve;script.onerror = reject;
      document.head.append(script);
    });
  }
  async function start() {
    if (started) return; started = true;
    try {
      const response = await fetch('data/locality.json?v=20261109-1');
      if (!response.ok) throw new Error('data');
      data = await response.json();
      if (!Array.isArray(data.points) || !Number.isFinite(data.project?.lat) || !Number.isFinite(data.project?.lon)) throw new Error('data');
      renderList(); showDetail(data.project);
      filters.forEach(button => { button.disabled = false; });
      await loadLeaflet();
      const compact = compactLayout.matches;
      canvas.replaceChildren();
      map = L.map(canvas,{scrollWheelZoom:false,dragging:!compact,tapHold:false,attributionControl:true}).setView([data.project.lat,data.project.lon],16);
      map.attributionControl.setPrefix(false);
      let loadedTiles = 0, failedTiles = 0;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',
        attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
      }).on('loading', () => { loadedTiles = 0;failedTiles = 0;section.dataset.tiles = 'loading'; })
        .on('tileload', () => { loadedTiles++; })
        .on('tileerror', () => { failedTiles++; })
        .on('load', () => {
          section.dataset.tiles = failedTiles ? loadedTiles ? 'partial' : 'error' : 'ready';
          status.textContent = failedTiles ? 'Část mapového podkladu není dostupná. Použijte také seznam míst a odkazy do map. Vzdálenosti jsou vzdušnou čarou.' : 'Vzdálenosti jsou uvedené vzdušnou čarou.';
        }).addTo(map);
      drawMarkers(); overview();
      section.querySelector('#locality-overview').disabled = false;
      movement.disabled = false;movement.setAttribute('aria-pressed',String(!compact));
      new ResizeObserver(() => map.invalidateSize({pan:false})).observe(canvas);
      section.dataset.mapReady = 'true';
    } catch (_) {
      status.textContent = 'Interaktivní mapa není právě dostupná. Přesnou polohu otevřete odkazem v mapách.';
      section.dataset.mapReady = 'false';
    }
  }
  filters.forEach(button => button.addEventListener('click', () => {
    if (!data) return;
    currentFilter = button.dataset.localityFilter;
    filters.forEach(item => item.setAttribute('aria-pressed',String(item === button)));
    selected = 'project';renderList();drawMarkers();select('project',false);overview();
  }));
  list.addEventListener('click', event => { const button = event.target.closest('[data-locality-place]');if (button) select(button.dataset.localityPlace); });
  section.querySelector('#locality-overview').addEventListener('click', () => { select('project',false);overview(); });
  movement.addEventListener('click', () => {
    if (!map) return;
    const enabled = !map.dragging.enabled();
    enabled ? map.dragging.enable() : map.dragging.disable();
    mobileMovement = enabled;
    movement.setAttribute('aria-pressed',String(enabled));
  });
  compactLayout.addEventListener('change', () => {
    if (!map) return;
    const enabled = !compactLayout.matches || mobileMovement;
    enabled ? map.dragging.enable() : map.dragging.disable();
    movement.setAttribute('aria-pressed',String(enabled));
  });
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { observer.disconnect();start(); }
  },{rootMargin:'300px'});
  observer.observe(section);
  new IntersectionObserver(entries => {
    document.body.classList.toggle('locality-map-visible',entries.some(entry => entry.isIntersecting));
  },{rootMargin:'-80px 0px 0px 0px'}).observe(canvas);
})();
