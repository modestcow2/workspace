// ─── 관리자 페이지 로직 ──────────────────────────────────────────────────────
let currentAdmin = null;
let pendingAction = null; // { type: 'approve'|'reject', suggestionId, suggestion }

// ─── 인증 ────────────────────────────────────────────────────────────────────
document.getElementById('login-btn').addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    console.error('로그인 실패:', err);
    showAdminToast('로그인에 실패했습니다.', 'error');
  });
});

document.getElementById('logout-btn').addEventListener('click', () => {
  auth.signOut();
});

auth.onAuthStateChanged(user => {
  const loginBtn     = document.getElementById('login-btn');
  const logoutBtn    = document.getElementById('logout-btn');
  const userSpan     = document.getElementById('admin-user');
  const authRequired = document.getElementById('auth-required');
  const authDenied   = document.getElementById('auth-denied');
  const adminPanel   = document.getElementById('admin-panel');

  if (!user) {
    currentAdmin = null;
    loginBtn.style.display = '';
    logoutBtn.style.display = 'none';
    userSpan.textContent = '';
    authRequired.style.display = '';
    authDenied.style.display = 'none';
    adminPanel.style.display = 'none';
    return;
  }

  loginBtn.style.display = 'none';
  logoutBtn.style.display = '';
  userSpan.textContent = user.email;

  if (user.email !== ADMIN_EMAIL) {
    currentAdmin = null;
    authRequired.style.display = 'none';
    authDenied.style.display = '';
    adminPanel.style.display = 'none';
    return;
  }

  currentAdmin = user.email;
  authRequired.style.display = 'none';
  authDenied.style.display = 'none';
  adminPanel.style.display = '';
  loadSuggestions();
});

// ─── 탭 전환 ─────────────────────────────────────────────────────────────────
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.getElementById('tab-pending').style.display = target === 'pending' ? '' : 'none';
    document.getElementById('tab-reviewed').style.display = target === 'reviewed' ? '' : 'none';
  });
});

// ─── 제안 목록 로드 ──────────────────────────────────────────────────────────
async function loadSuggestions() {
  try {
    const all = await fetchAllSuggestions();
    const pending  = all.filter(s => s.status === 'pending');
    const reviewed = all.filter(s => s.status !== 'pending');

    document.getElementById('pending-count').textContent = `대기 중인 제안: ${pending.length}건`;
    renderSuggestionList(pending, 'pending-list', true);
    renderSuggestionList(reviewed, 'reviewed-list', false);
  } catch (err) {
    console.error('제안 목록 로드 실패:', err);
    showAdminToast('목록을 불러오는 데 실패했습니다.', 'error');
  }
}

// ─── 제안 카드 렌더링 ────────────────────────────────────────────────────────
function renderSuggestionList(suggestions, containerId, showActions) {
  const container = document.getElementById(containerId);

  if (suggestions.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-400 py-8">항목이 없습니다</p>';
    return;
  }

  container.innerHTML = suggestions.map(s => {
    const typeLabel = { edit: '수정', delete: '삭제', add: '추가' }[s.type] || s.type;
    const typeBadge = {
      edit:   'bg-blue-100 text-blue-700',
      delete: 'bg-red-100 text-red-700',
      add:    'bg-green-100 text-green-700'
    }[s.type] || 'bg-gray-100 text-gray-700';

    const statusBadge = {
      pending:  '<span class="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">대기</span>',
      approved: '<span class="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">승인</span>',
      rejected: '<span class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">거절</span>'
    }[s.status] || '';

    const time = s.createdAt ? new Date(s.createdAt.seconds * 1000).toLocaleString('ko-KR') : '-';

    // Diff 표시 (수정 제안일 때)
    let diffHtml = '';
    if (s.type === 'edit' && s.proposedData) {
      const original = RESTAURANTS.find(r => r.id === s.restaurantId);
      if (original) {
        diffHtml = buildDiffHtml(original, s.proposedData);
      }
    } else if (s.type === 'add' && s.proposedData) {
      diffHtml = `<div class="mt-2 p-3 bg-green-50 rounded-lg text-xs">
        <p class="font-semibold mb-1">새 식당 정보:</p>
        <p><strong>이름:</strong> ${escHtml(s.proposedData.name || '')}</p>
        <p><strong>주소:</strong> ${escHtml(s.proposedData.address || '')}</p>
        <p><strong>메뉴:</strong> ${escHtml((s.proposedData.mainMenu || []).join(', '))}</p>
        <p><strong>가격대:</strong> ${escHtml(s.proposedData.priceRange || '')}</p>
      </div>`;
    }

    const reviewInfo = s.status !== 'pending' && s.reviewedBy
      ? `<p class="text-xs text-gray-400 mt-1">처리: ${escHtml(s.reviewedBy)} ${s.reviewNote ? '— ' + escHtml(s.reviewNote) : ''}</p>`
      : '';

    const actionBtns = showActions ? `
      <div class="flex gap-2 mt-3">
        <button class="approve-btn text-xs px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors" data-sid="${s.id}">✅ 승인</button>
        <button class="reject-btn text-xs px-4 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors" data-sid="${s.id}">❌ 거절</button>
      </div>
    ` : '';

    return `
      <div class="bg-white rounded-xl shadow-sm p-4 suggestion-card" data-sid="${s.id}">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-xs px-2 py-0.5 rounded-full font-semibold ${typeBadge}">${typeLabel}</span>
            ${statusBadge}
            <span class="text-sm font-bold">${escHtml(s.restaurantName || '식당 #' + s.restaurantId)}</span>
          </div>
          <span class="text-xs text-gray-400">${time}</span>
        </div>
        <div class="text-xs text-gray-600">
          <span class="font-semibold">제안자:</span> ${escHtml(s.nickname || '익명')}
          <span class="ml-3 font-semibold">사유:</span> ${escHtml(s.reason || '-')}
        </div>
        ${diffHtml}
        ${reviewInfo}
        ${actionBtns}
      </div>
    `;
  }).join('');

  // 버튼 이벤트 바인딩
  if (showActions) {
    container.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = suggestions.find(x => x.id === btn.dataset.sid);
        if (s) openReviewModal('approve', s);
      });
    });
    container.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = suggestions.find(x => x.id === btn.dataset.sid);
        if (s) openReviewModal('reject', s);
      });
    });
  }
}

// ─── Diff 표시 ───────────────────────────────────────────────────────────────
function buildDiffHtml(original, proposed) {
  const fields = [
    { key: 'name',       label: '이름' },
    { key: 'address',    label: '주소' },
    { key: 'mainMenu',   label: '메뉴',     fmt: v => Array.isArray(v) ? v.join(', ') : v },
    { key: 'priceRange', label: '가격대' },
    { key: 'openHours',  label: '영업시간' },
    { key: 'tip',        label: '한 줄 특징' },
  ];

  let rows = '';
  fields.forEach(f => {
    const origVal = f.fmt ? f.fmt(original[f.key]) : (original[f.key] || '');
    const propVal = f.fmt ? f.fmt(proposed[f.key]) : (proposed[f.key] || '');
    if (String(origVal) !== String(propVal)) {
      rows += `<tr>
        <td class="font-semibold pr-3 align-top">${f.label}</td>
        <td class="text-red-500 line-through pr-3">${escHtml(String(origVal))}</td>
        <td class="text-green-600 font-medium">${escHtml(String(propVal))}</td>
      </tr>`;
    }
  });

  if (!rows) return '<p class="text-xs text-gray-400 mt-2">변경된 필드가 없습니다</p>';

  return `<div class="mt-2 overflow-x-auto">
    <table class="text-xs w-full">
      <thead><tr class="text-gray-500"><th class="text-left pr-3">필드</th><th class="text-left pr-3">원본</th><th class="text-left">제안</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ─── 리뷰 모달 ───────────────────────────────────────────────────────────────
function openReviewModal(action, suggestion) {
  pendingAction = { type: action, suggestionId: suggestion.id, suggestion };
  document.getElementById('review-modal-title').textContent =
    action === 'approve' ? '✅ 승인 확인' : '❌ 거절 확인';
  document.getElementById('review-note').value = '';
  document.getElementById('review-modal').style.display = 'flex';
}

document.getElementById('review-cancel').addEventListener('click', () => {
  document.getElementById('review-modal').style.display = 'none';
  pendingAction = null;
});

document.getElementById('review-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) {
    e.currentTarget.style.display = 'none';
    pendingAction = null;
  }
});

document.getElementById('review-confirm').addEventListener('click', async () => {
  if (!pendingAction || !currentAdmin) return;

  const note = document.getElementById('review-note').value.trim();
  const btn = document.getElementById('review-confirm');
  btn.disabled = true;
  btn.textContent = '처리 중...';

  try {
    if (pendingAction.type === 'approve') {
      await approveSuggestion(pendingAction.suggestionId, pendingAction.suggestion, currentAdmin, note);
      showAdminToast('승인 완료!');
    } else {
      await rejectSuggestion(pendingAction.suggestionId, currentAdmin, note);
      showAdminToast('거절 완료!');
    }
    document.getElementById('review-modal').style.display = 'none';
    pendingAction = null;
    loadSuggestions();
  } catch (err) {
    console.error('처리 실패:', err);
    showAdminToast('처리에 실패했습니다.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '확인';
  }
});

// ─── 토스트 ──────────────────────────────────────────────────────────────────
function showAdminToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast toast-' + type;
  toast.style.display = '';
  setTimeout(() => { toast.style.display = 'none'; }, 3000);
}
