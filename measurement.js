/* Consent and the project events consumed by Google Tag Manager. */
(() => {
  'use strict';
  const containerId = 'GTM-P6R9WBHB';
  const storeKey = 'alexandra-cookie-choice-v1';
  const path = location.pathname.replace(/\/+$/, '/index.html').split('/').pop();
  const pages = ['index','building','creative','interiors','ochrana-osobnich-udaju','reels','storyboard','tour'];
  const page = pages.includes(path.replace(/\.html$/, '')) ? path.replace(/\.html$/, '') : 'index';
  const cleanLocation = new URL(page === 'index' ? './' : page+'.html', document.baseURI).href.split(/[?#]/)[0];
  const denied = {analytics:false,marketing:false};
  let choice = null, containerLoaded = false;
  const seen = {analytics:false,marketing:false};
  const layer = window.dataLayer = window.dataLayer || [];
  function gtag() { layer.push(arguments); }
  const destinations = {ga4:null,metaPixel:null};
  let googleStarted = false, metaStarted = false;
  const eventNames = {
    page_view:['page_view','PageView'], click:['content_click','ContentClick'], scroll_depth:['scroll_depth','ScrollDepth'],
    phone_click:['click_to_call','Contact'], email_draft:['email_draft_open','EmailDraftOpened'], generate_lead:['generate_lead','Lead']
  };
  function loadScript(src) {
    const script = document.createElement('script');
    script.async = true; script.referrerPolicy = 'origin'; script.src = src;
    document.head.append(script);
  }
  function deliver(key, record) {
    const names = eventNames[record.event.slice(3)];
    if (!names || !destinations[key]) return;
    const params = {page_name:record.page_name};
    for (const field of ['section_name','action_name','apartment_id','percent_scrolled']) {
      if (record[field] != null) params[field] = record[field];
    }
    if (key === 'ga4') {
      if (!choice?.analytics || !record.analytics_allowed) return;
      if (!googleStarted) {
        googleStarted = true;
        gtag('js',new Date());
        gtag('config',destinations.ga4,{send_page_view:false,allow_google_signals:false,
          allow_ad_personalization_signals:false,page_location:cleanLocation,page_referrer:''});
        loadScript('https://www.googletagmanager.com/gtag/js?id='+destinations.ga4);
      }
      gtag('event',names[0],{...params,send_to:destinations.ga4,page_location:cleanLocation,page_referrer:''});
    } else {
      if (!choice?.marketing || !record.marketing_allowed) return;
      if (!metaStarted) {
        metaStarted = true;
        if (!window.fbq) {
          const fbq = function () { if (fbq.callMethod) fbq.callMethod.apply(fbq,arguments); else fbq.queue.push(arguments); };
          fbq.queue = []; fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0';
          window.fbq = fbq; window._fbq ||= fbq;
          loadScript('https://connect.facebook.net/en_US/fbevents.js');
        }
        window.fbq('consent','grant');
        window.fbq('set','autoConfig',false,destinations.metaPixel);
        window.fbq('init',destinations.metaPixel);
      }
      const standard = ['PageView','Contact','Lead'].includes(names[1]);
      window.fbq(standard ? 'trackSingle' : 'trackSingleCustom',destinations.metaPixel,names[1],params);
    }
  }
  // The GTM owner can supply the two public destination IDs in one initialization tag.
  // A late-loading container replays only the events captured with the matching consent.
  function configure(ids = {}) {
    for (const [key, valid] of [['ga4',/^G-[A-Z0-9]{6,18}$/],['metaPixel',/^[1-9]\d{9,19}$/]]) {
      const id = ids?.[key];
      if (destinations[key] || typeof id !== 'string' || !valid.test(id)) continue;
      destinations[key] = id;
      for (const record of layer.slice()) {
        if (typeof record?.event === 'string' && record.event.startsWith('ra_')) deliver(key,record);
      }
    }
  }
  window.AlexandraMeasurement = Object.freeze({configure});
  function consentValues(value) {
    return {
      analytics_storage:value.analytics ? 'granted':'denied',
      ad_storage:value.marketing ? 'granted':'denied',
      ad_user_data:value.marketing ? 'granted':'denied',
      ad_personalization:value.marketing ? 'granted':'denied'
    };
  }
  gtag('consent','default',consentValues(denied));
  gtag('set','ads_data_redaction',true);
  function loadChoice() {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey));
      if (saved && typeof saved.analytics === 'boolean' && typeof saved.marketing === 'boolean' &&
          Number.isFinite(saved.expires) && saved.expires > Date.now()) return saved;
    } catch { /* Visitors can still choose for the current page. */ }
    return null;
  }
  function publish(name, values = {}, audience = choice) {
    if (!audience || (!audience.analytics && !audience.marketing)) return;
    const record = {event:'ra_'+name, page_name:page, page_location:cleanLocation,
      analytics_allowed:audience.analytics, marketing_allowed:audience.marketing,
      action_name:null, section_name:null, apartment_id:null, percent_scrolled:null, ...values};
    // Send to already configured destinations before GTM processes the new event.
    // A configuration tag fired by this dataLayer.push will replay it exactly once.
    deliver('ga4',record); deliver('metaPixel',record);
    layer.push(record);
  }
  function start(value) {
    if (!value.analytics && !value.marketing) return;
    if (!containerLoaded) {
      containerLoaded = true;
      layer.push({'gtm.start':Date.now(),event:'gtm.js'});
      loadScript('https://www.googletagmanager.com/gtm.js?id='+containerId);
    }
    const newAudience = {analytics:value.analytics && !seen.analytics,marketing:value.marketing && !seen.marketing};
    publish('page_view',{},newAudience);
    seen.analytics ||= value.analytics;
    seen.marketing ||= value.marketing;
  }
  function clearOptionalCookies(analytics,marketing) {
    const names = document.cookie.split(';').map(pair => pair.trim().split('=')[0]).filter(name =>
      analytics && /^_ga($|_)|^_gid$|^_gat($|_)/.test(name) ||
      marketing && /^_fb[pc]$|^_gcl_/.test(name));
    const domains = ['',location.hostname];
    if (location.hostname.endsWith('.rezidencealexandra.cz')) domains.push('rezidencealexandra.cz');
    const paths = location.hostname.endsWith('.github.io') ? ['/rezidence-alexandra','/rezidence-alexandra/'] : ['/'];
    for (const name of names) for (const domain of domains) for (const prefix of paths) {
      document.cookie = name+'=; Max-Age=0; Path='+prefix+(domain ? '; Domain='+domain : '');
    }
  }
  const banner = document.createElement('section');
  banner.className = 'cookie-panel';
  banner.hidden = true;
  banner.setAttribute('aria-labelledby','ra-cookie-title');
  banner.innerHTML = `<h2 id="ra-cookie-title">Vaše nastavení cookies</h2>
    <p>Nezbytné funkce webu jsou vždy aktivní. Vyberte, zda nám povolíte měřit návštěvnost a zájem o byty pro marketing. Svou volbu můžete kdykoli změnit. <a href="ochrana-osobnich-udaju.html#cookies">Více o cookies</a></p>
    <div class="cookie-actions"><button type="button" data-consent-action="all">Přijmout vše</button><button type="button" data-consent-action="none">Odmítnout vše</button><button type="button" data-cookie-settings>Vlastní nastavení</button></div>`;
  const dialog = document.createElement('dialog');
  dialog.className = 'cookie-dialog';
  dialog.setAttribute('aria-labelledby','ra-settings-title');
  dialog.innerHTML = `<h2 id="ra-settings-title">Nastavení cookies</h2>
    <p>Nezbytné funkce zajišťují například uložení vašeho výběru bytů a této volby.</p>
    <label class="cookie-option"><input type="checkbox" name="analytics"><span><strong>Analytické</strong><small>Návštěvnost stránek, kliknutí a posun na stránce.</small></span></label>
    <label class="cookie-option"><input type="checkbox" name="marketing"><span><strong>Marketingové</strong><small>Vyhodnocení zájmu o projekt, například kliknutí na telefon a přijatých poptávek.</small></span></label>
    <div class="cookie-actions"><button type="button" data-consent-action="save">Uložit volbu</button><button type="button" data-consent-action="cancel">Zavřít</button></div>`;
  document.body.append(banner, dialog);
  let opener = null;
  function showSettings(button) {
    opener = button;
    dialog.querySelector('[name="analytics"]').checked = !!choice?.analytics;
    dialog.querySelector('[name="marketing"]').checked = !!choice?.marketing;
    dialog.showModal();
  }
  dialog.addEventListener('close', () => {
    if (opener?.isConnected && !opener.closest('[hidden]')) opener.focus({preventScroll:true});
  });
  function apply(value, persist) {
    const previous = choice;
    choice = value;
    const updated = value || denied;
    if (persist) {
      try { localStorage.setItem(storeKey,JSON.stringify(value)); } catch { /* Choice applies in memory. */ }
    }
    const lostAnalytics = !!previous?.analytics && !updated.analytics;
    const lostMarketing = !!previous?.marketing && !updated.marketing;
    if (lostMarketing && metaStarted) window.fbq('consent','revoke');
    if (lostAnalytics || lostMarketing) clearOptionalCookies(lostAnalytics,lostMarketing);
    gtag('consent','update',consentValues(updated));
    banner.hidden = !!value;
    if (dialog.open) dialog.close();
    if (containerLoaded && (lostAnalytics || lostMarketing)) {
      // Remove listeners installed by previously permitted third-party tags.
      location.reload();
      return;
    }
    start(updated);
  }
  document.addEventListener('click', event => {
    const settings = event.target.closest?.('[data-cookie-settings]');
    if (settings) { showSettings(settings); return; }
    const action = event.target.closest?.('[data-consent-action]')?.dataset.consentAction;
    if (!action) return;
    if (action === 'cancel') { dialog.close(); return; }
    const all = action === 'all', manual = action === 'save';
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth()+6);
    apply({analytics:all || manual && dialog.querySelector('[name="analytics"]').checked,
      marketing:all || manual && dialog.querySelector('[name="marketing"]').checked,expires:expiry.getTime()},true);
  });
  apply(loadChoice(),false);
  window.addEventListener('storage', event => {
    if (event.key === storeKey || event.key === null) apply(loadChoice(),false);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && choice?.expires <= Date.now()) apply(null,false);
  });
  function sectionName(element) {
    const section = element.closest('#byty,#vybaveni,#parkovani,#pro-kupujici,#kontakt,#lokalita,#residence-journey,#unit-dialog,#furnished-plan-dialog,#project-contact-dialog');
    return section?.id || page;
  }
  function apartmentId(element) {
    const raw = element.closest('[data-unit-id],[data-viewing-unit],[data-detail-neighbor],[data-map-unit],[data-unit],[data-furnished-unit]')?.dataset;
    const val = raw?.unitId || raw?.viewingUnit || raw?.detailNeighbor || raw?.mapUnit || raw?.unit || raw?.furnishedUnit;
    return /^(?:[1-9]|[1-4]\d|5[01])$/.test(val || '') ? Number(val) : null;
  }
  document.addEventListener('click', event => {
    if (!event.isTrusted || !choice || (!choice.analytics && !choice.marketing)) return;
    const el = event.target.closest?.('a[href],button,summary,[role="button"]');
    if (!el || el.closest('.cookie-panel,.cookie-dialog,[data-cookie-settings],#inquiry-form')) return;
    const base = {section_name:sectionName(el),apartment_id:apartmentId(el)};
    if (el.matches('a[href^="tel:"]')) { publish('phone_click',base); return; }
    const kind = el.closest('.bytex-links') ? 'catalog_pdf' : el.matches('[data-detail-neighbor],[data-map-unit],[data-unit]') ? 'apartment' :
      el.matches('[data-parking-id]') ? 'parking_space' : el.matches('[data-map-floor]') ? 'floor' :
      el.matches('.viewing-cta,#inquire-unit') ? 'viewing' : el.matches('a[href$=".pdf"]') ? 'document_pdf' :
      el.tagName === 'SUMMARY' ? 'expand' : el.closest('nav') ? 'navigation' : el.matches('a') ? 'link' : 'control';
    publish('click',{...base,action_name:kind});
  },true);
  const levels = [25,50,75,90];
  let lastPercent = 0, scrollFrame = 0, userScrolled = false;
  function enableScroll() {
    if (!choice || (!choice.analytics && !choice.marketing)) return;
    if (!userScrolled) {
      lastPercent = Math.max(lastPercent, window.scrollY / Math.max(1,document.documentElement.scrollHeight-innerHeight)*100);
      userScrolled = true;
    }
  }
  window.addEventListener('wheel',enableScroll,{passive:true});
  window.addEventListener('touchmove',enableScroll,{passive:true});
  window.addEventListener('pointerdown', e => {
    if (e.target === document.documentElement && e.clientX >= document.documentElement.clientWidth-16) enableScroll();
  },{passive:true});
  document.addEventListener('keydown', e => { if (['PageDown','PageUp','ArrowDown','ArrowUp','Home','End',' '].includes(e.key)) enableScroll(); });
  window.addEventListener('scroll', () => {
    if (!userScrolled || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const total = document.documentElement.scrollHeight - innerHeight;
      if (total <= 0) return;
      const percent = window.scrollY / total * 100;
      for (const level of levels) if (lastPercent < level && percent >= level) publish('scroll_depth',{percent_scrolled:level});
      lastPercent = Math.max(lastPercent,percent);
    });
  }, {passive:true});
  // The form dispatches these only after validation / positive confirmation from its receiver.
  document.addEventListener('alexandra:email-prepared', () => publish('email_draft',{section_name:'kontakt'}));
  document.addEventListener('alexandra:inquiry-accepted', () => publish('generate_lead',{section_name:'kontakt'}));
})();
