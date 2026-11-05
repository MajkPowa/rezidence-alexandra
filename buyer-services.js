/* Client-side, illustrative annuity calculation. No bank offers or visitor data leave the page. */
(() => {
  'use strict';
  function calculate(price, equity, annualRate, years) {
    if (![price,equity,annualRate,years].every(Number.isFinite) || price <= 0 || price > 200000000 || equity < 0 || equity > price || annualRate < 0 || annualRate > 30 || !Number.isInteger(years) || years < 1 || years > 40) return null;
    const principal = price - equity, months = years * 12, rate = annualRate / 1200;
    const monthly = principal === 0 ? 0 : rate === 0 ? principal / months : principal * rate / -Math.expm1(-months * Math.log1p(rate));
    return { principal, months, monthly, total: monthly * months, interest: Math.max(0,monthly * months - principal), ownShare: equity / price * 100 };
  }
  window.AlexandraMortgage = Object.freeze({ calculate });
  const form = document.querySelector('#mortgage-calculator');
  if (!form) return;
  const units = window.ALEXANDRA_UNITS || [];
  const byId = id => units.find(u=>u.id===Number(id));
  const select = form.querySelector('#mortgage-unit');
  const fields = ['price','equity','rate','years'].map(key=>form.querySelector('#mortgage-'+key));
  const [price,equity,rate,years] = fields;
  const money = new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',maximumFractionDigits:0});
  const percent = new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:1});
  const precisePercent = new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:2});
  const output = form.querySelector('#mortgage-result');
  const error = form.querySelector('#mortgage-error');
  const title = form.querySelector('#mortgage-selection');
  const sliders = {
    equity: form.querySelector('#mortgage-equity-range'),
    years: form.querySelector('#mortgage-years-range'),
    rate: form.querySelector('#mortgage-rate-range')
  };
  const ownBar = form.querySelector('#mortgage-funding-own');
  const ownPercent = form.querySelector('#mortgage-equity-percent');
  const rateSummary = form.querySelector('#mortgage-rate-summary');
  const announcement = form.querySelector('#mortgage-announcement');
  const equityPresets = Array.from(form.querySelectorAll?.('[data-equity-preset]') || []);
  const yearsPresets = Array.from(form.querySelectorAll?.('[data-years-preset]') || []);
  const label = value => window.AlexandraFloorLabels?.label(value) || (Number(value) === 1 ? 'Přízemí' : `${Number(value)-1}. NP`);
  const validUnit = id => /^\d+$/.test(String(id)) ? byId(id) : null;
  function addOption(value,text) { const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o); }
  select.replaceChildren();
  addOption('custom','Vlastní částka');
  for (const unit of units) addOption(String(unit.id),`Byt ${String(unit.id).padStart(2,'0')} · ${unit.layout} · ${label(unit.floor)} · ${money.format(unit.price)}`);
  function selectedUnit() { return validUnit(select.value); }
  function syncLinks() {
    const unit = selectedUnit();
    document.querySelectorAll('[data-buyer-mail]').forEach(a=>{
      const subject = `Rezidence Alexandra – ${a.dataset.buyerMail}${unit ? ` – byt ${unit.id}` : ''}`;
      const address=/^[A-Z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(a.dataset.buyerRecipient || '') ? a.dataset.buyerRecipient : 'dvorakfin@seznam.cz';
      a.href='mailto:'+address+'?subject='+encodeURIComponent(subject);
    });
  }
  const readValues = () => fields.map(input=>input.value.trim()==='' ? NaN : input.valueAsNumber);
  function syncSlider(slider, value, min, max, spokenValue, valid = Number.isFinite(value)) {
    if (!slider) return;
    if (valid) {
      // The slider is a visual companion. Never round or rewrite the precise number input.
      slider.value=String(Math.max(min,Math.min(max,value)));
      slider.style?.setProperty('--range-progress',`${(Math.max(min,Math.min(max,value))-min)/(max-min)*100}%`);
    }
    slider.setAttribute?.('aria-valuetext',valid ? spokenValue : 'Upravte hodnotu posuvníkem nebo zadejte platné číslo');
  }
  function syncControls(values) {
    const [cost,own,annualRate,duration]=values;
    const validPrice=Number.isFinite(cost)&&cost>0&&cost<=200000000;
    const validOwn=Number.isFinite(own)&&own>=0&&validPrice&&own<=cost;
    const validRate=Number.isFinite(annualRate)&&annualRate>=0&&annualRate<=30;
    const validYears=Number.isInteger(duration)&&duration>=1&&duration<=40;
    const share=validOwn ? own/cost*100 : NaN;
    [validPrice,validOwn,validRate,validYears].forEach((valid,i)=>fields[i].setAttribute?.('aria-invalid',String(!valid)));
    if(sliders.equity)sliders.equity.disabled=!validPrice;
    syncSlider(sliders.equity,share,0,100,`${percent.format(share)} procent, ${money.format(own)} vlastních prostředků`,validOwn);
    syncSlider(sliders.years,duration,1,40,`${duration} ${duration===1?'rok':duration<5?'roky':'let'}`,validYears);
    syncSlider(sliders.rate,annualRate,0,30,`${precisePercent.format(annualRate)} procent ročně`,validRate);
    if(ownPercent)ownPercent.textContent=validOwn ? percent.format(share)+' %' : '—';
    if(rateSummary)rateSummary.textContent=validRate ? precisePercent.format(annualRate)+' % p. a.' : 'Upravit sazbu';
    equityPresets.forEach(button=>{
      button.disabled=!validPrice;
      button.setAttribute('aria-pressed',String(validOwn&&Math.abs(share-Number(button.dataset.equityPreset))<.00001));
    });
    yearsPresets.forEach(button=>button.setAttribute('aria-pressed',String(validYears&&duration===Number(button.dataset.yearsPreset))));
    if(ownBar?.style)ownBar.style.transform=`scaleX(${validOwn ? share/100 : 0})`;
  }
  function announceResult() {
    if(!announcement)return;
    const result=calculate(...readValues());
    announcement.textContent=result ? `Orientační měsíční splátka ${money.format(result.monthly)}. Výše úvěru ${money.format(result.principal)}.` : error.textContent;
  }
  function render() {
    const unit=selectedUnit();
    title.textContent=unit ? `Byt ${String(unit.id).padStart(2,'0')} · ${unit.layout} · ${label(unit.floor)}` : 'Vlastní model financování';
    syncLinks();
    const values=readValues();
    syncControls(values);
    const result=calculate(...values);
    error.hidden=!!result; output.hidden=!result;
    if (!result) { error.textContent='Zkontrolujte cenu, vlastní prostředky, sazbu a splatnost. Vlastní prostředky mohou být nejvýše ve výši ceny bytu.'; return; }
    for(const [key,value] of Object.entries({...result,equity:values[1]})) {
      const selector='[data-mortgage="'+key+'"]';
      const nodes=form.querySelectorAll ? Array.from(form.querySelectorAll(selector)) : [form.querySelector(selector)].filter(Boolean);
      nodes.forEach(node=>{node.textContent=key==='ownShare'?percent.format(value)+' %':key==='months'?String(value):money.format(value);});
    }
  }
  function choose(id,writeQuery=false) {
    const unit=validUnit(id);
    if (!unit) {
      select.value='custom'; price.readOnly=false;
      if(writeQuery){const url=new URL(location.href);url.searchParams.set('financovani-byt','custom');history.replaceState(null,'',url);}
      render(); return;
    }
    select.value=String(unit.id); price.value=String(unit.price);price.readOnly=true; equity.value=String(Math.round(unit.price*20)/100);
    if(writeQuery){const url=new URL(location.href);url.searchParams.set('financovani-byt',String(unit.id));history.replaceState(null,'',url);}
    render();
  }
  select.addEventListener('change',()=>{choose(select.value,true);announceResult();});
  fields.forEach(input=>{
    input.addEventListener('input',render);
    input.addEventListener('change',announceResult);
  });
  function setOwnShare(share) {
    const cost=readValues()[0];
    if(!Number.isFinite(cost)||cost<=0||cost>200000000||!Number.isFinite(share)||share<0||share>100)return;
    equity.value=String(Math.round(cost*share)/100);
    render();
  }
  sliders.equity?.addEventListener('input',()=>setOwnShare(sliders.equity.valueAsNumber));
  sliders.years?.addEventListener('input',()=>{years.value=sliders.years.value;render();});
  sliders.rate?.addEventListener('input',()=>{rate.value=sliders.rate.value;render();});
  Object.values(sliders).forEach(slider=>slider?.addEventListener('change',announceResult));
  equityPresets.forEach(button=>button.addEventListener('click',()=>{setOwnShare(Number(button.dataset.equityPreset));announceResult();}));
  yearsPresets.forEach(button=>button.addEventListener('click',()=>{
    const duration=Number(button.dataset.yearsPreset);
    if(!Number.isInteger(duration)||duration<1||duration>40)return;
    years.value=String(duration);render();announceResult();
  }));
  form.addEventListener('submit',event=>{event.preventDefault();render();announceResult();});
  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-mortgage-unit]');
    if(!link)return;
    const unit=validUnit(link.dataset.mortgageUnit);if(!unit)return;
    choose(unit.id,true);
    announceResult();
    document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  });
  const query=new URLSearchParams(location.search);
  const initial=query.get('financovani-byt') || query.get('byt');
  if(validUnit(initial))choose(initial);else{select.value='custom';render();}
  // Empty confirmed slots remain truthful contact requests until the client supplies details.
  if (typeof fetch === 'function') fetch('data/project-contacts.json?v=20261105',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(data=>{
    if(!data || typeof data!=='object')return;
    const validContact=c=>c&&typeof c.name==='string'&&c.name.trim()&&typeof c.email==='string'&&/^[A-Z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(c.email);
    function contactCard(target,contact,subject) {
      const box=document.querySelector(target);if(!box)return;
      const h=document.createElement('h4');h.textContent=contact.name;
      const a=document.createElement('a');a.className='text-link';a.dataset.buyerMail=subject;a.dataset.buyerRecipient=contact.email;a.textContent=contact.email;
      box.replaceChildren(h,a);
    }
    if(validContact(data.mortgageSpecialist))contactCard('#mortgage-specialist-contact',data.mortgageSpecialist,'hypoteční konzultace');
    const lawyers=Array.isArray(data.legalAdvisors)?data.legalAdvisors.filter(validContact):[];
    const lawBox=document.querySelector('#legal-advisor-contacts');
    if(lawBox&&lawyers.length){lawBox.replaceChildren();lawyers.forEach(c=>{const row=document.createElement('div');const h=document.createElement('h4');h.textContent=c.name;const a=document.createElement('a');a.className='text-link';a.dataset.buyerMail='právní zajištění koupě';a.dataset.buyerRecipient=c.email;a.textContent=c.email;row.append(h,a);lawBox.append(row);});}
    const docs=Array.isArray(data.contractDocuments)?data.contractDocuments.filter(d=>d&&typeof d.title==='string'&&typeof d.href==='string'&&/^plans\/[a-z0-9-]+\.pdf(?:#page=\d+)?$/.test(d.href)):[];
    const docBox=document.querySelector('#contract-document-links');
    if(docBox&&docs.length){docBox.replaceChildren();docs.forEach(d=>{const a=document.createElement('a');a.className='text-link';a.href=d.href;a.textContent=d.title+' (PDF)';a.target='_blank';a.rel='noopener';docBox.append(a);});}
    syncLinks();
  }).catch(()=>{});
})();
