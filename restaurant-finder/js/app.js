// ─── 상수 ────────────────────────────────────────────────────────────────────
const STORAGE_CUSTOMS   = 'restaurant_finder_custom';
const STORAGE_OVERRIDES = 'restaurant_finder_overrides';

// ─── 상태 ────────────────────────────────────────────────────────────────────
const activeFilters = {
  flavor: new Set(), texture: new Set(), cooking: new Set(),
  cuisine: new Set(), temp: new Set(), occasion: new Set(), health: new Set()
};
let allRestaurants = [];
let markerMap    = new Map();   // id → L.Marker
let mapInstance  = null;
let editingId    = null;        // null=신규등록, number=편집 중인 id

// ─── 유틸 ────────────────────────────────────────────────────────────────────
const getCuisineEmoji = () => '🍽️';

function haversineKm(lat, lng) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat - BASE_POINT.lat), dLng = toRad(lng - BASE_POINT.lng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(BASE_POINT.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

// ─── localStorage 저장/불러오기 ──────────────────────────────────────────────
function loadState() {
  try {
    const customs   = JSON.parse(localStorage.getItem(STORAGE_CUSTOMS)   || '[]');
    const overrides = JSON.parse(localStorage.getItem(STORAGE_OVERRIDES) || '{}');
    const deleted   = new Set(overrides.deleted || []);
    const edits     = overrides.edits || {};          // { [id]: restaurant }

    // 기본 데이터에 편집 내용 적용 후 삭제 항목 제외
    allRestaurants = RESTAURANTS
      .map(r => edits[r.id] ? { ...edits[r.id] } : r)
      .filter(r => !deleted.has(r.id));

    // 직접 등록된 식당 추가 (중복 방지)
    customs.forEach(r => {
      if (!allRestaurants.find(x => x.id === r.id)) allRestaurants.push(r);
    });
  } catch {
    allRestaurants = [...RESTAURANTS];
  }
}

function saveState() {
  try {
    const customs = allRestaurants.filter(r => r._custom);
    localStorage.setItem(STORAGE_CUSTOMS, JSON.stringify(customs));

    // 기본 데이터와 비교해 삭제/수정 내역 추출
    const originalIds = new Set(RESTAURANTS.map(r => r.id));
    const currentIds  = new Set(allRestaurants.map(r => r.id));
    const deleted     = [...originalIds].filter(id => !currentIds.has(id));

    const edits = {};
    allRestaurants.forEach(r => {
      if (!r._custom && originalIds.has(r.id)) {
        const orig = RESTAURANTS.find(x => x.id === r.id);
        if (JSON.stringify(orig) !== JSON.stringify(r)) edits[r.id] = r;
      }
    });

    localStorage.setItem(STORAGE_OVERRIDES, JSON.stringify({ deleted, edits }));
  } catch { }
}

function hasLocalChanges() {
  try {
    const ov = JSON.parse(localStorage.getItem(STORAGE_OVERRIDES) || '{}');
    const cu = JSON.parse(localStorage.getItem(STORAGE_CUSTOMS)   || '[]');
    return (ov.deleted?.length || 0) + Object.keys(ov.edits || {}).length + cu.length > 0;
  } catch { return false; }
}

// ─── 기본 데이터로 복구 ───────────────────────────────────────────────────────
function resetAllData() {
  if (!confirm('모든 변경사항(추가·수정·삭제)을 초기화하고 기본 데이터로 복구하시겠습니까?')) return;
  localStorage.removeItem(STORAGE_CUSTOMS);
  localStorage.removeItem(STORAGE_OVERRIDES);

  // 지도 마커 전체 제거 후 재구성
  markerMap.forEach((marker) => { if (mapInstance) mapInstance.removeLayer(marker); });
  markerMap.clear();
  allRestaurants = [...RESTAURANTS];
  allRestaurants.forEach(addMarkerForRestaurant);

  updateResetDataBtn();
  render();
}

function updateResetDataBtn() {
  const btn = document.getElementById('reset-data-btn');
  if (btn) btn.style.display = hasLocalChanges() ? '' : 'none';
}

// ─── 필터 로직 ───────────────────────────────────────────────────────────────
function filterRestaurants() {
  return allRestaurants.filter(r =>
    Object.keys(activeFilters).every(cat => {
      const sel = activeFilters[cat];
      if (sel.size === 0) return true;
      return [...sel].some(tag => r.tags[cat].includes(tag));
    })
  );
}

function toggleFilter(cat, tag) {
  activeFilters[cat].has(tag) ? activeFilters[cat].delete(tag) : activeFilters[cat].add(tag);
  render();
}

function resetFilters() {
  Object.keys(activeFilters).forEach(k => activeFilters[k].clear());
  render();
}

const hasActiveFilters = () => Object.values(activeFilters).some(s => s.size > 0);

// ─── 렌더: 필터 패널 ──────────────────────────────────────────────────────────
function renderFilterPanel() {
  const panel = document.getElementById('filter-panel');
  panel.querySelectorAll('.filter-group').forEach(el => el.remove());
  document.getElementById('reset-btn').style.display = hasActiveFilters() ? '' : 'none';

  Object.entries(FILTER_META).forEach(([cat, meta]) => {
    const group = document.createElement('div');
    group.className = 'filter-group mb-3 last:mb-0';

    const label = document.createElement('p');
    label.className = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2';
    label.textContent = (meta.icon ? meta.icon + ' ' : '') + meta.label;
    group.appendChild(label);

    const row = document.createElement('div');
    row.className = 'flex flex-wrap gap-2';
    meta.options.forEach(tag => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-badge' + (activeFilters[cat].has(tag) ? ' active' : '');
      btn.textContent = tag;
      btn.addEventListener('click', () => toggleFilter(cat, tag));
      row.appendChild(btn);
    });
    group.appendChild(row);
    panel.appendChild(group);
  });
}

// ─── 렌더: 활성 필터 칩 ──────────────────────────────────────────────────────
function renderActiveChips() {
  const container = document.getElementById('active-filters');
  if (!hasActiveFilters()) { container.style.display = 'none'; return; }
  container.style.display = 'flex';
  container.innerHTML = '';
  Object.entries(activeFilters).forEach(([cat, set]) => {
    set.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'active-chip';
      chip.innerHTML = `${tag} <button aria-label="${tag} 제거">×</button>`;
      chip.querySelector('button').addEventListener('click', () => toggleFilter(cat, tag));
      container.appendChild(chip);
    });
  });
}

// ─── 렌더: 식당 카드 ──────────────────────────────────────────────────────────
function renderCards(filtered) {
  const grid  = document.getElementById('restaurant-grid');
  const empty = document.getElementById('empty-state');
  document.getElementById('result-summary').textContent =
    `${filtered.length}개 식당 표시 중 (전체 ${allRestaurants.length}개)`;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = filtered.map(r => {
    const isCustom   = !!r._custom;
    const isModified = !isCustom && JSON.stringify(RESTAURANTS.find(x => x.id === r.id)) !== JSON.stringify(r);
    const badgeHtml  = isCustom
      ? `<span class="badge-custom">직접등록</span>`
      : isModified
        ? `<span class="badge-modified">수정됨</span>`
        : '';

    return `
      <article class="restaurant-card${isCustom ? ' custom-card' : ''}" data-id="${r.id}">
        <div class="flex items-start gap-2 mb-2">
          <span class="text-2xl flex-shrink-0 mt-0.5">${getCuisineEmoji(r.tags)}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1 justify-between">
              <h3 class="font-bold text-gray-900 text-sm truncate">${r.name}</h3>
              ${badgeHtml}
            </div>
            <p class="text-xs text-gray-400 truncate">${r.address}</p>
            <div class="flex gap-1 mt-0.5">
              <a href="https://map.naver.com/p/search/${encodeURIComponent(r.name + ' ' + r.address)}"
                 target="_blank" rel="noopener" class="map-link map-link-naver"
                 onclick="event.stopPropagation()">🗺️ 네이버</a>
              <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + r.address)}"
                 target="_blank" rel="noopener" class="map-link map-link-google"
                 onclick="event.stopPropagation()">🌍 구글</a>
            </div>
          </div>
          <span class="text-xs text-gray-400 flex-shrink-0 ml-1">${r.distanceKm}km</span>
        </div>

        <div class="flex gap-3 text-xs text-gray-500 mb-2">
          <span>${r.priceRange}</span><span>·</span>
          <span>🕐 ${r.openHours || '-'}</span>
        </div>

        <p class="text-xs text-gray-700 mb-2">
          <span class="font-semibold">메뉴</span> ${r.mainMenu.join(' · ')}
        </p>

        ${r.tip ? `<p class="tip-text">${r.tip}</p>` : ''}

        <div class="flex flex-wrap gap-1 mt-auto pt-1">
          ${Object.keys(FILTER_META).map(cat =>
            (r.tags[cat] || []).map(t => `<span class="tag tag-${cat}">${t}</span>`).join('')
          ).join('')}
        </div>

        <div class="card-actions">
          <button class="edit-btn"   data-id="${r.id}">✏️ 편집</button>
          <button class="delete-btn" data-id="${r.id}">🗑️ 삭제</button>
        </div>
      </article>
    `;
  }).join('');

  // 버튼 이벤트
  grid.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const r = allRestaurants.find(x => x.id === +btn.dataset.id);
      if (r) openModal(r);
    });
  });
  grid.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteRestaurant(+btn.dataset.id);
    });
  });

  // 카드 클릭 → 지도 포커스
  grid.querySelectorAll('.restaurant-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.card-actions')) return;
      const marker = markerMap.get(+card.dataset.id);
      if (marker && mapInstance) {
        marker.openPopup();
        mapInstance.setView(marker.getLatLng(), 16, { animate: true });
      }
    });
  });
}

// ─── 렌더: 지도 마커 dim 처리 ────────────────────────────────────────────────
function renderMapMarkers(filtered) {
  if (!mapInstance) return;
  const filteredIds = new Set(filtered.map(r => r.id));
  markerMap.forEach((marker, id) => {
    const el = marker.getElement();
    if (el) el.classList.toggle('dimmed', !filteredIds.has(id));
  });
}

// ─── 메인 렌더 ───────────────────────────────────────────────────────────────
function render() {
  const filtered = filterRestaurants();
  renderFilterPanel();
  renderActiveChips();
  renderCards(filtered);
  renderMapMarkers(filtered);
}

// ─── Leaflet 지도 초기화 ──────────────────────────────────────────────────────
function initMap() {
  mapInstance = L.map('map', { zoomControl: true }).setView([BASE_POINT.lat, BASE_POINT.lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '', maxZoom: 19 }).addTo(mapInstance);

  L.marker([BASE_POINT.lat, BASE_POINT.lng], {
    icon: L.divIcon({ html: '<div class="base-marker">🏢</div>', className: '', iconSize: [38,38], iconAnchor: [19,19] })
  }).addTo(mapInstance).bindPopup(`<b>${BASE_POINT.name}</b><br>기준점 (경복궁역)`);

  L.circle([BASE_POINT.lat, BASE_POINT.lng], {
    radius: 3000, color: '#6366f1', weight: 1.5,
    fillColor: '#6366f1', fillOpacity: 0.04, dashArray: '6 4'
  }).addTo(mapInstance);

  allRestaurants.forEach(addMarkerForRestaurant);
}

function addMarkerForRestaurant(r) {
  if (!mapInstance) return;
  const q = encodeURIComponent(r.name + ' ' + r.address);
  const marker = L.marker([r.lat, r.lng], {
    icon: L.divIcon({
      html: `<div class="restaurant-marker">${getCuisineEmoji(r.tags)}</div>`,
      className: '', iconSize: [32,32], iconAnchor: [16,16]
    })
  }).addTo(mapInstance).bindPopup(`
    <b>${r.name}</b><br>
    <span style="font-size:11px;color:#6b7280">${r.address}</span><br>
    <span style="font-size:12px">${r.mainMenu.join(' · ')}</span><br>
    <div style="margin-top:6px;display:flex;gap:6px">
      <a href="https://map.naver.com/p/search/${q}" target="_blank"
         style="font-size:11px;color:#03c75a;font-weight:600;">🗺️ 네이버</a>
      <a href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank"
         style="font-size:11px;color:#4285f4;font-weight:600;">🌍 구글</a>
    </div>
  `);
  markerMap.set(r.id, marker);
}

function updateMarker(r) {
  const old = markerMap.get(r.id);
  if (old && mapInstance) mapInstance.removeLayer(old);
  markerMap.delete(r.id);
  addMarkerForRestaurant(r);
}

// ─── 식당 삭제 (모든 식당 공통) ──────────────────────────────────────────────
function deleteRestaurant(id) {
  const r = allRestaurants.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`"${r.name}"을(를) 삭제하시겠습니까?`)) return;

  allRestaurants = allRestaurants.filter(x => x.id !== id);
  const marker = markerMap.get(id);
  if (marker && mapInstance) mapInstance.removeLayer(marker);
  markerMap.delete(id);

  saveState();
  updateResetDataBtn();
  render();
}

// ─── 모달: 태그 선택 UI ──────────────────────────────────────────────────────
function buildTagSelector(selectedTags = {}) {
  const container = document.getElementById('tag-selector');
  container.innerHTML = '';
  Object.entries(FILTER_META).forEach(([cat, meta]) => {
    const div = document.createElement('div');
    const p   = document.createElement('p');
    p.className = 'text-xs font-semibold text-gray-500 mb-1.5';
    p.textContent = (meta.icon ? meta.icon + ' ' : '') + meta.label;
    div.appendChild(p);

    const row = document.createElement('div');
    row.className = 'flex flex-wrap gap-1.5';
    meta.options.forEach(tag => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'modal-tag-btn' + ((selectedTags[cat] || []).includes(tag) ? ' selected' : '');
      btn.dataset.cat = cat;
      btn.dataset.tag = tag;
      btn.textContent = tag;
      btn.addEventListener('click', () => btn.classList.toggle('selected'));
      row.appendChild(btn);
    });
    div.appendChild(row);
    container.appendChild(div);
  });
}

// ─── 모달 열기 (신규: openModal() / 편집: openModal(restaurant)) ─────────────
function openModal(restaurant = null) {
  const form = document.getElementById('add-form');
  form.reset();
  editingId = restaurant ? restaurant.id : null;

  // 모달 제목 전환
  document.getElementById('modal-title').textContent = restaurant ? '✏️ 식당 편집' : '🍴 식당 직접 등록';

  // 편집 시 기존 값 채우기
  if (restaurant) {
    form.elements['restaurantName'].value = restaurant.name;
    form.elements['address'].value        = restaurant.address;
    form.elements['lat'].value            = restaurant.lat;
    form.elements['lng'].value            = restaurant.lng;
    form.elements['mainMenu'].value       = restaurant.mainMenu.join(', ');
    form.elements['priceRange'].value     = restaurant.priceRange;
    form.elements['openHours'].value      = restaurant.openHours !== '-' ? restaurant.openHours : '';
    form.elements['tip'].value            = restaurant.tip || '';
  }

  buildTagSelector(restaurant ? restaurant.tags : {});
  document.getElementById('modal-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.body.style.overflow = '';
  editingId = null;
}

// ─── 폼 제출 처리 (신규 등록 / 편집 공통) ────────────────────────────────────
function handleSubmit(e) {
  e.preventDefault();
  const data = new FormData(e.target);

  const name        = (data.get('restaurantName') || '').trim();
  const address     = (data.get('address')        || '').trim();
  const mainMenuRaw = (data.get('mainMenu')       || '').trim();

  if (!name || !address || !mainMenuRaw) {
    alert('이름, 주소, 대표 메뉴는 필수 입력 항목입니다.');
    return;
  }

  const lat      = parseFloat(data.get('lat')) || BASE_POINT.lat;
  const lng      = parseFloat(data.get('lng')) || BASE_POINT.lng;
  const mainMenu = mainMenuRaw.split(',').map(s => s.trim()).filter(Boolean);

  const tags = { flavor: [], texture: [], cooking: [], cuisine: [], temp: [], occasion: [], health: [] };
  document.querySelectorAll('.modal-tag-btn.selected').forEach(btn => {
    if (tags[btn.dataset.cat]) tags[btn.dataset.cat].push(btn.dataset.tag);
  });

  if (editingId !== null) {
    // ── 편집 모드: 기존 항목 업데이트 ──
    const idx = allRestaurants.findIndex(r => r.id === editingId);
    if (idx === -1) return;
    const original = allRestaurants[idx];
    allRestaurants[idx] = {
      ...original,
      name, address, lat, lng,
      distanceKm: haversineKm(lat, lng),
      mainMenu,
      priceRange: data.get('priceRange'),
      openHours: (data.get('openHours') || '').trim() || '-',
      tags,
      tip: (data.get('tip') || '').trim(),
    };
    updateMarker(allRestaurants[idx]);
    saveState();
    updateResetDataBtn();
    closeModal();
    render();
  } else {
    // ── 신규 등록 모드 ──
    const restaurant = {
      id: Date.now(),
      name, address, lat, lng,
      distanceKm: haversineKm(lat, lng),
      mainMenu,
      priceRange: data.get('priceRange'),
      openHours: (data.get('openHours') || '').trim() || '-',
      tags,
      tip: (data.get('tip') || '').trim(),
      _custom: true,
    };
    allRestaurants.push(restaurant);
    addMarkerForRestaurant(restaurant);
    saveState();
    updateResetDataBtn();
    closeModal();
    render();
    setTimeout(() => {
      document.querySelector(`[data-id="${restaurant.id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 150);
  }
}

// ─── 초기화 ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initMap();
  render();
  updateResetDataBtn();

  document.getElementById('reset-btn').addEventListener('click', resetFilters);
  document.getElementById('reset-data-btn').addEventListener('click', resetAllData);
  document.getElementById('add-restaurant-btn').addEventListener('click', () => openModal());
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('add-form').addEventListener('submit', handleSubmit);

  window.addEventListener('resize', () => {
    if (mapInstance) mapInstance.invalidateSize();
  });
});
