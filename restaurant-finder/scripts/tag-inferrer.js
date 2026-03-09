/**
 * 태그 추론 모듈
 * 네이버 카테고리 문자열 + 식당명으로부터 7차원 태그, 가격대, 메뉴 등을 추론한다.
 */

// 카테고리 키워드 → 태그 매핑 규칙 (우선순위: 먼저 매칭되는 것이 우선)
const RULES = [
  // 한식 - 탕/국물류
  { keywords: ['삼계탕', '보양식', '옻닭', '백숙'],
    tags: { flavor: ['담백 깔끔'], texture: ['부드러운', '헤비한'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: ['벌크업·보양'] },
    price: '₩₩', menu: ['삼계탕'] },
  { keywords: ['국밥', '설렁탕', '곰탕', '뼈해장국'],
    tags: { flavor: ['담백 깔끔'], texture: ['부드러운'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: ['저자극'] },
    price: '₩', menu: ['국밥'] },
  { keywords: ['해장국', '감자탕', '뼈다귀'],
    tags: { flavor: ['매운'], texture: ['헤비한'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩', menu: ['해장국'] },
  { keywords: ['칼국수', '수제비', '손칼국수'],
    tags: { flavor: ['담백 깔끔'], texture: ['쫄깃한'], cooking: ['면류·파스타'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: ['저자극'] },
    price: '₩', menu: ['칼국수'] },
  { keywords: ['냉면', '막국수', '밀면'],
    tags: { flavor: ['새콤한', '담백 깔끔'], texture: ['쫄깃한'], cooking: ['면류·파스타'], cuisine: ['한식'], temp: ['차가운'], occasion: ['혼밥'], health: [] },
    price: '₩₩', menu: ['냉면'] },
  { keywords: ['찌개', '된장찌개', '김치찌개', '순두부'],
    tags: { flavor: ['짠'], texture: ['부드러운'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩', menu: ['찌개'] },
  { keywords: ['전골', '샤브샤브', '부대찌개'],
    tags: { flavor: ['짠'], texture: ['헤비한'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['사교·회식'], health: [] },
    price: '₩₩', menu: ['전골'] },

  // 한식 - 구이/고기류
  { keywords: ['갈비', '갈비찜'],
    tags: { flavor: ['단', '기름진'], texture: ['부드러운', '헤비한'], cooking: ['구이·볶음'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['사교·회식'], health: [] },
    price: '₩₩₩', menu: ['갈비'] },
  { keywords: ['삼겹살', '목살', '돼지고기', '고깃집', '구이', '소고기', '한우'],
    tags: { flavor: ['기름진'], texture: ['헤비한'], cooking: ['구이·볶음'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['사교·회식', '안주'], health: [] },
    price: '₩₩₩', menu: ['고기구이'] },
  { keywords: ['불고기'],
    tags: { flavor: ['단', '기름진'], texture: ['부드러운'], cooking: ['구이·볶음'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['사교·회식'], health: [] },
    price: '₩₩', menu: ['불고기'] },
  { keywords: ['보쌈'],
    tags: { flavor: ['담백 깔끔'], texture: ['부드러운', '헤비한'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['사교·회식', '안주'], health: [] },
    price: '₩₩', menu: ['보쌈'] },
  { keywords: ['족발'],
    tags: { flavor: ['기름진'], texture: ['쫄깃한', '헤비한'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['사교·회식', '안주'], health: [] },
    price: '₩₩', menu: ['족발'] },

  // 한식 - 밥/면류
  { keywords: ['비빔밥', '돌솥밥'],
    tags: { flavor: ['매운', '담백 깔끔'], texture: ['아삭한'], cooking: ['생식·무침'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩', menu: ['비빔밥'] },
  { keywords: ['한정식'],
    tags: { flavor: ['담백 깔끔'], texture: ['가벼운'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['사교·회식'], health: ['저자극'] },
    price: '₩₩₩', menu: ['한정식'] },
  { keywords: ['백반', '정식', '가정식'],
    tags: { flavor: ['담백 깔끔'], texture: ['가벼운'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: ['저자극'] },
    price: '₩', menu: ['백반'] },
  { keywords: ['죽'],
    tags: { flavor: ['담백 깔끔'], texture: ['부드러운', '가벼운'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: ['저자극'] },
    price: '₩', menu: ['죽'] },

  // 분식
  { keywords: ['떡볶이', '분식'],
    tags: { flavor: ['매운', '단'], texture: ['쫄깃한'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩', menu: ['떡볶이'] },
  { keywords: ['순대'],
    tags: { flavor: ['담백 깔끔'], texture: ['쫄깃한', '부드러운'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['혼밥', '안주'], health: [] },
    price: '₩', menu: ['순대'] },
  { keywords: ['만두'],
    tags: { flavor: ['담백 깔끔'], texture: ['부드러운'], cooking: ['국물·찜'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩', menu: ['만두'] },

  // 한식 - 치킨/기타
  { keywords: ['치킨', '닭강정', '후라이드', '양념치킨'],
    tags: { flavor: ['기름진'], texture: ['바삭한'], cooking: ['튀김'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['사교·회식', '안주'], health: [] },
    price: '₩₩', menu: ['치킨'] },

  // 중식
  { keywords: ['짜장면', '짬뽕', '중국집', '중화요리'],
    tags: { flavor: ['짠', '기름진'], texture: ['쫄깃한'], cooking: ['면류·파스타'], cuisine: ['중식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩', menu: ['짜장면', '짬뽕'] },
  { keywords: ['마라탕', '마라', '훠궈'],
    tags: { flavor: ['매운', '기름진'], texture: ['헤비한'], cooking: ['국물·찜'], cuisine: ['중식'], temp: ['뜨끈한'], occasion: ['사교·회식'], health: [] },
    price: '₩₩', menu: ['마라탕'] },
  { keywords: ['딤섬'],
    tags: { flavor: ['담백 깔끔'], texture: ['부드러운'], cooking: ['국물·찜'], cuisine: ['중식'], temp: ['뜨끈한'], occasion: ['사교·회식'], health: [] },
    price: '₩₩', menu: ['딤섬'] },

  // 일식
  { keywords: ['초밥', '스시', '오마카세'],
    tags: { flavor: ['담백 깔끔', '감칠맛'], texture: ['부드러운'], cooking: ['생식·무침'], cuisine: ['일식'], temp: ['차가운'], occasion: ['사교·회식'], health: [] },
    price: '₩₩₩', menu: ['초밥'] },
  { keywords: ['라멘', '라면'],
    tags: { flavor: ['짠', '기름진', '감칠맛'], texture: ['쫄깃한'], cooking: ['면류·파스타'], cuisine: ['일식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩₩', menu: ['라멘'] },
  { keywords: ['돈카츠', '돈까스', '카츠'],
    tags: { flavor: ['기름진'], texture: ['바삭한'], cooking: ['튀김'], cuisine: ['일식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩₩', menu: ['돈카츠'] },
  { keywords: ['우동', '소바'],
    tags: { flavor: ['담백 깔끔'], texture: ['쫄깃한'], cooking: ['면류·파스타'], cuisine: ['일식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: ['저자극'] },
    price: '₩', menu: ['우동'] },
  { keywords: ['사시미', '회', '횟집'],
    tags: { flavor: ['담백 깔끔'], texture: ['아삭한'], cooking: ['생식·무침'], cuisine: ['일식'], temp: ['차가운'], occasion: ['사교·회식', '안주'], health: [] },
    price: '₩₩₩', menu: ['회'] },

  // 양식
  { keywords: ['이탈리아음식', '이탈리안', '이탈리아'],
    tags: { flavor: ['기름진'], texture: ['쫄깃한'], cooking: ['면류·파스타'], cuisine: ['이탈리안'], temp: ['뜨끈한'], occasion: ['사교·회식'], health: [] },
    price: '₩₩', menu: ['이탈리안'] },
  { keywords: ['프랑스음식', '프렌치'],
    tags: { flavor: ['기름진', '감칠맛'], texture: ['부드러운'], cooking: ['오븐·화덕'], cuisine: ['양식'], temp: ['뜨끈한'], occasion: ['사교·회식'], health: [] },
    price: '₩₩₩', menu: ['프렌치'] },
  { keywords: ['스페인음식'],
    tags: { flavor: ['기름진', '짠'], texture: ['가벼운'], cooking: ['구이·볶음'], cuisine: ['양식'], temp: ['뜨끈한'], occasion: ['사교·회식'], health: [] },
    price: '₩₩', menu: ['스페인요리'] },
  { keywords: ['멕시코', '남미음식', '타코'],
    tags: { flavor: ['매운', '기름진'], texture: ['바삭한'], cooking: ['구이·볶음'], cuisine: ['에스닉'], temp: ['뜨끈한'], occasion: ['사교·회식'], health: [] },
    price: '₩₩', menu: ['멕시코요리'] },
  { keywords: ['패밀리레스토랑'],
    tags: { flavor: ['기름진'], texture: ['헤비한'], cooking: ['구이·볶음'], cuisine: ['양식'], temp: ['뜨끈한'], occasion: ['사교·회식'], health: [] },
    price: '₩₩', menu: ['양식'] },
  { keywords: ['파스타', '스파게티'],
    tags: { flavor: ['기름진'], texture: ['쫄깃한'], cooking: ['면류·파스타'], cuisine: ['이탈리안'], temp: ['뜨끈한'], occasion: ['사교·회식'], health: [] },
    price: '₩₩', menu: ['파스타'] },
  { keywords: ['피자'],
    tags: { flavor: ['기름진', '짠'], texture: ['바삭한', '쫄깃한'], cooking: ['오븐·화덕'], cuisine: ['이탈리안'], temp: ['뜨끈한'], occasion: ['사교·회식'], health: [] },
    price: '₩₩', menu: ['피자'] },
  { keywords: ['스테이크', '립'],
    tags: { flavor: ['기름진', '감칠맛'], texture: ['부드러운', '헤비한'], cooking: ['구이·볶음'], cuisine: ['양식'], temp: ['뜨끈한'], occasion: ['사교·회식'], health: ['벌크업·보양'] },
    price: '₩₩₩', menu: ['스테이크'] },
  { keywords: ['햄버거', '버거'],
    tags: { flavor: ['기름진', '짠'], texture: ['헤비한'], cooking: ['구이·볶음'], cuisine: ['양식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩₩', menu: ['햄버거'] },
  { keywords: ['브런치'],
    tags: { flavor: ['단', '담백 깔끔'], texture: ['바삭한', '가벼운'], cooking: ['오븐·화덕'], cuisine: ['양식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩₩', menu: ['브런치'] },
  { keywords: ['카페', '베이커리', '빵', '디저트', '케이크', '마카롱', '와플', '크로플', '도넛', '아이스크림', '젤라토', '타르트'],
    tags: { flavor: ['단'], texture: ['부드러운', '가벼운'], cooking: ['오븐·화덕'], cuisine: ['디저트·카페'], temp: ['차가운'], occasion: ['혼밥'], health: [] },
    price: '₩₩', menu: ['디저트'] },
  { keywords: ['샐러드', '포케'],
    tags: { flavor: ['새콤한', '담백 깔끔'], texture: ['아삭한', '가벼운'], cooking: ['생식·무침'], cuisine: ['양식'], temp: ['차가운'], occasion: ['혼밥'], health: ['디톡스'] },
    price: '₩₩', menu: ['샐러드'] },

  // 에스닉
  { keywords: ['베트남음식'],
    tags: { flavor: ['새콤한', '담백 깔끔'], texture: ['쫄깃한', '가벼운'], cooking: ['면류·파스타'], cuisine: ['에스닉'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩', menu: ['베트남요리'] },
  { keywords: ['태국음식'],
    tags: { flavor: ['매운', '새콤한'], texture: ['가벼운'], cooking: ['구이·볶음'], cuisine: ['에스닉'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩₩', menu: ['태국요리'] },
  { keywords: ['인도음식'],
    tags: { flavor: ['매운'], texture: ['부드러운', '헤비한'], cooking: ['국물·찜'], cuisine: ['에스닉'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩₩', menu: ['인도요리'] },
  { keywords: ['쌀국수', '포', '베트남', '반미'],
    tags: { flavor: ['새콤한', '담백 깔끔'], texture: ['쫄깃한', '가벼운'], cooking: ['면류·파스타'], cuisine: ['에스닉'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩', menu: ['쌀국수'] },
  { keywords: ['커리', '카레', '인도', '난'],
    tags: { flavor: ['매운'], texture: ['부드러운', '헤비한'], cooking: ['국물·찜'], cuisine: ['에스닉'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩₩', menu: ['커리'] },
  { keywords: ['태국', '팟타이', '똠양꿍'],
    tags: { flavor: ['매운', '새콤한'], texture: ['가벼운'], cooking: ['구이·볶음'], cuisine: ['에스닉'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩₩', menu: ['태국요리'] },

  // 발효·숙성 관련
  { keywords: ['김치', '젓갈', '장아찌', '발효'],
    tags: { flavor: ['매운', '감칠맛'], texture: ['아삭한'], cooking: ['발효·숙성'], cuisine: ['한식'], temp: ['차가운'], occasion: ['혼밥'], health: [] },
    price: '₩', menu: ['김치'] },

  // 퓨전
  { keywords: ['퓨전음식', '퓨전'],
    tags: { flavor: ['기름진', '감칠맛'], texture: ['가벼운'], cooking: ['구이·볶음'], cuisine: ['퓨전'], temp: ['뜨끈한'], occasion: ['사교·회식'], health: [] },
    price: '₩₩', menu: ['퓨전'] },

  // 포괄 카테고리 (맨 뒤에 위치 — 구체적 규칙에 안 걸린 경우)
  { keywords: ['한식'],
    tags: { flavor: ['담백 깔끔'], texture: [], cooking: ['구이·볶음'], cuisine: ['한식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩₩', menu: [] },
  { keywords: ['중식'],
    tags: { flavor: ['기름진'], texture: [], cooking: ['구이·볶음'], cuisine: ['중식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩₩', menu: [] },
  { keywords: ['일식'],
    tags: { flavor: ['담백 깔끔'], texture: [], cooking: ['생식·무침'], cuisine: ['일식'], temp: ['차가운'], occasion: ['혼밥'], health: [] },
    price: '₩₩', menu: [] },
  { keywords: ['양식'],
    tags: { flavor: ['기름진'], texture: [], cooking: ['구이·볶음'], cuisine: ['양식'], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
    price: '₩₩', menu: [] },
];

// 오마카세 키워드 → 가격 업그레이드
const PREMIUM_KEYWORDS = ['오마카세', '코스', '파인다이닝', '미슐랭'];

function stripHtml(str) {
  return str.replace(/<\/?b>/g, '').trim();
}

// 네이버 카테고리 문자열에서 cuisine 추출
const CATEGORY_CUISINE_MAP = {
  '한식': '한식',
  '중식': '중식', '중국식': '중식',
  '일식': '일식', '일본식': '일식',
  '양식': '양식', '서양식': '양식',
  '이탈리아음식': '이탈리안', '이탈리안': '이탈리안',
  '프랑스음식': '양식', '프렌치': '양식',
  '스페인음식': '양식',
  '멕시코음식': '에스닉', '남미음식': '에스닉',
  '베트남음식': '에스닉',
  '태국음식': '에스닉',
  '인도음식': '에스닉',
  '동남아음식': '에스닉', '아시아음식': '에스닉',
  '퓨전음식': '퓨전', '퓨전': '퓨전',
  '카페': '디저트·카페', '디저트': '디저트·카페', '베이커리': '디저트·카페',
  '제과': '디저트·카페', '아이스크림': '디저트·카페',
};

function detectCuisineFromCategory(category) {
  for (const [keyword, cuisine] of Object.entries(CATEGORY_CUISINE_MAP)) {
    if (category.includes(keyword)) return cuisine;
  }
  return '한식';
}

function inferTags(item) {
  const category = (item.category || '').toLowerCase();
  const title = stripHtml(item.title).toLowerCase();
  const combined = `${category} ${title}`;

  let matched = null;
  for (const rule of RULES) {
    if (rule.keywords.some(kw => combined.includes(kw))) {
      matched = rule;
      break;
    }
  }

  // 아무 규칙에도 안 걸린 경우 카테고리에서 cuisine 추출 시도
  if (!matched) {
    const detectedCuisine = detectCuisineFromCategory(category);
    matched = {
      tags: { flavor: ['담백 깔끔'], texture: [], cooking: ['구이·볶음'], cuisine: [detectedCuisine], temp: ['뜨끈한'], occasion: ['혼밥'], health: [] },
      price: '₩₩',
      menu: [],
    };
  }

  // 태그 복사 (원본 보호)
  const tags = {};
  for (const key of Object.keys(matched.tags)) {
    tags[key] = [...matched.tags[key]];
  }

  // 가격 결정
  let priceRange = matched.price;
  if (PREMIUM_KEYWORDS.some(kw => combined.includes(kw))) {
    priceRange = '₩₩₩₩';
  }

  // 메뉴 추출: 규칙 기본 메뉴 + 카테고리 최하위
  const mainMenu = [...matched.menu];
  const catParts = (item.category || '').split('>').map(s => s.trim());
  if (catParts.length >= 3) {
    const leaf = catParts[catParts.length - 1];
    if (!mainMenu.includes(leaf) && leaf !== '음식점') {
      mainMenu.push(leaf);
    }
  }
  // 식당명에서 메뉴 힌트 추출
  const cleanTitle = stripHtml(item.title);
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (cleanTitle.includes(kw) && !mainMenu.includes(kw) && kw.length >= 2) {
        mainMenu.push(kw);
        break;
      }
    }
  }
  if (mainMenu.length === 0) {
    mainMenu.push(catParts[catParts.length - 1] || '정식');
  }

  // tip 생성
  const cuisineLabel = tags.cuisine[0] || '음식';
  const categoryTail = catParts.length >= 2 ? catParts.slice(1).join(' ') : cuisineLabel;
  const tip = `${categoryTail} 전문점`;

  return {
    tags,
    priceRange,
    mainMenu: [...new Set(mainMenu)].slice(0, 4),
    openHours: '11:00~21:00',
    tip,
  };
}

module.exports = { inferTags, stripHtml };
