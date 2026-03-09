#!/usr/bin/env node
/**
 * 기존 raw 데이터에서 태그만 재적용하여 data.js를 재생성하는 스크립트
 * API 호출 없이 로컬 raw JSON만 사용
 */
const fs = require('fs');
const path = require('path');

const { inferTags, stripHtml } = require('./tag-inferrer');
const { convertCoords, isInSeoulRange } = require('./katech-converter');
const { deduplicate } = require('./deduplicate');
const { generateDataJs, BASE_POINT } = require('./generate-data');

const RAW_DIR = path.join(__dirname, 'raw');
const MAX_DISTANCE_KM = 3;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// raw 디렉토리에서 모든 JSON 로드
const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.json')).sort();
console.log(`📂 raw 파일 ${files.length}개 로드`);

const allItems = [];
const seenLinks = new Set();

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(RAW_DIR, file), 'utf-8'));
  if (!data.items) continue;
  for (const item of data.items) {
    if (!item.category) continue;
    const topCat = item.category.split('>')[0];
    const foodCats = ['음식점','한식','중식','일식','양식','분식','술집','도시락,컵밥','카페,디저트','이탈리아음식','육류,고기요리','브런치카페','해물,생선요리'];
    if (!foodCats.some(c => topCat === c || topCat.includes(c))) continue;
    if (!seenLinks.has(item.link)) {
      seenLinks.add(item.link);
      allItems.push(item);
    }
  }
}

console.log(`📊 고유 항목: ${allItems.length}개`);

// 좌표 변환 & 거리 필터링
const converted = [];
for (const item of allItems) {
  try {
    const { lat, lng } = convertCoords(item.mapx, item.mapy);
    if (!isInSeoulRange(lat, lng)) continue;
    const dist = haversineKm(BASE_POINT.lat, BASE_POINT.lng, lat, lng);
    if (dist > MAX_DISTANCE_KM) continue;
    converted.push({
      ...item,
      lat: Math.round(lat * 10000) / 10000,
      lng: Math.round(lng * 10000) / 10000,
      distanceKm: Math.round(dist * 10) / 10,
    });
  } catch (e) { /* skip */ }
}

// 중복 제거
const unique = deduplicate(converted);

// 태그 재적용
const restaurants = unique.map(item => {
  const { tags, priceRange, mainMenu, openHours, tip } = inferTags(item);
  return {
    name: stripHtml(item.title),
    address: item.roadAddress || item.address || '',
    lat: item.lat,
    lng: item.lng,
    distanceKm: item.distanceKm,
    mainMenu,
    priceRange,
    openHours,
    tags,
    tip,
  };
});

restaurants.sort((a, b) => a.distanceKm - b.distanceKm);

// 통계
const cuisineCount = {};
for (const r of restaurants) {
  const c = r.tags.cuisine[0] || '기타';
  cuisineCount[c] = (cuisineCount[c] || 0) + 1;
}
console.log(`\n📋 최종: ${restaurants.length}개 식당`);
console.log('   음식 국적 분포:', cuisineCount);

// data.js 생성
generateDataJs(restaurants);
console.log('\n✅ 재태깅 완료!');
