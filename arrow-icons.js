/* Alexandra arrows use vector paths, never platform-dependent text glyphs. */
(() => {
  'use strict';
  const paths = Object.freeze({
    'arrow-up-right': 'M5 19 19 5M8 5h11v11',
    'arrow-right': 'M4 12h16M14 6l6 6-6 6',
    'arrow-left': 'M20 12H4M10 6l-6 6 6 6',
    'arrow-up': 'M12 20V4M6 10l6-6 6 6',
    'arrow-down': 'M12 4v16M6 14l6 6 6-6',
    'rotate-cw': 'M19.5 8.5a8 8 0 1 0 .3 6.3M19.5 3.5v5h-5',
    'rotate-ccw': 'M4.5 8.5a8 8 0 1 1-.3 6.3M4.5 3.5v5h5',
    'chevron-up': 'M6 15l6-6 6 6'
  });
  function svg(name) {
    if (!Object.prototype.hasOwnProperty.call(paths, name)) return '';
    return `<svg class="alex-arrow" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${paths[name]}"/></svg>`;
  }
  window.AlexandraArrows = Object.freeze({ svg });
})();
