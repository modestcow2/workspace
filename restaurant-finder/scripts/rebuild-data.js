#!/usr/bin/env node
/**
 * 데이터 재빌드 오케스트레이터
 *
 * 1. place-detail-progress.json 로드 (Phase 1-2 수집 결과)
 * 2. 기존 raw 데이터 + 상세 데이터 병합
 * 3. tag-inferrer.js로 태그 재추론 (foodType 포함)
 * 4. generate-tips.js로 tip 재생성
 * 5. 영업시간/메뉴 실제 데이터로 교체
 * 6. generate-data.js로 최종 data.js 출력
 *
 * 사용법: node rebuild-data.js
 */

const fs = require('fs');
const path = require('path');

const { inferTags, stripHtml } = require('./tag-inferrer');
const { generateDataJs, BASE_POINT } = require('./generate-data');
const { generateTip } = require('./generate-tips');

const DATA_PATH = path.resolve(__dirname, '..', 'js', 'data.js');
const PROGRESS_PATH = path.resolve(__dirname, 'place-detail-progress.json');

// data.js에서 RESTAURANTS 파싱
function parseDataJs() {
  const src = fs.readFileSync(DATA_PATH, 'utf-8');
  const match = src.match(/const RESTAURANTS\s*=\s*(\[[\s\S]*\]);/);
  if (!match) throw new Error('RESTAURANTS 배열을 찾을 수 없습니다.');
  return eval(match[1]);
}

// 리뷰 키워드 → 태그 보정 매핑
const KEYWORD_TAG_MAP = {
  // flavor 보정
  '매운': { category: 'flavor', tag: '매운' },
  '매운맛': { category: 'flavor', tag: '매운' },
  '달콤': { category: 'flavor', tag: '단' },
  '담백': { category: 'flavor', tag: '담백 깔끔' },
  '느끼': { category: 'flavor', tag: '기름진' },
  '짭조름': { category: 'flavor', tag: '짠' },
  '새콤': { category: 'flavor', tag: '새콤한' },
  '감칠맛': { category: 'flavor', tag: '감칠맛' },
  // occasion 보정
  '혼밥': { category: 'occasion', tag: '혼밥' },
  '혼술': { category: 'occasion', tag: '혼밥' },
  '회식': { category: 'occasion', tag: '사교·회식' },
  '모임': { category: 'occasion', tag: '사교·회식' },
  '데이트': { category: 'occasion', tag: '사교·회식' },
  '안주': { category: 'occasion', tag: '안주' },
  // health 보정
  '건강': { category: 'health', tag: '저자극' },
  '보양': { category: 'health', tag: '벌크업·보양' },
  '다이어트': { category: 'health', tag: '디톡스' },
};

// 메뉴 가격 → priceRange 보정
function inferPriceFromMenus(menus) {
  if (!menus || menus.length === 0) return null;
  const avgPrice = menus.reduce((sum, m) => sum + m.price, 0) / menus.length;
  if (avgPrice <= 10000) return '₩';
  if (avgPrice <= 20000) return '₩₩';
  if (avgPrice <= 30000) return '₩₩₩';
  return '₩₩₩₩';
}

function main() {
  console.log('🔄 데이터 재빌드 시작...\n');

  // 1. 기존 데이터 로드
  const restaurants = parseDataJs();
  console.log(`📦 기존 데이터: ${restaurants.length}개 식당`);

  // 2. 수집 결과 로드
  let placeDetails = {};
  if (fs.existsSync(PROGRESS_PATH)) {
    placeDetails = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'));
    console.log(`📋 수집 데이터: ${Object.keys(placeDetails).length}개 항목`);
  } else {
    console.log('⚠ place-detail-progress.json 없음 — 태그 재추론만 수행합니다.');
  }

  // 3. 각 식당 데이터 재빌드
  let hoursUpdated = 0, menuUpdated = 0, tipUpdated = 0, tagsUpdated = 0;

  const rebuilt = restaurants.map(r => {
    const detail = placeDetails[r.id] || null;

    // 3-1. 기존 태그에 foodType 추가
    const tags = { ...r.tags };
    const needsFoodTypeReinfer = !tags.foodType || tags.foodType.length === 0 ||
      (tags.foodType.length === 1 && tags.foodType[0] === '백반·가정식');
    if (needsFoodTypeReinfer) {
      // 먼저 이름으로 inferTags 시도 (키워드 매칭)
      const inferred = inferTags({ title: r.name, category: '', categoryNaver: '' });
      if (inferred.tags.foodType && inferred.tags.foodType.length > 0 &&
          !inferred.tags.foodType.includes('백반·가정식')) {
        // 구체적인 foodType이 나온 경우에만 사용
        tags.foodType = inferred.tags.foodType;
      } else {
        // 기존 태그/메뉴 기반으로 추론 (더 정확)
        tags.foodType = inferFoodTypeFromExisting(tags, r.mainMenu);
      }
      if (tags.foodType.length > 0) tagsUpdated++;
    }

    // 3-2. 리뷰 키워드로 태그 보정
    if (detail?.reviewKeywords) {
      for (const kw of detail.reviewKeywords) {
        const mapping = KEYWORD_TAG_MAP[kw];
        if (mapping && tags[mapping.category]) {
          if (!tags[mapping.category].includes(mapping.tag)) {
            tags[mapping.category].push(mapping.tag);
          }
        }
      }
    }

    // 3-3. 영업시간 업데이트
    let openHours = r.openHours;
    if (detail?.openHours && detail.openHours !== '확인필요') {
      openHours = detail.openHours;
      hoursUpdated++;
    } else if (openHours === '11:00~21:00') {
      openHours = '확인필요';
    }

    // 3-4. 메뉴 업데이트
    let mainMenu = r.mainMenu;
    if (detail?.menus && detail.menus.length > 0) {
      const detailMenuNames = detail.menus.map(m => m.name);
      // 수집된 실제 메뉴로 교체 (최대 4개)
      mainMenu = [...new Set(detailMenuNames)].slice(0, 4);
      menuUpdated++;
    }

    // 3-5. 가격 보정
    let priceRange = r.priceRange;
    if (detail?.menus && detail.menus.length > 0) {
      const inferredPrice = inferPriceFromMenus(detail.menus);
      if (inferredPrice) priceRange = inferredPrice;
    }

    // 3-6. tip 재생성
    const newTip = generateTip({ ...r, tags, mainMenu }, detail);
    if (newTip !== r.tip) tipUpdated++;

    return {
      ...r,
      tags,
      openHours,
      mainMenu,
      priceRange,
      tip: newTip,
    };
  });

  // 4. data.js 생성
  generateDataJs(rebuilt);

  console.log(`\n✅ 재빌드 완료!`);
  console.log(`   영업시간 업데이트: ${hoursUpdated}개`);
  console.log(`   메뉴 업데이트: ${menuUpdated}개`);
  console.log(`   태그(foodType) 추가: ${tagsUpdated}개`);
  console.log(`   tip 업데이트: ${tipUpdated}개`);
}

// 기존 태그/메뉴 기반으로 foodType 추론
function inferFoodTypeFromExisting(tags, mainMenu) {
  const foodTypes = [];
  const cuisine = tags.cuisine || [];
  const cooking = tags.cooking || [];
  const menuStr = (mainMenu || []).join(' ');

  // 메뉴/태그 기반 foodType 매핑
  const MENU_FOODTYPE = {
    '국밥': '국밥·탕·찌개', '설렁탕': '국밥·탕·찌개', '곰탕': '국밥·탕·찌개',
    '삼계탕': '국밥·탕·찌개', '해장국': '국밥·탕·찌개', '감자탕': '국밥·탕·찌개',
    '찌개': '국밥·탕·찌개', '전골': '국밥·탕·찌개', '순두부': '국밥·탕·찌개',
    '칼국수': '냉면·국수', '냉면': '냉면·국수', '막국수': '냉면·국수',
    '수제비': '냉면·국수', '우동': '냉면·국수', '소바': '냉면·국수',
    '고기구이': '구이', '삼겹살': '구이', '갈비': '구이', '불고기': '구이',
    '족발': '족발·보쌈', '보쌈': '족발·보쌈',
    '비빔밥': '백반·가정식', '백반': '백반·가정식', '한정식': '백반·가정식', '정식': '백반·가정식',
    '떡볶이': '분식', '순대': '분식', '만두': '분식',
    '치킨': '치킨',
    '짜장면': '중식', '짬뽕': '중식', '딤섬': '중식',
    '마라탕': '마라·훠궈', '훠궈': '마라·훠궈',
    '초밥': '일식·초밥', '사시미': '일식·초밥', '회': '일식·초밥',
    '라멘': '라멘·우동',
    '돈카츠': '돈카츠',
    '파스타': '피자·파스타', '피자': '피자·파스타', '이탈리안': '피자·파스타',
    '스테이크': '스테이크·양식', '프렌치': '스테이크·양식', '양식': '스테이크·양식',
    '햄버거': '햄버거',
    '브런치': '브런치·샐러드', '샐러드': '브런치·샐러드', '포케': '브런치·샐러드',
    '디저트': '카페·디저트',
    '베트남요리': '베트남·동남아', '쌀국수': '베트남·동남아', '태국요리': '베트남·동남아',
    '커리': '인도·커리', '인도요리': '인도·커리',
    '멕시코요리': '멕시코·남미',
    '퓨전': '퓨전',
    '죽': '죽·가벼운식사',
  };

  for (const menu of (mainMenu || [])) {
    if (MENU_FOODTYPE[menu] && !foodTypes.includes(MENU_FOODTYPE[menu])) {
      foodTypes.push(MENU_FOODTYPE[menu]);
    }
  }

  // cooking 태그 기반 폴백
  if (foodTypes.length === 0) {
    if (cooking.includes('국물·찜')) {
      if (cuisine.includes('한식')) foodTypes.push('국밥·탕·찌개');
      else if (cuisine.includes('중식')) foodTypes.push('중식');
      else if (cuisine.includes('일식')) foodTypes.push('일식·초밥');
      else foodTypes.push('국밥·탕·찌개');
    }
    if (cooking.includes('구이·볶음')) {
      if (cuisine.includes('한식')) foodTypes.push('구이');
      else if (cuisine.includes('양식')) foodTypes.push('스테이크·양식');
      else if (cuisine.includes('동남아')) foodTypes.push('베트남·동남아');
    }
    if (cooking.includes('면류·파스타')) {
      if (cuisine.includes('한식')) foodTypes.push('냉면·국수');
      else if (cuisine.includes('이탈리안')) foodTypes.push('피자·파스타');
      else if (cuisine.includes('일식')) foodTypes.push('라멘·우동');
      else if (cuisine.includes('동남아')) foodTypes.push('베트남·동남아');
    }
    if (cooking.includes('튀김')) foodTypes.push('돈카츠');
    if (cooking.includes('디저트·베이킹')) foodTypes.push('카페·디저트');
    if (cooking.includes('생식·무침')) {
      if (cuisine.includes('일식')) foodTypes.push('일식·초밥');
      else if (cuisine.includes('양식')) foodTypes.push('브런치·샐러드');
    }
    if (cooking.includes('오븐·화덕')) {
      if (cuisine.includes('이탈리안')) foodTypes.push('피자·파스타');
      else foodTypes.push('스테이크·양식');
    }
  }

  // 최종 폴백: cuisine만으로 추론
  if (foodTypes.length === 0) {
    const CUISINE_FALLBACK = {
      '한식': '백반·가정식', '중식': '중식', '일식': '일식·초밥',
      '양식': '스테이크·양식', '이탈리안': '피자·파스타',
      '동남아': '베트남·동남아', '에스닉': '베트남·동남아', '기타지역': '인도·커리', '퓨전': '퓨전',
    };
    for (const c of cuisine) {
      if (CUISINE_FALLBACK[c]) { foodTypes.push(CUISINE_FALLBACK[c]); break; }
    }
  }

  return [...new Set(foodTypes)].slice(0, 2);
}

main();
