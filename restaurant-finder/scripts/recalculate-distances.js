#!/usr/bin/env node
/**
 * BASE_POINT 좌표 수정 후 모든 식당의 distanceKm을 재계산하는 스크립트
 *
 * 사용법: node scripts/recalculate-distances.js
 */

const fs = require('fs');
const path = require('path');
const { BASE_POINT } = require('./generate-data');

const DATA_PATH = path.resolve(__dirname, '..', 'js', 'data.js');

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// data.js를 텍스트로 읽어서 RESTAURANTS 배열 추출
const src = fs.readFileSync(DATA_PATH, 'utf-8');

// BASE_POINT 업데이트
let updated = src.replace(
  /const BASE_POINT\s*=\s*\{[^}]+\};/,
  `const BASE_POINT = ${JSON.stringify(BASE_POINT)};`
);

// RESTAURANTS 배열을 eval로 파싱
const restaurantsMatch = updated.match(/const RESTAURANTS\s*=\s*(\[[\s\S]*\]);/);
if (!restaurantsMatch) {
  console.error('❌ RESTAURANTS 배열을 찾을 수 없습니다.');
  process.exit(1);
}

// 안전하게 파싱하기 위해 임시 실행
const restaurants = eval(restaurantsMatch[1]);

console.log(`📍 새 BASE_POINT: lat=${BASE_POINT.lat}, lng=${BASE_POINT.lng}`);
console.log(`📊 ${restaurants.length}개 식당 거리 재계산 중...\n`);

let changed = 0;
for (const r of restaurants) {
  const newDist = Math.round(haversineKm(BASE_POINT.lat, BASE_POINT.lng, r.lat, r.lng) * 10) / 10;
  if (r.distanceKm !== newDist) {
    changed++;
  }
  r.distanceKm = newDist;
}

// RESTAURANTS 배열 재생성
const entries = restaurants.map(r => {
  return '  ' + JSON.stringify(r, null, 2).split('\n').join('\n  ');
});

updated = updated.replace(
  /const RESTAURANTS\s*=\s*\[[\s\S]*\];/,
  `const RESTAURANTS = [\n${entries.join(',\n')}\n];`
);

fs.writeFileSync(DATA_PATH, updated, 'utf-8');

console.log(`✅ 완료: ${changed}개 식당의 거리가 변경됨 (전체 ${restaurants.length}개)`);

// 변경 샘플 출력
const sample = restaurants.slice(0, 5);
console.log('\n📋 샘플 (처음 5개):');
for (const r of sample) {
  console.log(`  ${r.name}: ${r.distanceKm}km`);
}
