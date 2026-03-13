#!/usr/bin/env node
/**
 * 카카오 카테고리 검색 기반 식당 수집기
 *
 * 격자 분할 전략으로 반경 1.5km 내 모든 음식점/카페를 전수 조사한다.
 * - 격자 간격: 350m, 조회 반경: 250m (겹침 허용, 중복제거로 처리)
 * - 카테고리: FD6(음식점) + CE7(카페)
 * - 45개 캡 도달 시 4개 하위 셀로 적응적 세분화
 *
 * 사용법:
 *   KAKAO_REST_API_KEY=xxx node collect-kakao.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const { BASE_POINT } = require('./generate-data');

// ─── 설정 ───
const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY;
const SEARCH_RADIUS_M = 1500;     // 전체 검색 반경
const GRID_STEP_M = 350;          // 격자 간격
const CELL_RADIUS_M = 250;        // 셀 조회 반경
const SUB_CELL_RADIUS_M = 125;    // 세분화 시 반경
const CATEGORIES = ['FD6', 'CE7']; // 음식점, 카페
const MAX_PER_PAGE = 15;          // 카카오 API 페이지당 최대
const MAX_PAGES = 3;              // 최대 3페이지 (45개)
const CAP = 45;                   // 카카오 API 결과 캡
const DELAY_MS = 100;             // 요청 간 딜레이
const MAX_RETRIES = 3;
const RAW_DIR = path.join(__dirname, 'raw-kakao');

// ─── 유틸리티 ───
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 중심점에서 미터 단위 오프셋으로 새 좌표 계산
 */
function offsetLatLng(lat, lng, dNorthM, dEastM) {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(lat * Math.PI / 180);
  return {
    lat: lat + dNorthM / mPerDegLat,
    lng: lng + dEastM / mPerDegLng,
  };
}

/**
 * 중심점 기준 반경 내 격자 점 생성
 */
function generateGrid(center, radiusM = SEARCH_RADIUS_M, stepM = GRID_STEP_M) {
  const points = [];
  const steps = Math.ceil(radiusM / stepM);

  for (let dy = -steps; dy <= steps; dy++) {
    for (let dx = -steps; dx <= steps; dx++) {
      const dNorthM = dy * stepM;
      const dEastM = dx * stepM;
      const dist = Math.sqrt(dNorthM ** 2 + dEastM ** 2);
      if (dist > radiusM) continue;

      const point = offsetLatLng(center.lat, center.lng, dNorthM, dEastM);
      points.push(point);
    }
  }

  return points;
}

/**
 * 카카오 카테고리 검색 API 호출
 */
async function searchCategory(lat, lng, radius, categoryCode, page = 1) {
  const url = 'https://dapi.kakao.com/v2/local/search/category.json';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await axios.get(url, {
        params: {
          category_group_code: categoryCode,
          x: lng,  // 카카오 API: x=경도, y=위도
          y: lat,
          radius,
          page,
          size: MAX_PER_PAGE,
          sort: 'distance',
        },
        headers: {
          Authorization: `KakaoAK ${KAKAO_API_KEY}`,
        },
        timeout: 10000,
      });
      return res.data;
    } catch (err) {
      const status = err.response?.status;
      if (attempt < MAX_RETRIES && (!status || status >= 500 || status === 429)) {
        const wait = DELAY_MS * Math.pow(2, attempt);
        console.warn(`  ⚠ 재시도 ${attempt}/${MAX_RETRIES} (${status || err.code}) — ${wait}ms 대기`);
        await sleep(wait);
      } else {
        console.error(`  ✗ 카카오 API 실패: (${lat},${lng}) r=${radius} — ${err.message}`);
        return null;
      }
    }
  }
}

/**
 * 단일 셀에서 모든 페이지 수집 (적응적 세분화 포함)
 */
async function adaptiveSearch(lat, lng, radius, categoryCode, depth = 0) {
  const results = [];
  let totalCount = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await searchCategory(lat, lng, radius, categoryCode, page);
    if (!data || !data.documents) break;

    results.push(...data.documents);
    totalCount = data.meta.total_count;

    if (data.meta.is_end) break;
    await sleep(DELAY_MS);
  }

  // 45개 캡에 도달 & 실제 결과가 더 있을 수 있으면 세분화
  if (results.length >= CAP && depth < 2) {
    console.log(`    📐 셀 (${lat.toFixed(4)},${lng.toFixed(4)}) r=${radius} 캡 도달 → 4분할 (depth=${depth + 1})`);
    const subRadius = Math.floor(radius / 2);
    const subOffset = subRadius;
    const subResults = [];

    const offsets = [
      [-subOffset, -subOffset],
      [-subOffset, subOffset],
      [subOffset, -subOffset],
      [subOffset, subOffset],
    ];

    for (const [dN, dE] of offsets) {
      const sub = offsetLatLng(lat, lng, dN, dE);
      const subData = await adaptiveSearch(sub.lat, sub.lng, subRadius, categoryCode, depth + 1);
      subResults.push(...subData);
      await sleep(DELAY_MS);
    }

    return subResults;
  }

  return results;
}

/**
 * 카카오 결과를 통일된 포맷으로 변환
 */
function normalizeKakaoResult(doc) {
  return {
    // 원본 카카오 필드
    kakaoId: doc.id,
    title: doc.place_name,
    category: doc.category_name,         // "음식점 > 한식 > 국밥"
    address: doc.address_name,
    roadAddress: doc.road_address_name,
    phone: doc.phone,
    placeUrl: doc.place_url,
    lat: parseFloat(doc.y),              // WGS84 네이티브
    lng: parseFloat(doc.x),
    source: 'kakao',
  };
}

// ─── 메인 ───
async function collectKakao() {
  if (!KAKAO_API_KEY) {
    console.error('❌ KAKAO_REST_API_KEY 환경변수를 설정해주세요.');
    process.exit(1);
  }

  // raw-kakao 디렉토리 생성
  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
  }

  const grid = generateGrid(BASE_POINT);
  console.log(`📍 격자 점 ${grid.length}개 생성 (반경 ${SEARCH_RADIUS_M}m, 간격 ${GRID_STEP_M}m)`);
  console.log(`📂 카테고리: ${CATEGORIES.join(', ')}`);

  const allResults = new Map(); // kakaoId → normalized item
  let apiCalls = 0;

  for (const category of CATEGORIES) {
    console.log(`\n🔍 카테고리 ${category} 수집 시작...`);

    for (let i = 0; i < grid.length; i++) {
      const point = grid[i];
      const docs = await adaptiveSearch(point.lat, point.lng, CELL_RADIUS_M, category);
      apiCalls += Math.ceil(docs.length / MAX_PER_PAGE) || 1;

      let newCount = 0;
      for (const doc of docs) {
        if (!allResults.has(doc.id)) {
          allResults.set(doc.id, normalizeKakaoResult(doc));
          newCount++;
        }
      }

      if ((i + 1) % 10 === 0 || i === grid.length - 1) {
        console.log(`  [${i + 1}/${grid.length}] 누적 ${allResults.size}개 (이번 셀 +${newCount})`);
      }

      await sleep(DELAY_MS);
    }
  }

  const results = Array.from(allResults.values());

  // raw 결과 저장
  const rawPath = path.join(RAW_DIR, `kakao_${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(rawPath, JSON.stringify(results, null, 2), 'utf-8');

  console.log(`\n📊 카카오 수집 완료:`);
  console.log(`  총 ${results.length}개 장소`);
  console.log(`  API 호출 약 ${apiCalls}회`);
  console.log(`  저장: ${rawPath}`);

  return results;
}

// 직접 실행 시
if (require.main === module) {
  collectKakao().catch(err => {
    console.error('❌ 치명적 오류:', err);
    process.exit(1);
  });
}

module.exports = { collectKakao };
