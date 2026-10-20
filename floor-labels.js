(() => {
  'use strict';
  // Preserve the source floor IDs (1–6), URL parameters and PDF bindings.
  // The presentation uses the floor names confirmed by the project owner.
  const label = value => Number(value) === 1 ? 'Přízemí' : `${Number(value) - 1}. NP`;
  const location = value => Number(value) === 1 ? 'v přízemí' : `v ${label(value)}`;
  const source = value => `${label(value)} · ve zdrojovém výkresu ${Number(value)}. NP`;
  window.AlexandraFloorLabels = Object.freeze({ label, location, source });
})();
