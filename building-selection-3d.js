(() => {
  'use strict';
  let initialized = false;
  const floorLabel = window.AlexandraFloorLabels.label;
  const runtimeURL = new URL('vendor/model-viewer.min.js', document.baseURI);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let runtimePromise, runtimeAttempt = 0;

  function loadRuntime() {
    if (customElements.get('model-viewer')) return Promise.resolve();
    if (!runtimePromise) {
      const url = new URL(runtimeURL);
      if (runtimeAttempt++) url.searchParams.set('retry', String(runtimeAttempt));
      runtimePromise = import(url.href).then(() => customElements.whenDefined('model-viewer')).catch(error => {
        runtimePromise = null;
        throw error;
      });
    }
    return runtimePromise;
  }

  function initialize() {
    const explorer = document.querySelector('#floor-explorer');
    const facade = explorer?.querySelector('#building-stack');
    if (initialized || !facade?.querySelector('[data-map-floor]')) return;
    initialized = true;
    const view = document.createElement('div');
    view.className = 'building-selection-view';
    facade.before(view);
    view.innerHTML = `<div class="building-selection-mode" role="group" aria-label="Zobrazení domu"><button type="button" data-building-mode="render" aria-pressed="true" aria-controls="building-stack">Vizualizace</button><button type="button" data-building-mode="architecture" aria-pressed="false" aria-controls="building-selection-3d-panel">3D dům</button><button type="button" data-building-mode="availability" aria-pressed="false" aria-controls="building-selection-3d-panel">Dostupnost bytů</button></div>`;
    view.append(facade);
    const panel = document.createElement('div');
    panel.id = 'building-selection-3d-panel';
    panel.className = 'building-selection-3d-panel';
    panel.hidden = true;
    panel.innerHTML = `<div class="building-selection-availability-tools" hidden><label class="building-selection-isolate"><input type="checkbox" data-building-isolate> Jen vybrané podlaží <strong data-building-floor-name>1. NP</strong></label><div class="building-selection-3d-legend" aria-label="Legenda dostupnosti"><span data-availability-key="available"><i aria-hidden="true"></i>Volný</span><span data-availability-key="reserved"><i aria-hidden="true"></i>Rezervovaný</span><span data-availability-key="sold"><i aria-hidden="true"></i>Prodaný</span><span data-availability-key="unknown"><i aria-hidden="true"></i>Na dotaz</span></div></div><div class="building-selection-3d-stage"><div class="building-selection-3d-loading" role="status">Načítání 3D modelu…</div><div class="building-selection-3d-error" hidden><p>3D model se nepodařilo zobrazit. Podlaží a byty můžete dál vybírat na vizualizaci.</p><button type="button" data-building-3d-retry>Zkusit znovu</button><button type="button" data-building-mode="render">Zpět na vizualizaci</button></div></div><p class="building-selection-3d-selection" role="status" aria-live="polite" aria-atomic="true" hidden></p><p class="building-selection-3d-help" id="building-selection-3d-help"></p><details class="building-selection-camera"><summary>Ovládání pohledu</summary><div class="building-selection-3d-controls" role="group" aria-label="Pohled na 3D model"><button type="button" data-building-orbit="-35deg 68deg 58m" disabled>Přední pohled</button><button type="button" data-building-orbit="145deg 68deg 58m" disabled>Zadní pohled</button><button type="button" data-building-orbit="-35deg 35deg 58m" disabled>Nadhled</button></div></details><p class="building-selection-3d-note"></p>`;
    view.append(panel);
    const stage = panel.querySelector('.building-selection-3d-stage');
    const loading = panel.querySelector('.building-selection-3d-loading');
    const error = panel.querySelector('.building-selection-3d-error');
    const cameraButtons = [...panel.querySelectorAll('[data-building-orbit]')];
    const units = window.ALEXANDRA_UNITS || [];
    const catalog = window.AlexandraCatalog;
    const inventory = window.AlexandraInventory;
    const isolate = panel.querySelector('[data-building-isolate]');
    const availabilityTools = panel.querySelector('.building-selection-availability-tools');
    const selection = panel.querySelector('.building-selection-3d-selection');
    const colors = { available:'#4b805a', reserved:'#b17c2f', sold:'#aa5552', unknown:'#8d968c' };
    const labels = { available:'Volný', reserved:'Rezervovaný', sold:'Prodaný', unknown:'Dostupnost na dotaz' };
    let model, ready = false, loadTimer, mode = 'render', content = 'architecture', requestedSrc = '', loadingSource = '', geometry, geometryPromise, requestNumber = 0, lastFloor = 2;
    const srcForVariant = () => content === 'availability' ? (isolate.checked ? `assets/3d/availability-floor-${activeFloor()}.glb` : 'assets/3d/availability-building.glb') : 'assets/3d/exterior-no-balconies.glb';
    const activeFloor = () => Number(facade.querySelector('[data-map-floor][aria-pressed="true"]')?.dataset.mapFloor) || 2;
    const selectedUnit = () => Number(explorer.querySelector('#building-selection-units [aria-pressed="true"]')?.dataset.buildingUnit) || null;
    const unitStatus = unit => { const key = inventory?.status(unit)?.key; return Object.hasOwn(colors,key) ? key : 'unknown'; };
    const linear = hex => [1,3,5].map(i => { const value = parseInt(hex.slice(i,i+2),16)/255; return value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4; });

    async function loadGeometry() {
      if (!geometryPromise) geometryPromise = fetch('data/building-selection-geometry.json').then(response => {
        if (!response.ok) throw new Error('Building geometry unavailable');
        return response.json();
      }).then(data => {
        const rows = data?.availabilityModel?.units;
        if (!Array.isArray(rows) || rows.length !== 51 || new Set(rows.map(row=>row.id)).size !== 51 || rows.some(row=>!units.some(unit=>unit.id===row.id && unit.floor===row.floor) || !Array.isArray(row.labelPosition) || row.labelPosition.length!==3 || !row.labelPosition.every(Number.isFinite))) throw new Error('Invalid source-mapped geometry');
        geometry = rows;
      }).catch(error => { geometryPromise = null; throw error; });
      return geometryPromise;
    }

    function updateCopy() {
      availabilityTools.hidden = content !== 'availability';
      selection.hidden = content !== 'availability';
      panel.querySelector('[data-building-floor-name]').textContent = floorLabel(activeFloor());
      panel.querySelector('.building-selection-3d-help').textContent = content === 'availability'
        ? 'Tažením otočíte model, klepnutím na barevný byt otevřete jeho půdorys a kartu níže. Volba „Jen vybrané podlaží“ odkryje všechny byty v patře.'
        : 'Tažením otočíte dům, dvěma prsty nebo kolečkem přiblížíte. Klepnutím na číslo vyberete podlaží. Barvy bytů najdete v režimu „Dostupnost bytů“.';
      panel.querySelector('.building-selection-3d-note').innerHTML = content === 'availability'
        ? '<strong>Prostorové rozložení podle půdorysů.</strong> Barevné objemy vycházejí z hranic bytů ve zdrojových výkresech; šedé společné prostory nejsou byty. Barvy se aktualizují ze stejného seznamu dostupnosti jako ceník. U nepotvrzených stavů uvádíme „Na dotaz“. Jde o orientační schéma bez balkonů, nikoli dokončenou architekturu či právní hranice jednotek.'
        : '<strong>Orientační prostorová rekonstrukce.</strong> Zobrazujeme dům bez bočních balkonů. Model vychází z dostupných výkresů a vizualizací, nejde o závazné provedení stavby.';
    }

    function syncAvailability() {
      if (content !== 'availability' || !ready || !model?.model || !geometry) return;
      const chosen = selectedUnit();
      for (const material of model.model.materials) {
        const match = /^unit-(\d+)$/.exec(material.name);
        if (!match || !material.isLoaded || !material.isActive) continue;
        const unit = units.find(unit=>unit.id===Number(match[1]));
        if (!unit) continue;
        material.pbrMetallicRoughness.setBaseColorFactor([...linear(colors[unitStatus(unit)]), 1]);
        material.setAlphaMode('OPAQUE');
        material.setEmissiveFactor(unit.id === chosen ? [.13,.11,.045] : [0,0,0]);
      }
      model.querySelectorAll('[data-volume-unit]').forEach(button => {
        const unit = units.find(unit=>unit.id===Number(button.dataset.volumeUnit));
        const key = unitStatus(unit);
        button.dataset.availabilityKey = key;
        button.setAttribute('aria-pressed', String(unit.id===chosen));
        button.setAttribute('aria-label', `Vybrat byt ${unit.id}, ${unit.layout}, ${labels[key]}`);
      });
      const unit = units.find(unit=>unit.id===chosen);
      selection.textContent = unit ? `Vybrán byt ${String(unit.id).padStart(2,'0')} · ${unit.layout} · ${floorLabel(unit.floor)} · ${labels[unitStatus(unit)]}` : 'Vyberte byt přímo v modelu nebo v seznamu podlaží.';
    }

    function chooseVolume(id) {
      const unit = units.find(unit=>unit.id===id);
      if (!unit || !catalog) return;
      catalog.setFilters({floor:String(unit.floor)});
      const button = explorer.querySelector(`#building-selection-units [data-building-unit="${id}"]`);
      if (!button || button.disabled) {
        selection.textContent = `Byt ${id} neodpovídá aktivním filtrům. Pro jeho výběr upravte filtry v přehledu.`;
        return;
      }
      button.click();
      syncAvailability();
    }

    function setCameraForSource() {
      const row = geometry?.find(unit=>unit.floor===activeFloor());
      const center = content === 'availability' && isolate.checked && row ? (row.bottomY+row.topY)/2 : 8.8;
      model.cameraTarget = `15.4m ${center}m -9.35m`;
      if (content === 'availability' && isolate.checked) model.cameraOrbit = '-35deg 28deg 58m';
    }

    function setBusy(busy) {
      ready = !busy;
      loading.hidden = !busy;
      model?.setAttribute('aria-busy', String(busy));
      cameraButtons.forEach(button => { button.disabled = busy; });
      model?.querySelectorAll('button').forEach(button => { button.disabled = busy; });
    }
    function showError() {
      clearTimeout(loadTimer);
      setBusy(true);
      loading.hidden = true;
      error.hidden = false;
      model?.setAttribute('aria-busy', 'false');
    }
    function beginLoad() {
      clearTimeout(loadTimer);
      error.hidden = true;
      setBusy(true);
      loadTimer = setTimeout(showError, 45000);
    }
    function syncFloor() {
      const floor = activeFloor();
      const floorChanged = lastFloor !== floor;
      lastFloor = floor;
      model?.querySelectorAll('[data-map-floor]').forEach(button => {
        button.setAttribute('aria-pressed', String(Number(button.dataset.mapFloor) === floor));
      });
      panel.querySelector('[data-building-floor-name]').textContent = floorLabel(floor);
      if (floorChanged && content === 'availability' && isolate.checked && mode === '3d') loadModel();
      else syncAvailability();
    }
    function drawHotspots() {
      if (!model) return;
      if (content === 'availability' && isolate.checked && geometry) {
        model.innerHTML = geometry.filter(row=>row.floor===activeFloor()).map(row=>`<button type="button" class="building-selection-unit-hotspot" slot="hotspot-unit-${row.id}" data-position="${row.labelPosition.map(n=>`${n}m`).join(' ')}" data-normal="0m 1m 0m" data-volume-unit="${row.id}" aria-pressed="false">${String(row.id).padStart(2,'0')}</button>`).join('');
      } else {
        // Anchors identify whole storeys. Apartment volumes and their labels use
        // separately verified plan geometry, never an inferred facade division.
        const anchors = [[1,16.9,1.55,2.1],[2,4.2,4.85,1.8],[3,27,7.85,1.8],[4,4.2,10.85,1.8],[5,27,13.85,1.8],[6,4.2,16.85,1.8]];
        model.innerHTML = anchors.map(([floor,x,y,z]) => `<button type="button" class="building-selection-hotspot" slot="hotspot-floor-${floor}" data-position="${x}m ${y}m ${z}m" data-normal="0m 0m 1m" data-visibility-attribute="visible" data-map-floor="${floor}" aria-label="Vybrat ${floorLabel(floor)}" aria-pressed="${floor === activeFloor()}">${floorLabel(floor)}</button>`).join('');
        model.querySelectorAll('[data-map-floor]').forEach(button => {
          button.addEventListener('hotspot-visibility', event => { button.tabIndex = event.detail.visible ? 0 : -1; });
        });
      }
      model.querySelectorAll('button').forEach(button=>{button.disabled=!ready;});
    }
    function makeModel() {
      model = document.createElement('model-viewer');
      model.id = 'building-selection-model';
      const attributes = {
        'camera-controls':'', 'touch-action':'pan-y', 'shadow-intensity':'1', exposure:'1',
        'environment-image':'neutral', 'camera-target':'15.4m 8.8m -9.35m',
        'camera-orbit':'-35deg 68deg 58m', 'min-camera-orbit':'auto 10deg 28m',
        'max-camera-orbit':'auto 89deg 115m', 'interpolation-decay': reducedMotion.matches ? '0' : '120',
        'interaction-prompt':'none', 'loading':'eager', 'reveal':'auto',
        'aria-describedby':'building-selection-3d-help', 'aria-busy':'true'
      };
      Object.entries(attributes).forEach(([name,value]) => model.setAttribute(name,value));
      model.addEventListener('load', event => {
        // A prior source may finish while another view is being requested.
        if (event.detail?.url && new URL(event.detail.url,document.baseURI).href !== new URL(srcForVariant(),document.baseURI).href) return;
        clearTimeout(loadTimer);
        loadingSource = '';
        setBusy(false);
        error.hidden = true;
        setCameraForSource();
        drawHotspots();
        syncFloor();
      });
      model.addEventListener('error', showError);
      model.addEventListener('camera-change', event => {
        if (event.detail?.source === 'user-interaction') cameraButtons.forEach(button => button.setAttribute('aria-pressed','false'));
      });
      let pointerStart = null, pointerMoved = false;
      model.addEventListener('pointerdown', event => {
        pointerStart = event.isPrimary ? {x:event.clientX,y:event.clientY,id:event.pointerId} : null;
        pointerMoved = false;
      });
      model.addEventListener('pointermove', event => {
        if (pointerStart && Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>8) pointerMoved=true;
      });
      model.addEventListener('pointercancel', () => { pointerStart=null; });
      model.addEventListener('pointerup', event => {
        if (!pointerStart || pointerMoved || event.pointerId!==pointerStart.id || event.target.closest('button') || content!=='availability' || !ready) {pointerStart=null;return;}
        pointerStart=null;
        const material = model.materialFromPoint(event.clientX,event.clientY);
        const match = /^unit-(\d+)$/.exec(material?.name || '');
        if (match) chooseVolume(Number(match[1]));
      });
      stage.prepend(model);
    }
    async function loadModel(retry = false) {
      const nextSrc = srcForVariant();
      if (!retry && model && requestedSrc === nextSrc && ready) return;
      if (!retry && loadingSource === nextSrc) return;
      loadingSource = nextSrc;
      const currentRequest = ++requestNumber;
      beginLoad();
      try {
        await loadRuntime();
        if (content === 'availability') await loadGeometry();
        if (currentRequest !== requestNumber) return;
        if (!model) makeModel();
        const src = srcForVariant();
        const changed = requestedSrc !== src;
        requestedSrc = src;
        model.alt = content === 'availability' ? `Prostorové rozložení a dostupnost bytů Rezidence Alexandra podle zdrojových půdorysů. ${isolate.checked ? `${floorLabel(activeFloor())}.` : 'Celý dům, šest podlaží.'} Klepnutím vyberte byt; barvu doplňuje text dostupnosti v kartě.` : 'Orientační prostorový model Rezidence Alexandra bez bočních balkonů. Vyberte číslo podlaží.';
        drawHotspots();
        setCameraForSource();
        if (retry && !changed) {
          model.removeAttribute('src');
          requestAnimationFrame(() => { if (currentRequest===requestNumber) model.setAttribute('src',src); });
        } else if (changed || !model.hasAttribute('src')) model.setAttribute('src',src);
        else if (model.loaded) { clearTimeout(loadTimer); loadingSource=''; setBusy(false); syncFloor(); }
      } catch { if (currentRequest===requestNumber) {loadingSource='';showError();} }
    }
    function setMode(next) {
      mode = next === 'render' ? 'render' : '3d';
      if (mode === '3d') content = next;
      // The facade is SVG: its .hidden property is not reflected consistently
      // by browsers, so use the global attribute explicitly.
      facade.toggleAttribute('hidden', mode === '3d');
      panel.hidden = mode !== '3d';
      view.querySelectorAll('.building-selection-mode [data-building-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.buildingMode === next)));
      updateCopy();
      if (mode === '3d') loadModel();
    }
    explorer.addEventListener('click', event => {
      const modeButton = event.target.closest('[data-building-mode]');
      if (modeButton) { setMode(modeButton.dataset.buildingMode); return; }
      if (event.target.closest('[data-building-3d-retry]')) { loadModel(true); return; }
      const unitButton = event.target.closest('[data-volume-unit]');
      if (unitButton) { chooseVolume(Number(unitButton.dataset.volumeUnit));return; }
      if (event.target.closest('[data-building-unit],[data-map-unit]')) { queueMicrotask(syncFloor);return; }
      const orbitButton = event.target.closest('[data-building-orbit]');
      if (orbitButton && ready) {
        model.cameraOrbit = orbitButton.dataset.buildingOrbit;
        if (reducedMotion.matches) model.jumpCameraToGoal?.();
        cameraButtons.forEach(button => button.setAttribute('aria-pressed', String(button === orbitButton)));
      }
    });
    isolate.addEventListener('change', () => {updateCopy();loadModel();});
    explorer.addEventListener('change', event => {if(event.target.id==='map-unit-select') queueMicrotask(syncFloor);});
    explorer.addEventListener('keydown', event => {if(event.target.closest('[data-map-unit],[data-map-floor]')) queueMicrotask(syncFloor);});
    document.addEventListener('alexandra:catalog-change', syncFloor);
    document.addEventListener('alexandra:inventory-change', syncAvailability);
    updateCopy();
    reducedMotion.addEventListener('change', () => { if (model) model.interpolationDecay = reducedMotion.matches ? 0 : 120; });
  }
  document.addEventListener('alexandra:floor-selector-ready', initialize);
  initialize();
})();
