#!/usr/bin/env node
/**
 * 네이버 지역 검색 API를 활용한 식당 데이터 수집 메인 스크립트
 *
 * 사용법:
 *   NAVER_CLIENT_ID=xxx NAVER_CLIENT_SECRET=yyy node collect-restaurants.js
 *
 * 또는 .env 스타일:
 *   set NAVER_CLIENT_ID=xxx && set NAVER_CLIENT_SECRET=yyy && node collect-restaurants.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const { buildQueries } = require('./queries');
const { convertCoords, isInSeoulRange } = require('./katech-converter');
const { inferTags, stripHtml } = require('./tag-inferrer');
const { deduplicate, distanceMeters } = require('./deduplicate');
const { generateDataJs, BASE_POINT } = require('./generate-data');

// ─── 설정 ───
const CLIENT_ID = process.env.NAVER_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const DELAY_MS = 150;           // 요청 간 딜레이
const MAX_RETRIES = 3;          // 실패 시 재시도
const DISPLAY = 5;              // 쿼리당 결과 수
const MAX_DISTANCE_KM = 3;     // 반경 제한
const RAW_DIR = path.join(__dirname, 'raw');

// ─── 유틸리티 ───
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── API 호출 ───
async function searchLocal(query, retries = MAX_RETRIES) {
  const url = 'https://openapi.naver.com/v1/search/local.json';
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(url, {
        params: { query, display: DISPLAY, start: 1, sort: 'random' },
        headers: {
          'X-Naver-Client-Id': CLIENT_ID,
          'X-Naver-Client-Secret': CLIENT_SECRET,
        },
        timeout: 10000,
      });
      return res.data;
    } catch (err) {
      const status = err.response?.status;
      if (attempt < retries && (!status || status >= 500 || status === 429)) {
        const wait = DELAY_MS * Math.pow(2, attempt);
        console.warn(`  ⚠ 재시도 ${attempt}/${retries} (${status || err.code}) — ${wait}ms 대기`);
        await sleep(wait);
      } else {
        console.error(`  ✗ 실패: ${query} — ${err.message}`);
        return null;
      }
    }
  }
}

// ─── 메인 ───
async function main() {
  // 환경변수 확인
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET 환경변수를 설정해주세요.');
    console.error('   예: NAVER_CLIENT_ID=xxx NAVER_CLIENT_SECRET=yyy node collect-restaurants.js');
    process.exit(1);
  }

  // raw 디렉토리 생성
  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
  }

  const queries = buildQueries();
  console.log(`🔍 총 ${queries.length}개 쿼리 실행 시작...\n`);

  const allItems = [];   // 모든 수집 결과
  let newCount = 0;
  const seenLinks = new Set(); // link 기반 빠른 중복 체크

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const data = await searchLocal(query);

    if (data && data.items) {
      // 원본 저장
      const filename = `${String(i).padStart(4, '0')}_${query.replace(/\s+/g, '_')}.json`;
      fs.writeFileSync(path.join(RAW_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');

      let queryNew = 0;
      for (const item of data.items) {
        // 음식점 카테고리만 필터
        if (!item.category || !item.category.includes('음식점')) continue;

        if (!seenLinks.has(item.link)) {
          seenLinks.add(item.link);
          allItems.push(item);
          queryNew++;
          newCount++;
        }
      }

      const total = data.items.filter(it => it.category?.includes('음식점')).length;
      console.log(`[${i + 1}/${queries.length}] "${query}" → ${total}건 (${queryNew}건 신규)`);
    } else {
      console.log(`[${i + 1}/${queries.length}] "${query}" → 결과 없음`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n📊 수집 완료: 총 ${allItems.length}개 고유 항목`);

  // ─── 좌표 변환 & 거리 필터링 ───
  console.log('\n🗺️  좌표 변환 및 거리 필터링...');
  const converted = [];
  let outOfRange = 0;
  let invalidCoord = 0;

  for (const item of allItems) {
    try {
      const { lat, lng } = convertCoords(item.mapx, item.mapy);
      if (!isInSeoulRange(lat, lng)) {
        invalidCoord++;
        continue;
      }

      const dist = haversineKm(BASE_POINT.lat, BASE_POINT.lng, lat, lng);
      if (dist > MAX_DISTANCE_KM) {
        outOfRange++;
        continue;
      }

      converted.push({
        ...item,
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000,
        distanceKm: Math.round(dist * 10) / 10,
      });
    } catch (e) {
      invalidCoord++;
    }
  }

  console.log(`  좌표 유효: ${converted.length}건, 범위 초과: ${outOfRange}건, 좌표 오류: ${invalidCoord}건`);

  // ─── 중복 제거 ───
  console.log('\n🔄 중복 제거...');
  const unique = deduplicate(converted);
  console.log(`  ${converted.length} → ${unique.length}건 (${converted.length - unique.length}건 중복 제거)`);

  // ─── 태그 추론 & 최종 변환 ───
  console.log('\n🏷️  태그 추론...');
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

  // 거리순 정렬
  restaurants.sort((a, b) => a.distanceKm - b.distanceKm);

  console.log(`\n📋 최종 결과: ${restaurants.length}개 식당`);

  // 통계
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

  // ─── data.js 생성 ───
  console.log('\n📝 data.js 생성...');
  generateDataJs(restaurants);

  console.log('\n✅ 전체 완료!');
}

main().catch(err => {
  console.error('❌ 치명적 오류:', err);
  process.exit(1);
});
