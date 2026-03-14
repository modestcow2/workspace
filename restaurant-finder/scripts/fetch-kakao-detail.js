#!/usr/bin/env node
/**
 * 카카오 플레이스 보완 수집 스크립트
 *
 * Phase 1(네이버)에서 영업시간 수집 실패한 식당에 대해
 * 카카오 플레이스 페이지에서 보완 수집합니다.
 *
 * 사용법: node fetch-kakao-detail.js
 * 전제: place-detail-progress.json 존재 (Phase 1 완료 후)
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.resolve(__dirname, '..', 'js', 'data.js');
const NAVER_PROGRESS_PATH = path.resolve(__dirname, 'place-detail-progress.json');
const KAKAO_RAW_DIR = path.resolve(__dirname, 'raw-kakao');
const DELAY_MS = 3000;
const RETRY_DELAY_MS = 30000;
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// data.js에서 RESTAURANTS 파싱
function parseDataJs() {
  const src = fs.readFileSync(DATA_PATH, 'utf-8');
  const match = src.match(/const RESTAURANTS\s*=\s*(\[[\s\S]*\]);/);
  if (!match) throw new Error('RESTAURANTS 배열을 찾을 수 없습니다.');
  return eval(match[1]);
}

// 카카오 raw 데이터에서 kakaoId 맵 로드
function loadKakaoIdMap() {
  const map = {};
  if (!fs.existsSync(KAKAO_RAW_DIR)) return map;

  const files = fs.readdirSync(KAKAO_RAW_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(KAKAO_RAW_DIR, file), 'utf-8'));
      const items = Array.isArray(data) ? data : (data.items || []);
      for (const item of items) {
        if (item.kakaoId && item.title) {
          // 이름 정규화하여 매핑
          const normalName = item.title.replace(/<\/?b>/g, '').trim().toLowerCase();
          map[normalName] = {
            kakaoId: item.kakaoId,
            placeUrl: item.placeUrl || `https://place.map.kakao.com/${item.kakaoId}`,
          };
        }
      }
    } catch {}
  }
  return map;
}

// 카카오 플레이스 페이지에서 상세 정보 추출
async function fetchKakaoDetail(kakaoId) {
  const url = `https://place.map.kakao.com/${kakaoId}`;

  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': DESKTOP_UA },
      timeout: 15000,
    });

    const html = res.data;
    const result = {
      openHours: null,
      menus: [],
      source: 'kakao',
    };

    // 영업시간 추출
    const hoursPatterns = [
      /영업시간[^0-9]{0,30}(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/,
      /(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/,
    ];

    for (const pattern of hoursPatterns) {
      const match = html.match(pattern);
      if (match) {
        result.openHours = `${match[1]}~${match[2]}`;
        break;
      }
    }

    // 메뉴+가격 추출
    const priceRegex = /([가-힣a-zA-Z\s]{2,20})\s*(\d{1,3}(?:,\d{3})*)\s*원/g;
    let priceMatch;
    while ((priceMatch = priceRegex.exec(html)) !== null) {
      const menuName = priceMatch[1].trim();
      const price = parseInt(priceMatch[2].replace(/,/g, ''), 10);
      if (price >= 1000 && price <= 200000 && menuName.length >= 2) {
        result.menus.push({ name: menuName, price });
      }
      if (result.menus.length >= 10) break;
    }

    return result;
  } catch (err) {
    if (err.response?.status === 429) {
      return { error: 'rate_limited' };
    }
    return { error: err.message };
  }
}

// ─── 메인 ───
async function main() {
  // Phase 1 진행 데이터 로드
  if (!fs.existsSync(NAVER_PROGRESS_PATH)) {
    console.error('❌ place-detail-progress.json이 없습니다. Phase 1을 먼저 실행하세요.');
    process.exit(1);
  }

  const progress = JSON.parse(fs.readFileSync(NAVER_PROGRESS_PATH, 'utf-8'));
  const restaurants = parseDataJs();
  const kakaoMap = loadKakaoIdMap();

  // 영업시간 미확보 식당 필터
  const targets = restaurants.filter(r => {
    const p = progress[r.id];
    return !p || p.openHours === '확인필요';
  });

  console.log(`🔍 카카오 보완 수집 대상: ${targets.length}개 (전체 ${restaurants.length}개 중 영업시간 미확보)`);
  console.log(`   카카오 ID 매핑: ${Object.keys(kakaoMap).length}개`);

  let found = 0, notFound = 0, noKakaoId = 0;

  for (let i = 0; i < targets.length; i++) {
    const r = targets[i];
    const normalName = r.name.toLowerCase();
    const kakaoInfo = kakaoMap[normalName];

    if (!kakaoInfo) {
      noKakaoId++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${targets.length}] "${r.name}" (kakao:${kakaoInfo.kakaoId}) ... `);

    let result = await fetchKakaoDetail(kakaoInfo.kakaoId);

    if (result && result.error === 'rate_limited') {
      console.log('⚠ Rate limited — 30초 대기...');
      await sleep(RETRY_DELAY_MS);
      result = await fetchKakaoDetail(kakaoInfo.kakaoId);
    }

    if (result && !result.error && result.openHours) {
      console.log(`✓ ${result.openHours} 메뉴:${result.menus.length}개`);

      // progress 업데이트
      if (!progress[r.id]) progress[r.id] = {};
      progress[r.id].openHours = result.openHours;
      progress[r.id].source = 'kakao';
      progress[r.id].status = 'found';
      if (result.menus.length > 0 && (!progress[r.id].menus || progress[r.id].menus.length === 0)) {
        progress[r.id].menus = result.menus;
      }
      found++;
    } else {
      console.log(`✗ ${result?.error || '없음'}`);
      notFound++;
    }

    await sleep(DELAY_MS);

    // 20건마다 중간 저장
    if ((found + notFound) % 20 === 0 && (found + notFound) > 0) {
      fs.writeFileSync(NAVER_PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf-8');
      console.log(`\n   💾 중간 저장 — 발견: ${found} | 미발견: ${notFound}\n`);
    }
  }

  // 최종 저장
  fs.writeFileSync(NAVER_PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf-8');

  console.log(`\n✅ 카카오 보완 수집 완료!`);
  console.log(`   발견: ${found}개 | 미발견: ${notFound}개 | 카카오ID 없음: ${noKakaoId}개`);

  // 최종 통계
  const all = Object.values(progress);
  const withHours = all.filter(p => p.openHours && p.openHours !== '확인필요').length;
  console.log(`\n📊 영업시간 최종 확보율: ${withHours}/${all.length} (${(withHours/all.length*100).toFixed(1)}%)`);
}

main().catch(err => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});
