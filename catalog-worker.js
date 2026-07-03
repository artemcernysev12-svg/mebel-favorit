// V41_115 (TBT): парсинг каталога в ФОНОВОМ потоке.
// Главный поток больше не жуёт 2.2МБ JS: воркер скачивает catalog.js как текст,
// вырезает JSON и парсит у себя, отдавая готовый массив через postMessage.
// Формат catalog.js: комментарии → window.CATALOG=[...]; → window.CATALOG_META={...};
self.onmessage = function(e){
  var url = e && e.data && e.data.url;
  if(!url){ self.postMessage({ok:false, error:'no url'}); return; }
  fetch(url)
    .then(function(r){ if(!r.ok) throw new Error('http '+r.status); return r.text(); })
    .then(function(t){
      var K='window.CATALOG=', M='window.CATALOG_META=';
      var i=t.indexOf(K);
      if(i<0) throw new Error('no CATALOG marker');
      var j=t.indexOf(M, i);
      var arrTxt=(j>i ? t.slice(i+K.length, j) : t.slice(i+K.length)).trim();
      if(arrTxt.charAt(arrTxt.length-1)===';') arrTxt=arrTxt.slice(0,-1);
      var catalog=JSON.parse(arrTxt);
      var meta=null;
      if(j>=0){
        var mTxt=t.slice(j+M.length).trim();
        if(mTxt.charAt(mTxt.length-1)===';') mTxt=mTxt.slice(0,-1);
        try{ meta=JSON.parse(mTxt); }catch(_){ meta=null; }
      }
      self.postMessage({ok:true, catalog:catalog, meta:meta});
    })
    .catch(function(err){ self.postMessage({ok:false, error:String(err&&err.message||err)}); });
};
