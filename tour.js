(() => {
 'use strict';
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const stage=$('#stage'), canvas=$('#panorama'), TAU=Math.PI*2;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const safePath=p=>typeof p==='string' && /^assets\/walkthrough-v3\/[a-zA-Z0-9_./-]+\.(jpg|webp|png)$/.test(p) && !p.includes('..');
 const query=new URLSearchParams(location.search), seen=new Map(), cache=new Map();
 let manifest, apartment, current, requested, requestSerial=0, view={yaw:0,pitch:0,fov:1.15}, hotspots=[], ready=false, gl, program, texture, uniforms, renderPending=false;
 let controlsEnabled=true;
 function effectiveFov(){const aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);return 2*Math.atan(Math.tan(view.fov/2)*Math.min(1,(16/9)/aspect));}
 function initGL(){
  gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true}); if(!gl) return false;
  const vertex='attribute vec2 a;varying vec2 uv;void main(){uv=a;gl_Position=vec4(a,0.,1.);}';
  const fragment=`precision highp float;varying vec2 uv;uniform sampler2D tex;uniform float yaw,pitch,fov,aspect;
   void main(){float sy=sin(yaw),cy=cos(yaw),sp=sin(pitch),cp=cos(pitch);vec3 r=vec3(cy,-sy,0.);vec3 f=vec3(sy*cp,cy*cp,sp);vec3 u=vec3(-sy*sp,-cy*sp,cp);vec3 d=normalize(r*uv.x*aspect*tan(fov*.5)+u*uv.y*tan(fov*.5)+f);vec2 t=vec2(fract(atan(d.x,d.y)/6.283185307+.5),.5-asin(clamp(d.z,-1.,1.))/3.141592654);gl_FragColor=texture2D(tex,t);}`;
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Shader unavailable');return s;};
  program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Renderer unavailable');gl.useProgram(program);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  uniforms=Object.fromEntries(['yaw','pitch','fov','aspect'].map(k=>[k,gl.getUniformLocation(program,k)]));return true;
 }
 function draw(){
  renderPending=false;if(!ready||!gl||!canvas.clientWidth)return;
  const ratio=Math.min(devicePixelRatio||1,2),w=Math.round(canvas.clientWidth*ratio),h=Math.round(canvas.clientHeight*ratio);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
  gl.uniform1f(uniforms.yaw,view.yaw);gl.uniform1f(uniforms.pitch,view.pitch);gl.uniform1f(uniforms.fov,effectiveFov());gl.uniform1f(uniforms.aspect,w/h);gl.drawArrays(gl.TRIANGLES,0,6);projectHotspots();
 }
 function schedule(){if(!renderPending){renderPending=true;requestAnimationFrame(draw);}}
 function move(dx,dy,dz=0){if(!controlsEnabled)return;view.yaw=(view.yaw+dx)%TAU;view.pitch=Math.max(-1.35,Math.min(1.35,view.pitch+dy));view.fov=Math.max(.5,Math.min(1.5,view.fov+dz));schedule();}
 function upload(im){
  let source=im;const max=gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if(im.width>max||im.height>max){const c=document.createElement('canvas');const scale=Math.min(max/im.width,max/im.height);c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);source=c;}
  gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,source);ready=true;schedule();
 }
 function image(url){
  if(cache.has(url))return cache.get(url);
  const promise=new Promise((resolve,reject)=>{const im=new Image();im.decoding='async';im.onload=()=>resolve(im);im.onerror=()=>{cache.delete(url);reject(Error('Image unavailable'));};im.src=url;});cache.set(url,promise);
  // Keep only a few full panoramas in memory on phones.
  const cacheLimit=matchMedia('(max-width:768px)').matches?3:6;if(cache.size>cacheLimit)cache.delete(cache.keys().next().value);return promise;
 }
 function defaultView(node){const t=node.target||[node.position[0],node.position[1]+1,node.position[2]],p=node.position;const dx=t[0]-p[0],dy=t[1]-p[1],dz=t[2]-p[2];return {yaw:Math.atan2(dx,dy),pitch:Math.atan2(dz,Math.hypot(dx,dy)),fov:1.15};}
 function updateURL(mode='replace'){if(mode==='none')return;const url=new URL(location.href);url.searchParams.set('byt',apartment.id);url.searchParams.set('mistnost',current.id);if(url.href!==location.href)history[mode==='push'?'pushState':'replaceState'](null,'',url);}
 function roomCategory(id){return id.includes('kitchen')?'Kuchyně':id.includes('bedroom')?'Ložnice':id.includes('bath')?'Koupelna':id.includes('living')?'Obývací pokoj':null;}
 function syncUI(historyMode){
  const visited=seen.get(apartment.id)||new Set();visited.add(current.id);seen.set(apartment.id,visited);
  $('#room-meta').textContent=`${apartment.label} / TYPOVÁ 360° PROHLÍDKA`;
  $('#room-title').textContent=current.label;
  canvas.setAttribute('aria-label',`${current.label}, ${apartment.label}, 360° interiér. Šipky mění směr, plus a minus přibližují. Místnosti vyberete tlačítky pod prohlídkou.`);
  $('#fallback-image').alt=`Náhled místnosti ${current.label}, ${apartment.label}`;
  $('#tour-summary').textContent=`${apartment.nodes.length} propojených stanovišť`;
  $('#source-plan').href=`plans/unit-${apartment.sourceUnit}.pdf`;
  $('#apartment-note').textContent='';
  $('#room-description').textContent='';
  const gallery=new URL('interiors.html',location.href);gallery.searchParams.set('typology',apartment.label);const category=roomCategory(current.id);if(category)gallery.searchParams.set('room',category);$('#room-gallery').href=gallery.pathname+gallery.search;
  $$('[data-apartment]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.apartment===apartment.id)));
  $('#room-list').innerHTML=apartment.nodes.map((n,i)=>`<button type="button" class="room-card ${visited.has(n.id)?'visited':''}" data-node="${escape(n.id)}" aria-current="${n.id===current.id}" aria-label="Přejít do místnosti: ${escape(n.label)}"><img src="${escape(n.thumb)}" alt="" loading="lazy" width="480" height="290"><small aria-hidden="true">${visited.has(n.id)?'✓':String(i+1).padStart(2,'0')}</small><span>${escape(n.label)}</span></button>`).join('');
  $('#visited-count').textContent=`Prohlédnuto ${visited.size} z ${apartment.nodes.length} stanovišť`;
  $('#adjacent-rooms').innerHTML=(current.links||[]).map(link=>{const n=apartment.nodes.find(n=>n.id===link.to);return n?`<button type="button" data-adjacent="${escape(n.id)}">${escape(n.label)} <span aria-hidden="true">${window.AlexandraArrows.svg('arrow-right')}</span></button>`:'';}).join('');
  renderMap();buildHotspots();updateURL(historyMode);
 }
 function renderMap(){
  const [w,d]=apartment.bounds;
  const polygons=(apartment.rooms||[]).map(r=>`<polygon class="map-room ${r.id===current.room?'active':''}" points="${r.polygon.map(p=>`${p[0]},${d-p[1]}`).join(' ')}"><title>${escape(r.label)}</title></polygon>`).join('');
  const points=apartment.nodes.map((n,i)=>`<g data-map-node="${escape(n.id)}" role="button" tabindex="0" aria-label="Přejít: ${escape(n.label)}"><circle class="map-node ${n.id===current.id?'active':''}" cx="${n.position[0]}" cy="${d-n.position[1]}" r=".19"/><text class="map-text" x="${n.position[0]}" y="${d-n.position[1]+.055}" ${n.id===current.id?'style="fill:white"':''}>${i+1}</text><title>${escape(n.label)}</title></g>`).join('');
  $('#floor-map').innerHTML=`<svg viewBox="-.25 -.25 ${w+.5} ${d+.5}" role="group" aria-label="Orientační půdorys ${escape(apartment.label)}">${polygons}<path id="map-bearing" class="map-bearing" d="M0,0 L-.4,-.75 Q0,-.95 .4,-.75Z" aria-hidden="true"/>${points}</svg>`;
  $('#map-room-list').innerHTML=apartment.nodes.map((n,i)=>`<button type="button" data-map-node="${escape(n.id)}" aria-current="${n.id===current.id}"><span aria-hidden="true">${String(i+1).padStart(2,'0')}</span>${escape(n.label)}</button>`).join('');
 }
 function buildHotspots(){
  hotspots=[];$('#hotspots').replaceChildren();
  for(const link of current.links||[]){const target=apartment.nodes.find(n=>n.id===link.to);if(!target)continue;const b=document.createElement('button');b.type='button';b.className='hotspot';b.setAttribute('aria-label',`Přejít: ${target.label}`);b.innerHTML=`<span class="dot" aria-hidden="true">${window.AlexandraArrows.svg('chevron-up')}</span><span class="hotspot-label">${escape(target.label)}</span>`;b.onclick=()=>navigate(target.id);$('#hotspots').append(b);const p=link.portal||[target.position[0],target.position[1],.45];hotspots.push({element:b,vector:p.map((v,i)=>v-current.position[i])});}
  projectHotspots();
 }
 function projectHotspots(){
  const w=canvas.clientWidth,h=canvas.clientHeight,sy=Math.sin(view.yaw),cy=Math.cos(view.yaw),sp=Math.sin(view.pitch),cp=Math.cos(view.pitch),tan=Math.tan(effectiveFov()/2);
  const topLimit=$('.stage-top').offsetHeight+40,bottomLimit=$('.stage-bottom').offsetHeight+40;
  const bearing=$('#map-bearing');if(bearing&&current)bearing.setAttribute('transform',`translate(${current.position[0]},${apartment.bounds[1]-current.position[1]}) rotate(${view.yaw*180/Math.PI})`);
  for(const {element,vector:[x,y,z]} of hotspots){const right=x*cy-y*sy,along=x*sy+y*cy,forward=along*cp+z*sp,up=-along*sp+z*cp;const px=w/2+(right/forward)/(tan*w/h)*w/2,py=h/2-(up/forward)/tan*h/2;const visible=ready&&forward>.05&&px>32&&px<w-32&&py>topLimit&&py<h-bottomLimit;element.hidden=!visible;if(visible){element.style.left=`${px}px`;element.style.top=`${py}px`;element.classList.toggle('label-left',px>w*.5);}}
 }
 function busy(value,label){stage.setAttribute('aria-busy',String(value));$('#loading').hidden=!value;if(label)$('#load-status').textContent=label;}
 async function navigate(id,selectedApartment=apartment,{historyMode='push',revealStage=false}={}){
  const node=selectedApartment.nodes.find(n=>n.id===id);if(!node)return;const initiatingElement=document.activeElement;const focusKind=initiatingElement?.closest('[data-node]')?'room':initiatingElement?.closest('[data-map-node]')?'map':initiatingElement?.closest('.hotspot,[data-adjacent]')?'canvas':null;requested={node,apartment:selectedApartment};const serial=++requestSerial;busy(true,`Vstupujeme: ${node.label}…`);$('#error-panel').hidden=true;
  try{
   const im=await image(gl?node.src:node.thumb);if(serial!==requestSerial)return;
   apartment=selectedApartment;current=node;view=defaultView(node);
   if(gl){upload(im);canvas.hidden=false;$('#fallback-image').hidden=true;}else{canvas.hidden=true;$('#fallback-image').src=node.thumb;$('#fallback-image').hidden=false;$('#navigation-hint').textContent='Váš prohlížeč zobrazuje náhledy. Místnosti můžete dál měnit v nabídce.';}
   ready=!!gl;busy(false);syncUI(historyMode);schedule();
   const actionStillFocused=document.activeElement===initiatingElement||(document.activeElement===document.body&&!initiatingElement?.isConnected);
   if(revealStage&&actionStillFocused){
    const focusTarget=canvas.hidden?$('#room-title'):canvas;
    if(canvas.hidden)focusTarget.setAttribute('tabindex','-1');
    focusTarget.focus({preventScroll:true});
    stage.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
   }else if(focusKind&&!initiatingElement.isConnected&&document.activeElement===document.body){const focusTarget=focusKind==='room'?$(`[data-node="${CSS.escape(node.id)}"]`):focusKind==='map'?$(`[data-map-node="${CSS.escape(node.id)}"]`):canvas;focusTarget?.focus({preventScroll:true});}
   for(const link of (node.links||[]).slice(0,2)){const adjacent=apartment.nodes.find(n=>n.id===link.to);if(adjacent?.preview)image(adjacent.preview).catch(()=>{});}
  }catch(error){if(serial!==requestSerial)return;console.warn('Panorama could not be displayed:',error.message);busy(false);$('#error-panel').hidden=false;$('#error-detail').textContent=`Místnost „${node.label}“ se nepodařilo načíst. Zkuste to znovu nebo vyberte jinou místnost.`;}
 }
 function chooseApartment(id,nodeId,historyMode='push'){const a=manifest.apartments.find(x=>x.id===id);if(!a)return false;for(const name of ['map','help'])togglePanel(name,false);navigate(a.nodes.some(n=>n.id===nodeId)?nodeId:a.defaultNode||a.nodes[0].id,a,{historyMode});return true;}
 const pointers=new Map();let previousPinch=0;
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});pointers.set(e.pointerId,[e.clientX,e.clientY]);previousPinch=0;});
 canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const previous=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const p=[...pointers.values()],distance=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);if(previousPinch)move(0,0,(previousPinch-distance)*.004);previousPinch=distance;}else{move(-(e.clientX-previous[0])*.0045,(e.clientY-previous[1])*.0045);}});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{pointers.delete(e.pointerId);previousPinch=0;});
 canvas.addEventListener('wheel',e=>{if(document.activeElement!==canvas)return;e.preventDefault();move(0,0,e.deltaY*.001);},{passive:false});
 canvas.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;const delta={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,.1],ArrowDown:[0,-.1],'+':[0,0,-.1],'=':[0,0,-.1],'-':[0,0,.1],Home:null}[e.key];if(e.key==='Home'){e.preventDefault();if(current){view=defaultView(current);schedule();}}else if(delta){e.preventDefault();move(...delta);}});
 $('#look-left').onclick=()=>move(-.22,0);$('#look-right').onclick=()=>move(.22,0);$('#look-up').onclick=()=>move(0,.16);$('#look-down').onclick=()=>move(0,-.16);$('#zoom-in').onclick=()=>move(0,0,-.12);$('#zoom-out').onclick=()=>move(0,0,.12);$('#view-reset').onclick=()=>{if(current){view=defaultView(current);schedule();}};
 const inertSiblings=new Map();
 function isolateStage(value){
  if(value){let branch=stage;while(branch.parentElement&&branch!==document.body){for(const sibling of branch.parentElement.children){if(sibling!==branch&&!inertSiblings.has(sibling)){inertSiblings.set(sibling,sibling.inert);sibling.inert=true;}}branch=branch.parentElement;}}
  else{for(const [element,wasInert] of inertSiblings)element.inert=wasInert;inertSiblings.clear();}
 }
 function fullscreenState(value){$('#fullscreen').setAttribute('aria-label',value?'Ukončit celou obrazovku':'Celá obrazovka');$('#fullscreen').title=value?'Ukončit celou obrazovku':'Celá obrazovka';$('#fullscreen').setAttribute('aria-pressed',String(value));}
 function expandStage(value){stage.classList.toggle('is-expanded',value);document.body.classList.toggle('tour-expanded',value);isolateStage(value);fullscreenState(value);if(value)$('#fullscreen').focus({preventScroll:true});schedule();}
 $('#fullscreen').onclick=async()=>{if(stage.classList.contains('is-expanded')){expandStage(false);return;}try{if(document.fullscreenElement)await document.exitFullscreen();else if(stage.requestFullscreen)await stage.requestFullscreen();else expandStage(true);}catch(_){expandStage(true);}};
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){const name=['map','help'].find(n=>!$(`#${n}-panel`).hidden);if(name){e.preventDefault();togglePanel(name,false);$(`#${name}-toggle`).focus();return;}if(stage.classList.contains('is-expanded')){e.preventDefault();expandStage(false);$('#fullscreen').focus();}}
  if(e.key==='Tab'&&(stage.classList.contains('is-expanded')||document.fullscreenElement===stage)){const focusable=[...stage.querySelectorAll('button:not(:disabled),summary,a[href],canvas[tabindex="0"],[role="button"][tabindex="0"]')].filter(el=>!el.closest('[hidden]')&&el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&(document.activeElement===first||!stage.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!stage.contains(document.activeElement))){e.preventDefault();first?.focus();}}
 });
 document.addEventListener('fullscreenchange',()=>{const active=document.fullscreenElement===stage;fullscreenState(active);if(!active)$('#fullscreen').focus({preventScroll:true});schedule();});
 function togglePanel(name,open){const p=$(`#${name}-panel`),b=$(`#${name}-toggle`);const value=open??p.hidden;p.hidden=!value;b.setAttribute('aria-expanded',String(value));if(value){const other=name==='map'?'help':'map';$(`#${other}-panel`).hidden=true;$(`#${other}-toggle`).setAttribute('aria-expanded','false');p.scrollTop=0;$(`#${name}-close`).focus({preventScroll:true});}}
 for(const name of ['map','help']){$(`#${name}-toggle`).onclick=()=>togglePanel(name);$(`#${name}-close`).onclick=()=>{togglePanel(name,false);$(`#${name}-toggle`).focus();};}
 document.addEventListener('pointerdown',e=>{for(const name of ['map','help']){const panel=$(`#${name}-panel`);if(!panel.hidden&&!panel.contains(e.target)&&!$(`#${name}-toggle`).contains(e.target))togglePanel(name,false);}});
 $('#room-list').onclick=e=>{const b=e.target.closest('[data-node]');if(b)navigate(b.dataset.node,apartment,{revealStage:true});};
 $('#adjacent-rooms').onclick=e=>{const b=e.target.closest('[data-adjacent]');if(b)navigate(b.dataset.adjacent,apartment,{revealStage:true});};
 function mapNavigate(e){const b=e.target.closest('[data-map-node]');if(b){navigate(b.dataset.mapNode);togglePanel('map',false);if(!canvas.hidden)canvas.focus({preventScroll:true});else $('#map-toggle').focus({preventScroll:true});}}
 $('#floor-map').onclick=mapNavigate;$('#map-room-list').onclick=mapNavigate;
 $('#floor-map').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){const b=e.target.closest('[data-map-node]');if(b){e.preventDefault();mapNavigate(e);}}};
 $$('[data-apartment]').forEach(b=>b.onclick=()=>{if(manifest)chooseApartment(b.dataset.apartment);});
 $('#retry').onclick=()=>manifest&&requested?navigate(requested.node.id,requested.apartment):load();
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;$('#navigation-hint').textContent='Obnovujeme 360° zobrazení…';});
 canvas.addEventListener('webglcontextrestored',()=>{try{initGL();if(current)navigate(current.id,apartment,{historyMode:'replace'});}catch(_){location.reload();}});
 window.addEventListener('popstate',()=>{if(!manifest)return;const state=new URLSearchParams(location.search);if(!chooseApartment(state.get('byt')||'3kk',state.get('mistnost'),'none'))chooseApartment('3kk',null,'none');});
 new ResizeObserver(schedule).observe(stage);
 async function load(){
  busy(true,'Načítání prohlídky…');$('#error-panel').hidden=true;
  try{const r=await fetch('assets/walkthrough-v3/manifest.json?v=catalog20261020',{cache:'no-cache'});if(!r.ok)throw Error('Manifest');manifest=await r.json();if(!manifest.apartments?.length)throw Error('No apartments');for(const a of manifest.apartments){if(!a.nodes?.length||a.nodes.some(n=>!safePath(n.src)||!safePath(n.thumb)))throw Error('Invalid assets');}try{initGL();}catch(_){gl=null;}controlsEnabled=!!gl;$$('.view-controls button,.direction-controls button').forEach(b=>{if(b.id!=='fullscreen')b.disabled=!gl;});if(!chooseApartment(query.get('byt')||'3kk',query.get('mistnost'),'replace'))chooseApartment('3kk',null,'replace');}
  catch(_){busy(false);$('#error-panel').hidden=false;$('#error-detail').textContent='Prohlídku se nepodařilo načíst. Zkuste stránku obnovit.';}
 }
 load();
})();
