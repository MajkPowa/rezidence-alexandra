/* Alexandra: original architectural pictograms. Static markup uses the same sprite. */
(() => {
  'use strict';
  const art = new Set(['residence','interior','walkthrough','plan','layers','area','living','kitchen','bedroom','bathroom','balcony','parking-open','parking-covered','garage','location','document','materials','fittings','entrance','contact','film']);
  const ui = new Set(['favorite','favorite-filled','arrow-up-right','arrow-right','arrow-left','arrow-down','arrow-up','download','close','plus','minus','menu','expand','check','info']);
  function svg(name, variant = 'ui') {
    if (!(art.has(name) || ui.has(name))) return '';
    const kind = art.has(name) ? 'art' : 'ui';
    const grid = kind === 'art' ? 64 : 24;
    return `<svg class="alex-icon alex-icon--${kind}" viewBox="0 0 ${grid} ${grid}" width="${grid}" height="${grid}" aria-hidden="true" focusable="false"><use href="assets/icons/alexandra.svg#${name}"></use></svg>`;
  }
  window.AlexandraIcons = Object.freeze({ svg });
})();
