#!/usr/bin/env node
/**
 * 하이브리드 식당 수집 오케스트레이터
 *
 * 1. 카카오 카테고리 수집 (전수 조사)
 * 2. 네이버 키워드 수집 (기존 로직)
 * 3. 교차 소스 중복제거 (카카오 좌표 우선)
 * 4. 태그 추론 → data.js 생성
 *
 * 사용법:
 *   KAKAO_REST_API_KEY=xxx NAVER_CLIENT_ID=yyy NAVER_CLIENT_SECRET=zzz node collect-hybrid.js
 *
 * 카카오만 실행 (네이버 키 없을 때):
 *   KAKAO_REST_API_KEY=xxx node collect-hybrid.js --kakao-only
 */

const fs = require('fs');
const path = require('path');

const { collectKakao } = require('./collect-kakao');
const { inferTags, stripHtml } = require('./tag-inferrer');
const { deduplicate, deduplicateCrossSource, distanceMeters } = require('./deduplicate');
const { generateDataJs, BASE_POINT } = require('./generate-data');

const MAX_DISTANCE_KM = 1.5;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 기존 네이버 raw 데이터를 로드 (이미 수집된 경우)
 */
function loadNaverRaw() {
  const rawDir = path.join(__dirname, 'raw');
  if (!fs.existsSync(rawDir)) return [];

  const { convertCoords, isInSeoulRange } = require('./katech-converter');
  const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.json'));
  const seenLinks = new Set();
  const items = [];

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(rawDir, file), 'utf-8'));
      const rawItems = data.items || [];
      for (const item of rawItems) {
        if (!item.category || !item.category.includes('음식점')) continue;
        if (item.link && seenLinks.has(item.link)) continue;
        if (item.link) seenLinks.add(item.link);

        try {
          const { lat, lng } = convertCoords(item.mapx, item.mapy);
          if (!isInSeoulRange(lat, lng)) continue;
          const dist = haversineKm(BASE_POINT.lat, BASE_POINT.lng, lat, lng);
          if (dist > MAX_DISTANCE_KM) continue;

          items.push({
            ...item,
            lat: Math.round(lat * 10000) / 10000,
            lng: Math.round(lng * 10000) / 10000,
            distanceKm: Math.round(dist * 10) / 10,
            source: 'naver',
          });
        } catch (e) {
          // 좌표 변환 실패 → 스킵
        }
      }
    } catch (e) {
      // 파일 파싱 실패 → 스킵
    }
  }

  return items;
}

// ─── 메인 ───
async function main() {
  const kakaoOnly = process.argv.includes('--kakao-only');
  const naverOnly = process.argv.includes('--naver-only');

  // ── Step 1: 카카오 수집 ──
  let kakaoItems = [];
  if (!naverOnly) {
    console.log('═══════════════════════════════════════');
    console.log('  Step 1: 카카오 카테고리 수집');
    console.log('═══════════════════════════════════════\n');

    const kakaoRaw = await collectKakao();

    // 거리 필터링
    for (const item of kakaoRaw) {
      const dist = haversineKm(BASE_POINT.lat, BASE_POINT.lng, item.lat, item.lng);
      if (dist <= MAX_DISTANCE_KM) {
        item.distanceKm = Math.round(dist * 10) / 10;
        kakaoItems.push(item);
      }
    }
    console.log(`\n  카카오 거리 필터 후: ${kakaoItems.length}건`);
  }

  // ── Step 2: 네이버 기존 데이터 로드 ──
  let naverItems = [];
  if (!kakaoOnly) {
    console.log('\n═══════════════════════════════════════');
    console.log('  Step 2: 네이버 기존 데이터 로드');
    console.log('═══════════════════════════════════════\n');

    naverItems = loadNaverRaw();
    console.log(`  네이버 raw 데이터: ${naverItems.length}건`);

    if (naverItems.length === 0) {
      console.log('  ℹ️  네이버 raw 데이터가 없습니다. 먼저 npm run collect 를 실행하세요.');
      console.log('     또는 --kakao-only 옵션으로 카카오만 사용하세요.');
    }
  }

  // ── Step 3: 교차 소스 중복제거 ──
  console.log('\n═══════════════════════════════════════');
  console.log('  Step 3: 교차 소스 중복제거');
  console.log('═══════════════════════════════════════\n');

  // 각 소스 내 중복제거
  const kakaoUnique = deduplicate(kakaoItems);
  const naverUnique = deduplicate(naverItems);
  console.log(`  카카오: ${kakaoItems.length} → ${kakaoUnique.length}건`);
  console.log(`  네이버: ${naverItems.length} → ${naverUnique.length}건`);

  // 교차 소스 중복제거 (카카오 우선)
  const merged = deduplicateCrossSource(kakaoUnique, naverUnique);
  console.log(`  교차 중복제거 후: ${merged.length}건`);

  // ── Step 4: 태그 추론 & data.js 생성 ──
  console.log('\n═══════════════════════════════════════');
  console.log('  Step 4: 태그 추론 & data.js 생성');
  console.log('═══════════════════════════════════════\n');

  const restaurants = merged.map(item => {
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
      source: item.source || 'unknown',
    };
  });

  // 거리순 정렬
  restaurants.sort((a, b) => a.distanceKm - b.distanceKm);

  // 통계
  console.log(`📋 최종 결과: ${restaurants.length}개 식당`);

  const sourceCount = {};
  for (const r of restaurants) {
    sourceCount[r.source] = (sourceCount[r.source] || 0) + 1;
  }
  console.log('   소스 분포:', sourceCount);

  const cuisineCount = {};
  for (const r of restaurants) {
    const c = r.tags.cuisine[0] || '기타';
    cuisineCount[c] = (cuisineCount[c] || 0) + 1;
  }
  console.log('   음식 국적 분포:', cuisineCount);

  const priceCount = {};
  for (const r of restaurants) {
    priceCount[r.priceRange] = (priceCount[r.priceRange] || 0) + 1;
  }
  console.log('   가격대 분포:', priceCount);

  // data.js 생성
  console.log('\n📝 data.js 생성...');
  generateDataJs(restaurants);

  console.log('\n✅ 하이브리드 수집 완료!');
}

main().catch(err => {
  console.error('❌ 치명적 오류:', err);
  process.exit(1);
});
