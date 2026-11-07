/* Persistent developer identity and a native, user-initiated contact dialog. */
(() => {
  'use strict';
  if (document.querySelector('#project-contact-widget')) return;
  const arrow = window.AlexandraIcons?.svg('arrow-up-right') || '<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 19 19 5M5 5h14v14"/></svg>';
  const widget = document.createElement('aside');
  widget.id = 'project-contact-widget';
  widget.className = 'project-contact-widget';
  widget.setAttribute('aria-label', 'Dům realit — kontakt k Rezidenci Alexandra');
  widget.innerHTML = `<button type="button" class="project-contact-trigger viewing-cta" aria-haspopup="dialog" aria-controls="project-contact-dialog" aria-expanded="false"><img src="assets/dumrealit/dumrealit-logo.svg" alt="Dům realit" width="60" height="53"/><span class="project-contact-trigger-label"><span class="project-contact-brand-name">Dům realit</span><strong>Domluvit prohlídku</strong></span>${arrow}</button>`;
  const trigger = widget.querySelector('button');
  const dialog = document.createElement('dialog');
  dialog.id = 'project-contact-dialog';
  dialog.className = 'project-contact-dialog';
  dialog.setAttribute('aria-labelledby', 'project-contact-title');
  const contactHref = document.querySelector('#kontakt') ? '#kontakt' : 'index.html#kontakt';
  const mail = 'mailto:dvorak@dumrealit.cz?subject=' + encodeURIComponent('Prohlídka bytu — Rezidence Alexandra');
  dialog.innerHTML = `<button type="button" class="project-contact-close" aria-label="Zavřít kontakt" autofocus><svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 6 12 12M18 6 6 18"/></svg></button><img class="project-contact-logo" src="assets/dumrealit/dumrealit-logo.svg" alt="Dům realit" width="112" height="98"/><p class="project-contact-project">Rezidence Alexandra</p><h2 id="project-contact-title">Domluvit prohlídku</h2><p class="project-contact-intro">Zavolejte nebo napište a domluvte si termín prohlídky.</p><div class="project-contact-person"><strong>Pavel Dvořák</strong><span>Informace k bytům a prohlídky</span><a href="tel:+420734358581">734 358 581</a><a href="mailto:dvorak@dumrealit.cz">dvorak@dumrealit.cz</a></div><a class="button viewing-cta project-contact-mail" href="${mail}">Napsat ohledně prohlídky ${arrow}</a><a class="project-contact-details" href="${contactHref}">Kontaktní formulář ${arrow}</a>`;
  document.body.append(widget, dialog);
  document.body.classList.add('has-project-contact');
  let frame = 0;
  function externalBlock() {
    if (document.querySelector('dialog[open]:not(#project-contact-dialog)')) return 'other-dialog';
    if (document.body.classList.contains('menu-is-open')) return 'menu';
    if (document.fullscreenElement || document.body.classList.contains('tour-expanded')) return 'full-screen';
    const toast = document.querySelector('#toast');
    return toast && !toast.hidden ? 'notification' : '';
  }
  function coversControl() {
    if (!document.elementsFromPoint) return false;
    const css = getComputedStyle(widget);
    const width = Number.parseFloat(css.width), height = Number.parseFloat(css.height);
    const right = Number.parseFloat(css.right), bottom = Number.parseFloat(css.bottom);
    if (![width,height,right,bottom].every(Number.isFinite)) return false;
    const left = document.documentElement.clientWidth - right - width;
    const top = innerHeight - bottom - height;
    for (const x of [left+2,left+width/2,left+width-2]) {
      for (const y of [top+2,top+height/2,top+height-2]) {
        for (const element of document.elementsFromPoint(x,y)) {
          const control = element.closest('a[href],button,input,select,textarea,summary,[role="button"],#mortgage-calculator');
          if (!control || widget.contains(control) || dialog.contains(control) || control.closest('[hidden],[inert],[aria-hidden="true"]')) continue;
          return true;
        }
      }
    }
    return false;
  }
  function sync() {
    frame = 0;
    const blocked = externalBlock();
    if (blocked && dialog.open) dialog.close();
    const reason = blocked || (dialog.open ? 'contact-dialog' : coversControl() ? 'controls' : '');
    if (widget.hidden !== Boolean(reason)) widget.hidden = Boolean(reason);
    if (widget.dataset.hiddenReason !== reason) widget.dataset.hiddenReason = reason;
    trigger.setAttribute('aria-expanded', String(dialog.open));
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(sync); }
  function close() { if (dialog.open) dialog.close(); }
  trigger.addEventListener('click', () => {
    if (externalBlock()) return;
    if (typeof dialog.showModal !== 'function') { location.href = contactHref; return; }
    if (!dialog.open) dialog.showModal();
    sync();
    dialog.querySelector('.project-contact-close').focus({preventScroll:true});
  });
  dialog.querySelector('.project-contact-close').addEventListener('click', close);
  dialog.querySelector('.project-contact-details').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => {
    sync();
    if (!externalBlock() && !widget.hidden) trigger.focus({preventScroll:true});
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  document.addEventListener('keydown', event => {
    if (!dialog.open) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== 'Tab') return;
    event.stopPropagation();
    const controls = [...dialog.querySelectorAll('button:not(:disabled),a[href]')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  }, true);
  new MutationObserver(schedule).observe(document.body, {subtree:true,attributes:true,attributeFilter:['open','class','hidden','inert']});
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', schedule);
  document.addEventListener('fullscreenchange', schedule);
  function applyDeveloperContact(value) {
    const developer = value?.developer;
    if (!developer || typeof developer.portrait !== 'string' || !/^assets\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|jpe?g|png)$/i.test(developer.portrait)) return;
    const portrait = document.createElement('img');
    portrait.className = 'project-contact-portrait';
    portrait.alt = typeof developer.portraitAlt === 'string' && developer.portraitAlt.trim() ? developer.portraitAlt.trim().slice(0,160) : 'Pan Dvořák';
    portrait.width = 96;
    portrait.height = 112;
    portrait.decoding = 'async';
    portrait.addEventListener('load', () => {
      if (!portrait.naturalWidth || widget.classList.contains('has-developer-portrait')) return;
      const logo = dialog.querySelector('.project-contact-logo');
      const identity = document.createElement('div');
      identity.className = 'project-contact-identity';
      logo.replaceWith(identity);
      identity.append(logo,portrait);
      const widgetLogo = trigger.querySelector('img');
      const media = document.createElement('span');
      media.className = 'project-contact-media';
      const compact = portrait.cloneNode();
      compact.className = 'project-contact-portrait-compact';
      compact.width = 34;
      compact.height = 52;
      widgetLogo.replaceWith(media);
      widgetLogo.src = 'assets/dumrealit/dumrealit-mark.svg';
      widgetLogo.classList.add('project-contact-brand-badge');
      media.append(compact,widgetLogo);
      widget.classList.add('has-developer-portrait');
      schedule();
    }, {once:true});
    // Missing images leave the existing logo-only contact completely intact.
    portrait.src = developer.portrait;
  }
  if (typeof fetch === 'function') {
    fetch('data/project-contacts.json?v=20261106', {cache:'no-cache'})
      .then(response => response.ok ? response.json() : null)
      .then(applyDeveloperContact)
      .catch(() => { /* The verified logo and current sales contact remain usable. */ });
  }
  sync();
})();
