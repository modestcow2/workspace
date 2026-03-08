const BASE_POINT = { lat: 37.5796, lng: 126.9770, name: '한국생산성본부' };

const FILTER_META = {
  flavor:   { label: '맛의 조화',   icon: '👅',
    options: ['매운맛', '단맛', '짠맛', '기름진', '담백·깔끔', '새콤한'] },
  texture:  { label: '식감·무게감', icon: '🫦',
    options: ['바삭한', '쫄깃한', '아삭한', '부드러운', '헤비한', '가벼운'] },
  cooking:  { label: '조리 방식',   icon: '🍳',
    options: ['구이·볶음', '국물·찜', '생식·무침', '튀김'] },
  cuisine:  { label: '음식 국적',   icon: '🌍',
    options: ['한식', '중식', '일식', '양식', '아시안', '퓨전'] },
  temp:     { label: '온도',        icon: '🌡️',
    options: ['冷 차가운', '溫 따뜻한', '평균'] },
  occasion: { label: '상황·목적',   icon: '🎯',
    options: ['혼밥', '사교·회식', '안주'] },
  health:   { label: '건강·소화',   icon: '💪',
    options: ['디톡스', '벌크업·보양', '저자극'] },
};

// ※ 아래 데이터는 경복궁역 일대의 대표 식당 유형을 기반으로 작성된 예시입니다.
// ※ 실제 좌표는 Google Maps 우클릭 → 좌표 복사로 확인 후 수정하세요.
const RESTAURANTS = [
  // ── 한식 10 ──────────────────────────────────────────────
  {
    id: 1, name: '토속촌 삼계탕',
    address: '서울 종로구 자하문로5길 5',
    lat: 37.5840, lng: 126.9754, distanceKm: 0.5,
    mainMenu: ['삼계탕', '옻닭', '흑삼계탕'],
    priceRange: '₩₩₩', openHours: '10:00~22:00',
    tags: { flavor: ['담백·깔끔'], texture: ['부드러운', '헤비한'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['溫 따뜻한'], occasion: ['사교·회식'], health: ['벌크업·보양'] },
    tip: '외국인 관광객에게도 유명한 40년 전통 삼계탕 전문점'
  },
  {
    id: 2, name: '경복궁 쌈밥집',
    address: '서울 종로구 사직로8길 36',
    lat: 37.5810, lng: 126.9760, distanceKm: 0.3,
    mainMenu: ['쌈밥', '된장찌개', '보쌈'],
    priceRange: '₩₩', openHours: '11:30~21:00',
    tags: { flavor: ['담백·깔끔'], texture: ['아삭한', '가벼운'], cooking: ['생식·무침'], cuisine: ['한식'], temp: ['溫 따뜻한'], occasion: ['사교·회식'], health: ['디톡스'] },
    tip: '신선한 제철 채소 쌈과 손두부가 일품'
  },
  {
    id: 3, name: '광화문 국밥',
    address: '서울 종로구 새문안로3길 30',
    lat: 37.5770, lng: 126.9766, distanceKm: 0.3,
    mainMenu: ['순대국밥', '돼지국밥', '콩나물국밥'],
    priceRange: '₩', openHours: '07:00~21:00',
    tags: { flavor: ['담백·깔끔', '짠맛'], texture: ['부드러운', '헤비한'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['溫 따뜻한'], occasion: ['혼밥'], health: ['저자극'] },
    tip: '아침 일찍부터 열어 해장으로 인기'
  },
  {
    id: 4, name: '인사동 된장찌개',
    address: '서울 종로구 인사동길 32',
    lat: 37.5740, lng: 126.9842, distanceKm: 1.1,
    mainMenu: ['된장찌개', '청국장', '두부조림'],
    priceRange: '₩₩', openHours: '11:00~21:00',
    tags: { flavor: ['담백·깔끔', '짠맛'], texture: ['부드러운', '가벼운'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['溫 따뜻한'], occasion: ['혼밥'], health: ['저자극'] },
    tip: '인사동 골목 안 숨은 집밥 맛집'
  },
  {
    id: 5, name: '삼청동 비빔밥',
    address: '서울 종로구 삼청로 100',
    lat: 37.5870, lng: 126.9804, distanceKm: 1.2,
    mainMenu: ['돌솥비빔밥', '육회비빔밥', '산채비빔밥'],
    priceRange: '₩₩', openHours: '11:00~20:00',
    tags: { flavor: ['매운맛', '담백·깔끔', '새콤한'], texture: ['아삭한', '가벼운'], cooking: ['생식·무침'], cuisine: ['한식'], temp: ['冷 차가운'], occasion: ['혼밥'], health: ['디톡스'] },
    tip: '삼청동 카페거리 초입, 돌솥비빔밥이 대표 메뉴'
  },
  {
    id: 6, name: '서촌 불고기',
    address: '서울 종로구 필운대로1길 14',
    lat: 37.5756, lng: 126.9732, distanceKm: 0.6,
    mainMenu: ['불고기', '제육볶음', '갈비찜'],
    priceRange: '₩₩₩', openHours: '11:30~22:00',
    tags: { flavor: ['단맛', '기름진'], texture: ['쫄깃한', '헤비한'], cooking: ['구이·볶음'], cuisine: ['한식'], temp: ['溫 따뜻한'], occasion: ['사교·회식', '안주'], health: ['벌크업·보양'] },
    tip: '서촌 골목 분위기와 잘 어울리는 정통 불고기'
  },
  {
    id: 7, name: '서촌 한정식',
    address: '서울 종로구 자하문로15길 10',
    lat: 37.5831, lng: 126.9697, distanceKm: 1.0,
    mainMenu: ['한정식', '갈비탕', '전복죽'],
    priceRange: '₩₩₩₩', openHours: '12:00~21:00',
    tags: { flavor: ['담백·깔끔'], texture: ['아삭한', '부드러운'], cooking: ['국물·찜', '생식·무침'], cuisine: ['한식'], temp: ['溫 따뜻한'], occasion: ['사교·회식'], health: ['저자극'] },
    tip: '한옥 분위기에서 즐기는 프리미엄 한정식'
  },
  {
    id: 8, name: '통인시장 도시락카페',
    address: '서울 종로구 자하문로15길 18',
    lat: 37.5836, lng: 126.9686, distanceKm: 1.1,
    mainMenu: ['엽전도시락', '떡볶이', '오징어튀김'],
    priceRange: '₩', openHours: '10:00~17:00',
    tags: { flavor: ['매운맛', '단맛'], texture: ['바삭한', '쫄깃한'], cooking: ['튀김', '구이·볶음'], cuisine: ['한식'], temp: ['溫 따뜻한'], occasion: ['혼밥'], health: [] },
    tip: '엽전으로 원하는 반찬을 골라 담는 체험형 식당'
  },
  {
    id: 9, name: '광화문 갈비',
    address: '서울 종로구 새문안로 57',
    lat: 37.5762, lng: 126.9768, distanceKm: 0.4,
    mainMenu: ['LA갈비', '너비아니', '갈비탕'],
    priceRange: '₩₩₩', openHours: '11:30~22:00',
    tags: { flavor: ['단맛', '기름진'], texture: ['쫄깃한', '헤비한'], cooking: ['구이·볶음'], cuisine: ['한식'], temp: ['溫 따뜻한'], occasion: ['사교·회식', '안주'], health: ['벌크업·보양'] },
    tip: '직화구이로 즐기는 부드러운 LA갈비'
  },
  {
    id: 10, name: '북촌 순두부',
    address: '서울 종로구 북촌로 37',
    lat: 37.5838, lng: 126.9833, distanceKm: 1.4,
    mainMenu: ['순두부찌개', '두부전골', '콩비지'],
    priceRange: '₩₩', openHours: '11:00~21:00',
    tags: { flavor: ['매운맛'], texture: ['부드러운', '가벼운'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['溫 따뜻한'], occasion: ['혼밥'], health: ['저자극'] },
    tip: '북촌 한옥마을 인근, 바지락 넣은 얼큰 순두부찌개'
  },

  // ── 중식 2 ──────────────────────────────────────────────
  {
    id: 11, name: '광화문 중화반점',
    address: '서울 종로구 새문안로3길 15',
    lat: 37.5749, lng: 126.9780, distanceKm: 0.5,
    mainMenu: ['짜장면', '짬뽕', '탕수육'],
    priceRange: '₩₩', openHours: '11:00~21:30',
    tags: { flavor: ['매운맛', '짠맛', '기름진'], texture: ['쫄깃한', '헤비한'], cooking: ['국물·찜', '구이·볶음'], cuisine: ['중식'], temp: ['溫 따뜻한'], occasion: ['혼밥', '사교·회식'], health: [] },
    tip: '50년 전통, 직접 뽑은 수타면이 특징'
  },
  {
    id: 12, name: '딤섬하우스',
    address: '서울 종로구 종로 51',
    lat: 37.5728, lng: 126.9761, distanceKm: 0.9,
    mainMenu: ['하가우', '샤오마이', '춘권'],
    priceRange: '₩₩₩', openHours: '11:30~21:00',
    tags: { flavor: ['기름진', '담백·깔끔'], texture: ['쫄깃한', '바삭한'], cooking: ['국물·찜', '튀김'], cuisine: ['중식'], temp: ['溫 따뜻한'], occasion: ['사교·회식'], health: [] },
    tip: '홍콩식 딤섬 전문, 런치 타임 특히 붐빔'
  },

  // ── 일식 4 ──────────────────────────────────────────────
  {
    id: 13, name: '경복궁 스시',
    address: '서울 종로구 사직로8길 20',
    lat: 37.5803, lng: 126.9773, distanceKm: 0.1,
    mainMenu: ['스시 세트', '사시미', '롤'],
    priceRange: '₩₩₩', openHours: '11:30~22:00',
    tags: { flavor: ['담백·깔끔', '새콤한'], texture: ['부드러운', '가벼운'], cooking: ['생식·무침'], cuisine: ['일식'], temp: ['冷 차가운'], occasion: ['사교·회식', '안주'], health: ['디톡스'] },
    tip: '경복궁 뷰와 함께 즐기는 신선한 스시'
  },
  {
    id: 14, name: '광화문 라멘',
    address: '서울 종로구 새문안로5가길 28',
    lat: 37.5762, lng: 126.9770, distanceKm: 0.4,
    mainMenu: ['돈코츠 라멘', '쇼유 라멘', '츠케멘'],
    priceRange: '₩₩', openHours: '11:00~22:00',
    tags: { flavor: ['기름진', '짠맛'], texture: ['쫄깃한', '헤비한'], cooking: ['국물·찜'], cuisine: ['일식'], temp: ['溫 따뜻한'], occasion: ['혼밥'], health: [] },
    tip: '12시간 우린 진한 돈코츠 육수가 핵심'
  },
  {
    id: 15, name: '인사동 돈카츠',
    address: '서울 종로구 인사동10길 11',
    lat: 37.5755, lng: 126.9840, distanceKm: 1.0,
    mainMenu: ['로스카츠', '히레카츠', '카츠동'],
    priceRange: '₩₩', openHours: '11:30~20:30',
    tags: { flavor: ['기름진'], texture: ['바삭한', '헤비한'], cooking: ['튀김'], cuisine: ['일식'], temp: ['溫 따뜻한'], occasion: ['혼밥'], health: [] },
    tip: '두툼한 고기에 빵가루 겉바속촉'
  },
  {
    id: 16, name: '삼청동 오마카세',
    address: '서울 종로구 삼청로 75',
    lat: 37.5868, lng: 126.9797, distanceKm: 1.2,
    mainMenu: ['오마카세 코스', '우니', '오토로'],
    priceRange: '₩₩₩₩', openHours: '12:00~22:00 (예약제)',
    tags: { flavor: ['담백·깔끔', '새콤한'], texture: ['부드러운', '가벼운'], cooking: ['생식·무침'], cuisine: ['일식'], temp: ['冷 차가운'], occasion: ['사교·회식', '안주'], health: ['디톡스'] },
    tip: '제철 재료로 구성되는 10피스 오마카세'
  },

  // ── 양식 4 ──────────────────────────────────────────────
  {
    id: 17, name: '광화문 파스타',
    address: '서울 종로구 새문안로 32',
    lat: 37.5758, lng: 126.9773, distanceKm: 0.4,
    mainMenu: ['까르보나라', '아라비아타', '리조토'],
    priceRange: '₩₩', openHours: '11:30~21:30',
    tags: { flavor: ['기름진', '담백·깔끔'], texture: ['쫄깃한', '가벼운'], cooking: ['구이·볶음'], cuisine: ['양식'], temp: ['溫 따뜻한'], occasion: ['혼밥', '사교·회식'], health: [] },
    tip: '신선한 생면 파스타, 런치 세트 가성비 좋음'
  },
  {
    id: 18, name: '세종로 스테이크하우스',
    address: '서울 종로구 세종대로 163',
    lat: 37.5742, lng: 126.9766, distanceKm: 0.6,
    mainMenu: ['등심 스테이크', '안심 스테이크', '립아이'],
    priceRange: '₩₩₩₩', openHours: '11:30~22:00',
    tags: { flavor: ['기름진', '짠맛'], texture: ['부드러운', '헤비한'], cooking: ['구이·볶음'], cuisine: ['양식'], temp: ['溫 따뜻한'], occasion: ['사교·회식', '안주'], health: ['벌크업·보양'] },
    tip: '미국산 프라임 등급 소고기 사용'
  },
  {
    id: 19, name: '경복궁 브런치',
    address: '서울 종로구 사직로 72',
    lat: 37.5812, lng: 126.9762, distanceKm: 0.2,
    mainMenu: ['에그 베네딕트', '아보카도 토스트', '팬케이크'],
    priceRange: '₩₩', openHours: '09:00~17:00',
    tags: { flavor: ['담백·깔끔'], texture: ['부드러운', '가벼운'], cooking: ['구이·볶음'], cuisine: ['양식'], temp: ['溫 따뜻한'], occasion: ['혼밥', '사교·회식'], health: ['디톡스'] },
    tip: '경복궁 돌담길 뷰, 주말 웨이팅 필수'
  },
  {
    id: 20, name: '서촌 피자',
    address: '서울 종로구 자하문로 57',
    lat: 37.5823, lng: 126.9680, distanceKm: 1.2,
    mainMenu: ['마르게리따', '페퍼로니', '4치즈'],
    priceRange: '₩₩₩', openHours: '11:30~22:00',
    tags: { flavor: ['기름진', '짠맛'], texture: ['바삭한', '쫄깃한', '헤비한'], cooking: ['구이·볶음'], cuisine: ['양식'], temp: ['溫 따뜻한'], occasion: ['사교·회식', '안주'], health: [] },
    tip: '나폴리 정통 화덕피자, 크리스피한 크러스트'
  },

  // ── 분식 5 ──────────────────────────────────────────────
  {
    id: 21, name: '광화문 떡볶이',
    address: '서울 종로구 세종대로 175',
    lat: 37.5754, lng: 126.9772, distanceKm: 0.4,
    mainMenu: ['떡볶이', '순대', '튀김'],
    priceRange: '₩', openHours: '11:00~21:00',
    tags: { flavor: ['매운맛', '단맛'], texture: ['쫄깃한', '헤비한'], cooking: ['국물·찜', '구이·볶음'], cuisine: ['한식'], temp: ['溫 따뜻한'], occasion: ['혼밥', '안주'], health: [] },
    tip: '매콤달콤 국물 떡볶이, 어묵 꼬치 무한리필'
  },
  {
    id: 22, name: '경복궁역 김밥천국',
    address: '서울 종로구 사직로 35',
    lat: 37.5799, lng: 126.9760, distanceKm: 0.1,
    mainMenu: ['참치김밥', '치즈김밥', '라면'],
    priceRange: '₩', openHours: '07:00~22:00',
    tags: { flavor: ['담백·깔끔'], texture: ['쫄깃한', '가벼운'], cooking: ['생식·무침'], cuisine: ['한식'], temp: ['평균'], occasion: ['혼밥'], health: ['저자극'] },
    tip: '아침부터 저녁까지 가성비 최고의 한 끼'
  },
  {
    id: 23, name: '인사동 순대타운',
    address: '서울 종로구 인사동길 19',
    lat: 37.5737, lng: 126.9843, distanceKm: 1.2,
    mainMenu: ['순대볶음', '순대국밥', '머리고기'],
    priceRange: '₩', openHours: '10:00~22:00',
    tags: { flavor: ['기름진', '매운맛', '짠맛'], texture: ['쫄깃한', '헤비한'], cooking: ['국물·찜', '구이·볶음'], cuisine: ['한식'], temp: ['溫 따뜻한'], occasion: ['혼밥', '안주'], health: [] },
    tip: '직접 만든 당면 가득 순대, 막걸리와 찰떡궁합'
  },
  {
    id: 24, name: '삼청동 튀김집',
    address: '서울 종로구 삼청로 83',
    lat: 37.5855, lng: 126.9806, distanceKm: 1.1,
    mainMenu: ['모둠튀김', '오징어튀김', '고구마튀김'],
    priceRange: '₩', openHours: '11:00~19:00',
    tags: { flavor: ['기름진'], texture: ['바삭한', '헤비한'], cooking: ['튀김'], cuisine: ['한식'], temp: ['溫 따뜻한'], occasion: ['혼밥', '안주'], health: [] },
    tip: '삼청동 산책 중 간식으로 최고, 금방 튀긴 바삭함'
  },
  {
    id: 25, name: '광화문 라볶이',
    address: '서울 종로구 새문안로3길 7',
    lat: 37.5752, lng: 126.9774, distanceKm: 0.4,
    mainMenu: ['라볶이', '떡라볶이', '떡만두국'],
    priceRange: '₩', openHours: '10:30~21:30',
    tags: { flavor: ['매운맛', '단맛'], texture: ['쫄깃한', '헤비한'], cooking: ['국물·찜', '구이·볶음'], cuisine: ['한식'], temp: ['溫 따뜻한'], occasion: ['혼밥'], health: [] },
    tip: '라면+떡볶이 조합, 매운맛 단계 선택 가능'
  }
];
