/* Quaderno app service worker. Scope: the folder it is served from (/quaderno-catalog/).
   Only handles requests that belong to the app (shell, data, fonts, icons, images);
   every other page of the static site is left to the network untouched. */
var VERSION='quaderno-app-v4'; // v2: drops caches that pinned data/pairings.json (cache-first) before the compound rebuild
var SHELL=['app.html','css/app.css','js/app.js','js/app-ink.js','data/recipes.json','manifest.webmanifest',
  'fonts/cormorant-garamond.woff2','fonts/cormorant-garamond-italic.woff2','fonts/inter.woff2',
  'icons/icon-192.png','icons/maskable-192.png','icons/apple-touch-icon.png','icons/favicon-32.png','arcimboldo-hero.jpg'];
var BASE=new URL('./',self.location).href;

function isApp(url){
  if(url.indexOf(BASE)!==0)return false;
  var p=url.slice(BASE.length).split('?')[0].split('#')[0];
  return p===''||p==='app.html'||p==='css/app.css'||/^js\/app(-ink)?\.js$/.test(p)||p==='manifest.webmanifest'||
    /^(data|fonts|icons|steps)\//.test(p)||/^[^\/]+\.(jpg|jpeg|png|webp)$/.test(p);
}

self.addEventListener('install',function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){
    return c.addAll(SHELL).then(function(){
      // then every recipe image referenced in recipes.json (covers + Leonardo plates)
      return c.match('data/recipes.json').then(function(r){return r.json();}).then(function(d){
        var set={};d.recipes.forEach(function(r){if(r.cover)set[r.cover.src]=1;(r.tutorial?r.tutorial.steps:[]).forEach(function(s){if(s.img)set[s.img.src]=1;});});
        return Promise.all(Object.keys(set).map(function(u){return c.match(u).then(function(hit){return hit||c.add(u).catch(function(){});});}));
      });
    });
  }).then(function(){return self.skipWaiting();}));
});

self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k.indexOf('quaderno-app-')===0&&k!==VERSION;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}).then(function(){
    return self.clients.matchAll({type:'window'}).then(function(cs){cs.forEach(function(c){c.postMessage({type:'precached',version:VERSION});});});
  }));
});

self.addEventListener('fetch',function(e){
  var req=e.request;if(req.method!=='GET')return;
  var url=req.url;
  if(req.mode==='navigate'){
    var p=url.slice(BASE.length).split('?')[0].split('#')[0];
    if(url.indexOf(BASE)!==0||(p!=='app.html'))return; // other site pages: network only, untouched
    e.respondWith(fetch(req).then(function(res){var cp=res.clone();caches.open(VERSION).then(function(c){c.put('app.html',cp);});return res;})
      .catch(function(){return caches.match('app.html');}));
    return;
  }
  if(!isApp(url))return;
  var path=url.slice(BASE.length).split('?')[0];
  if(path==='data/recipes.json'||/^data\/(pairings[^\/]*|ing-index|compounds)\.json$/.test(path)||/^data\/ing\/[a-z0-9-]+\.json$/.test(path)||path==='js/app.js'||path==='css/app.css'||path==='js/app-ink.js'){
    // network-first so content/app updates land quickly; cache when offline
    e.respondWith(fetch(req).then(function(res){if(res.ok){var cp=res.clone();caches.open(VERSION).then(function(c){c.put(path,cp);});}return res;})
      .catch(function(){return caches.match(path);}));
    return;
  }
  // images, fonts, icons: cache-first, fill on miss
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(function(hit){
    return hit||fetch(req).then(function(res){if(res.ok){var cp=res.clone();caches.open(VERSION).then(function(c){c.put(req,cp);});}return res;});
  }));
});
