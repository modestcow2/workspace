// ─── 상수 ────────────────────────────────────────────────────────────────────
const STORAGE_CUSTOMS   = 'restaurant_finder_custom';
const STORAGE_OVERRIDES = 'restaurant_finder_overrides';
const DATA_VERSION      = 'v2';
const STORAGE_VERSION   = 'restaurant_finder_version';

// ─── 상태 ────────────────────────────────────────────────────────────────────
const activeFilters = {
  flavor: new Set(), texture: new Set(), cooking: new Set(),
  cuisine: new Set(), temp: new Set(), occasion: new Set(), health: new Set()
};
let allRestaurants = [];
let editingId    = null;        // null=신규등록, number=편집 중인 id
let currentPage     = 1;
const ITEMS_PER_PAGE = 18;

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
    // 데이터 버전 체크 — 버전 불일치 시 사용자 변경사항 초기화
    const savedVersion = localStorage.getItem(STORAGE_VERSION);
    if (savedVersion !== DATA_VERSION) {
      localStorage.removeItem(STORAGE_CUSTOMS);
      localStorage.removeItem(STORAGE_OVERRIDES);
      localStorage.setItem(STORAGE_VERSION, DATA_VERSION);
    }

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

  allRestaurants = [...RESTAURANTS];
  currentPage = 1;

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
  currentPage = 1;
  render();
}

function resetFilters() {
  Object.keys(activeFilters).forEach(k => activeFilters[k].clear());
  currentPage = 1;
  render();
}

const hasActiveFilters = () => Object.values(activeFilters).some(s => s.size > 0);

// ─── 렌더: 필터 패널 ──────────────────────────────────────────────────────────
let activeTab = null;   // 현재 열린 탭 카테고리

function renderFilterPanel() {
  const panel = document.getElementById('filter-panel');
  panel.querySelectorAll('.filter-tabs-wrap, .filter-options').forEach(el => el.remove());
  document.getElementById('reset-btn').style.display = hasActiveFilters() ? '' : 'none';

  // ── 탭 행 ──
  const tabsWrap = document.createElement('div');
  tabsWrap.className = 'filter-tabs-wrap';
  const tabs = document.createElement('div');
  tabs.className = 'filter-tabs';

  Object.entries(FILTER_META).forEach(([cat, meta]) => {
    const count = activeFilters[cat].size;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-tab' + (activeTab === cat ? ' active' : '');

    let label = (meta.icon ? meta.icon + ' ' : '') + meta.label;
    btn.innerHTML = label + (count > 0 ? ` <span class="tab-count">${count}</span>` : '');

    btn.addEventListener('click', () => {
      activeTab = activeTab === cat ? null : cat;
      renderFilterPanel();
    });
    tabs.appendChild(btn);
  });

  tabsWrap.appendChild(tabs);
  panel.appendChild(tabsWrap);

  // ── 옵션 영역 (선택된 탭만) ──
  if (activeTab && FILTER_META[activeTab]) {
    const meta = FILTER_META[activeTab];
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'filter-options visible';

    const row = document.createElement('div');
    row.className = 'flex flex-wrap gap-2';
    meta.options.forEach(tag => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-badge' + (activeFilters[activeTab].has(tag) ? ' active' : '');
      btn.textContent = tag;
      btn.addEventListener('click', () => toggleFilter(activeTab, tag));
      row.appendChild(btn);
    });
    optionsDiv.appendChild(row);
    panel.appendChild(optionsDiv);
  }
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
    renderPagination(0);
    return;
  }
  empty.style.display = 'none';

  // 페이지네이션 적용
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const paged = filtered.slice(start, start + ITEMS_PER_PAGE);

  grid.innerHTML = paged.map(r => {
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

  renderPagination(filtered.length);
}

// ─── 메인 렌더 ───────────────────────────────────────────────────────────────
function render() {
  const filtered = filterRestaurants();
  renderFilterPanel();
  renderActiveChips();
  renderCards(filtered);
}

// ─── 렌더: 페이지네이션 ─────────────────────────────────────────────────────
function renderPagination(totalItems) {
  const container = document.getElementById('pagination');
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  // 이전 버튼
  html += `<button class="page-btn" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>‹ 이전</button>`;

  // 페이지 번호 (최대 7개 표시, 양 끝 + 현재 주변)
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);
    if (currentPage <= 3) { start = 2; end = 5; }
    if (currentPage >= totalPages - 2) { start = totalPages - 4; end = totalPages - 1; }
    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  pages.forEach(p => {
    if (p === '...') {
      html += `<span class="text-gray-400 px-1">…</span>`;
    } else {
      html += `<button class="page-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`;
    }
  });

  // 다음 버튼
  html += `<button class="page-btn" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>다음 ›</button>`;

  container.innerHTML = html;

  // 이벤트 바인딩
  container.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.page;
      if (val === 'prev') currentPage--;
      else if (val === 'next') currentPage++;
      else currentPage = +val;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// ─── 식당 삭제 (모든 식당 공통) ──────────────────────────────────────────────
function deleteRestaurant(id) {
  const r = allRestaurants.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`"${r.name}"을(를) 삭제하시겠습니까?`)) return;

  allRestaurants = allRestaurants.filter(x => x.id !== id);

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

});
