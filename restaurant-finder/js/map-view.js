// ─── 지도 뷰 모듈 ─────────────────────────────────────────────────────────────
const MapView = (() => {
  let map = null;
  let clusterer = null;
  let kpcMarker = null;
  let markers = [];
  let activeInfoWindow = null;
  let initialized = false;

  // KPC 좌표
  const KPC_LAT = BASE_POINT.lat;
  const KPC_LNG = BASE_POINT.lng;

  function initMap() {
    if (initialized) return;

    const container = document.getElementById('kakao-map');
    const center = new kakao.maps.LatLng(KPC_LAT, KPC_LNG);

    map = new kakao.maps.Map(container, {
      center: center,
      level: 4 // 적절한 줌 레벨
    });

    // 줌 컨트롤 추가
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);

    // KPC 기준점 마커 (클러스터링 제외)
    const kpcContent = document.createElement('div');
    kpcContent.className = 'kpc-marker';
    kpcContent.textContent = '★';

    kpcMarker = new kakao.maps.CustomOverlay({
      position: center,
      content: '<div class="kpc-marker">★</div>',
      yAnchor: 0.5,
      zIndex: 10
    });
    kpcMarker.setMap(map);

    // KPC 클릭 시 InfoWindow
    const kpcClickMarker = new kakao.maps.Marker({
      position: center,
      map: map,
      opacity: 0 // 투명 마커 (클릭 영역용)
    });
    const kpcInfoWindow = new kakao.maps.InfoWindow({
      content: '<div class="map-info-window"><strong>한국생산성본부 (KPC)</strong><br><span style="font-size:11px;color:#6b7280">📍 경복궁역 인근</span></div>',
      removable: true
    });
    kakao.maps.event.addListener(kpcClickMarker, 'click', () => {
      if (activeInfoWindow) activeInfoWindow.close();
      kpcInfoWindow.open(map, kpcClickMarker);
      activeInfoWindow = kpcInfoWindow;
    });

    // 클러스터러 초기화
    clusterer = new kakao.maps.MarkerClusterer({
      map: map,
      averageCenter: true,
      minLevel: 3,
      disableClickZoom: true,
      styles: [{
        width: '40px', height: '40px',
        background: 'rgba(99, 102, 241, 0.85)',
        borderRadius: '20px',
        color: '#fff',
        textAlign: 'center',
        fontWeight: '700',
        lineHeight: '40px',
        fontSize: '14px'
      }, {
        width: '50px', height: '50px',
        background: 'rgba(79, 70, 229, 0.85)',
        borderRadius: '25px',
        color: '#fff',
        textAlign: 'center',
        fontWeight: '700',
        lineHeight: '50px',
        fontSize: '15px'
      }, {
        width: '60px', height: '60px',
        background: 'rgba(67, 56, 202, 0.85)',
        borderRadius: '30px',
        color: '#fff',
        textAlign: 'center',
        fontWeight: '700',
        lineHeight: '60px',
        fontSize: '16px'
      }]
    });

    // 클러스터 클릭 시 확대
    kakao.maps.event.addListener(clusterer, 'clusterclick', (cluster) => {
      const level = map.getLevel() - 2;
      map.setLevel(level, { anchor: cluster.getCenter() });
    });

    initialized = true;
  }

  function buildInfoContent(r) {
    const isApprox = r.lat === BASE_POINT.lat && r.lng === BASE_POINT.lng;
    const approxBadge = isApprox ? '<span style="font-size:10px;color:#ef4444;font-weight:600">⚠ 대략적 위치</span><br>' : '';
    const menus = r.mainMenu.slice(0, 3).join(' · ');
    const naverUrl = `https://map.naver.com/p/search/${encodeURIComponent(r.name)}?c=${r.lng},${r.lat},15,0,0,0,dh`;
    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + r.address)}`;

    return `<div class="map-info-window">
      ${approxBadge}
      <strong>${r.name}</strong>
      <div style="margin:4px 0;font-size:11px;color:#6b7280">
        ${r.distanceKm}km · ${r.priceRange} · 🕐 ${r.openHours || '-'}
      </div>
      <div style="font-size:11px;color:#374151;margin-bottom:4px">
        ${menus}
      </div>
      <div style="display:flex;gap:4px">
        <a href="${naverUrl}" target="_blank" rel="noopener" class="map-link map-link-naver" style="font-size:10px">🗺️ 네이버</a>
        <a href="${googleUrl}" target="_blank" rel="noopener" class="map-link map-link-google" style="font-size:10px">🌍 구글</a>
      </div>
    </div>`;
  }

  function updateMarkers(filtered) {
    if (!initialized) return;

    // 기존 마커 제거
    clusterer.clear();
    markers = [];

    // 새 마커 생성
    filtered.forEach(r => {
      if (!r.lat || !r.lng) return;

      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(r.lat, r.lng),
        title: r.name
      });

      const infoWindow = new kakao.maps.InfoWindow({
        content: buildInfoContent(r),
        removable: true
      });

      kakao.maps.event.addListener(marker, 'click', () => {
        if (activeInfoWindow) activeInfoWindow.close();
        infoWindow.open(map, marker);
        activeInfoWindow = infoWindow;
      });

      markers.push(marker);
    });

    // 클러스터에 마커 추가
    clusterer.addMarkers(markers);
  }

  function show() {
    if (!initialized) initMap();

    document.getElementById('map-container').style.display = '';
    document.getElementById('restaurant-grid').style.display = 'none';
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('pagination').style.display = 'none';

    // 지도 크기 재계산
    setTimeout(() => {
      if (map) map.relayout();
    }, 100);
  }

  function hide() {
    document.getElementById('map-container').style.display = 'none';
    document.getElementById('restaurant-grid').style.display = '';
    document.getElementById('pagination').style.display = '';
  }

  function isInitialized() {
    return initialized;
  }

  return { initMap, updateMarkers, show, hide, isInitialized };
})();
