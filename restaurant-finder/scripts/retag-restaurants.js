#!/usr/bin/env node
/**
 * 식당 occasion/cooking 재태깅 스크립트
 *
 * - data.js를 파싱하여 모든 식당의 occasion/cooking 태그를 휴리스틱 규칙으로 재분류
 * - 다중 태깅 허용
 * - generate-data.js로 최종 data.js 출력
 *
 * 사용법: node retag-restaurants.js
 */

const fs = require('fs');
const path = require('path');
const { generateDataJs } = require('./generate-data');

const DATA_PATH = path.resolve(__dirname, '..', 'js', 'data.js');

// data.js에서 RESTAURANTS 파싱 (rebuild-data.js 패턴 재사용)
function parseDataJs() {
  const src = fs.readFileSync(DATA_PATH, 'utf-8');
  const match = src.match(/const RESTAURANTS\s*=\s*(\[[\s\S]*\]);/);
  if (!match) throw new Error('RESTAURANTS 배열을 찾을 수 없습니다.');
  return eval(match[1]);
}

// ── Occasion 재태깅 ──

function retagOccasion(r) {
  const occasions = new Set();
  const price = r.priceRange || '';
  const foodType = (r.tags.foodType || []);
  const cuisine = (r.tags.cuisine || []);
  const tip = (r.tip || '').toLowerCase();
  const menuStr = (r.mainMenu || []).join(' ').toLowerCase();

  // 혼밥 조건
  if (['₩', '₩₩'].includes(price)) occasions.add('혼밥');
  if (foodType.some(f => ['국밥·탕·찌개', '냉면·국수', '분식', '라멘·우동', '돈카츠', '햄버거', '죽·가벼운식사', '백반·가정식', '카페·디저트'].includes(f))) {
    occasions.add('혼밥');
  }
  if (/혼밥|1인/.test(tip)) occasions.add('혼밥');
  if (/국밥|설렁탕|곰탕|칼국수|냉면|비빔밥|라멘|돈카츠|우동|햄버거|김밥|떡볶이|카레|쌀국수/.test(menuStr)) {
    occasions.add('혼밥');
  }

  // 사교 조건
  if (['₩₩', '₩₩₩', '₩₩₩₩'].includes(price)) occasions.add('사교');
  if (foodType.some(f => ['구이', '족발·보쌈', '피자·파스타', '스테이크·양식', '치킨', '중식', '마라·훠궈', '일식·초밥', '브런치·샐러드', '베트남·동남아', '멕시코·남미', '퓨전', '인도·커리', '카페·디저트'].includes(f))) {
    occasions.add('사교');
  }
  if (/모임|회식|데이트|분위기/.test(tip)) occasions.add('사교');
  // 기존 occasion에 '사교·회식' 또는 '안주' 포함
  const oldOccasion = (r.tags.occasion || []);
  if (oldOccasion.some(o => o === '사교·회식' || o === '안주' || o === '사교')) {
    occasions.add('사교');
  }

  // 단체 조건
  if (foodType.some(f => ['마라·훠궈', '족발·보쌈', '치킨'].includes(f))) {
    occasions.add('단체');
  }
  if (foodType.includes('중식') && ['₩₩', '₩₩₩', '₩₩₩₩'].includes(price)) {
    occasions.add('단체');
  }
  if (foodType.includes('구이') && ['₩₩₩', '₩₩₩₩'].includes(price)) {
    occasions.add('단체');
  }
  if (foodType.includes('피자·파스타') && ['₩₩', '₩₩₩'].includes(price)) {
    occasions.add('단체');
  }
  if (/단체|넓|대형/.test(tip)) occasions.add('단체');
  if (/전골|샤브샤브|부대찌개|코스/.test(menuStr)) occasions.add('단체');

  // 비즈니스 조건
  if (price === '₩₩₩₩') occasions.add('비즈니스');
  if (price === '₩₩₩' && foodType.some(f => ['스테이크·양식', '일식·초밥', '구이'].includes(f))) {
    occasions.add('비즈니스');
  }
  if (price === '₩₩₩' && cuisine.some(c => ['양식', '이탈리안'].includes(c))) {
    occasions.add('비즈니스');
  }
  if (/프라이빗|룸|독립|고급/.test(tip)) occasions.add('비즈니스');
  if (/오마카세|코스|파인다이닝/.test(menuStr)) occasions.add('비즈니스');

  // 폴백
  if (occasions.size === 0) occasions.add('혼밥');

  return [...occasions];
}

// ── Cooking 재태깅 ──

const VALID_COOKING = ['구이·볶음', '국물·찜', '생식·무침', '튀김', '면류·파스타', '오븐·화덕', '발효·숙성', '전·부침', '조림·수비드', '샐러드·회', '밥·죽', '베이킹', '기타'];

function retagCooking(r) {
  const foodType = (r.tags.foodType || []);
  const menuStr = (r.mainMenu || []).join(' ').toLowerCase();
  const existingCooking = (r.tags.cooking || []);

  // foodType/mainMenu 기반 추가 매핑
  let newCooking = null;

  // 카페·디저트 → 베이킹
  if (foodType.includes('카페·디저트')) {
    newCooking = '베이킹';
  }
  // 백반·가정식 OR 비빔밥/덮밥/볶음밥/공기밥/솥밥 → 밥·죽 (국밥 제외)
  else if (foodType.includes('백반·가정식') || /비빔밥|덮밥|볶음밥|공기밥|솥밥|백반/.test(menuStr)) {
    newCooking = '밥·죽';
  }
  // 죽·가벼운식사 → 밥·죽
  else if (foodType.includes('죽·가벼운식사')) {
    newCooking = '밥·죽';
  }
  // 전/부침/파전/빈대떡/해물전/김치전/녹두전 → 전·부침
  else if (/부침|파전|빈대떡|해물전|김치전|녹두전|감자전|동그랑땡/.test(menuStr)) {
    newCooking = '전·부침';
  }
  // 조림/수비드/장조림/갈비찜 → 조림·수비드
  else if (/조림|수비드|장조림|갈비찜/.test(menuStr)) {
    newCooking = '조림·수비드';
  }
  // 샐러드/회/포케/사시미 → 샐러드·회
  else if (/샐러드|포케|사시미|모둠회|생선회|활어회|회덮/.test(menuStr)) {
    newCooking = '샐러드·회';
  }
  // 족발·보쌈 → 조림·수비드
  else if (foodType.includes('족발·보쌈')) {
    newCooking = '조림·수비드';
  }
  // 브런치·샐러드 → mainMenu 기반
  else if (foodType.includes('브런치·샐러드')) {
    if (/빵|토스트|와플|크로플|베이글|머핀/.test(menuStr)) {
      newCooking = '베이킹';
    } else {
      newCooking = '샐러드·회';
    }
  }

  // 기존 cooking 마이그레이션: '디저트·베이킹' → '베이킹'
  const migrated = existingCooking.map(c => c === '디저트·베이킹' ? '베이킹' : c);
  const validExisting = migrated.filter(c => VALID_COOKING.includes(c));

  // 결정 로직:
  // 1. 새 매핑이 있으면 기존 유효값과 합쳐서 반환 (중복 제거)
  // 2. 새 매핑이 없으면 기존 유효값 유지
  // 3. 둘 다 없으면 '기타'

  if (newCooking) {
    const result = new Set(validExisting);
    result.add(newCooking);
    return [...result];
  }

  if (validExisting.length > 0) return validExisting;

  return ['기타'];
}

// ── 메인 ──

function main() {
  console.log('🔄 식당 태그 재분류 시작...\n');

  const restaurants = parseDataJs();
  console.log(`📦 총 ${restaurants.length}개 식당 로드\n`);

  // 통계 추적
  const occasionStats = {};
  const cookingStats = {};

  const retagged = restaurants.map(r => {
    const newOccasion = retagOccasion(r);
    const newCooking = retagCooking(r);

    // 통계
    for (const o of newOccasion) occasionStats[o] = (occasionStats[o] || 0) + 1;
    for (const c of newCooking) cookingStats[c] = (cookingStats[c] || 0) + 1;

    return {
      ...r,
      tags: {
        ...r.tags,
        occasion: newOccasion,
        cooking: newCooking,
      },
    };
  });

  // 통계 출력
  console.log('=== Occasion 분포 ===');
  const total = restaurants.length;
  for (const [tag, count] of Object.entries(occasionStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tag}: ${count}개 (${(count / total * 100).toFixed(1)}%)`);
  }

  console.log('\n=== Cooking 분포 ===');
  for (const [tag, count] of Object.entries(cookingStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tag}: ${count}개 (${(count / total * 100).toFixed(1)}%)`);
  }

  // 빈 카테고리 체크
  const emptyCooking = VALID_COOKING.filter(c => !cookingStats[c]);
  if (emptyCooking.length > 0) {
    console.log(`\n⚠ 0건인 cooking 카테고리: ${emptyCooking.join(', ')}`);
  } else {
    console.log('\n✅ 모든 cooking 카테고리에 1개 이상 식당 존재');
  }

  const occasionTags = ['혼밥', '사교', '단체', '비즈니스'];
  const emptyOccasion = occasionTags.filter(o => !occasionStats[o]);
  if (emptyOccasion.length > 0) {
    console.log(`⚠ 0건인 occasion 카테고리: ${emptyOccasion.join(', ')}`);
  } else {
    console.log('✅ 모든 occasion 카테고리에 1개 이상 식당 존재');
  }

  // 스팟 체크: 다양한 유형 샘플 출력
  console.log('\n=== 스팟 체크 (10개 샘플) ===');
  const samples = [];
  // 국밥집
  samples.push(retagged.find(r => (r.tags.foodType || []).includes('국밥·탕·찌개')));
  // 삼겹살
  samples.push(retagged.find(r => r.mainMenu.some(m => m.includes('삼겹살') || m.includes('고기구이'))));
  // 오마카세/고급
  samples.push(retagged.find(r => r.priceRange === '₩₩₩₩'));
  // 카페
  samples.push(retagged.find(r => (r.tags.foodType || []).includes('카페·디저트')));
  // 치킨
  samples.push(retagged.find(r => (r.tags.foodType || []).includes('치킨')));
  // 마라
  samples.push(retagged.find(r => (r.tags.foodType || []).includes('마라·훠궈')));
  // 족발
  samples.push(retagged.find(r => (r.tags.foodType || []).includes('족발·보쌈')));
  // 피자
  samples.push(retagged.find(r => (r.tags.foodType || []).includes('피자·파스타')));
  // 스테이크
  samples.push(retagged.find(r => (r.tags.foodType || []).includes('스테이크·양식')));
  // 분식
  samples.push(retagged.find(r => (r.tags.foodType || []).includes('분식')));

  for (const s of samples) {
    if (!s) continue;
    console.log(`  ${s.name} (${s.priceRange}) → occasion: [${s.tags.occasion}], cooking: [${s.tags.cooking}]`);
  }

  // data.js 생성
  console.log('');
  generateDataJs(retagged);
}

main();
