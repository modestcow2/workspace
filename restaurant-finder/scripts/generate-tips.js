/**
 * 한 줄 특징(tip) 생성 모듈
 *
 * 수집된 외부 데이터를 조합하여 의미있는 tip을 생성합니다.
 * 우선순위:
 *   1. 리뷰 키워드 기반 (키워드가 있을 때)
 *   2. 메뉴+가격 기반 (메뉴 가격이 있을 때)
 *   3. 카테고리+특성 기반 (폴백)
 */

// 리뷰 키워드를 tip에 적합한 형태로 정리
const KEYWORD_EMOJI = {
  '혼밥': '🍚',
  '점심': '☀️',
  '저녁': '🌙',
  '웨이팅': '⏳',
  '매운': '🌶️',
  '매운맛': '🌶️',
  '양많은': '🍖',
  '양많음': '🍖',
  '분위기': '✨',
  '친절': '😊',
  '가성비': '💰',
  '회식': '🍻',
  '데이트': '💕',
  '주차': '🅿️',
};

// 가격대별 표현
function priceDescription(price) {
  if (price <= 7000) return '가성비 좋은';
  if (price <= 10000) return '든든한';
  if (price <= 15000) return '푸짐한';
  if (price <= 25000) return '제대로 된';
  if (price <= 40000) return '특별한';
  return '프리미엄';
}

// 메뉴 가격 포맷
function formatPrice(price) {
  if (price >= 10000) {
    return `${(price / 10000).toFixed(price % 10000 === 0 ? 0 : 1)}만원`;
  }
  return `${price.toLocaleString()}원`;
}

/**
 * tip 생성
 * @param {object} restaurant - 식당 데이터 (tags, mainMenu 등)
 * @param {object} placeDetail - place-detail-progress의 수집 데이터 (nullable)
 * @returns {string} 한 줄 특징 텍스트
 */
function generateTip(restaurant, placeDetail) {
  const parts = [];

  // 1. 리뷰 키워드 기반 tip
  if (placeDetail?.reviewKeywords && placeDetail.reviewKeywords.length >= 2) {
    const keywords = placeDetail.reviewKeywords.slice(0, 3);
    return keywords.join(' / ');
  }

  // 2. 메뉴+가격 기반 tip
  if (placeDetail?.menus && placeDetail.menus.length > 0) {
    const menus = placeDetail.menus.slice(0, 2);
    const menuTexts = menus.map(m => `${m.name} ${formatPrice(m.price)}`);
    const avgPrice = Math.round(menus.reduce((sum, m) => sum + m.price, 0) / menus.length);
    const desc = priceDescription(avgPrice);
    return `${menuTexts.join(' / ')} · ${desc} 한끼`;
  }

  // 3. 리뷰 키워드가 1개라도 있으면 활용
  if (placeDetail?.reviewKeywords && placeDetail.reviewKeywords.length === 1) {
    const kw = placeDetail.reviewKeywords[0];
    const menu = restaurant.mainMenu?.[0];
    if (menu) {
      return `${kw} · ${menu} 맛집`;
    }
    return `${kw}`;
  }

  // 4. 카테고리+특성 기반 (폴백)
  const tags = restaurant.tags || {};
  const cuisine = tags.cuisine?.[0] || '';
  const occasion = tags.occasion?.[0] || '';
  const flavor = tags.flavor?.[0] || '';
  const menu = restaurant.mainMenu?.[0] || '';

  // 특성 조합
  if (occasion === '혼밥' && menu) {
    return `1인 식사 가능 · ${menu}`;
  }
  if (occasion === '사교·회식' && menu) {
    return `모임·회식 추천 · ${menu}`;
  }
  if (flavor && menu) {
    return `${flavor} ${menu}`;
  }
  if (cuisine && menu) {
    return `${cuisine} ${menu}`;
  }
  if (menu) {
    return menu;
  }

  return cuisine || '맛집';
}

module.exports = { generateTip };
