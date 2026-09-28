/* Quaderno — app-style SPA. Vanilla JS, hash routing, no build step. */
(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s);};
var $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s));};
var reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- storage ---------- */
var LANG_KEY='recipe-lang',LEGACY_LANG='peperonata-lang',FAV_KEY='quaderno-saved',LAST_KEY='quaderno-last-cook';
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
function readLang(){
  var v=lsGet(LANG_KEY);if(v==='it'||v==='en')return v;
  var m=document.cookie.match(/(?:^|; )recipe-lang=(en|it)/);if(m)return m[1];
  v=lsGet(LEGACY_LANG);if(v==='it'||v==='en')return v;
  return 'it';
}
var lang=readLang();
var saved=[];try{saved=JSON.parse(lsGet(FAV_KEY)||'[]')||[];}catch(e){saved=[];}

/* ---------- i18n (UI chrome only; recipe text comes from recipes.json) ---------- */
var UI={
 it:{tabHome:'Home',tabExplore:'Esplora',tabCook:'Cucina',tabSaved:'Salvati',offline:'Offline',
   notebook:'Quaderno di cucina',today:'Ricetta del giorno',open:'Apri la ricetta',seeAll:'Tutte',recipes:'ricette',recipe:'ricetta',
   explore:'Esplora',search:'Cerca per titolo o ingrediente',all:'Tutte',results:function(n){return n===1?'1 ricetta':n+' ricette';},
   noResults:'Nessuna ricetta',noResultsTxt:'Prova con un altro ingrediente o togli un filtro.',reset:'Azzera filtri',
   saved:'Salvati',savedEmpty:'Nessuna ricetta salvata',savedEmptyTxt:'Tocca il cuore su una ricetta per ritrovarla qui, anche offline.',
   goExplore:'Esplora le ricette',cook:'Cucina',cookSub:'Una tavola alla volta, a mani libere.',resume:'Riprendi',plates:function(n){return n+' tavole';},
   steps:function(n){return n+' passi';},stepOf:function(a,b){return 'Passo '+a+' di '+b;},
   ingredients:'Ingredienti',method:'Procedimento',notes:'Note',start:'Inizia a cucinare',close:'Chiudi',save:'Salva',unsave:'Rimuovi dai salvati',
   savedToast:'Salvata nei preferiti',removedToast:'Rimossa dai preferiti',portions:'Porzioni',
   source:'Guarda la fonte',sourceSub:'Video originale',scheda:'Scheda del quaderno',schedaSub:'Pagina originale del catalogo',
   tutorial:'Tutorial illustrato',tutorialSub:'Tutte le tavole su una pagina',credits:'Crediti',
   prev:'Precedente',next:'Avanti',finish:'Fine',bye:'Buon appetito',byeTxt:'Hai completato tutte le tavole.',backRecipe:'Torna alla ricetta',restart:'Ricomincia',
   wake:'Schermo sempre acceso',cover:'Copertina',langLabel:'Lingua',back:'Indietro',noTut:'Nessuna tavola illustrata: passi dalla scheda.',
   installed:'Pronto offline',sections:'Sezioni',categories:'Categorie',inMethod:'Dalla scheda',kitchenNotes:'Note di cucina'},
 en:{tabHome:'Home',tabExplore:'Explore',tabCook:'Cook',tabSaved:'Saved',offline:'Offline',
   notebook:'Kitchen notebook',today:'Recipe of the day',open:'Open recipe',seeAll:'All',recipes:'recipes',recipe:'recipe',
   explore:'Explore',search:'Search by title or ingredient',all:'All',results:function(n){return n===1?'1 recipe':n+' recipes';},
   noResults:'No recipes',noResultsTxt:'Try another ingredient or remove a filter.',reset:'Clear filters',
   saved:'Saved',savedEmpty:'Nothing saved yet',savedEmptyTxt:'Tap the heart on a recipe to keep it here, even offline.',
   goExplore:'Explore recipes',cook:'Cook',cookSub:'One plate at a time, hands free.',resume:'Resume',plates:function(n){return n+' plates';},
   steps:function(n){return n+' steps';},stepOf:function(a,b){return 'Step '+a+' of '+b;},
   ingredients:'Ingredients',method:'Method',notes:'Notes',start:'Start cooking',close:'Close',save:'Save',unsave:'Remove from saved',
   savedToast:'Saved to favourites',removedToast:'Removed from favourites',portions:'Servings',
   source:'Watch the source',sourceSub:'Original video',scheda:'Notebook card',schedaSub:'Original catalogue page',
   tutorial:'Illustrated tutorial',tutorialSub:'All plates on one page',credits:'Credits',
   prev:'Previous',next:'Next',finish:'Finish',bye:'Buon appetito',byeTxt:'You have completed every plate.',backRecipe:'Back to recipe',restart:'Start again',
   wake:'Screen kept awake',cover:'Cover',langLabel:'Language',back:'Back',noTut:'No illustrated plates: steps from the card.',
   installed:'Ready offline',sections:'Sections',categories:'Categories',inMethod:'From the card',kitchenNotes:'Kitchen notes'}
};
function t(k){var v=UI[lang][k];return v;}
function L(o){if(!o)return '';if(typeof o==='string')return o;return o[lang]||o.it||o.en||'';}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,"'");}

/* ---------- icons ---------- */
var IC={
 close:'<svg class="i" viewBox="0 0 24 24"><path d="M6 6.2 18 17.8M18 6.2 6 17.8"/></svg>',
 down:'<svg class="i" viewBox="0 0 24 24"><path d="m5.5 9.2 6.5 6.4 6.5-6.4"/></svg>',
 heart:'<svg class="i" viewBox="0 0 24 24"><path d="M12 19.9s-7.3-4.4-7.3-10.1c0-2.3 1.8-4.1 4-4.1 1.4 0 2.6.7 3.3 1.9.7-1.2 1.9-1.9 3.3-1.9 2.2 0 4 1.8 4 4.1 0 5.7-7.3 10.1-7.3 10.1Z"/></svg>',
 search:'<svg class="i" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.6 15.7 4.6 4.5"/></svg>',
 chev:'<svg class="i" viewBox="0 0 24 24" style="width:20px;height:20px"><path d="m9.2 5.8 6.2 6.2-6.2 6.2"/></svg>',
 left:'<svg class="i" viewBox="0 0 24 24"><path d="M14.8 5.8 8.6 12l6.2 6.2"/></svg>',
 right:'<svg class="i" viewBox="0 0 24 24"><path d="m9.2 5.8 6.2 6.2-6.2 6.2"/></svg>',
 play:'<svg class="i" viewBox="0 0 24 24"><path d="M8.3 5.6v12.8c0 .5.5.8.9.5l9.6-6.4c.4-.3.4-.8 0-1.1L9.2 5.1c-.4-.3-.9 0-.9.5Z"/></svg>',
 video:'<svg class="i" viewBox="0 0 24 24"><rect x="3.2" y="5.8" width="17.6" height="12.4" rx="3"/><path d="m10.4 9.4 4.4 2.6-4.4 2.6Z"/></svg>',
 book:'<svg class="i" viewBox="0 0 24 24"><path d="M4.2 5.4c2.8-.9 5.4-.6 7.8 1v12.4c-2.4-1.6-5-1.9-7.8-1Z"/><path d="M19.8 5.4c-2.8-.9-5.4-.6-7.8 1v12.4c2.4-1.6 5-1.9 7.8-1Z"/></svg>',
 plates:'<svg class="i" viewBox="0 0 24 24"><rect x="3.4" y="4.2" width="17.2" height="11.6" rx="2"/><path d="m3.8 13.2 4.6-4 3.6 3 2.8-2.2 5.4 4.4"/><path d="M7 19.6h10"/></svg>',
 check:'<svg viewBox="0 0 24 24"><path d="m5.5 12.5 4.2 4.1 8.8-9.2"/></svg>',
 empty:'<svg class="i" viewBox="0 0 96 96"><path d="M20 22c14-5 26-3 28 4v52c-3-7-14-9-28-4Z"/><path d="M76 22c-14-5-26-3-28 4v52c3-7 14-9 28-4Z"/><path d="M57 40s-5-3-5-7c0-1.6 1.3-2.9 2.8-2.9 1 0 1.8.5 2.2 1.3.4-.8 1.3-1.3 2.2-1.3 1.6 0 2.8 1.3 2.8 2.9 0 4-5 7-5 7Z"/><path d="M27 36h12M27 44h12M27 52h9M55 52h13M55 60h10"/></svg>'
};

/* ---------- data ---------- */
var DB=null,BY={};
function cover(r){return r.cover?r.cover.src:(r.tutorial&&r.tutorial.steps.length?r.tutorial.steps[r.tutorial.steps.length-1].img.src:'arcimboldo-hero.jpg');}
function title(r){return L(r.title);}
function short(r){return L(r.shortTitle)||L(r.title);}
function srcName(r){return r.section.name;}
function cookSteps(r){
  if(r.tutorial&&r.tutorial.steps.length){
    return r.tutorial.steps.map(function(s){return {text:L(s),img:s.img?s.img.src:null,alt:s.img?s.img.alt:''};});
  }
  var out=[];r.method.forEach(function(b){b.steps.forEach(function(s){out.push({text:(b.title?L(b.title)+' — ':'')+L(s),img:null});});});
  return out;
}
function searchIndex(r){
  if(r._ix)return r._ix;
  var parts=[r.title.it,r.title.en,r.shortTitle&&r.shortTitle.it,r.shortTitle&&r.shortTitle.en,r.subtitle&&r.subtitle.it,r.subtitle&&r.subtitle.en,r.section.name];
  r.ingredients.forEach(function(g){if(g.title){parts.push(g.title.it,g.title.en);}g.items.forEach(function(i){parts.push(i.it,i.en);});});
  r._ix=norm(parts.filter(Boolean).join(' | '));return r._ix;
}
function catLabel(id){var c=DB.categories.filter(function(c){return c.id===id;})[0];return c?L(c.label):id;}

/* ---------- router ---------- */
var TABS=['home','explore','cook','saved'];
var state={tab:'home',sheet:null,cook:null,explore:{q:'',src:'',cat:''}};
var histIdx=0;
function parse(){
  var h=location.hash.replace(/^#\/?/,'');var q='';var qi=h.indexOf('?');
  if(qi>=0){q=h.slice(qi+1);h=h.slice(0,qi);}
  var p=h.split('/').filter(Boolean).map(decodeURIComponent);var params={};
  q.split('&').forEach(function(kv){if(!kv)return;var a=kv.split('=');params[decodeURIComponent(a[0])]=decodeURIComponent(a[1]||'');});
  return {p:p,q:params};
}
function go(path,opts){
  opts=opts||{};
  var url='#'+path;
  if(opts.replace){history.replaceState({idx:histIdx},'',url);}
  else{histIdx++;history.pushState({idx:histIdx},'',url);}
  route();
}
function back(fallback){
  if(history.state&&history.state.idx>0){history.back();}
  else go(fallback||'/'+state.tab,{replace:true});
}
window.addEventListener('popstate',function(e){histIdx=(e.state&&e.state.idx)||0;route();});
window.addEventListener('hashchange',function(){if(!history.state){history.replaceState({idx:histIdx},'',location.hash);route();}});

function route(){
  if(!DB)return;
  var r=parse(),p=r.p;
  var tab=state.tab,sheet=null,cook=null;
  if(!p.length||p[0]==='home')tab='home';
  else if(p[0]==='explore'){tab='explore';var e=state.explore,nq={q:r.q.q||'',src:r.q.src||'',cat:r.q.cat||''};
    if(nq.q!==e.q||nq.src!==e.src||nq.cat!==e.cat){state.explore=nq;renderExplore(true);}}
  else if(p[0]==='saved')tab='saved';
  else if(p[0]==='cook'&&p.length===1)tab='cook';
  else if(p[0]==='r'&&BY[p[1]])sheet=p[1];
  else if(p[0]==='cook'&&BY[p[1]]){cook={slug:p[1],n:Math.max(1,parseInt(p[2],10)||1)};}
  else {go('/home',{replace:true});return;}
  setTab(tab);
  if(cook){
    // keep the recipe sheet underneath if it's the same recipe, so Back lands on it
    if(state.sheet!==cook.slug&&state.sheet)closeSheet(true);
    openCook(cook.slug,cook.n);
  }else{
    closeCook();
    if(sheet)openSheet(sheet);else closeSheet();
  }
  document.body.classList.toggle('covered',!!(state.sheet||state.cook));
}
function setTab(tab){
  var changed=state.tab!==tab;state.tab=tab;
  $$('.tab').forEach(function(a){if(a.dataset.tab===tab)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $$('.screen').forEach(function(s){var on=s.dataset.screen===tab;s.classList.toggle('on',on);s.setAttribute('aria-hidden',on?'false':'true');if('inert' in s)s.inert=!on;});
  if(ink)ink.setActive(tab==='home'&&!state.sheet&&!state.cook);
  if(changed&&tab==='saved')renderSaved();
  if(changed&&tab==='cook')renderCookHub();
}

/* ---------- common bits ---------- */
function langToggle(){
  return '<div class="lang" role="group" aria-label="'+t('langLabel')+'">'+
    '<button type="button" data-lang="it" aria-pressed="'+(lang==='it')+'">IT</button>'+
    '<button type="button" data-lang="en" aria-pressed="'+(lang==='en')+'">EN</button></div>';
}
function isSaved(slug){return saved.indexOf(slug)>=0;}
function heartDot(slug){return isSaved(slug)?'<span class="heart-dot" aria-hidden="true">'+IC.heart+'</span>':'';}
function img(src,alt,cls,eager){return '<img'+(cls?' class="'+cls+'"':'')+' src="'+esc(src)+'" alt="'+esc(alt||'')+'" decoding="async"'+(eager?'':' loading="lazy"')+' draggable="false"/>';}
function toast(msg){var el=$('#toast');el.textContent=msg;el.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(function(){el.classList.remove('on');},1900);}
function updateBadge(){$('#savedBadge').textContent=saved.length?String(saved.length):'';}

/* ---------- HOME ---------- */
var ink=null;
function dayKey(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function recipeOfDay(){
  // deterministic by local date; drawn from recipes whose cover plate is large enough for a full-bleed hero
  var pool=DB.recipes.filter(function(r){return r.cover&&(r.cover.w||0)>=480;});if(!pool.length)pool=DB.recipes;
  var s=dayKey(),h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return pool[h%pool.length];
}
function renderHome(){
  var el=$('#s-home');var rod=recipeOfDay();
  var date=new Date().toLocaleDateString(lang==='it'?'it-IT':'en-GB',{weekday:'long',day:'numeric',month:'long'});
  var h='<header class="home-head"><canvas id="inkcanvas" aria-hidden="true"></canvas>'+
    '<div class="top"><div class="col">'+langToggle()+'</div></div>'+
    '<div class="col"><h1 class="brand" id="h-home"><small>'+esc(t('notebook'))+'</small>Quaderno</h1><div class="home-date">'+esc(date.charAt(0).toUpperCase()+date.slice(1))+'</div></div></header>';
  h+='<div class="col">';
  h+='<button type="button" class="hero" data-open="'+rod.slug+'" aria-label="'+esc(t('today')+': '+title(rod))+'">'+img(cover(rod),rod.cover&&rod.cover.alt,'',true)+
     '<span class="tag">'+esc(t('today'))+'</span><span class="txt"><span class="src">'+esc(srcName(rod))+'</span><h2>'+esc(short(rod))+'</h2>'+
     '<p>'+esc(L(rod.description)||L(rod.subtitle))+'</p><span class="go">'+esc(t('open'))+' '+IC.chev+'</span></span></button>';
  DB.sections.forEach(function(sec){
    var list=DB.recipes.filter(function(r){return r.section.id===sec.id;});
    h+='<div class="row-head"><div><div class="num">'+esc(sec.num)+'</div><h2>'+esc(sec.name)+'</h2><div class="sub">'+list.length+' '+esc(list.length===1?t('recipe'):t('recipes'))+'</div></div>'+
       '<button type="button" class="see-all" data-go="/explore?src='+sec.id+'">'+esc(t('seeAll'))+IC.chev+'</button></div>';
    h+='<div class="rail" role="list">';
    list.forEach(function(r){
      h+='<button type="button" role="listitem" class="rcard" data-open="'+r.slug+'"><div class="ph">'+img(cover(r),'')+heartDot(r.slug)+'</div>'+
         '<div class="t">'+esc(short(r))+'</div><div class="m">'+esc(r.tutorial?t('plates')(r.tutorial.steps.length):t('steps')(cookSteps(r).length))+'</div></button>';
    });
    h+='</div>';
  });
  h+='</div>';
  el.innerHTML=h;
  var c=$('#inkcanvas');
  if(window.QuadernoInk){ink=new window.QuadernoInk(c);ink.setActive(state.tab==='home'&&!state.sheet&&!state.cook);}
}

/* ---------- EXPLORE ---------- */
function exploreFilter(){
  var e=state.explore,q=norm(e.q).trim(),terms=q?q.split(/\s+/):[];
  return DB.recipes.filter(function(r){
    if(e.src&&r.section.id!==e.src)return false;
    if(e.cat&&r.categories.indexOf(e.cat)<0)return false;
    if(terms.length){var ix=searchIndex(r);for(var i=0;i<terms.length;i++)if(ix.indexOf(terms[i])<0)return false;}
    return true;
  });
}
function renderExplore(keepInput){
  var el=$('#s-explore');var e=state.explore;
  if(!keepInput||!$('#q')){
    var h='<div class="appbar"><div class="col"><div><div class="eyebrow">Quaderno</div><h1 id="h-explore">'+esc(t('explore'))+'</h1></div>'+langToggle()+'</div>'+
      '<div class="col stack"><label class="search"><span class="sr">'+esc(t('search'))+'</span><span class="ico">'+IC.search+'</span>'+
      '<input id="q" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="'+esc(t('search'))+'" value="'+esc(e.q)+'"/>'+
      '<button type="button" class="clear" data-clear aria-label="'+esc(t('close'))+'">'+IC.close+'</button></label>'+
      '<div class="chips" id="chips" role="group"></div></div></div>'+
      '<div class="col"><div class="count" id="count" aria-live="polite"></div><div class="grid" id="grid"></div></div>';
    el.innerHTML=h;
    $('#q').addEventListener('input',function(){state.explore.q=this.value;syncExploreHash();renderExploreResults();});
    $('#q').addEventListener('keydown',function(ev){if(ev.key==='Enter')this.blur();});
  }else{ if($('#q').value!==e.q)$('#q').value=e.q; }
  renderChips();renderExploreResults();
}
function renderChips(){
  var e=state.explore;
  var h='<button type="button" class="chip" data-chip="all" aria-pressed="'+(!e.src&&!e.cat)+'">'+esc(t('all'))+'</button>';
  DB.sections.forEach(function(s){h+='<button type="button" class="chip" data-chip="src:'+s.id+'" aria-pressed="'+(e.src===s.id)+'">'+esc(s.name)+'</button>';});
  h+='<span class="chip-sep" aria-hidden="true"></span>';
  DB.categories.forEach(function(c){h+='<button type="button" class="chip" data-chip="cat:'+c.id+'" aria-pressed="'+(e.cat===c.id)+'">'+esc(L(c.label))+'</button>';});
  $('#chips').innerHTML=h;
}
function renderExploreResults(){
  var list=exploreFilter();
  $('#count').textContent=t('results')(list.length);
  if(!list.length){
    $('#grid').innerHTML='<div class="empty" style="grid-column:1/-1">'+IC.empty+'<h2>'+esc(t('noResults'))+'</h2><p>'+esc(t('noResultsTxt'))+'</p><button type="button" class="btn ghost" data-chip="all">'+esc(t('reset'))+'</button></div>';
    return;
  }
  $('#grid').innerHTML=list.map(function(r,i){
    return '<button type="button" class="tile" data-open="'+r.slug+'" style="animation-delay:'+Math.min(i*25,300)+'ms">'+img(cover(r),'')+heartDot(r.slug)+
      '<span class="t"><span class="s">'+esc(srcName(r))+'</span>'+esc(short(r))+'</span></button>';
  }).join('');
}
function syncExploreHash(){
  var e=state.explore,qs=[];if(e.src)qs.push('src='+e.src);if(e.cat)qs.push('cat='+e.cat);if(e.q)qs.push('q='+encodeURIComponent(e.q));
  history.replaceState(history.state,'','#/explore'+(qs.length?'?'+qs.join('&'):''));
}

/* ---------- COOK HUB ---------- */
function renderCookHub(){
  var el=$('#s-cook');var last=null;try{last=JSON.parse(lsGet(LAST_KEY)||'null');}catch(e){}
  var h='<div class="appbar"><div class="col"><div><div class="eyebrow">Quaderno</div><h1 id="h-cook">'+esc(t('cook'))+'</h1></div>'+langToggle()+'</div></div><div class="col"><p class="lead">'+esc(t('cookSub'))+'</p>';
  if(last&&BY[last.slug]){var lr=BY[last.slug],n=cookSteps(lr).length,st=Math.min(last.n,n);
    h+='<button type="button" class="resume" data-go="/cook/'+lr.slug+'/'+st+'">'+img(cover(lr),'')+'<div><div class="k">'+esc(t('resume'))+' · '+esc(t('stepOf')(st,n))+'</div><div class="t">'+esc(short(lr))+'</div></div><span class="play">'+IC.play+'</span></button>';}
  DB.sections.forEach(function(sec){
    h+='<div class="group-label">'+esc(sec.num+' · '+sec.name)+'</div><div class="list">';
    DB.recipes.filter(function(r){return r.section.id===sec.id;}).forEach(function(r){
      var n=cookSteps(r).length;
      h+='<button type="button" class="lrow" data-go="/cook/'+r.slug+'/1" aria-label="'+esc(t('start')+': '+short(r))+'">'+img(cover(r),'')+'<div><div class="t">'+esc(short(r))+'</div><div class="m">'+esc(r.tutorial?t('plates')(n):t('steps')(n))+'</div></div><span class="play">'+IC.play+'</span></button>';
    });
    h+='</div>';
  });
  el.innerHTML=h+'</div>';
}

/* ---------- SAVED ---------- */
function renderSaved(){
  var el=$('#s-saved');var list=saved.map(function(s){return BY[s];}).filter(Boolean);
  var h='<div class="appbar"><div class="col"><div><div class="eyebrow">Quaderno</div><h1 id="h-saved">'+esc(t('saved'))+'</h1></div>'+langToggle()+'</div></div><div class="col">';
  if(!list.length){
    h+='<div class="empty">'+IC.empty+'<h2>'+esc(t('savedEmpty'))+'</h2><p>'+esc(t('savedEmptyTxt'))+'</p><button type="button" class="btn" data-go="/explore">'+esc(t('goExplore'))+'</button></div>';
  }else{
    h+='<div class="count">'+esc(t('results')(list.length))+'</div><div class="grid">'+list.map(function(r,i){
      return '<button type="button" class="tile" data-open="'+r.slug+'" style="animation-delay:'+Math.min(i*25,300)+'ms">'+img(cover(r),'')+
        '<span class="t"><span class="s">'+esc(srcName(r))+'</span>'+esc(short(r))+'</span></button>';}).join('')+'</div>';
  }
  el.innerHTML=h+'</div>';
}
function toggleSave(slug,btn){
  var i=saved.indexOf(slug);if(i>=0)saved.splice(i,1);else saved.unshift(slug);
  lsSet(FAV_KEY,JSON.stringify(saved));updateBadge();
  toast(i>=0?t('removedToast'):t('savedToast'));
  if(btn){btn.classList.toggle('saved',i<0);btn.setAttribute('aria-pressed',String(i<0));btn.setAttribute('aria-label',i<0?t('unsave'):t('save'));
    btn.classList.remove('pulse');void btn.offsetWidth;btn.classList.add('pulse');}
  if(navigator.vibrate&&i<0)try{navigator.vibrate(8);}catch(e){}
  renderSaved();refreshHearts();
}
function refreshHearts(){
  $$('[data-open]').forEach(function(b){
    var ph=b.classList.contains('rcard')?$('.ph',b):(b.classList.contains('tile')&&b.closest('#s-explore')?b:null);if(!ph)return;
    var d=$('.heart-dot',ph);if(isSaved(b.dataset.open)&&!d)ph.insertAdjacentHTML('beforeend',heartDot(b.dataset.open));else if(!isSaved(b.dataset.open)&&d)d.remove();
  });
}

/* ---------- RECIPE SHEET ---------- */
var sheetTab=0,servings=null,lastFocus=null;
function scaleText(s,factor){
  if(factor===1)return s;
  return s.replace(/(\d+(?:[.,]\d+)?)(\s*[–-]\s*(\d+(?:[.,]\d+)?))?/g,function(m,a,rng,b){
    function f(x){var v=parseFloat(x.replace(',','.'))*factor;return (Math.round(v*10)/10).toString().replace('.',lang==='it'?',':'.');}
    return f(a)+(rng?'–'+f(b):'');
  });
}
function openSheet(slug){
  var el=$('#sheet');
  if(state.sheet===slug&&el.classList.contains('on'))return;
  var r=BY[slug];if(!r)return;
  if(state.sheet!==slug){sheetTab=0;servings=r.servings;}
  state.sheet=slug;lastFocus=lastFocus||document.activeElement;
  renderSheet();
  el.setAttribute('aria-hidden','false');$('#scrim').classList.add('on');
  requestAnimationFrame(function(){el.classList.add('on');});
  $('.sheet-scroll',el).scrollTop=0;
  setTimeout(function(){var b=$('[data-close-sheet]',el);if(b)b.focus({preventScroll:true});},60);
  if(ink)ink.setActive(false);
  $('#app').inert=true;$('#tabbar').inert=true;
}
function renderSheet(keepScroll){
  var el=$('#sheet'),r=BY[state.sheet];if(!r)return;
  var sc=$('.sheet-scroll',el),top=keepScroll&&sc?sc.scrollTop:0;
  var sv=isSaved(r.slug);
  var h='<div class="sh-bar"><button type="button" class="icon-btn" data-close-sheet aria-label="'+esc(t('close'))+'">'+IC.down+'</button>'+
    '<div class="ttl" aria-hidden="true">'+esc(short(r))+'</div>'+langToggle().replace('class="lang"','class="lang" style="transform:scale(.9)"')+
    '<button type="button" class="icon-btn'+(sv?' saved':'')+'" data-save="'+r.slug+'" aria-pressed="'+sv+'" aria-label="'+esc(sv?t('unsave'):t('save'))+'">'+IC.heart+'</button></div>';
  h+='<div class="sheet-scroll"><div class="sh-hero'+(r.cover&&(r.cover.w||0)<400?' lowres':'')+'"><span class="grab" aria-hidden="true"></span>'+img(cover(r),r.cover&&r.cover.alt,'',true)+'</div><div class="sh-body"><div class="col">';
  h+='<div class="kicker">'+esc(L(r.kicker)||srcName(r))+'</div><h1 id="sh-title" class="selectable">'+esc(title(r))+'</h1>';
  if(r.subtitle)h+='<p class="subt">'+esc(L(r.subtitle))+'</p>';
  var desc=L(r.intro)||L(r.description);if(desc)h+='<p class="desc selectable">'+esc(desc)+'</p>';
  if(r.meta&&r.meta.length)h+='<div class="meta">'+r.meta.map(function(m){return '<span>'+esc(L(m))+'</span>';}).join('')+'</div>';
  h+='<div class="seg" role="tablist" style="--seg:'+sheetTab+'"><span class="ind" aria-hidden="true"></span>'+
    [t('ingredients'),t('method'),t('notes')].map(function(lbl,i){return '<button type="button" role="tab" id="tab-'+i+'" aria-controls="pn-'+i+'" aria-selected="'+(i===sheetTab)+'" data-seg="'+i+'">'+esc(lbl)+'</button>';}).join('')+'</div>';
  // ingredients
  var factor=(r.scalable&&servings&&r.servings)?servings/r.servings:1;
  h+='<div class="panel selectable" role="tabpanel" id="pn-0" aria-labelledby="tab-0"'+(sheetTab===0?'':' hidden')+'>';
  if(r.scalable)h+='<div class="stepper"><span>'+esc(t('portions'))+'</span><div class="ctl"><button type="button" data-serv="-1" aria-label="−">−</button><output aria-live="polite">'+servings+'</output><button type="button" data-serv="1" aria-label="+">+</button></div></div>';
  if(r.servingNote)h+='<p class="caption">'+esc(L(r.servingNote))+'</p>';
  r.ingredients.forEach(function(g,gi){
    h+='<div class="ig">'+(g.title?'<h3>'+esc(L(g.title))+'</h3>':'')+(g.intro?'<p class="gi">'+esc(L(g.intro))+'</p>':'')+'<ul>';
    g.items.forEach(function(it,ii){var id=r.slug+':'+gi+':'+ii;var done=checked[id];
      h+='<li><button type="button" class="ing'+(done?' done':'')+'" data-ing="'+id+'" aria-pressed="'+!!done+'"><span class="box">'+IC.check+'</span><span class="txt">'+esc(scaleText(L(it),factor))+'</span></button></li>';});
    h+='</ul>'+(g.note?'<p class="gi" style="margin-top:8px">'+esc(L(g.note))+'</p>':'')+'</div>';
  });
  h+='</div>';
  // method
  h+='<div class="panel selectable" role="tabpanel" id="pn-1" aria-labelledby="tab-1"'+(sheetTab===1?'':' hidden')+'>';
  r.method.forEach(function(b){
    h+='<div class="mblock">'+(b.title?'<h3>'+esc(L(b.title))+'</h3>':'')+(b.intro?'<p class="caption">'+esc(L(b.intro))+'</p>':'');
    b.steps.forEach(function(s,i){h+='<div class="mstep"><span class="n">'+(i+1)+'</span><p>'+esc(L(s))+'</p></div>';});
    h+='</div>';
  });
  h+='</div>';
  // notes
  h+='<div class="panel" role="tabpanel" id="pn-2" aria-labelledby="tab-2"'+(sheetTab===2?'':' hidden')+'>';
  if(r.techNote)h+='<p class="caption selectable">'+esc(L(r.techNote))+'</p>';
  if(r.notes.length)h+='<ul class="notes selectable">'+r.notes.map(function(n){return '<li>'+esc(L(n))+'</li>';}).join('')+'</ul>';
  if(r.source&&r.source.url)h+='<button type="button" class="card-row" data-ext="'+esc(r.source.url)+'"><span class="ic">'+IC.video+'</span><span><span class="l">'+esc(t('source'))+'</span><span class="s" style="display:block">'+esc(L(r.source.label))+'</span></span><span class="chev">'+IC.chev+'</span></button>';
  if(r.tutorial)h+='<button type="button" class="card-row" data-page="'+esc(r.tutorial.page)+'"><span class="ic">'+IC.plates+'</span><span><span class="l">'+esc(t('tutorial'))+'</span><span class="s" style="display:block">'+esc(t('tutorialSub'))+'</span></span><span class="chev">'+IC.chev+'</span></button>';
  h+='<button type="button" class="card-row" data-page="'+esc(r.schedaPage)+'"><span class="ic">'+IC.book+'</span><span><span class="l">'+esc(t('scheda'))+'</span><span class="s" style="display:block">'+esc(t('schedaSub'))+'</span></span><span class="chev">'+IC.chev+'</span></button>';
  if(r.credits)h+='<p class="credits selectable"><b>'+esc(t('credits'))+'.</b> '+esc(L(r.credits))+'</p>';
  h+='</div>';
  h+='</div></div></div>';
  h+='<div class="sh-cta"><div class="col" style="padding:0"><button type="button" class="btn accent" data-go="/cook/'+r.slug+'/1">'+IC.play+' '+esc(t('start'))+'</button></div></div>';
  el.innerHTML=h;el.setAttribute('aria-labelledby','sh-title');
  sc=$('.sheet-scroll',el);sc.scrollTop=top;
  sc.addEventListener('scroll',onSheetScroll,{passive:true});onSheetScroll.call(sc);
  bindSheetDrag(el,sc);
}
var checked={};
function onSheetScroll(){
  var sc=this,hero=$('.sh-hero',sc);if(!hero)return;var hh=hero.offsetHeight||1;
  var p=Math.max(0,Math.min(1,sc.scrollTop/hh));
  hero.style.setProperty('--p',p.toFixed(3));
  var bar=$('#sheet .sh-bar');bar.style.setProperty('--bar',Math.max(0,Math.min(1,(sc.scrollTop-hh*.55)/(hh*.3))).toFixed(3));
}
function bindSheetDrag(el,sc){
  // pull-down-to-dismiss from the hero when scrolled to top
  var y0=null,dy=0,active=false;
  sc.addEventListener('touchstart',function(e){if(sc.scrollTop<=0){y0=e.touches[0].clientY;dy=0;active=false;}else y0=null;},{passive:true});
  sc.addEventListener('touchmove',function(e){if(y0==null)return;dy=e.touches[0].clientY-y0;
    if(dy>6&&sc.scrollTop<=0){active=true;el.classList.add('dragging');el.style.transform='translateY('+(dy*.8)+'px)';}},{passive:true});
  sc.addEventListener('touchend',function(){if(!active){y0=null;return;}el.classList.remove('dragging');el.style.transform='';
    if(dy>120)back('/'+state.tab);y0=null;active=false;},{passive:true});
}
function closeSheet(silent){
  var el=$('#sheet');if(!state.sheet)return;
  state.sheet=null;el.classList.remove('on');el.setAttribute('aria-hidden','true');$('#scrim').classList.remove('on');
  $('#app').inert=false;$('#tabbar').inert=false;
  if(ink)ink.setActive(state.tab==='home'&&!state.cook);
  if(!silent&&lastFocus&&document.contains(lastFocus))try{lastFocus.focus({preventScroll:true});}catch(e){}
  lastFocus=null;
}
function setSeg(i){
  var el=$('#sheet');var old=sheetTab;sheetTab=i;
  $('.seg',el).style.setProperty('--seg',i);
  $$('.seg button',el).forEach(function(b,j){b.setAttribute('aria-selected',String(j===i));});
  $$('.panel',el).forEach(function(p,j){p.hidden=j!==i;if(j===i)p.style.setProperty('--dir',i>old?1:-1);});
  var sc=$('.sheet-scroll',el),seg=$('.seg',el);
  var segTop=seg.offsetTop+seg.offsetParent.offsetTop;
  if(sc.scrollTop>segTop-70)sc.scrollTop=segTop-70;
}

/* ---------- COOK MODE ---------- */
var ck={slug:null,i:0,steps:[],wake:null};
function openCook(slug,n){
  var el=$('#cookmode');var r=BY[slug];
  var fresh=ck.slug!==slug||!el.classList.contains('on');
  ck.slug=slug;ck.steps=cookSteps(r);
  var total=ck.steps.length;var idx=Math.min(n,total+1)-1;
  state.cook=slug;
  if(fresh){renderCook(r);el.setAttribute('aria-hidden','false');requestAnimationFrame(function(){el.classList.add('on');});
    setTimeout(function(){var b=$('[data-close-cook]',el);if(b)b.focus({preventScroll:true});},60);
    requestWake();document.body.classList.add('cooking');$('#app').inert=true;$('#tabbar').inert=true;$('#sheet').inert=true;}
  setCookIndex(idx,!fresh);
  if(ink)ink.setActive(false);
}
function renderCook(r){
  var el=$('#cookmode');var total=ck.steps.length;
  var h='<div class="ck-top"><button type="button" class="icon-btn" data-close-cook aria-label="'+esc(t('close'))+'">'+IC.close+'</button>'+
    '<div class="ttl"><b>'+esc(short(r))+'</b><span id="ck-count"></span></div>'+langToggle().replace('class="lang"','class="lang" style="transform:scale(.9)"')+'</div>';
  h+='<div class="dots" aria-hidden="true">'+ck.steps.map(function(){return '<i></i>';}).join('')+'</div>';
  h+='<div class="wake" id="wake"><i></i>'+esc(t('wake'))+'</div>';
  h+='<div class="ck-view" id="ck-view"><div class="ck-track" id="ck-track">';
  ck.steps.forEach(function(s,i){
    h+='<article class="slide" aria-roledescription="slide" aria-label="'+esc(t('stepOf')(i+1,total))+'">'+
      (s.img?'<div class="plate">'+img(s.img,s.alt,'',i<2)+'</div>':'<div class="plate'+(r.cover?'':' noimg')+'">'+(r.cover?img(cover(r),'',''):'<span>'+(i+1)+'</span>')+'</div>')+
      '<div class="body"><div class="sn">'+esc(t('stepOf')(i+1,total))+'</div><p class="stx selectable">'+esc(s.text)+'</p></div></article>';
  });
  h+='<article class="slide fin"><div class="plate">'+img(cover(r),'','')+'</div><h2>'+esc(t('bye'))+'</h2><p>'+esc(t('byeTxt'))+'</p>'+
     '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button type="button" class="btn accent" data-back-recipe>'+esc(t('backRecipe'))+'</button><button type="button" class="btn ghost" data-restart>'+esc(t('restart'))+'</button></div></article>';
  h+='</div></div>';
  h+='<div class="ck-nav"><button type="button" class="btn ghost prev" data-ck="-1" aria-label="'+esc(t('prev'))+'">'+IC.left+'</button>'+
     '<button type="button" class="btn next" data-ck="1"><span id="ck-next-l">'+esc(t('next'))+'</span>'+IC.right+'</button></div>';
  el.innerHTML=h;bindSwipe();
}
function setCookIndex(i,animate){
  var total=ck.steps.length;i=Math.max(0,Math.min(total,i));ck.i=i;
  var tr=$('#ck-track');if(!tr)return;
  if(!animate)tr.classList.add('drag');
  tr.style.transform='translateX('+(-i*100)+'%)';
  if(!animate){void tr.offsetWidth;tr.classList.remove('drag');}
  $$('#cookmode .dots i').forEach(function(d,j){d.className=j<i?'done':(j===i?'cur':'');});
  $('#ck-count').textContent=i<total?t('stepOf')(i+1,total):t('bye');
  var prev=$('[data-ck="-1"]'),next=$('[data-ck="1"]');
  prev.disabled=i===0;next.style.visibility=i>=total?'hidden':'visible';
  $('#ck-next-l').textContent=i===total-1?t('finish'):t('next');
  $$('#ck-track .slide').forEach(function(s,j){s.setAttribute('aria-hidden',String(j!==i));if('inert' in s)s.inert=j!==i;var b=$('.body',s);if(b&&j!==i)b.scrollTop=0;});
  if(i<total)lsSet(LAST_KEY,JSON.stringify({slug:ck.slug,n:i+1}));
  else{try{localStorage.removeItem(LAST_KEY);}catch(e){}}
  // keep URL in sync without adding history entries (Back returns to the recipe)
  var want='#/cook/'+ck.slug+'/'+(i+1);if(location.hash!==want)history.replaceState(history.state,'',want);
  // preload next plate
  var nx=ck.steps[i+1];if(nx&&nx.img){var im=new Image();im.src=nx.img;}
}
function cookStep(d){
  var total=ck.steps.length;var n=ck.i+d;if(n<0||n>total)return;
  setCookIndex(n,true);
}
function bindSwipe(){
  var view=$('#ck-view'),tr=$('#ck-track');var x0=0,y0=0,dx=0,dragging=false,decided=false,t0=0,pid=null;
  view.addEventListener('pointerdown',function(e){if(e.button&&e.button!==0)return;if(e.target.closest('button'))return;
    x0=e.clientX;y0=e.clientY;dx=0;dragging=true;decided=false;t0=performance.now();pid=e.pointerId;});
  view.addEventListener('pointermove',function(e){
    if(!dragging||e.pointerId!==pid)return;var mx=e.clientX-x0,my=e.clientY-y0;
    if(!decided){if(Math.abs(mx)<8&&Math.abs(my)<8)return;decided=true;if(Math.abs(my)>Math.abs(mx)){dragging=false;return;}
      tr.classList.add('drag');try{view.setPointerCapture(pid);}catch(_){}}
    dx=mx;var w=view.offsetWidth;var total=ck.steps.length;
    if((ck.i===0&&dx>0)||(ck.i===total&&dx<0))dx*=.3;
    tr.style.transform='translateX(calc('+(-ck.i*100)+'% + '+dx+'px))';
  });
  function end(){
    if(!dragging)return;dragging=false;if(!decided)return;tr.classList.remove('drag');
    var w=view.offsetWidth,v=dx/Math.max(1,performance.now()-t0);
    if(dx<-w*.22||v<-.45)cookStep(1);else if(dx>w*.22||v>.45)cookStep(-1);else setCookIndex(ck.i,true);
  }
  view.addEventListener('pointerup',end);view.addEventListener('pointercancel',end);
}
function closeCook(){
  var el=$('#cookmode');if(!state.cook)return;
  state.cook=null;el.classList.remove('on');el.setAttribute('aria-hidden','true');releaseWake();document.body.classList.remove('cooking');
  $('#sheet').inert=false;
  if(!state.sheet){$('#app').inert=false;$('#tabbar').inert=false;}
  if(state.tab==='cook')renderCookHub();
}
function requestWake(){
  if(!('wakeLock' in navigator))return;
  navigator.wakeLock.request('screen').then(function(l){ck.wake=l;var w=$('#wake');if(w)w.classList.add('on');
    l.addEventListener('release',function(){var w=$('#wake');if(w)w.classList.remove('on');});}).catch(function(){});
}
function releaseWake(){if(ck.wake){try{ck.wake.release();}catch(e){}ck.wake=null;}}
document.addEventListener('visibilitychange',function(){if(!document.hidden&&state.cook&&!ck.wake)requestWake();if(document.hidden)ck.wake=null;});

/* ---------- language ---------- */
function setLang(l){
  if(l!=='it'&&l!=='en'||l===lang)return;lang=l;document.documentElement.lang=l;
  lsSet(LANG_KEY,l);try{document.cookie=LANG_KEY+'='+l+';path=/;max-age=31536000';}catch(e){}
  applyChrome();
  var hs=$('#s-home').scrollTop;renderHome();$('#s-home').scrollTop=hs;
  renderExplore();renderCookHub();renderSaved();
  if(state.sheet)renderSheet(true);
  if(state.cook){var r=BY[state.cook];renderCook(r);setCookIndex(ck.i,false);if(ck.wake)$('#wake').classList.add('on');}
  var b=$('[data-lang="'+l+'"]',state.cook?$('#cookmode'):state.sheet?$('#sheet'):$('.screen.on'));if(b)b.focus({preventScroll:true});
}
function applyChrome(){
  $$('[data-i18n]').forEach(function(e){e.textContent=t(e.dataset.i18n);});
  $('#tabbar').setAttribute('aria-label',t('sections'));
}

/* ---------- global events ---------- */
document.addEventListener('click',function(e){
  var a;
  if((a=e.target.closest('.tab'))){e.preventDefault();var tb=a.dataset.tab;
    if(tb===state.tab){var s=$('#s-'+tb);s.scrollTo({top:0,behavior:reduceMotion?'auto':'smooth'});}
    go('/'+tb,{replace:true});return;}
  if((a=e.target.closest('[data-lang]'))){setLang(a.dataset.lang);return;}
  if((a=e.target.closest('[data-open]'))){go('/r/'+a.dataset.open);return;}
  if((a=e.target.closest('[data-go]'))){var g=a.dataset.go;
    if(g.indexOf('/explore')===0){var qq=g.split('?')[1]||'';var src=(qq.match(/src=([^&]+)/)||[])[1]||'';state.explore={q:'',src:src,cat:''};renderExplore();go(g,{replace:!state.sheet});return;}
    if(g.indexOf('/cook/')===0&&state.cook){go(g,{replace:true});return;}
    go(g);return;}
  if((a=e.target.closest('[data-chip]'))){var c=a.dataset.chip,ex=state.explore;
    if(c==='all'){ex.src='';ex.cat='';ex.q='';var qi=$('#q');if(qi)qi.value='';}
    else if(c.indexOf('src:')===0){var v=c.slice(4);ex.src=ex.src===v?'':v;}
    else if(c.indexOf('cat:')===0){var v2=c.slice(4);ex.cat=ex.cat===v2?'':v2;}
    renderChips();renderExploreResults();syncExploreHash();return;}
  if((a=e.target.closest('[data-clear]'))){state.explore.q='';$('#q').value='';$('#q').focus();renderExploreResults();syncExploreHash();return;}
  if((a=e.target.closest('[data-close-sheet]'))){back('/'+state.tab);return;}
  if(e.target===$('#scrim')){back('/'+state.tab);return;}
  if((a=e.target.closest('[data-save]'))){toggleSave(a.dataset.save,a);return;}
  if((a=e.target.closest('[data-seg]'))){setSeg(+a.dataset.seg);return;}
  if((a=e.target.closest('[data-ing]'))){var id=a.dataset.ing;checked[id]=!checked[id];a.classList.toggle('done',checked[id]);a.setAttribute('aria-pressed',String(checked[id]));return;}
  if((a=e.target.closest('[data-serv]'))){var r=BY[state.sheet];servings=Math.max(1,Math.min(24,servings+(+a.dataset.serv)));renderSheet(true);return;}
  if((a=e.target.closest('[data-ext]'))){window.open(a.dataset.ext,'_blank','noopener');return;}
  if((a=e.target.closest('[data-page]'))){location.href=a.dataset.page;return;}
  if((a=e.target.closest('[data-close-cook]'))){closeCookNav();return;}
  if((a=e.target.closest('[data-back-recipe]'))){closeCookNav();return;}
  if((a=e.target.closest('[data-restart]'))){setCookIndex(0,true);return;}
  if((a=e.target.closest('[data-ck]'))){cookStep(+a.dataset.ck);return;}
});
function closeCookNav(){
  // Back to the recipe sheet if it is underneath; otherwise open it.
  var slug=state.cook;
  if(state.sheet===slug&&history.state&&history.state.idx>0)history.back();
  else go('/r/'+slug,{replace:true});
}
document.addEventListener('keydown',function(e){
  if(state.cook){
    if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();cookStep(1);}
    else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();cookStep(-1);}
    else if(e.key==='Escape'){e.preventDefault();closeCookNav();}
    return;
  }
  if(state.sheet&&e.key==='Escape'){e.preventDefault();back('/'+state.tab);return;}
  if(state.sheet&&(e.key==='ArrowRight'||e.key==='ArrowLeft')&&e.target.closest&&e.target.closest('.seg')){
    e.preventDefault();var n=(sheetTab+(e.key==='ArrowRight'?1:2))%3;setSeg(n);$('#tab-'+n).focus();}
  if(e.key==='/'&&state.tab==='explore'&&document.activeElement!==$('#q')){e.preventDefault();$('#q').focus();}
});
window.addEventListener('online',function(){document.body.classList.remove('offline');});
window.addEventListener('offline',function(){document.body.classList.add('offline');});

/* ---------- boot ---------- */
function boot(data){
  DB=data;DB.recipes.forEach(function(r){BY[r.slug]=r;});
  document.documentElement.lang=lang;
  applyChrome();updateBadge();
  renderHome();renderExplore();renderCookHub();renderSaved();
  if(!history.state)history.replaceState({idx:0},'',location.hash||'#/home');
  histIdx=history.state.idx||0;
  // Deep link straight into a recipe/cook: seed a Home entry underneath so Back stays inside the app.
  var p=parse().p;
  if(histIdx===0&&(p[0]==='r'||(p[0]==='cook'&&p[1]))){
    var target=location.hash;history.replaceState({idx:0},'','#/home');histIdx=1;
    if(p[0]==='cook'){history.pushState({idx:1},'','#/r/'+p[1]);histIdx=2;history.pushState({idx:2},'',target);}
    else history.pushState({idx:1},'',target);
  }
  route();
  if(!navigator.onLine)document.body.classList.add('offline');
  var b=$('#boot');b.classList.add('gone');setTimeout(function(){b.remove();},500);
}
fetch('data/recipes.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(boot).catch(function(err){
  console.error('[quaderno] recipes.json',err);
  if('caches' in window)caches.match('data/recipes.json').then(function(r){return r?r.json():Promise.reject();}).then(boot).catch(function(){
    $('#boot').innerHTML='<div class="empty"><h2>Quaderno</h2><p>'+esc(t('offline'))+'</p></div>';});
});

/* ---------- service worker ---------- */
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('sw.js',{scope:'./'}).then(function(reg){
      window.__swReg=reg;
      navigator.serviceWorker.addEventListener('message',function(e){if(e.data&&e.data.type==='precached')toast(t('installed'));});
    }).catch(function(e){console.warn('[quaderno] sw',e);});
  });
}
})();
