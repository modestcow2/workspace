// ─── Firestore 데이터 접근 레이어 ────────────────────────────────────────────

/**
 * 승인된 오버라이드 전체 조회
 * @returns {Promise<Object>} { [restaurantId]: { type, data, approvedAt, approvedBy } }
 */
async function fetchOverrides() {
  const snap = await db.collection('approved_overrides').get();
  const overrides = {};
  snap.forEach(doc => {
    overrides[doc.id] = doc.data();
  });
  return overrides;
}

/**
 * 기본 데이터(RESTAURANTS)에 Firestore 오버라이드를 병합
 * @param {Array} baseData - data.js의 RESTAURANTS
 * @param {Object} overrides - fetchOverrides() 결과
 * @returns {Array} 병합된 식당 배열
 */
function applyOverrides(baseData, overrides) {
  const result = [];

  // 기존 데이터 처리 (edit/delete)
  baseData.forEach(r => {
    const id = String(r.id);
    const ov = overrides[id];
    if (!ov) {
      result.push(r);
    } else if (ov.type === 'delete') {
      // 삭제됨 — 제외
    } else if (ov.type === 'edit') {
      result.push({ ...r, ...ov.data, id: r.id });
    }
  });

  // 신규 추가 (type === 'add')
  Object.entries(overrides).forEach(([id, ov]) => {
    if (ov.type === 'add' && ov.data) {
      const exists = result.find(r => String(r.id) === id);
      if (!exists) {
        result.push({ ...ov.data, id: Number(id) || id, _added: true });
      }
    }
  });

  return result;
}

/**
 * 수정/삭제/추가 제안 제출 (일반 사용자)
 */
async function submitSuggestion({ restaurantId, restaurantName, type, proposedData, nickname, reason }) {
  return db.collection('suggestions').add({
    restaurantId,
    restaurantName: restaurantName || '',
    type,
    status: 'pending',
    proposedData: proposedData || null,
    nickname: nickname || '익명',
    reason: reason || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null
  });
}

/**
 * 대기 중인 제안 목록 조회
 */
async function fetchPendingSuggestions() {
  const snap = await db.collection('suggestions')
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * 모든 제안 조회 (관리자용)
 */
async function fetchAllSuggestions() {
  const snap = await db.collection('suggestions')
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * 제안 승인
 */
async function approveSuggestion(suggestionId, suggestion, adminEmail, reviewNote) {
  const batch = db.batch();

  // 1) suggestion 상태 업데이트
  const sugRef = db.collection('suggestions').doc(suggestionId);
  batch.update(sugRef, {
    status: 'approved',
    reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
    reviewedBy: adminEmail,
    reviewNote: reviewNote || null
  });

  // 2) approved_overrides에 반영
  const ovRef = db.collection('approved_overrides').doc(String(suggestion.restaurantId));
  batch.set(ovRef, {
    type: suggestion.type,
    data: suggestion.proposedData || null,
    approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
    approvedBy: adminEmail
  });

  return batch.commit();
}

/**
 * 제안 거절
 */
async function rejectSuggestion(suggestionId, adminEmail, reviewNote) {
  return db.collection('suggestions').doc(suggestionId).update({
    status: 'rejected',
    reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
    reviewedBy: adminEmail,
    reviewNote: reviewNote || null
  });
}

/**
 * 관리자 직접 오버라이드 저장
 */
async function saveDirectOverride(restaurantId, type, data, adminEmail) {
  return db.collection('approved_overrides').doc(String(restaurantId)).set({
    type,
    data: data || null,
    approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
    approvedBy: adminEmail
  });
}

/**
 * 스팸 방지: sessionStorage 기반 쿨다운 (30초)
 */
function checkThrottle() {
  const last = sessionStorage.getItem('last_suggestion_time');
  if (last && Date.now() - Number(last) < 30000) {
    return false; // 쿨다운 중
  }
  return true;
}

function markThrottle() {
  sessionStorage.setItem('last_suggestion_time', String(Date.now()));
}
