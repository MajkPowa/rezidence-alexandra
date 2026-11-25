(() => {
  'use strict';
  // The original media IDs are also used in previously shared tour links.
  const labels = Object.freeze({ '1kk': '1+kk', '2kk': '2+kk', '3kk': '2,5 + kk' });
  function mediaId(value) {
    const key = String(value ?? '').toLowerCase().replace(/[\s+]/g, '').replace('.', ',');
    if (key === '2,5kk') return '3kk';
    return Object.hasOwn(labels, key) ? key : null;
  }
  window.AlexandraLayouts = Object.freeze({ labels, mediaId });
})();
