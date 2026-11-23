// WK LV As-Built (Nyanza) — offline app shell. Bump CACHE on every release.
var CACHE='wklv-nyz-v15';
var ASSETS=['./','./index.html','./app.js','./tracker.html','./manifest.webmanifest',
  './nyanza-transformers.js','./nyanza-villages.js','./nyanza-customers.js',
  './exceljs.min.js','./jszip.min.js','./zxing.min.js','./nyanza-template.xlsx',
  './leaflet/leaflet.js','./leaflet/leaflet.css','./leaflet/images/layers.png','./leaflet/images/layers-2x.png',
  './leaflet/images/marker-icon.png','./leaflet/images/marker-icon-2x.png','./leaflet/images/marker-shadow.png',
  './icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./favicon-32.png','./logo-mark.png'];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ASSETS);}).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){return k.indexOf('wklv-nyz')===0&&k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});
self.addEventListener('fetch',function(e){
  if(e.request.method!=='GET') return;
  // Only our own files. Satellite tiles go to the network (the app keeps its own offline tile store).
  if(new URL(e.request.url).origin!==self.location.origin) return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(function(r){
    return r || fetch(e.request).then(function(resp){
      var copy=resp.clone();
      caches.open(CACHE).then(function(c){ try{c.put(e.request,copy);}catch(err){} });
      return resp;
    }).catch(function(){ return caches.match('./index.html'); });
  }));
});
