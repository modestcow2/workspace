/**
 * 검색 쿼리 생성 모듈
 * 지역 키워드 × 음식 키워드 조합으로 네이버 지역 검색 쿼리를 생성한다.
 */

const AREA_KEYWORDS = [
  '경복궁역', '광화문', '서촌', '북촌', '삼청동',
  '인사동', '종로', '세종로', '사직동', '통인시장',
  '효자동', '청운동', '부암동', '안국역', '경복궁',
];

const FOOD_KEYWORDS = [
  '한식', '중식', '일식', '양식', '분식',
  '삼계탕', '비빔밥', '냉면', '칼국수', '국밥',
  '설렁탕', '불고기', '갈비', '삼겹살', '보쌈',
  '족발', '짜장면', '짬뽕', '마라탕', '스시',
  '라멘', '돈카츠', '파스타', '피자', '스테이크',
  '햄버거', '브런치', '쌀국수', '커리', '치킨',
  '순대', '만두', '백반', '한정식', '맛집',
  '해장국', '떡볶이', '샐러드', '포케', '오마카세',
];

function buildQueries() {
  const queries = [];
  for (const area of AREA_KEYWORDS) {
    for (const food of FOOD_KEYWORDS) {
      queries.push(`${area} ${food}`);
    }
  }
  return queries;
}

module.exports = { AREA_KEYWORDS, FOOD_KEYWORDS, buildQueries };
