/* Quaderno — Abbinamenti (concept). Ingredient "drops" as SDF metaball watercolor (WebGL1),
   gentle physics, tap to pop + reveal flavour pairings from data/pairings.json:
   threads = shared aroma compounds (Ahn et al. 2011, Sci. Rep. 1:196, CC BY-NC-SA 3.0),
   plus the notebook recipes where both ingredients appear. No build step. */
(function(){
'use strict';
var doc=document, html=doc.documentElement, body=doc.body;
var RM=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var DPR=Math.min(window.devicePixelRatio||1,1.5);
var NMAX=56;
var LANG_KEY='recipe-lang';
var $=function(id){return doc.getElementById(id);};
var stage=$('stage'), inkC=$('ink'), fxC=$('fx'), labelsEl=$('labels'), sheet=$('sheet'), sheetIn=$('sheetIn');
var chipsEl=$('chips'), hintEl=$('hint'), resetBtn=$('reset');

/* ---------- i18n ---------- */
var T={
 it:{title:'Abbinamenti',kicker:'Quaderno · concept',hint:'Cerca, o tocca uno degli ingredienti principali',how:'Come funziona',
   search:'Cerca un ingrediente…',searchLbl:'Cerca un ingrediente',noRes:'Nessun ingrediente trovato',noAroma:'senza dati aromatici',hubs:'Ingredienti principali',hubOf:'ingrediente principale',
   back:'Torna al quaderno',reset:'Ricomincia',close:'Chiudi',pairs:'Condivide aromi con…',recipesWith:'Ricette con ',
   nComp:function(n){return n+(n===1?' composto':' composti');},shared:'Composti aromatici in comune',togetherNb:'Insieme nel quaderno',
   never:'mai insieme nelle ricette del quaderno',moreC:function(n){return ' e altri '+n;},
   known:function(n){return n+(n===1?' composto aromatico noto':' composti aromatici noti');},entity:'voce del dataset',approx:'voce più vicina',
   noData:'Questo ingrediente non è nel dataset dei composti aromatici: nessun filo, per non inventare dati.',
   src:'Dati aromatici',unm:'Senza dati aromatici: ',
   inN:function(n){return 'in '+n+(n===1?' ricetta':' ricette')+' del quaderno';},nRec:function(n){return n+(n===1?' ricetta':' ricette');},
   staples:'Anche, onnipresenti: ',more:function(n){return 'Altri '+n+' abbinamenti aromatici';},none:'Nessun composto aromatico in comune con gli altri ingredienti del quaderno.',
   howTitle:'Abbinamenti dalla scienza degli aromi',
   stats:function(r,i,t,m){return r+' ricette · '+i+' ingredienti ('+m+' con dati aromatici) · '+t+' tipi. Un concept: la chimica suggerisce, il cuoco decide.';},
   types:'Tipi di ingrediente',ings:'Ingredienti',together:'insieme in'},
 en:{title:'Pairings',kicker:'Notebook · concept',hint:'Search, or tap one of the key ingredients',how:'How it works',
   search:'Search an ingredient…',searchLbl:'Search an ingredient',noRes:'No ingredient found',noAroma:'no aroma data',hubs:'Key ingredients',hubOf:'key ingredient',
   back:'Back to the notebook',reset:'Start over',close:'Close',pairs:'Shares aromas with…',recipesWith:'Recipes with ',
   nComp:function(n){return n+(n===1?' compound':' compounds');},shared:'Shared aroma compounds',togetherNb:'Together in the notebook',
   never:'never together in the notebook recipes',moreC:function(n){return ' and '+n+' more';},
   known:function(n){return n+(n===1?' known aroma compound':' known aroma compounds');},entity:'dataset entry',approx:'closest entry',
   noData:'This ingredient is not in the aroma-compound dataset: no threads, rather than invented data.',
   src:'Aroma data',unm:'No aroma data: ',
   inN:function(n){return 'in '+n+(n===1?' recipe':' recipes')+' in the notebook';},nRec:function(n){return n+(n===1?' recipe':' recipes');},
   staples:'Also, everywhere: ',more:function(n){return n+' more aroma pairings';},none:'No aroma compounds shared with the other notebook ingredients.',
   howTitle:'Pairings from flavour science',
   stats:function(r,i,t,m){return r+' recipes · '+i+' ingredients ('+m+' with aroma data) · '+t+' types. A concept: chemistry suggests, the cook decides.';},
   types:'Ingredient types',ings:'Ingredients',together:'together in'}
};
var SHORT={verdure:['Verdure','Vegetables'],erbe:['Erbe','Herbs'],mare:['Mare','Seafood'],carne:['Carne','Meat'],latticini:['Latticini & uova','Dairy & eggs'],
  cereali:['Cereali','Grains'],frutta:['Frutta','Fruit'],condimenti:['Condimenti','Condiments'],altro:['Altro','Other']};
function getLang(){
  try{var v=localStorage.getItem(LANG_KEY);if(v==='it'||v==='en')return v;}catch(e){}
  var m=doc.cookie.match(/(?:^|; )recipe-lang=(en|it)/);if(m)return m[1];
  return 'it';
}
var lang=getLang();
function t(k){return T[lang][k];}
function nm(o){return o[lang]||o.it;}

/* ---------- state ---------- */
var D=null, ING={}, TYPE={}, TYPES=[], RECIPE={};
var drops=[], byId={};
var W=0,H=0,TOP=120, mobile=true;
var focus=null, trail=[], hidden={}, FOC={x:0,y:0,r:0};
var particles=[], splats=[], threads=[], shock=[];
var time=0, running=false, raf=0, lastT=0, acc=0;
var gl=null, prog=null, U={}, use2D=false, ctx2=null, fx=null, quality=1;
var sheetPeek=false;
var SD=null, searchUp=false; // the central search drop
var SEARCH_HTML='<form id="sForm" role="search" autocomplete="off" onsubmit="return false"><svg class="sic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.2"/><path d="m15.2 15.2 4.6 4.6"/></svg>'+
  '<input id="sInput" type="search" role="combobox" aria-autocomplete="list" aria-controls="sList" aria-expanded="false" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>'+
  '<ul id="sList" role="listbox" hidden></ul></form><p class="shubs" id="sHubs" aria-hidden="true"></p>';
var sbox=$('sbox');
if(!sbox){sbox=doc.createElement('div');sbox.className='sbox';sbox.id='sbox';doc.body.appendChild(sbox);} // older cached html
if(!$('sInput'))sbox.innerHTML=SEARCH_HTML;
var sInput=$('sInput'), sList=$('sList'), sIdx=-1, sItems=[];

function hexRgb(h){h=h.replace('#','');return [parseInt(h.substr(0,2),16)/255,parseInt(h.substr(2,2),16)/255,parseInt(h.substr(4,2),16)/255];}
function clamp(v,a,b){return v<a?a:v>b?b:v;}
function rnd(a,b){return a+Math.random()*(b-a);}

/* ---------- data ---------- */
// Versioned file name: an old service worker (cache-first on data/) can never have it cached,
// so new code never meets stale data. Falls back to the legacy name if the new file is missing.
var DATA_URLS=['data/pairings-v4.json','data/pairings-v2.json','data/pairings.json'];
function loadData(i){
  i=i||0;
  return fetch(DATA_URLS[i],{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status+' '+DATA_URLS[i]);return r.json();})
    .catch(function(e){if(i+1<DATA_URLS.length){console.warn(e);return loadData(i+1);}throw e;});
}
function boot(){
  loadData().then(function(data){
    try{init(data);window.__pairingsReady=true;}
    catch(e){console.error('pairings init failed',e);fallback(e,data);}
  },function(e){console.error('pairings data failed',e);fallback(e,null);});
}
boot();

/* Never a blank page: readable message + plain ingredient list (or a retry button when there is no data). */
function fallback(err,data){
  window.__pairingsReady=true;window.__pairingsFallback=String(err&&err.message||err);
  try{stop();}catch(_){}
  try{
    var en=lang==='en';
    var box=$('fallback');
    if(!box){box=doc.createElement('section');box.id='fallback';doc.body.appendChild(box);}
    box.className='fallback';box.hidden=false;box.setAttribute('role','alert');
    var h='<h2>'+(en?'The drops could not be drawn':'Le gocce non si possono disegnare')+'</h2><p>'+
      (en?'Something went wrong while loading this concept page. Try reloading (a hard refresh clears an old cached copy).':
          'Qualcosa è andato storto nel caricare questa pagina concept. Prova a ricaricare (un ricaricamento forzato elimina una vecchia copia in cache).')+'</p>'+
      '<p><button type="button" id="fbRetry">'+(en?'Reload':'Ricarica')+'</button> · <a href="app.html">'+(en?'Back to the notebook':'Torna al quaderno')+'</a></p>';
    var ok=data&&Array.isArray(data.ingredients)&&data.ingredients.length;
    if(ok){
      var ings=data.ingredients.filter(function(g){return g&&g.id;});
      var types=Array.isArray(data.types)?data.types.filter(function(ty){return ty&&ty.id;}):[];
      var byT={},names={},tset={};types.forEach(function(ty){tset[ty.id]=1;});
      ings.forEach(function(g){names[g.id]=g[lang]||g.it||g.id;var k=tset[g.type]?g.type:'_';(byT[k]=byT[k]||[]).push(g);});
      if(byT._)types=types.concat([{id:'_',it:'Ingredienti',en:'Ingredients'}]);
      h+='<div class="fb-list">'+types.map(function(ty){var gs=byT[ty.id]||[];if(!gs.length)return '';
        return '<h3 style="--c:'+esc(/^#[0-9a-f]{6}$/i.test(ty.color||'')?ty.color:'#704a2c')+'">'+esc(ty[lang]||ty.it||ty.id)+'</h3><ul>'+gs.map(function(g){
          var ms=(Array.isArray(g.matches)?g.matches:[]).slice(0,5).map(function(m){return esc(names[m.id]||m.id)+(m.n!=null?' ('+m.n+')':'');}).join(', ');
          return '<li><b>'+esc(names[g.id])+'</b>'+(ms?' — '+ms:'')+'</li>';}).join('')+'</ul>';}).join('')+'</div>';
      if(data.source&&data.source.url)h+='<p class="fb-src">'+esc((en?'Aroma data':'Dati aromatici')+': '+(data.source.label||data.source.short||''))+' · '+esc(data.source.license||'')+'</p>';
    }
    box.innerHTML=h;
    var rb=$('fbRetry');if(rb)rb.addEventListener('click',function(){location.reload();});
    if(hintEl)hintEl.classList.add('gone');
  }catch(e2){console.error(e2);if(hintEl)hintEl.textContent='Impossibile caricare i dati / Could not load data';}
}

function normalise(data){
  if(!data||!data.ingredients||!data.types||!data.recipes)throw new Error('pairings data: missing fields');
  data.compounds=data.compounds||[];
  data.method=data.method||{it:'',en:''};
  data.unmapped=data.unmapped||[];
  data.mappedCount=data.mappedCount!=null?data.mappedCount:data.ingredients.length;
  data.featured=(data.featured||data.ingredients.map(function(g){return g.id;}));
  data.recipeCount=data.recipeCount||data.recipes.length;
  var ids={};data.ingredients.forEach(function(g){ids[g.id]=1;});
  data.featured=data.featured.filter(function(id){return ids[id];});
  data.hubs=(data.hubs||data.featured.slice(0,12)).filter(function(id){return ids[id];});
  data.ingredients.forEach(function(g){
    g.n=+g.n||1;g.recipes=g.recipes||[];
    g.matches=(g.matches||[]).filter(function(m){return m&&ids[m.id];});
    g.matches.forEach(function(m){m.score=isFinite(+m.score)?+m.score:0;m.n=+m.n||0;m.recipes=m.recipes||[];m.ex=m.ex||[];});
  });
  var tids={};data.types.forEach(function(ty){tids[ty.id]=1;if(!/^#[0-9a-f]{6}$/i.test(ty.color||''))ty.color='#704a2c';});
  data.ingredients.forEach(function(g){if(!tids[g.type])g.type=data.types[data.types.length-1].id;});
  return data;
}

function init(data){
  D=normalise(data);
  data.types.forEach(function(ty,i){ty.idx=i;ty.rgb=hexRgb(ty.color);TYPE[ty.id]=ty;TYPES.push(ty);});
  data.ingredients.forEach(function(g){ING[g.id]=g;});
  data.recipes.forEach(function(r){RECIPE[r.slug]=r;});
  setupGL();
  fx=fxC.getContext('2d');
  buildChips();
  applyLang();
  measure();
  populate();
  bind();
  bindSearch();searchLang();
  if(RM){settle(420);renderAll();}
  else start();
  // deep-link: pairings.html#pomodoro
  var h=decodeURIComponent(location.hash.replace(/^#\/?/,''));
  if(h&&ING[h])setTimeout(function(){select(h,true);},RM?0:900);
}

/* ---------- layout ---------- */
function measure(){
  W=window.innerWidth;H=window.innerHeight;mobile=W<760;
  var cb=chipsEl.getBoundingClientRect();TOP=Math.max(96,cb.bottom+6);
  var sc=DPR*quality;
  if(inkC.width!==Math.round(W*sc)||inkC.height!==Math.round(H*sc)){inkC.width=Math.round(W*sc);inkC.height=Math.round(H*sc);}
  fxC.width=Math.round(W*DPR);fxC.height=Math.round(H*DPR);
  if(gl)gl.viewport(0,0,inkC.width,inkC.height);
}
function sheetH(){return Math.round(Math.min(H*0.4,H-150));}
function baseR(){return clamp(Math.min(W,H-TOP)*0.041,21,33);}
function radiusFor(g){var b=baseR();return b*(0.86+0.27*Math.sqrt(g.n));}
function area(){ // usable rectangle for drops
  var x0=10,x1=W-10,y0=TOP+4,y1=H-(mobile?54:58);
  return {x0:x0,x1:x1,y0:y0,y1:y1};
}
function focalArea(){
  var a=area();
  if(!focus)return a;
  if(mobile){var sh=sheetPeek?132:sheetH();return {x0:a.x0,x1:a.x1,y0:a.y0,y1:H-sh-8};}
  var pw=Math.min(392,W*0.34)+32;return {x0:a.x0,x1:W-pw,y0:a.y0,y1:H-16};
}
function hubCount(){return Math.min(mobile?8:12,D.hubs.length);}
function searchR(){return mobile?clamp(Math.min(W,H-TOP)*0.2,64,84):clamp(Math.min(W,H-TOP)*0.17,86,112);}
function idleHomes(){
  // calm start: search drop in the centre, key ingredients on an even ring around it
  var a=area(),cx=(a.x0+a.x1)/2,cy=(a.y0+a.y1)/2;
  var hubs=drops.filter(function(d){return d.hub&&!d.spawned;});
  var hr=0;hubs.forEach(function(d){hr=Math.max(hr,d.r0);});
  var sr=SD?SD.r0:searchR();
  var ry=Math.max(sr+hr+18,(a.y1-a.y0)/2-hr-10), rx=Math.max(sr+hr+18,Math.min((a.x1-a.x0)/2-hr-8,ry*(mobile?1:1.5)));
  if(mobile)ry=Math.min(ry,rx*1.45);
  if(SD){SD.hx=cx;SD.hy=searchUp?Math.min(cy,a.y0+sr+14):cy;}
  hubs.forEach(function(d,i){var an=-Math.PI/2+i/hubs.length*Math.PI*2;
    d.hx=clamp(cx+Math.cos(an)*rx,a.x0+d.r0,a.x1-d.r0);d.hy=clamp(cy+Math.sin(an)*ry,a.y0+d.r0,a.y1-d.r0);});
}

/* ---------- drops ---------- */
function makeDrop(id,spawned){
  var g=ING[id];if(!g)return null;
  var d={id:id,g:g,type:g.type,rgb:TYPE[g.type].rgb,r0:radiusFor(g),x:0,y:0,vx:0,vy:0,s:spawned?0:1,vs:0,sT:1,op:1,opT:1,
    hx:0,hy:0,ph:Math.random()*6.283,wob:0,role:'idle',spawned:!!spawned,dragging:false,el:null,score:0,dead:false};
  var b=doc.createElement('button');b.type='button';b.className='dl'+(g.staple?' staple':'');
  b.innerHTML='<span class="nm"></span><span class="ct"></span>';
  b.addEventListener('click',function(e){if(e.detail===0)select(id);}); // keyboard; pointer handled on stage
  labelsEl.appendChild(b);d.el=b;d.nmEl=b.firstChild;d.ctEl=b.lastChild;
  setLabel(d);
  drops.push(d);byId[id]=d;
  return d;
}
function makeSearchDrop(){
  var g={id:'__search',it:'',en:'',n:1,staple:false,type:'__search'};
  var d={id:'__search',g:g,type:'__search',rgb:hexRgb('#9b7b58'),r0:searchR(),x:0,y:0,vx:0,vy:0,s:1,vs:0,sT:1,op:0.62,opT:0.62,
    hx:0,hy:0,ph:1.3,wob:0,role:'search',spawned:false,dragging:false,el:sbox,score:0,dead:false,search:true};
  drops.push(d);SD=d;return d;
}
function setLabel(d){if(d.search)return;d.nmEl.textContent=nm(d.g);d.ctEl.textContent=T[lang].nRec(d.g.n);
  d.el.setAttribute('aria-label',nm(d.g)+' — '+(d.hub?T[lang].hubOf+', ':'')+nm(TYPE[d.type])+', '+T[lang].nRec(d.g.n));}
function ensureHubs(){
  // (re)build the ring for the current screen size: first N key ingredients
  var want=D.hubs.slice(0,hubCount()),w={};want.forEach(function(id){w[id]=1;});
  drops.slice().forEach(function(d){if(d.hub&&!d.spawned&&!w[d.id]&&d!==focus)removeDrop(d);});
  want.forEach(function(id){var d=byId[id];
    if(!d){d=makeDrop(id,false);d.hub=true;d.x=SD?SD.x:W/2;d.y=SD?SD.y:H/2;d.s=RM?1:0;setLabel(d);}
    else if(!d.hub||d.spawned){d.hub=true;d.spawned=false;if(!focus){d.role='idle';d.sT=hidden[d.type]?0:1;d.opT=hidden[d.type]?0:1;}setLabel(d);}});
  // keep ring order = hub rank
  var hs=drops.filter(function(d){return d.hub&&!d.spawned;}).sort(function(a,b){return D.hubs.indexOf(a.id)-D.hubs.indexOf(b.id);});
  drops=drops.filter(function(d){return !(d.hub&&!d.spawned);}).concat(hs);
}
function populate(){
  makeSearchDrop();
  ensureHubs();
  idleHomes();
  var a=area();
  drops.forEach(function(d,i){
    d.x=d.hx;d.y=d.hy;
    if(!RM){ // hubs grow out of the search drop, one after another
      if(d.search){d.s=0.2;d.sT=1;}else{d.x=SD.hx;d.y=SD.hy;d.s=0;d.delay=0.25+i*0.07;}
    }
  });
}
function removeDrop(d){if(d.search)return;d.el.remove();drops.splice(drops.indexOf(d),1);if(byId[d.id]===d)delete byId[d.id];}

/* ---------- selection ---------- */
function topMatches(g){
  var lim=mobile?6:8;
  return g.matches.filter(function(m){return !m.staple&&!hidden[ING[m.id].type];}).slice(0,lim);
}
function select(id,instant){
  var g=ING[id];if(!g)return;
  if(focus&&focus.id===id){pop(focus);return;}
  if(trail[trail.length-1]!==id){var ix=trail.indexOf(id);if(ix>=0)trail=trail.slice(0,ix+1);else trail.push(id);}
  if(trail.length>6)trail=trail.slice(-6);
  var d=byId[id]||makeDrop(id,true);
  if(d.spawned&&d.s<0.05){d.x=focus?focus.x:(SD?SD.x:W/2);d.y=focus?focus.y:(SD?SD.y:H/2);}
  closeSuggest();try{if(doc.activeElement===sInput)sInput.blur();}catch(_){}searchUp=false;
  focus=d;
  body.classList.add('sel');hintEl.classList.add('gone');resetBtn.disabled=false;
  var ms=topMatches(g),mset={};
  ms.forEach(function(m,i){mset[m.id]=m;});
  // make sure matches exist on stage (they emerge from the tapped drop)
  ms.forEach(function(m){var md=byId[m.id];if(!md){md=makeDrop(m.id,true);md.x=d.x+rnd(-4,4);md.y=d.y+rnd(-4,4);md.s=0;md.delay=RM?0:0.16+Math.random()*0.25;}});
  openSheet(g,ms);
  var fa=focalArea(),fx0=(fa.x0+fa.x1)/2,fy0=(fa.y0+fa.y1)/2;
  var R=Math.min((fa.x1-fa.x0)*0.40,(fa.y1-fa.y0)*0.40);
  var maxS=Math.max(ms.length?ms[0].score:1,1e-6);
  FOC={x:fx0,y:fy0,r:mobile?0:R*1.45};
  drops.forEach(function(o){
    o.el.classList.remove('focus');
    if(o===d){o.role='focus';o.sT=mobile?1.3:1.45;o.opT=1;o.hx=fx0;o.hy=fy0;o.el.classList.add('focus');return;}
    var m=mset[o.id];
    if(m){
      var i=ms.indexOf(m),an=-Math.PI/2+(i+0.5)/ms.length*Math.PI*2+(ms.length%2?0:0.25);
      var dist=R*(1.08-0.3*(m.score/maxS));
      o.role='match';o.score=m.score;o.n=m.n;o.sT=mobile?0.92:1.02;o.opT=1;
      o.hx=fx0+Math.cos(an)*dist*(mobile?1.05:1.25);o.hy=fy0+Math.sin(an)*dist;
      return;
    }
    if(o.spawned){o.role='gone';o.sT=0;o.opT=0;return;}
    // everything else (search drop, unrelated key ingredients) quietly sinks into the focal drop
    o.role='hide';o.sT=0;o.opT=0;o.hx=fx0;o.hy=fy0;
  });
  threads=ms.map(function(m,i){return {to:m.id,score:m.score/Math.max(maxS,0.001),raw:m.score,p:RM?1:0,delay:RM?0:0.22+i*0.05};});
  try{history.replaceState(null,'','#'+id);}catch(e){}
  pop(d,instant);
  if(RM){settle(320);renderAll();}
}
function pop(d,instant){
  d.wob=1;
  if(RM||instant){return;}
  d.vs+=9; // swell…
  d.popAt=time+0.14; // …then burst
}
function burst(d){
  var r=d.r0*d.s,c=d.rgb,n=mobile?34:46;
  d.s*=0.78;d.vs=-2;
  for(var i=0;i<n;i++){
    var an=Math.random()*6.283,sp=rnd(140,520)*(0.6+0.4*Math.random());
    particles.push({x:d.x+Math.cos(an)*r*0.8,y:d.y+Math.sin(an)*r*0.8,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp-60,
      sz:rnd(1.4,5.2)*(Math.random()<0.18?2:1),c:c,life:1});
  }
  shock.push({x:d.x,y:d.y,r:r,t:0});
}
function reset(){
  if(!focus)return;
  focus=null;trail=[];threads=[];
  body.classList.remove('sel');resetBtn.disabled=true;hintEl.classList.remove('gone');
  closeSheet();
  drops.forEach(function(o){o.el.classList.remove('focus');
    if(o.spawned){o.role='gone';o.sT=0;o.opT=0;}
    else if(o.search){o.role='search';o.sT=1;o.opT=0.62;}
    else{o.role='idle';o.sT=hidden[o.type]?0:1;o.opT=hidden[o.type]?0:1;}});
  ensureHubs();idleHomes();
  try{history.replaceState(null,'',location.pathname+location.search);}catch(e){}
  if(RM){drops.slice().forEach(function(o){if(o.role==='gone')removeDrop(o);});settle(320);renderAll();}
}

/* ---------- sheet ---------- */
var ICON_CLOSE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
var ICON_GO='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.4 5.2 15.8 12l-6.4 6.8"/></svg>';
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function rlink(slug){var r=RECIPE[slug];return '<a href="app.html#/r/'+encodeURIComponent(slug)+'">'+esc(nm(r.short||r.title))+'</a>';}
function openSheet(g,ms){
  if(mobile)sheet.style.setProperty('--sheet-h',sheetH()+'px');
  var ty=TYPE[g.type],L=T[lang];
  var h='<div class="sh-head"><span class="sh-dot" style="--c:'+ty.color+'"></span><div class="sh-t"><div class="sh-type">'+esc(nm(ty))+'</div>'+
    '<h2 id="shTitle">'+esc(nm(g))+'</h2><div class="sh-meta">'+esc(L.inN(g.n))+(g.ahn?' · '+esc(L.known(g.nc))+'<br><span class="ent">'+esc(g.approx?L.approx:L.entity)+': <i>'+esc(g.ahn.replace(/_/g,' '))+'</i></span>':'')+'</div></div>'+
    '<button class="sh-close" type="button" data-act="reset" aria-label="'+esc(L.close)+'">'+ICON_CLOSE+'</button></div>';
  if(trail.length>1){
    h+='<nav class="crumbs" aria-label="Percorso">'+trail.map(function(id,i){
      return i===trail.length-1?'<span aria-current="true">'+esc(nm(ING[id]))+'</span>':'<button type="button" data-go="'+id+'">'+esc(nm(ING[id]))+'</button><span aria-hidden="true">→</span>';}).join('')+'</nav>';
  }
  h+='<h3 class="sh-h">'+esc(L.pairs)+'</h3>';
  if(!ms.length)h+='<p class="empty">'+esc(g.ahn?L.none:L.noData)+'</p>';
  var max=Math.max(ms.length?ms[0].score:1,1e-6);
  h+='<ol class="mlist">'+ms.map(function(m){var o=ING[m.id],c=TYPE[o.type].color;
    var ex=(m.ex||[]).map(function(k){return esc(D.compounds[k]!=null?D.compounds[k]:'');}).filter(Boolean).join(' · ')+(m.n>(m.ex||[]).length?esc(L.moreC(m.n-m.ex.length)):'');
    return '<li><button class="m" type="button" data-go="'+m.id+'"><span class="d" style="--c:'+c+'"></span><span class="mn">'+esc(nm(o))+'</span>'+
      '<span class="bar" title="Jaccard '+m.score+'"><i style="width:'+Math.round(18+82*m.score/max)+'%"></i></span><span class="mc">'+esc(L.nComp(m.n))+'</span></button>'+
      '<div class="mr cx"><b>'+esc(L.shared)+'</b> '+ex+'</div>'+
      '<div class="mr"><b>'+esc(L.togetherNb)+'</b> '+(m.recipes.length?m.recipes.map(rlink).join(' · '):'<span class="nv">'+esc(L.never)+'</span>')+'</div></li>';}).join('')+'</ol>';
  var shown={};ms.forEach(function(m){shown[m.id]=1;});
  var rest=g.matches.filter(function(m){return !m.staple&&!shown[m.id];});
  if(rest.length){
    h+='<details class="faint"><summary>'+esc(L.more(rest.length))+'</summary><div class="more">'+rest.map(function(m){var o=ING[m.id];
      return '<button type="button" data-go="'+m.id+'"><i style="--c:'+TYPE[o.type].color+'"></i>'+esc(nm(o))+' · '+m.n+'</button>';}).join('')+'</div></details>';
  }
  var st=g.matches.filter(function(m){return m.staple;});
  if(st.length)h+='<p class="faint">'+esc(L.staples)+st.map(function(m){return '<button type="button" data-go="'+m.id+'">'+esc(nm(ING[m.id]).toLowerCase())+'</button> ('+m.n+')';}).join(', ')+'</p>';
  h+='<h3 class="sh-h">'+esc(L.recipesWith+nm(g).toLowerCase())+'</h3><ul class="rlist">'+g.recipes.map(function(s){var r=RECIPE[s];
    return '<li><a href="app.html#/r/'+encodeURIComponent(s)+'">'+(r.cover?'<img src="'+esc(r.cover)+'" alt="" loading="lazy" decoding="async"/>':'<i></i>')+
      '<span>'+esc(nm(r.title))+'</span>'+ICON_GO+'</a></li>';}).join('')+'</ul>';
  if(D.source)h+='<p class="credit">'+srcCredit()+'</p>';
  sheetIn.innerHTML=h;sheetIn.scrollTop=0;
  sheet.classList.add('open');sheet.setAttribute('aria-hidden','false');sheet.setAttribute('aria-labelledby','shTitle');
}
function srcCredit(){var s=D.source;if(!s||!s.url)return '';return esc(t('src'))+': <a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.short)+'</a> · <a href="'+esc(s.licenseUrl)+'" target="_blank" rel="noopener">'+esc(s.license)+'</a>';}
function closeSheet(){sheet.classList.remove('open');sheet.setAttribute('aria-hidden','true');}

/* ---------- chips / language ---------- */
function buildChips(){
  chipsEl.innerHTML='';
  TYPES.forEach(function(ty){
    var cnt=D.ingredients.filter(function(g){return g.type===ty.id;}).length;
    var b=doc.createElement('button');b.type='button';b.className='chip';b.dataset.type=ty.id;b.style.setProperty('--c',ty.color);
    b.setAttribute('aria-pressed',hidden[ty.id]?'false':'true');
    b.innerHTML='<i></i><span></span><b>'+cnt+'</b>';
    b.addEventListener('click',function(){toggleType(ty.id);});
    chipsEl.appendChild(b);
  });
}
function toggleType(id){
  var allOn=TYPES.every(function(ty){return !hidden[ty.id];});
  if(allOn){TYPES.forEach(function(ty){hidden[ty.id]=ty.id!==id;});} // first tap = solo this type
  else hidden[id]=!hidden[id];
  if(TYPES.every(function(ty){return hidden[ty.id];}))hidden={};
  [].forEach.call(chipsEl.children,function(b){b.setAttribute('aria-pressed',hidden[b.dataset.type]?'false':'true');});
  if(focus&&hidden[focus.type])reset();
  if(focus){var f=focus.id;focus=null;trail.pop();select(f,true);}
  else drops.forEach(function(o){if(o.search)return;o.sT=hidden[o.type]?0:1;o.opT=hidden[o.type]?0:1;});
  if(RM){settle(200);renderAll();}
}
function applyLang(){
  html.lang=lang;
  [].forEach.call(doc.querySelectorAll('[data-i18n]'),function(el){el.textContent=t(el.dataset.i18n);});
  [].forEach.call(doc.querySelectorAll('[data-i18n-aria]'),function(el){el.setAttribute('aria-label',t(el.dataset.i18nAria));});
  [].forEach.call(doc.querySelectorAll('.lang button'),function(b){b.setAttribute('aria-pressed',b.dataset.lang===lang?'true':'false');});
  [].forEach.call(chipsEl.children,function(b){var ty=TYPE[b.dataset.type];b.querySelector('span').textContent=SHORT[ty.id][lang==='en'?1:0];b.title=nm(ty);});
  chipsEl.setAttribute('aria-label',t('types'));labelsEl.setAttribute('aria-label',t('ings'));
  doc.title=t('title')+' — Quaderno';
  if(D){
    var S=D.source;
    var hb=$('howBody');
    if(hb)hb.innerHTML='<strong>'+esc(t('howTitle'))+'</strong><p>'+esc(nm(D.method))+'</p>'+
      (S&&S.url?'<p class="src">'+esc(S.label||S.short||'')+'. <a href="'+esc(S.url)+'" target="_blank" rel="noopener">doi:10.1038/srep00196</a> · <a href="'+esc(S.licenseUrl||'#')+'" target="_blank" rel="noopener">'+esc(S.license||'')+'</a></p>':'')+
      (D.hubRule?'<p class="unm">'+esc(nm(D.hubRule))+'</p>':'')+
      (D.unmapped.length?'<p class="unm">'+esc(t('unm'))+esc(D.unmapped.map(function(u){return nm(u);}).join(', '))+'.</p>':'')+
      '<p>'+esc(T[lang].stats(D.recipeCount,D.ingredients.length,D.types.length,D.mappedCount))+'</p>';
    var cr=$('credit');
    if(!cr&&S&&S.url){cr=doc.createElement('p');cr.id='credit';cr.className='credit-fixed';doc.body.appendChild(cr);}
    if(cr)cr.innerHTML=srcCredit();
    drops.forEach(setLabel);
    if(sInput)searchLang();
    if(focus)openSheet(focus.g,topMatches(focus.g));
  }
}
function setLang(l){lang=l;try{localStorage.setItem(LANG_KEY,l);}catch(e){}
  doc.cookie='recipe-lang='+l+';path=/;max-age=31536000;SameSite=Lax';applyLang();if(RM)renderAll();}

/* ---------- input ---------- */
var ptr=null;
function hit(x,y){
  var best=null,bd=1e9;
  drops.forEach(function(d){
    if(d.s<0.2||d.op<0.1||d.role==='gone'||d.role==='hide')return;
    var r=Math.max(d.r0*d.s,22)+4,dx=x-d.x,dy=y-d.y,q=(dx*dx+dy*dy)/(r*r);
    var pri=d.role==='dim'?1.6:1; // prefer bright drops when overlapping
    if(q<1&&q*pri<bd){bd=q*pri;best=d;}
  });
  return best;
}
function bind(){
  stage.addEventListener('pointerdown',function(e){
    if(e.button>0)return;
    var d=hit(e.clientX,e.clientY);
    ptr={id:e.pointerId,d:d,x0:e.clientX,y0:e.clientY,lx:e.clientX,ly:e.clientY,lt:performance.now(),moved:false,vx:0,vy:0};
    try{stage.setPointerCapture(e.pointerId);}catch(_){}
  });
  stage.addEventListener('pointermove',function(e){
    if(!ptr||ptr.id!==e.pointerId)return;
    var dx=e.clientX-ptr.x0,dy=e.clientY-ptr.y0;
    if(!ptr.moved&&dx*dx+dy*dy>64&&ptr.d&&!ptr.d.search){ptr.moved=true;ptr.d.dragging=true;stage.classList.add('dragging');}
    if(ptr.moved&&ptr.d){
      var now=performance.now(),dt=Math.max(1,now-ptr.lt)/1000;
      ptr.vx=(e.clientX-ptr.lx)/dt;ptr.vy=(e.clientY-ptr.ly)/dt;ptr.lx=e.clientX;ptr.ly=e.clientY;ptr.lt=now;
      ptr.d.x=e.clientX;ptr.d.y=e.clientY;ptr.d.wob=Math.max(ptr.d.wob,0.5);
      if(RM){settle(40,ptr.d);renderAll();}
    }
  });
  function end(e){
    if(!ptr||ptr.id!==e.pointerId)return;
    var p=ptr;ptr=null;stage.classList.remove('dragging');
    if(p.moved&&p.d){
      var d=p.d;d.dragging=false;d.vx=clamp(p.vx,-1400,1400)*0.6;d.vy=clamp(p.vy,-1400,1400)*0.6;
      d.hx=d.x;d.hy=d.y; // stays where you leave it
      if(RM){settle(120);renderAll();}
      return;
    }
    if(e.type==='pointercancel')return;
    if(p.d&&p.d.search){try{sInput.focus();}catch(_){}return;}
    if(p.d)select(p.d.id);else if(focus)reset();else closeSuggest();
  }
  stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);
  resetBtn.addEventListener('click',reset);
  [].forEach.call(doc.querySelectorAll('.lang button'),function(b){b.addEventListener('click',function(){setLang(b.dataset.lang);});});
  sheetIn.addEventListener('click',function(e){
    var go=e.target.closest('[data-go]');if(go){select(go.dataset.go);return;}
    if(e.target.closest('[data-act="reset"]'))reset();
  });
  $('grab').addEventListener('click',function(){sheetPeek=!sheetPeek;sheet.classList.toggle('peek',sheetPeek);if(focus){var f=focus.id;focus=null;trail.pop();select(f,true);}});
  doc.addEventListener('keydown',function(e){if(e.key==='Escape'&&focus)reset();});
  var rt=0;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(onResize,120);});
  doc.addEventListener('visibilitychange',function(){if(doc.hidden)stop();else if(!RM)start();});
  window.addEventListener('pageshow',function(){if(!RM&&!doc.hidden)start();});
}
function onResize(){
  var wasMobile=mobile;measure();
  drops.forEach(function(d){d.r0=d.search?searchR():radiusFor(d.g);});
  if(!focus&&wasMobile!==mobile)ensureHubs();
  if(focus){var f=focus.id;focus=null;trail.pop();select(f,true);}else idleHomes();
  if(RM){settle(300);renderAll();}
}

/* ---------- physics ---------- */
function step(dt,pinned){
  time+=dt;
  var a=area(),i,j,d;
  for(i=0;i<drops.length;i++){
    d=drops[i];
    if(d.delay>0){d.delay-=dt;continue;}
    if(d.popAt&&time>=d.popAt){d.popAt=0;burst(d);}
    d.vs+=((d.sT-d.s)*150-d.vs*11)*dt;d.s=Math.max(0,d.s+d.vs*dt);
    d.op+=(d.opT-d.op)*Math.min(1,dt*4);
    d.wob*=Math.exp(-dt*1.4);
    if(d.dragging||d===pinned)continue;
    var drift=RM?0:(d.role==='idle'?5:d.role==='search'?2.5:d.role==='dim'?6:4);
    var hx=d.hx+Math.sin(time*0.21+d.ph)*drift, hy=d.hy+Math.cos(time*0.27+d.ph*1.7)*drift;
    var k=d.role==='focus'?11:d.role==='match'?7:d.role==='search'?7:d.role==='hide'?9:3.2;
    d.vx+=(hx-d.x)*k*dt;d.vy+=(hy-d.y)*k*dt;
    if(focus&&d.role==='dim'&&FOC.r){var ex=d.x-FOC.x,ey=d.y-FOC.y,el=Math.sqrt(ex*ex+ey*ey)||1;if(el<FOC.r){var fpush=(FOC.r-el)*9*dt;d.vx+=ex/el*fpush*6;d.vy+=ey/el*fpush*6;}}
    if(!RM){d.vx+=Math.sin(time*0.5+d.ph*3.1)*3*dt;d.vy+=Math.cos(time*0.4+d.ph*2.3)*3*dt;} // slow, gentle wander
  }
  // soft collisions
  for(i=0;i<drops.length;i++){
    var p=drops[i];if(p.s<0.12||p.delay>0)continue;
    for(j=i+1;j<drops.length;j++){
      var q=drops[j];if(q.s<0.12||q.delay>0)continue;
      var dx=q.x-p.x,dy=q.y-p.y,rr=(p.r0*p.s+q.r0*q.s)*1.14+(focus?8:4),d2=dx*dx+dy*dy;
      if(d2>=rr*rr)continue;
      var dd=Math.sqrt(d2)||0.01,ov=(rr-dd),nx=dx/dd,ny=dy/dd;
      var ip=mass(p,pinned),iq=mass(q,pinned),sum=ip+iq;if(sum<=0)continue;
      var push=ov*0.5;
      p.x-=nx*push*ip/sum;p.y-=ny*push*ip/sum;q.x+=nx*push*iq/sum;q.y+=ny*push*iq/sum;
      var rv=(q.vx-p.vx)*nx+(q.vy-p.vy)*ny;
      if(rv<0){var imp=rv*0.5;p.vx+=nx*imp*ip/sum;p.vy+=ny*imp*ip/sum;q.vx-=nx*imp*iq/sum;q.vy-=ny*imp*iq/sum;}
    }
  }
  var damp=Math.exp(-dt*3.4);
  for(i=0;i<drops.length;i++){
    d=drops[i];
    if(!isFinite(d.x)||!isFinite(d.y)||!isFinite(d.vx)||!isFinite(d.vy)){ // never let a NaN hide a drop
      d.x=isFinite(d.hx)?d.hx:W/2;d.y=isFinite(d.hy)?d.hy:H/2;d.vx=0;d.vy=0;}
    if(!isFinite(d.s)){d.s=d.sT||1;d.vs=0;}
    if(d.dragging||d===pinned)continue;
    d.vx*=damp;d.vy*=damp;d.x+=d.vx*dt;d.y+=d.vy*dt;
    var r=d.r0*d.s*0.7,minY=d.role==='dim'?a.y0-10:a.y0+r;
    if(d.x<a.x0+r){d.x=a.x0+r;d.vx=Math.abs(d.vx)*0.3;}
    if(d.x>a.x1-r){d.x=a.x1-r;d.vx=-Math.abs(d.vx)*0.3;}
    if(d.y<minY&&d.vy<=0){d.y+=(minY-d.y)*0.2;d.vy*=0.3;}
    if(d.y>H+200)d.y=H+200;
  }
  for(i=drops.length-1;i>=0;i--){d=drops[i];if(d.role==='gone'&&d.s<0.03&&d.op<0.05)removeDrop(d);}
  threads.forEach(function(th){if(th.delay>0)th.delay-=dt;else th.p=Math.min(1,th.p+dt*2.4);});
  // particles
  for(i=particles.length-1;i>=0;i--){
    var pt=particles[i];pt.vx*=Math.exp(-dt*3.2);pt.vy=pt.vy*Math.exp(-dt*3.2)+260*dt;pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;
    if(pt.vx*pt.vx+pt.vy*pt.vy<900){splats.push({x:pt.x,y:pt.y,sz:pt.sz*1.25,c:pt.c,a:1,rot:Math.random()*3,e:rnd(0.6,1)});particles.splice(i,1);}
  }
  for(i=splats.length-1;i>=0;i--){splats[i].a-=dt*0.45;if(splats[i].a<=0)splats.splice(i,1);}
  for(i=shock.length-1;i>=0;i--){shock[i].t+=dt*2.6;if(shock[i].t>=1)shock.splice(i,1);}
}
function mass(d,pinned){if(d.dragging||d===pinned)return 0;return d.role==='search'?0.15:d.role==='focus'?0.12:d.role==='match'?0.6:d.role==='dim'?1.4:1;}
function settle(n,pinned){for(var i=0;i<n;i++)step(1/60,pinned);particles=[];splats=[];shock=[];
  drops.slice().forEach(function(d){if(d.popAt)d.popAt=0;d.s=d.sT;d.op=d.opT;d.vs=0;if(d.role==='gone')removeDrop(d);});
  threads.forEach(function(th){th.p=1;th.delay=0;});}

/* ---------- loop ---------- */
var ft=[],slow=0;
function frame(now){
  raf=requestAnimationFrame(frame);
  try{frameBody(now);}catch(e){console.error('pairings frame failed',e);stop();fallback(e,D);}
}
function frameBody(now){
  var dtr=Math.min(0.1,(now-(lastT||now))/1000);lastT=now;
  acc+=dtr;var n=0;while(acc>=1/60&&n<6){step(1/60);acc-=1/60;n++;}if(n===6)acc=0;
  renderAll();
  // adaptive resolution for slow GPUs
  if(gl&&dtr>0){ft.push(dtr);if(ft.length>40){var avg=ft.reduce(function(s,v){return s+v;},0)/ft.length;ft=[];
    if(avg>0.030&&quality>0.55){quality=Math.max(0.55,quality*0.8);measure();}}}
}
function start(){if(running||RM)return;running=true;lastT=0;raf=requestAnimationFrame(frame);}
function stop(){running=false;cancelAnimationFrame(raf);}

/* ---------- search ---------- */
function placeSearch(d,r,vis){
  var st=sbox.style,on=vis&&d.role==='search';
  var tr='translate3d('+d.x.toFixed(1)+'px,'+d.y.toFixed(1)+'px,0) translate(-50%,-50%)';
  if(d._tr!==tr){st.transform=tr;d._tr=tr;}
  var w=Math.max(mobile?168:180,Math.round(r*1.8))+'px';if(d._w!==w){st.width=w;d._w=w;}
  var o=on?'1':'0';if(d._o!==o){st.opacity=o;d._o=o;st.visibility=on?'visible':'hidden';sbox.classList.toggle('off',!on);}
}
function fold(x){x=String(x||'').toLowerCase();try{x=x.normalize('NFD');}catch(_){}return x.replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,' ').replace(/\s+/g,' ').trim();}
function suggest(q){
  q=fold(q);if(!q)return [];
  var out=[];
  D.ingredients.forEach(function(g){
    var best=9;[g.it,g.en,g.id.replace(/-/g,' ')].forEach(function(n){var f=fold(n),ix=f.indexOf(q);
      if(ix<0)return;var sc=ix===0?0:(f.charAt(ix-1)===' '?1:2);if(sc<best)best=sc;});
    if(best<9)out.push({g:g,sc:best});
  });
  out.sort(function(a,b){return (a.sc-b.sc)||((b.g.ahn?1:0)-(a.g.ahn?1:0))||(b.g.n-a.g.n)||(fold(nm(a.g))<fold(nm(b.g))?-1:1);});
  return out.slice(0,mobile?6:8).map(function(o){return o.g;});
}
function renderSuggest(){
  var q=sInput.value;sItems=suggest(q);
  if(!q.trim()){closeSuggest();return;}
  sIdx=sItems.length?0:-1;
  sList.innerHTML=sItems.length?sItems.map(function(g,i){var o=lang==='en'?g.it:g.en;
    return '<li role="option" id="sOpt'+i+'" data-go="'+esc(g.id)+'"'+(i===sIdx?' aria-selected="true"':'')+'><i style="--c:'+TYPE[g.type].color+'"></i><span class="sn">'+esc(nm(g))+'</span>'+
      (o&&fold(o)!==fold(nm(g))?'<span class="so">'+esc(o)+'</span>':'')+(g.ahn?'':'<span class="sx">'+esc(t('noAroma'))+'</span>')+'</li>';}).join('')
    :'<li class="none" aria-disabled="true">'+esc(t('noRes'))+'</li>';
  sList.hidden=false;sInput.setAttribute('aria-expanded','true');body.classList.add('typing');
  if(sIdx>=0)sInput.setAttribute('aria-activedescendant','sOpt'+sIdx);else sInput.removeAttribute('aria-activedescendant');
}
function moveSel(k){if(!sItems.length)return;sIdx=(sIdx+k+sItems.length)%sItems.length;
  [].forEach.call(sList.children,function(li,i){if(i===sIdx)li.setAttribute('aria-selected','true');else li.removeAttribute('aria-selected');});
  sInput.setAttribute('aria-activedescendant','sOpt'+sIdx);}
function closeSuggest(){body.classList.remove('typing');if(!sList)return;sList.hidden=true;sList.innerHTML='';sItems=[];sIdx=-1;sInput.setAttribute('aria-expanded','false');sInput.removeAttribute('aria-activedescendant');}
function pick(id){sInput.value='';closeSuggest();try{sInput.blur();}catch(_){}select(id);}
function setSearchUp(v){if(!mobile)v=false;if(searchUp===v)return;searchUp=v;if(!focus){idleHomes();if(RM){settle(200);renderAll();}}}
function bindSearch(){
  sInput.addEventListener('input',renderSuggest);
  sInput.addEventListener('focus',function(){setSearchUp(true);if(sInput.value.trim())renderSuggest();});
  sInput.addEventListener('blur',function(){setTimeout(function(){if(doc.activeElement!==sInput){setSearchUp(false);}},150);});
  sInput.addEventListener('keydown',function(e){
    if(e.key==='ArrowDown'){e.preventDefault();moveSel(1);}
    else if(e.key==='ArrowUp'){e.preventDefault();moveSel(-1);}
    else if(e.key==='Enter'){e.preventDefault();if(sItems.length)pick(sItems[Math.max(0,sIdx)].id);}
    else if(e.key==='Escape'){e.stopPropagation();sInput.value='';closeSuggest();sInput.blur();}
  });
  // pointerdown (not click) so the choice lands before the input blurs / the keyboard closes
  sList.addEventListener('pointerdown',function(e){var li=e.target.closest('[data-go]');if(!li)return;e.preventDefault();pick(li.dataset.go);});
  $('sForm').addEventListener('submit',function(e){e.preventDefault();});
  doc.addEventListener('keydown',function(e){if(e.key==='/'&&!focus&&doc.activeElement!==sInput&&!/input|textarea/i.test((doc.activeElement||{}).tagName||'')){e.preventDefault();sInput.focus();}});
}
function searchLang(){sInput.placeholder=t('search');sInput.setAttribute('aria-label',t('searchLbl'));var hl=$('sHubs');if(hl)hl.textContent=t('hubs');if(sInput.value.trim())renderSuggest();}

/* ---------- rendering ---------- */
function renderAll(){
  if(use2D)render2D();else renderGL();
  if(!stage.classList.contains('ready'))stage.classList.add('ready');
  renderFx();
  renderLabels();
}
function renderLabels(){
  for(var i=0;i<drops.length;i++){
    var d=drops[i],r=d.r0*d.s,vis=d.op>0.04&&d.s>0.25;
    if(d.search){placeSearch(d,r,vis);continue;}
    var fs=clamp(r*0.42,12.5,d.role==='focus'?26:19);
    var st=d.el.style;
    var tr='translate3d('+(d.x).toFixed(1)+'px,'+(d.y).toFixed(1)+'px,0) translate(-50%,-50%)';
    if(d._tr!==tr){st.transform=tr;d._tr=tr;}
    var o=vis?(d.role==='dim'?Math.min(d.op*1.8,0.4):Math.min(1,d.op*1.2)):0;
    var os=o.toFixed(2);if(d._o!==os){st.opacity=os;d._o=os;st.visibility=o<0.02?'hidden':'visible';}
    var fss=fs.toFixed(1);if(d._fs!==fss){st.fontSize=fss+'px';d._fs=fss;st.maxWidth=Math.max(90,r*2.6).toFixed(0)+'px';}
    d.el.tabIndex=(d.role==='gone'||d.role==='hide'||hidden[d.type])?-1:0;
  }
}

/* WebGL metaball watercolor */
var VS='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
var FS=[
'precision highp float;',
'#define NMAX '+NMAX,
'uniform vec2 uRes;uniform float uScale;uniform float uTime;uniform int uN;',
'uniform vec4 uD[NMAX];uniform vec4 uC[NMAX];',
'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
' return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}',
'void main(){',
' vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uScale;',
' float F=0.,op=0.,sel=0.;vec3 col=vec3(0.);',
' float n1=noise(p*0.03+vec2(uTime*0.07,-uTime*0.05));',
' for(int i=0;i<NMAX;i++){',
'  if(i>=uN)break;',
'  vec4 d=uD[i];if(d.z<0.5)continue;',
'  vec2 v=p-d.xy;float R=d.z*1.8;float dd=dot(v,v);if(dd>R*R)continue;',
'  vec4 c=uC[i];float ph=float(i)*2.399;',
'  float dist=sqrt(dd)+1e-3;vec2 u=v/dist;float cx=u.x,sy=u.y;',
'  float c3=4.*cx*cx*cx-3.*cx,s3=3.*sy-4.*sy*sy*sy;',
'  float w=(0.035+0.12*c.w)*(cx*sin(uTime*.9+ph)+sy*cos(uTime*.7+ph*1.3))',
'        +(0.03+0.10*c.w)*(c3*sin(uTime*1.3+ph*2.)+s3*cos(uTime*1.1+ph));',
'  w+=(n1-0.5)*0.16;',
'  float rr=d.z*(1.+w);float q=dist/(rr*1.6);if(q>=1.)continue;',
'  float k=1.-q*q;float f=k*k*k;',
'  F+=f;col+=f*c.rgb;op+=f*d.w;',
' }',
' float pn=noise(p*0.8)*0.55+noise(p*0.19)*0.45;',
' vec3 paper=vec3(0.961,0.929,0.875)*(0.975+0.04*pn);',
' vec2 q2=gl_FragCoord.xy/uRes-0.5;paper*=1.-dot(q2,q2)*0.22;',
' vec3 outc=paper;',
' if(F>0.0005){',
'  vec3 pig=col/F;float o=op/F;',
'  float T=0.227;',
'  float g=noise(p*0.42+17.)*0.6+noise(p*1.6)*0.4;',
'  float inside=smoothstep(T-0.02,T+0.015,F);',
'  float halo=smoothstep(T*0.25,T,F)*(1.-inside);',
'  float core=smoothstep(T,T+0.8,F);',
'  float rim=inside*(1.-smoothstep(T+0.006,T+0.09,F));',
'  float dens=inside*(0.50-0.22*core+0.30*(g-0.5))+rim*0.42+halo*0.10;',
'  dens=clamp(dens*o,0.,1.);',
'  vec3 tint=mix(vec3(1.),pig,dens);',
'  outc=paper*tint;',
'  outc*=1.-rim*o*0.28;',
'  // sepia bloom at wet edges',
'  outc=mix(outc,outc*vec3(0.86,0.8,0.74),halo*o*0.5);',
' }',
' gl_FragColor=vec4(outc,1.);',
'}'].join('\n');
function setupGL(){
  try{gl=inkC.getContext('webgl',{antialias:false,alpha:false,depth:false,stencil:false,premultipliedAlpha:false,powerPreference:'low-power',preserveDrawingBuffer:false});}catch(e){gl=null;}
  if(gl&&gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)<NMAX*2+8)gl=null;
  if(gl){
    var sh=function(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.warn(gl.getShaderInfoLog(s));return null;}return s;};
    var vs=sh(gl.VERTEX_SHADER,VS),fs=sh(gl.FRAGMENT_SHADER,FS);
    if(vs&&fs){prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);
      if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){console.warn(gl.getProgramInfoLog(prog));prog=null;}}
    if(!prog)gl=null;
  }
  if(!gl){use2D=true;html.classList.add('no-webgl');ctx2=inkC.getContext('2d');return;}
  gl.useProgram(prog);
  var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  var loc=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  ['uRes','uScale','uTime','uN','uD','uC'].forEach(function(n){U[n]=gl.getUniformLocation(prog,n);});
  inkC.addEventListener('webglcontextlost',function(e){e.preventDefault();use2D=true;html.classList.add('no-webgl');});
}
var bufD=new Float32Array(NMAX*4),bufC=new Float32Array(NMAX*4);
function renderGL(){
  var n=0;
  for(var i=0;i<drops.length&&n<NMAX;i++){
    var d=drops[i];if(d.s<0.02||d.op<0.01)continue;
    var o=n*4;bufD[o]=d.x;bufD[o+1]=d.y;bufD[o+2]=d.r0*d.s;bufD[o+3]=d.op*(d.g.staple?0.55:1);
    bufC[o]=d.rgb[0];bufC[o+1]=d.rgb[1];bufC[o+2]=d.rgb[2];bufC[o+3]=d.wob;n++;
  }
  gl.uniform2f(U.uRes,inkC.width,inkC.height);gl.uniform1f(U.uScale,inkC.width/W);gl.uniform1f(U.uTime,RM?4.0:time);
  gl.uniform1i(U.uN,n);gl.uniform4fv(U.uD,bufD);gl.uniform4fv(U.uC,bufC);
  gl.drawArrays(gl.TRIANGLES,0,3);
}
/* Canvas-2D fallback: wobbly watercolor blobs */
function rgba(c,a){return 'rgba('+Math.round(c[0]*255)+','+Math.round(c[1]*255)+','+Math.round(c[2]*255)+','+a.toFixed(3)+')';}
function render2D(){
  var c=ctx2,sc=inkC.width/W;c.setTransform(1,0,0,1,0,0);c.fillStyle='#f5eddf';c.fillRect(0,0,inkC.width,inkC.height);
  c.setTransform(sc,0,0,sc,0,0);c.globalCompositeOperation='multiply';
  drops.forEach(function(d,i){
    if(d.s<0.05||d.op<0.02)return;var r=d.r0*d.s,ph=i*2.399,tm=RM?4:time,a=d.op*(d.g.staple?0.55:1);
    c.beginPath();
    for(var k=0;k<=28;k++){var an=k/28*6.283,w=1+(0.04+0.1*d.wob)*Math.sin(an*3+tm*1.2+ph)+0.035*Math.sin(an*5-tm+ph*2);
      var x=d.x+Math.cos(an)*r*w,y=d.y+Math.sin(an)*r*w;if(k)c.lineTo(x,y);else c.moveTo(x,y);}
    var gr=c.createRadialGradient(d.x-r*0.2,d.y-r*0.25,r*0.1,d.x,d.y,r*1.05);
    gr.addColorStop(0,rgba(d.rgb,0.22*a));gr.addColorStop(0.8,rgba(d.rgb,0.42*a));gr.addColorStop(1,rgba(d.rgb,0.62*a));
    c.fillStyle=gr;c.fill();c.lineWidth=1.4;c.strokeStyle=rgba(d.rgb,0.55*a);c.stroke();
  });
  c.globalCompositeOperation='source-over';
}
/* FX layer: ink threads, splatter, selection ring */
function renderFx(){
  var c=fx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,fxC.width,fxC.height);c.setTransform(DPR,0,0,DPR,0,0);
  var tm=RM?0:time;
  if(focus){
    threads.forEach(function(th,i){
      var m=byId[th.to];if(!m||th.p<=0)return;
      var x0=focus.x,y0=focus.y,x1=m.x,y1=m.y,dx=x1-x0,dy=y1-y0,l=Math.sqrt(dx*dx+dy*dy)||1;
      var r0=focus.r0*focus.s*0.92,r1=m.r0*m.s*0.92;if(l<r0+r1+4)return;
      var sx=x0+dx/l*r0,sy=y0+dy/l*r0,ex=x1-dx/l*r1,ey=y1-dy/l*r1;
      var bend=(0.1+0.04*Math.sin(tm*0.8+i*1.7))*l*(i%2?1:-1);
      var cx=(sx+ex)/2-dy/l*bend,cy=(sy+ey)/2+dx/l*bend;
      var w=0.7+4.6*th.score*th.score,N=26,pe=th.p;
      c.lineCap='round';
      for(var k=0;k<N*pe;k++){
        var t0=k/N,t1=Math.min((k+1)/N,pe);
        var ax=(1-t0)*(1-t0)*sx+2*(1-t0)*t0*cx+t0*t0*ex,ay=(1-t0)*(1-t0)*sy+2*(1-t0)*t0*cy+t0*t0*ey;
        var bx=(1-t1)*(1-t1)*sx+2*(1-t1)*t1*cx+t1*t1*ex,by=(1-t1)*(1-t1)*sy+2*(1-t1)*t1*cy+t1*t1*ey;
        var taper=0.55+0.45*Math.sin(Math.PI*(t0*0.8+0.1)); // swelling brush stroke
        c.lineWidth=w*taper*(0.9+0.2*Math.sin(k*1.3+i));
        c.strokeStyle='rgba(84,54,32,'+(0.72*Math.min(1,m.op*1.1)).toFixed(3)+')';
        c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.stroke();
      }
      if(pe>=1){c.fillStyle='rgba(84,54,32,0.65)';c.beginPath();c.arc(ex,ey,Math.max(1.4,w*0.6),0,6.283);c.fill();}
    });
    // selection ring (vermilion, hand-drawn)
    var r=focus.r0*focus.s+7;c.strokeStyle='rgba(178,58,30,0.85)';c.lineWidth=1.6;c.beginPath();
    for(var k=0;k<=48;k++){var an=k/48*6.9-0.3,rr=r*(1+0.03*Math.sin(an*3+tm)+0.018*Math.sin(an*7));
      var x=focus.x+Math.cos(an)*rr,y=focus.y+Math.sin(an)*rr;if(k)c.lineTo(x,y);else c.moveTo(x,y);}
    c.stroke();
  }
  splats.forEach(function(s){c.fillStyle=rgba([s.c[0]*0.7,s.c[1]*0.65,s.c[2]*0.6],0.75*s.a);c.beginPath();
    c.ellipse(s.x,s.y,s.sz,s.sz*s.e,s.rot,0,6.283);c.fill();});
  particles.forEach(function(p){c.fillStyle=rgba([p.c[0]*0.7,p.c[1]*0.65,p.c[2]*0.6],0.85);c.beginPath();
    var sp=Math.sqrt(p.vx*p.vx+p.vy*p.vy),an=Math.atan2(p.vy,p.vx);
    c.ellipse(p.x,p.y,p.sz*(1+sp/400),p.sz*0.8,an,0,6.283);c.fill();});
  shock.forEach(function(s){c.strokeStyle='rgba(178,58,30,'+(0.5*(1-s.t)).toFixed(3)+')';c.lineWidth=2*(1-s.t)+0.5;
    c.beginPath();c.arc(s.x,s.y,s.r*(1+s.t*1.6),0,6.283);c.stroke();});
}

// test hook (headless screenshots)
window.__pairings={warp:function(sec){for(var i=0;i<sec*60;i++)step(1/60);renderAll();},select:select,reset:reset,drops:function(){return drops.map(function(d){return {id:d.id,x:d.x,y:d.y,r:d.r0*d.s,role:d.role};});},gl:function(){return !use2D;}};
})();
