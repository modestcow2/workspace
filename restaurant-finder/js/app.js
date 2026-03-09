// ─── 상수 ────────────────────────────────────────────────────────────────────
const DATA_VERSION    = 'v3';
const STORAGE_VERSION = 'restaurant_finder_version';

// ─── 상태 ────────────────────────────────────────────────────────────────────
const activeFilters = {
  flavor: new Set(), texture: new Set(), cooking: new Set(),
  cuisine: new Set(), occasion: new Set(), health: new Set(),
  distance: new Set()
};
let allRestaurants = [];
let searchQuery  = '';
let editingId    = null;        // null=신규등록, number=편집 중인 id
let currentPage     = 1;
const ITEMS_PER_PAGE = 18;
let isAdmin = false;            // Firebase Auth 관리자 여부
let deletingRestaurant = null;  // 삭제 제안 중인 식당

// ─── 유틸 ────────────────────────────────────────────────────────────────────
const getCuisineEmoji = () => '🍽️';

function haversineKm(lat, lng) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat - BASE_POINT.lat), dLng = toRad(lng - BASE_POINT.lng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(BASE_POINT.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

// ─── 토스트 ──────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast toast-' + type;
  toast.style.display = '';
  setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

// ─── 데이터 로드 (Firestore 오버라이드 병합) ─────────────────────────────────
function loadState() {
  // v3 마이그레이션: 기존 localStorage 데이터 정리
  const savedVersion = localStorage.getItem(STORAGE_VERSION);
  if (savedVersion !== DATA_VERSION) {
    localStorage.removeItem('restaurant_finder_custom');
    localStorage.removeItem('restaurant_finder_overrides');
    localStorage.setItem(STORAGE_VERSION, DATA_VERSION);
  }

  // 즉시 기본 데이터로 렌더 (무작위 정렬)
  allRestaurants = [...RESTAURANTS];
  // Fisher-Yates shuffle
  for (let i = allRestaurants.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allRestaurants[i], allRestaurants[j]] = [allRestaurants[j], allRestaurants[i]];
  }
}

async function loadFirestoreOverrides() {
  try {
    const overrides = await fetchOverrides();
    if (Object.keys(overrides).length > 0) {
      allRestaurants = applyOverrides(RESTAURANTS, overrides);
      render();
    }
  } catch (err) {
    console.warn('Firestore 오버라이드 로드 실패 (오프라인 모드):', err);
  }
}

// ─── 필터 로직 ───────────────────────────────────────────────────────────────
const DISTANCE_THRESHOLDS = { '500m이내': 0.5, '1km이내': 1.0, '1.5km이내': 1.5 };

function filterRestaurants() {
  const query = searchQuery.toLowerCase();
  return allRestaurants.filter(r => {
    if (query) {
      const nameMatch = r.name.toLowerCase().includes(query);
      const menuMatch = r.mainMenu.some(m => m.toLowerCase().includes(query));
      if (!nameMatch && !menuMatch) return false;
    }
    return Object.keys(activeFilters).every(cat => {
      const sel = activeFilters[cat];
      if (sel.size === 0) return true;
      if (cat === 'distance') {
        const maxDist = Math.min(...[...sel].map(t => DISTANCE_THRESHOLDS[t]));
        return r.distanceKm <= maxDist;
      }
      return [...sel].some(tag => r.tags[cat].includes(tag));
    });
  });
}

function toggleFilter(cat, tag) {
  if (cat === 'distance') {
    if (activeFilters[cat].has(tag)) {
      activeFilters[cat].clear();
    } else {
      activeFilters[cat].clear();
      activeFilters[cat].add(tag);
    }
  } else {
    activeFilters[cat].has(tag) ? activeFilters[cat].delete(tag) : activeFilters[cat].add(tag);
  }
  currentPage = 1;
  render();
}

function resetFilters() {
  Object.keys(activeFilters).forEach(k => activeFilters[k].clear());
  searchQuery = '';
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  const searchClear = document.getElementById('search-clear');
  if (searchClear) searchClear.style.display = 'none';
  currentPage = 1;
  render();
}

const hasActiveFilters = () => Object.values(activeFilters).some(s => s.size > 0);

// ─── 렌더: 필터 패널 ──────────────────────────────────────────────────────────
let activeTab = null;

function renderFilterPanel() {
  const panel = document.getElementById('filter-panel');
  panel.querySelectorAll('.filter-tabs-wrap, .filter-options').forEach(el => el.remove());
  document.getElementById('reset-btn').style.display = hasActiveFilters() ? '' : 'none';

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
  document.getElementById('result-summary').textContent = searchQuery
    ? `"${searchQuery}" 검색 결과 ${filtered.length}곳 (전체 ${allRestaurants.length}개)`
    : `${filtered.length}개 식당 표시 중 (전체 ${allRestaurants.length}개)`;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.style.display = '';
    renderPagination(0);
    return;
  }
  empty.style.display = 'none';

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const paged = filtered.slice(start, start + ITEMS_PER_PAGE);

  // 버튼 텍스트: 관리자 vs 일반 사용자
  const editLabel   = isAdmin ? '✏️ 편집' : '✏️ 수정 제안';
  const deleteLabel = isAdmin ? '🗑️ 삭제' : '🗑️ 삭제 제안';

  grid.innerHTML = paged.map(r => {
    const isCustom   = !!r._custom || !!r._added;
    const badgeHtml  = isCustom
      ? `<span class="badge-custom">직접등록</span>`
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
              <a href="https://map.naver.com/p/search/${encodeURIComponent(r.name)}?c=${r.lng},${r.lat},15,0,0,0,dh"
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

        <div class="flex flex-wrap gap-1 pt-1">
          ${Object.keys(FILTER_META).map(cat =>
            (r.tags[cat] || []).map(t => `<span class="tag tag-${cat}">${t}</span>`).join('')
          ).join('')}
        </div>

        <div class="card-actions">
          <button class="edit-btn"   data-id="${r.id}">${editLabel}</button>
          <button class="delete-btn" data-id="${r.id}">${deleteLabel}</button>
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
  if (hasActiveFilters() || searchQuery) {
    filtered.sort((a, b) => a.distanceKm - b.distanceKm);
  }
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
  html += `<button class="page-btn" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>‹ 이전</button>`;

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

  html += `<button class="page-btn" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>다음 ›</button>`;
  container.innerHTML = html;

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

// ─── 식당 삭제 (관리자: 직접 삭제 / 일반: 삭제 제안) ─────────────────────────
function deleteRestaurant(id) {
  const r = allRestaurants.find(x => x.id === id);
  if (!r) return;

  if (isAdmin) {
    // 관리자: 직접 삭제 → approved_overrides에 저장
    if (!confirm(`"${r.name}"을(를) 삭제하시겠습니까?`)) return;
    saveDirectOverride(id, 'delete', null, auth.currentUser.email)
      .then(() => {
        allRestaurants = allRestaurants.filter(x => x.id !== id);
        render();
        showToast(`"${r.name}" 삭제 완료`);
      })
      .catch(err => {
        console.error('삭제 실패:', err);
        showToast('삭제에 실패했습니다.', 'error');
      });
  } else {
    // 일반 사용자: 삭제 제안 모달 열기
    deletingRestaurant = r;
    document.getElementById('delete-suggest-name').textContent = `"${r.name}"의 삭제를 제안합니다.`;
    document.getElementById('delete-nickname').value = '';
    document.getElementById('delete-reason').value = '';
    document.getElementById('delete-suggest-modal').style.display = 'flex';
  }
}

// ─── 모달: 태그 선택 UI ──────────────────────────────────────────────────────
function buildTagSelector(selectedTags = {}) {
  const container = document.getElementById('tag-selector');
  container.innerHTML = '';
  Object.entries(FILTER_META).forEach(([cat, meta]) => {
    if (cat === 'distance') return;
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

// ─── 모달 열기 ───────────────────────────────────────────────────────────────
function openModal(restaurant = null) {
  const form = document.getElementById('add-form');
  form.reset();
  editingId = restaurant ? restaurant.id : null;

  // 모달 제목 & 버튼 텍스트 전환
  const suggestionFields = document.getElementById('suggestion-fields');
  const submitBtn = document.getElementById('modal-submit-btn');

  if (isAdmin) {
    document.getElementById('modal-title').textContent = restaurant ? '✏️ 식당 편집' : '🍴 식당 직접 등록';
    suggestionFields.style.display = 'none';
    document.getElementById('coord-section').style.display = '';
    submitBtn.textContent = restaurant ? '저장하기' : '등록하기';
  } else {
    document.getElementById('modal-title').textContent = restaurant ? '✏️ 수정 제안' : '🍴 식당 추가 제안';
    document.getElementById('suggestion-notice').textContent = restaurant
      ? '📝 수정 제안은 관리자 승인 후 반영됩니다.'
      : '📝 식당 추가제안은 관리자 승인 후 반영됩니다.';
    suggestionFields.style.display = '';
    document.getElementById('coord-section').style.display = 'none';
    submitBtn.textContent = '제안하기';
  }

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

// ─── 주소 → 좌표 변환 (Nominatim) ────────────────────────────────────────────
async function geocodeAddress(address) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { 'Accept-Language': 'ko' } }
    );
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (err) {
    console.warn('Geocoding 실패:', err);
  }
  return null;
}

// ─── 폼 데이터 수집 헬퍼 ─────────────────────────────────────────────────────
function collectFormData(formData) {
  const name        = (formData.get('restaurantName') || '').trim();
  const address     = (formData.get('address')        || '').trim();
  const mainMenuRaw = (formData.get('mainMenu')       || '').trim();

  if (!name || !address || !mainMenuRaw) return null;

  const lat      = parseFloat(formData.get('lat')) || null;
  const lng      = parseFloat(formData.get('lng')) || null;
  const mainMenu = mainMenuRaw.split(',').map(s => s.trim()).filter(Boolean);

  const tags = { flavor: [], texture: [], cooking: [], cuisine: [], occasion: [], health: [] };
  document.querySelectorAll('.modal-tag-btn.selected').forEach(btn => {
    if (tags[btn.dataset.cat]) tags[btn.dataset.cat].push(btn.dataset.tag);
  });

  return {
    name, address, lat, lng,
    distanceKm: lat && lng ? haversineKm(lat, lng) : null,
    mainMenu,
    priceRange: formData.get('priceRange'),
    openHours: (formData.get('openHours') || '').trim() || '-',
    tags,
    tip: (formData.get('tip') || '').trim(),
  };
}

// ─── 폼 제출 처리 ────────────────────────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const collected = collectFormData(formData);

  if (!collected) {
    alert('이름, 주소, 대표 메뉴는 필수 입력 항목입니다.');
    return;
  }

  // 좌표가 없으면 주소로 자동 변환
  if (!collected.lat || !collected.lng) {
    const coords = await geocodeAddress(collected.address);
    if (coords) {
      collected.lat = coords.lat;
      collected.lng = coords.lng;
      collected.distanceKm = haversineKm(coords.lat, coords.lng);
    } else {
      collected.lat = BASE_POINT.lat;
      collected.lng = BASE_POINT.lng;
      collected.distanceKm = 0;
    }
  }

  if (isAdmin) {
    // ── 관리자: 직접 반영 ──
    if (editingId !== null) {
      const restaurantData = { ...collected };
      try {
        await saveDirectOverride(editingId, 'edit', restaurantData, auth.currentUser.email);
        const idx = allRestaurants.findIndex(r => r.id === editingId);
        if (idx !== -1) {
          allRestaurants[idx] = { ...allRestaurants[idx], ...restaurantData };
        }
        closeModal();
        render();
        showToast('수정 완료!');
      } catch (err) {
        console.error('저장 실패:', err);
        showToast('저장에 실패했습니다.', 'error');
      }
    } else {
      const newId = Date.now();
      const restaurantData = { ...collected, id: newId };
      try {
        await saveDirectOverride(newId, 'add', restaurantData, auth.currentUser.email);
        allRestaurants.push({ ...restaurantData, _added: true });
        closeModal();
        render();
        showToast('등록 완료!');
      } catch (err) {
        console.error('등록 실패:', err);
        showToast('등록에 실패했습니다.', 'error');
      }
    }
  } else {
    // ── 일반 사용자: 제안 제출 ──
    const nickname = (formData.get('nickname') || '').trim();
    const reason   = (formData.get('reason')   || '').trim();

    if (!nickname || !reason) {
      alert('닉네임과 수정 이유를 입력해주세요.');
      return;
    }

    if (!checkThrottle()) {
      showToast('잠시 후 다시 시도해주세요. (30초 쿨다운)', 'error');
      return;
    }

    const type = editingId !== null ? 'edit' : 'add';
    const restaurantName = editingId !== null
      ? (allRestaurants.find(r => r.id === editingId)?.name || '')
      : collected.name;

    try {
      await submitSuggestion({
        restaurantId: editingId !== null ? editingId : Date.now(),
        restaurantName,
        type,
        proposedData: collected,
        nickname,
        reason
      });
      markThrottle();
      closeModal();
      showToast('제안이 접수되었습니다! 관리자 승인 후 반영됩니다.');
    } catch (err) {
      console.error('제안 제출 실패:', err);
      showToast('제안 제출에 실패했습니다.', 'error');
    }
  }
}

// ─── Firebase Auth 상태 리스너 ───────────────────────────────────────────────
function setupAuth() {
  const loginBtn   = document.getElementById('auth-login-btn');
  const logoutBtn  = document.getElementById('auth-logout-btn');
  const userInfo   = document.getElementById('auth-user-info');
  const adminLink  = document.getElementById('admin-link');

  loginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
      console.error('로그인 실패:', err);
      showToast('로그인에 실패했습니다.', 'error');
    });
  });

  logoutBtn.addEventListener('click', () => {
    auth.signOut();
  });

  auth.onAuthStateChanged(user => {
    if (user) {
      loginBtn.style.display = 'none';
      logoutBtn.style.display = '';
      userInfo.style.display = '';
      userInfo.textContent = user.email;
      isAdmin = (user.email === ADMIN_EMAIL);
      adminLink.style.display = isAdmin ? '' : 'none';
      if (isAdmin) {
        fetchPendingSuggestions().then(list => {
          const badge = document.getElementById('pending-badge');
          if (list.length > 0) {
            badge.textContent = list.length;
            badge.style.display = '';
          } else {
            badge.style.display = 'none';
          }
        }).catch(err => console.error('배지 조회 실패:', err));
      }
    } else {
      loginBtn.style.display = '';
      logoutBtn.style.display = 'none';
      userInfo.style.display = 'none';
      userInfo.textContent = '';
      isAdmin = false;
      adminLink.style.display = 'none';
    }
    // 권한 변경 시 버튼 텍스트 갱신
    render();
  });
}

// ─── 삭제 제안 모달 이벤트 ───────────────────────────────────────────────────
function setupDeleteSuggestModal() {
  const modal = document.getElementById('delete-suggest-modal');

  document.getElementById('delete-suggest-cancel').addEventListener('click', () => {
    modal.style.display = 'none';
    deletingRestaurant = null;
  });

  modal.addEventListener('click', e => {
    if (e.target === e.currentTarget) {
      modal.style.display = 'none';
      deletingRestaurant = null;
    }
  });

  document.getElementById('delete-suggest-submit').addEventListener('click', async () => {
    if (!deletingRestaurant) return;

    const nickname = document.getElementById('delete-nickname').value.trim();
    const reason   = document.getElementById('delete-reason').value.trim();

    if (!nickname || !reason) {
      alert('닉네임과 삭제 이유를 입력해주세요.');
      return;
    }

    if (!checkThrottle()) {
      showToast('잠시 후 다시 시도해주세요. (30초 쿨다운)', 'error');
      return;
    }

    try {
      await submitSuggestion({
        restaurantId: deletingRestaurant.id,
        restaurantName: deletingRestaurant.name,
        type: 'delete',
        proposedData: null,
        nickname,
        reason
      });
      markThrottle();
      modal.style.display = 'none';
      deletingRestaurant = null;
      showToast('삭제 제안이 접수되었습니다! 관리자 승인 후 반영됩니다.');
    } catch (err) {
      console.error('삭제 제안 실패:', err);
      showToast('삭제 제안 제출에 실패했습니다.', 'error');
    }
  });
}

// ─── 초기화 ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  render();

  // Firestore 오버라이드 비동기 로드
  loadFirestoreOverrides();

  // Firebase Auth 세팅
  setupAuth();

  // 삭제 제안 모달
  setupDeleteSuggestModal();

  document.getElementById('reset-btn').addEventListener('click', resetFilters);
  document.getElementById('add-restaurant-btn').addEventListener('click', () => openModal());
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('add-form').addEventListener('submit', handleSubmit);

  // 검색창 이벤트
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    searchClear.style.display = searchQuery ? '' : 'none';
    currentPage = 1;
    render();
  });
  searchClear.addEventListener('click', () => {
    searchQuery = '';
    searchInput.value = '';
    searchClear.style.display = 'none';
    currentPage = 1;
    render();
  });
});
