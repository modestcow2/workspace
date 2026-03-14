#!/usr/bin/env node
/**
 * 데이터 품질 검증 스크립트
 *
 * 재빌드 후 data.js의 품질을 검증합니다:
 * - 영업시간 하드코딩 비율
 * - tip "전문점" 패턴 비율
 * - foodType 태그 존재 비율
 * - 필드별 null/빈값 통계
 *
 * 사용법: node validate-data.js
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.resolve(__dirname, '..', 'js', 'data.js');

function parseDataJs() {
  const src = fs.readFileSync(DATA_PATH, 'utf-8');
  const match = src.match(/const RESTAURANTS\s*=\s*(\[[\s\S]*\]);/);
  if (!match) throw new Error('RESTAURANTS 배열을 찾을 수 없습니다.');
  return eval(match[1]);
}

function main() {
  const restaurants = parseDataJs();
  const total = restaurants.length;

  console.log(`\n📊 데이터 품질 검증 — ${total}개 식당\n`);
  console.log('═'.repeat(60));

  // 1. 영업시간 검증
  const hardcoded = restaurants.filter(r => r.openHours === '11:00~21:00').length;
  const needsCheck = restaurants.filter(r => r.openHours === '확인필요').length;
  const validHours = total - hardcoded - needsCheck;
  const noHours = restaurants.filter(r => !r.openHours).length;

  console.log(`\n🕐 영업시간`);
  console.log(`   실제 데이터: ${validHours}개 (${pct(validHours, total)})`);
  console.log(`   하드코딩(11:00~21:00): ${hardcoded}개 (${pct(hardcoded, total)}) ${hardcoded === 0 ? '✅' : '⚠️ 목표: 0%'}`);
  console.log(`   확인필요: ${needsCheck}개 (${pct(needsCheck, total)})`);
  console.log(`   없음: ${noHours}개`);

  // 2. tip 검증
  const genericTip = restaurants.filter(r => r.tip && r.tip.endsWith('전문점')).length;
  const emptyTip = restaurants.filter(r => !r.tip || r.tip.length === 0).length;
  const goodTip = total - genericTip - emptyTip;

  console.log(`\n💡 한 줄 특징(tip)`);
  console.log(`   의미있는 tip: ${goodTip}개 (${pct(goodTip, total)})`);
  console.log(`   "~전문점" 패턴: ${genericTip}개 (${pct(genericTip, total)}) ${genericTip === 0 ? '✅' : '⚠️ 목표: 0%'}`);
  console.log(`   비어있음: ${emptyTip}개`);

  // 3. foodType 검증
  const hasFoodType = restaurants.filter(r => r.tags?.foodType && r.tags.foodType.length > 0).length;
  const noFoodType = total - hasFoodType;

  console.log(`\n🏷️  foodType 태그`);
  console.log(`   존재: ${hasFoodType}개 (${pct(hasFoodType, total)}) ${hasFoodType === total ? '✅' : `⚠️ 목표: 100%`}`);
  console.log(`   미존재: ${noFoodType}개 (${pct(noFoodType, total)})`);

  // 4. 태그 차원별 통계
  console.log(`\n📈 태그 차원별 채움률`);
  const dims = ['flavor', 'texture', 'cooking', 'cuisine', 'temp', 'occasion', 'health', 'foodType'];
  for (const dim of dims) {
    const filled = restaurants.filter(r => r.tags?.[dim] && r.tags[dim].length > 0).length;
    const bar = progressBar(filled, total);
    console.log(`   ${dim.padEnd(12)} ${bar} ${filled}/${total} (${pct(filled, total)})`);
  }

  // 5. 메뉴 검증
  const hasMenu = restaurants.filter(r => r.mainMenu && r.mainMenu.length > 0).length;
  const avgMenuCount = (restaurants.reduce((sum, r) => sum + (r.mainMenu?.length || 0), 0) / total).toFixed(1);

  console.log(`\n🍽️  메뉴`);
  console.log(`   메뉴 보유: ${hasMenu}개 (${pct(hasMenu, total)})`);
  console.log(`   평균 메뉴 수: ${avgMenuCount}개`);

  // 6. 가격대 분포
  console.log(`\n💰 가격대 분포`);
  const priceDist = {};
  for (const r of restaurants) {
    const p = r.priceRange || '없음';
    priceDist[p] = (priceDist[p] || 0) + 1;
  }
  for (const [price, count] of Object.entries(priceDist).sort()) {
    console.log(`   ${price.padEnd(6)} ${progressBar(count, total)} ${count}개 (${pct(count, total)})`);
  }

  // 7. 필드 완전성
  console.log(`\n📋 필드 완전성`);
  const fields = ['id', 'name', 'address', 'lat', 'lng', 'distanceKm', 'mainMenu', 'priceRange', 'openHours', 'tags', 'tip'];
  for (const field of fields) {
    const filled = restaurants.filter(r => {
      const v = r[field];
      if (v === null || v === undefined) return false;
      if (typeof v === 'string' && v.length === 0) return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    }).length;
    const status = filled === total ? '✅' : `⚠️ ${total - filled}개 누락`;
    console.log(`   ${field.padEnd(14)} ${filled}/${total} ${status}`);
  }

  // 8. foodType 분포 (상위 15개)
  if (hasFoodType > 0) {
    console.log(`\n🏷️  foodType 분포 (상위 15개)`);
    const ftDist = {};
    for (const r of restaurants) {
      for (const ft of (r.tags?.foodType || [])) {
        ftDist[ft] = (ftDist[ft] || 0) + 1;
      }
    }
    const sorted = Object.entries(ftDist).sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [ft, count] of sorted) {
      console.log(`   ${ft.padEnd(16)} ${progressBar(count, total)} ${count}개`);
    }
  }

  // 9. 샘플 출력
  console.log(`\n📝 무작위 샘플 5개`);
  const sample = shuffle(restaurants).slice(0, 5);
  for (const r of sample) {
    console.log(`   "${r.name}" | ${r.openHours} | ${r.mainMenu?.join(',')} | ${r.tip}`);
    console.log(`     foodType: ${r.tags?.foodType?.join(',') || '없음'} | price: ${r.priceRange}`);
  }

  console.log('\n' + '═'.repeat(60));

  // 최종 점수
  const score = Math.round(
    (validHours / total * 30) +
    (goodTip / total * 25) +
    (hasFoodType / total * 25) +
    (hasMenu / total * 20)
  );
  console.log(`\n🏆 데이터 품질 점수: ${score}/100`);
  if (score >= 90) console.log('   훌륭합니다!');
  else if (score >= 70) console.log('   양호합니다. 크롤링으로 개선 가능합니다.');
  else if (score >= 50) console.log('   보통입니다. Phase 1-2 수집이 필요합니다.');
  else console.log('   개선이 필요합니다. fetch-place-detail.js를 실행하세요.');
}

function pct(n, total) {
  return `${(n / total * 100).toFixed(1)}%`;
}

function progressBar(n, total, width = 20) {
  const filled = Math.round(n / total * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

main();
