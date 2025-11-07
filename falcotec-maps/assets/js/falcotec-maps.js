(() => {
  const bootQueue = (window.FalcotecMapsBoot || []);
  const VARS = window.FALCOTEC_MAPS_VARS || {};
  const API_KEY = VARS.apiKey || "";

  function ensureGoogle(cb){
    if (window.google && window.google.maps) { cb(); return; }
    if (!API_KEY) { console.warn('[Falcotec Maps] API key ausente em Configurações.'); cb(); return; }
    const id = 'falcotec-google-maps';
    if (document.getElementById(id)) {
      window.__falcotecReady = window.__falcotecReady || [];
      window.__falcotecReady.push(cb);
      return;
    }
    window.__falcotecReady = window.__falcotecReady || [];
    window.__falcotecReady.push(cb);

    const s = document.createElement('script');
    s.id = id;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}&libraries=places&callback=__falcotecMapsReady`;
    s.async = true; s.defer = true;
    window.__falcotecMapsReady = () => {
      (window.__falcotecReady || []).forEach(fn => { try{ fn(); }catch(e){} });
      window.__falcotecReady = [];
    };
    document.head.appendChild(s);
  }

  const H = {
    haversine(lat1, lon1, lat2, lon2){
      const R = 6371, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
      return R*(2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    },
    esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
    toast(el,msg){ el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2400); }
  };

  function initInstance(cfg){
    const { uid, initialRadius, type, keyword } = cfg;
    const wrap = document.querySelector(`.fmp-wrapper[data-uid="${uid}"]`);
    if (!wrap) return;

    const $map     = document.getElementById(`${uid}_map`);
    const $results = document.getElementById(`${uid}_results`);
    const $toast   = document.getElementById(`${uid}_toast`);
    const $radius  = document.getElementById(`${uid}_radius`);
    const $btn     = document.getElementById(`${uid}_refresh`);

    let map, placesService, userMarker, lastUserPos = null;
    let RADIUS_METERS = parseInt(initialRadius || 5000, 10);
    if ($radius) $radius.value = String(RADIUS_METERS);

    const STR = VARS.strings || {};

    function setSkeleton(state=true){
      if(state){
        $results.innerHTML = `
          <div class="fmp-card skeleton"></div>
          <div class="fmp-card skeleton"></div>
          <div class="fmp-card skeleton"></div>`;
      } else { $results.innerHTML = ""; }
    }

    function initMap(pos){
      map = new google.maps.Map($map, {
        center: pos, zoom: 14, mapTypeControl:false, streetViewControl:false, fullscreenControl:false
      });

      userMarker = new google.maps.Marker({
        position: pos, map,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor:"#EB600A", fillOpacity:1, strokeWeight:2, strokeColor:"#172866" },
        title: STR.youAreHere || "Você está aqui"
      });

      placesService = new google.maps.places.PlacesService(map);
      searchNearby(pos);
      window.map = map; // opcional p/ resize
    }

    function searchNearby(pos){
      if (!window.google || !google.maps) {
        $results.innerHTML = `<div class="fmp-card"><p class="fmp-meta">${H.esc(STR.notFound || 'Nenhum local encontrado nesse raio. Tente ampliar o raio.')}</p></div>`;
        return;
      }
      setSkeleton(true);

      const request = {
        location: pos,
        radius: RADIUS_METERS,
      };
      // aceita "type" e "keyword" conforme shortcode
      if (type)    request.type = type;
      if (keyword) request.keyword = keyword;

      placesService.nearbySearch(request, (results, status) => {
        setSkeleton(false);
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results || !results.length) {
          $results.innerHTML = `<div class="fmp-card"><p class="fmp-meta">${H.esc(STR.notFound || 'Nenhum local encontrado nesse raio. Tente ampliar o raio.')}</p></div>`;
          return;
        }
        // Se tiver keyword, aplicamos um filtro leve por nome/keyword (reforço)
        let list = results;
        if (keyword){
          const rx = new RegExp(keyword, 'i');
          list = results.filter(p => rx.test(p.name || '') || rx.test(p.vicinity || '') );
        }
        renderResults(pos, list);
      });
    }

    function makeDirectionsLink(origin, destLatLng){
      const o = `${origin.lat},${origin.lng}`;
      const d = `${destLatLng.lat()},${destLatLng.lng()}`;
      return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&travelmode=driving`;
    }

    function renderResults(origin, places){
      if (!places.length){
        $results.innerHTML = `<div class="fmp-card"><p class="fmp-meta">${H.esc(STR.notFound || 'Nenhum local encontrado nesse raio. Tente ampliar o raio.')}</p></div>`;
        return;
      }

      const list = places.map(p => {
        const lat = p.geometry.location.lat(), lng = p.geometry.location.lng();
        const dist = H.haversine(origin.lat, origin.lng, lat, lng);
        return { p, dist, lat, lng };
      }).sort((a,b)=> a.dist - b.dist);

      const bounds = new google.maps.LatLngBounds(origin);
      list.forEach(item => bounds.extend({lat:item.lat,lng:item.lng}));
      map.fitBounds(bounds);

      list.forEach(item=>{
        new google.maps.Marker({
          map, position: {lat:item.lat, lng:item.lng}, title: item.p.name,
          icon:{ path:"M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z",
                fillColor:"#EB600A", fillOpacity:1, strokeColor:"#172866", strokeWeight:1, scale:1 }
        });
      });

      $results.innerHTML = list.map(({p, dist})=>{
        const km = dist.toFixed(2);
        const rating = p.rating || null;
        const ratingsTotal = p.user_ratings_total || 0;
        const addr = p.vicinity || p.formatted_address || "Endereço não informado";
        const placeId = p.place_id;
        const mapsLink = placeId
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${encodeURIComponent(placeId)}`
          : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;

        const open = p.opening_hours && typeof p.opening_hours.isOpen === "function"
          ? p.opening_hours.isOpen()
          : (p.opening_hours?.open_now ?? undefined);

        const openBadgeClass = open === undefined ? "" : (open ? "ok" : "warn");
        const openText = open === undefined ? "" : (open ? (STR.openNow || 'Aberto agora') : (STR.closedNow || 'Fechado agora'));

        return `
        <article class="fmp-card" role="article">
          <div class="head">
            <h3 class="fmp-title">${H.esc(p.name)}</h3>
            <div class="fmp-badges">
              <span class="badge" title="Distância">🧭 ${km} km</span>
              ${rating ? `<span class="badge" title="Avaliação">★ ${Number(rating).toFixed(1)} (${ratingsTotal})</span>` : ``}
              ${openText ? `<span class="badge ${openBadgeClass}">${H.esc(openText)}</span>` : ``}
            </div>
          </div>
          <div class="fmp-meta">
            <div>📍 ${H.esc(addr)}</div>
            ${p.plus_code?.compound_code ? `<div>➕ ${H.esc(p.plus_code.compound_code)}</div>` : ``}
          </div>
          <div class="fmp-actions">
            <a class="fmp-link" href="${mapsLink}" target="_blank" rel="noopener noreferrer" aria-label="Abrir no Google Maps">
              ${H.esc(STR.openMaps || 'Abrir no Maps')}
            </a>
            ${p.geometry?.location ? `
              <a class="fmp-secondary" href="${makeDirectionsLink(origin, p.geometry.location)}" target="_blank" rel="noopener noreferrer">
                ${H.esc(STR.route || 'Traçar rota')}
              </a>` : ``}
          </div>
        </article>`;
      }).join("");
    }

    function locateAndSearch(){
      if (!navigator.geolocation){
        H.toast($toast, STR.geoDenied || 'Geolocalização indisponível. Autorize no navegador.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos)=>{
          const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          lastUserPos = here;
          if (!map) initMap(here);
          else {
            map.setCenter(here);
            userMarker && userMarker.setPosition(here);
            searchNearby(here);
          }
          setTimeout(()=> $results.scrollIntoView({ behavior:'smooth', block:'start' }), 600);
        },
        ()=>{
          H.toast($toast, STR.geoFail || 'Não foi possível obter sua localização.');
          const fb = VARS.defaultCenter || {lat:-23.2237, lng:-45.9009};
          lastUserPos = fb;
          if (!map) initMap(fb); else searchNearby(fb);
        },
        { enableHighAccuracy:true, timeout:8000, maximumAge:300000 }
      );
    }

    if ($btn) $btn.addEventListener('click', ()=>{
      RADIUS_METERS = parseInt($radius.value, 10);
      locateAndSearch();
    });
    if ($radius) $radius.addEventListener('change', ()=>{
      RADIUS_METERS = parseInt($radius.value, 10);
      if (lastUserPos) searchNearby(lastUserPos);
    });

    // Resize/orientation patches
    let t;
    function safeResize(){ if (window.google && google.maps && map) google.maps.event.trigger(map, 'resize'); }
    window.addEventListener('orientationchange', ()=>{ clearTimeout(t); t=setTimeout(safeResize, 350); });
    window.addEventListener('resize', ()=>{ clearTimeout(t); t=setTimeout(safeResize, 250); });

    ensureGoogle(()=> locateAndSearch());
  }

  bootQueue.forEach(cfg => initInstance(cfg));
})();
