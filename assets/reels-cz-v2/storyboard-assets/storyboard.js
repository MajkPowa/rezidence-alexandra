(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const tabs = $$('[data-tab]');
  const ids = tabs.map(tab => tab.dataset.tab);
  function revealRequestedExtras() {
    const id = location.hash.slice(1);
    if (!['storyboards','downloads'].includes(id)) return;
    const details = document.getElementById(id)?.querySelector('details');
    if (details) details.open = true;
  }
  revealRequestedExtras();
  window.addEventListener('hashchange', revealRequestedExtras);
  window.addEventListener('popstate', revealRequestedExtras);
  function activate(id, {scroll = false, focus = false} = {}) {
    if (!ids.includes(id)) id = ids[0];
    if (scroll || focus) { const production = $('#production-storyboards'); if (production) production.open = true; }
    tabs.forEach(tab => {
      const active = tab.dataset.tab === id;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    });
    if (focus) $('[data-tab="' + id + '"]').focus();
    if (scroll) $('#storyboard-' + id).scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
  }
  function hashBoard() {
    const value = location.hash.replace('#storyboard-', '');
    return ids.includes(value) ? value : null;
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      activate(tab.dataset.tab);
      history.replaceState(null, '', '#storyboard-' + tab.dataset.tab);
    });
    tab.addEventListener('keydown', event => {
      const offset = {ArrowLeft:-1, ArrowRight:1}[event.key];
      let next;
      if (offset) next = (index + offset + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        activate(tabs[next].dataset.tab, {focus:true});
        history.replaceState(null, '', '#storyboard-' + tabs[next].dataset.tab);
      }
    });
  });
  $$('[data-open-board]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    activate(link.dataset.openBoard, {scroll:true});
    history.pushState(null, '', link.hash);
    $('#storyboard-' + link.dataset.openBoard).focus({preventScroll:true});
  }));
  window.addEventListener('hashchange', () => { const id = hashBoard(); if (id) activate(id, {scroll:true}); });
  window.addEventListener('popstate', () => { const id = hashBoard(); if (id) activate(id, {scroll:true}); });
  activate(hashBoard() || 'hero');
  if (hashBoard()) { const production = $('#production-storyboards'); if (production) production.open = true; requestAnimationFrame(() => $('#storyboard-' + hashBoard()).scrollIntoView({block:'start'})); }

  const videos = $$('video');
  videos.forEach(video => {
    const card = video.closest('.film-card');
    const status = card.querySelector('.film-status');
    const retry = card.querySelector('.retry-film');
    const download = card.querySelector('.download-film');
    const originalPoster = video.getAttribute('poster');
    const poster = new Image();
    poster.onerror = () => { video.poster = video.dataset.fallbackPoster; };
    poster.src = originalPoster;
    const failed = () => {
      status.textContent = 'Film se nepodařilo načíst. Zkuste to znovu nebo si jej stáhněte.';
      status.classList.add('is-pending');
      retry.hidden = false;
      download.removeAttribute('aria-disabled');
    };
    video.addEventListener('error', failed);
    video.querySelector('source').addEventListener('error', failed);
    video.addEventListener('loadedmetadata', () => {
      status.textContent = Math.round(video.duration) + ' s · český hlas · 9:16';
      status.classList.remove('is-pending');
      retry.hidden = true;
      download.removeAttribute('aria-disabled');
    });
    video.addEventListener('play', () => videos.forEach(other => { if (other !== video) other.pause(); }));
    retry.addEventListener('click', () => {
      status.textContent = 'Načítání exportu…';
      retry.disabled = true;
      video.load();
      retry.disabled = false;
      const testPoster = new Image();
      testPoster.onload = () => { video.poster = originalPoster; };
      testPoster.src = originalPoster;
    });
    download.addEventListener('click', event => {
      if (download.getAttribute('aria-disabled') === 'true') {
        event.preventDefault();
        retry.focus();
      }
    });
  });

  const dialog = $('#frame-dialog');
  let returnFocus;
  $$('[data-image]').forEach(button => button.addEventListener('click', () => {
    returnFocus = button;
    $('#frame-title').textContent = button.dataset.imageTitle;
    $('#frame-label').textContent = button.dataset.imageLabel;
    $('#frame-image').src = button.dataset.image;
    $('#frame-image').alt = button.dataset.imageTitle + ' — ' + button.dataset.imageLabel;
    $('#frame-download').href = button.dataset.image;
    $('#frame-download').download = button.dataset.image.split('/').pop();
    dialog.showModal();
    dialog.scrollTop = 0;
    $('#frame-close').focus({preventScroll:true});
  }));
  $('#frame-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true}); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  $$('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    const text = document.getElementById(button.dataset.copy);
    const status = button.parentElement.querySelector('.copy-status');
    try {
      if (!navigator.clipboard?.writeText) throw Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text.textContent);
      status.textContent = 'Text zkopírován.';
    } catch (_) {
      const selection = getSelection(), range = document.createRange();
      range.selectNodeContents(text);
      selection.removeAllRanges(); selection.addRange(range);
      status.textContent = 'Text je označený. Zkopírujte jej pomocí Ctrl+C nebo nabídky prohlížeče.';
    }
  }));
})();
