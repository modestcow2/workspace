#!/usr/bin/env node
/**
 * 네이버 웹 검색에서 식당 영업시간을 수집하는 스크립트
 *
 * 사용법: node scripts/fetch-hours.js
 *
 * 네이버 검색 결과의 Place 패널에서 영업시간을 추출합니다.
 * 진행 상황을 hours-progress.json에 저장하여 중단 후 재시작이 가능합니다.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.resolve(__dirname, '..', 'js', 'data.js');
const PROGRESS_PATH = path.resolve(__dirname, 'hours-progress.json');
const DELAY_MS = 3000;       // 요청 간 3초 딜레이
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 네이버 검색 결과 Place 패널에서 영업시간 추출
async function searchHours(name, address) {
  // 주소에서 구 정보 추출하여 검색 정확도 향상
  const guMatch = address.match(/([가-힣]+구)/);
  const query = guMatch ? `${name} ${guMatch[1]}` : name;
  const url = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query)}`;

  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': DESKTOP_UA },
      timeout: 15000,
    });

    const html = res.data;

    // Place 패널의 영업시간 추출
    // 패턴: "영업시간</span></strong>" 뒤에 나오는 HH:MM ~ HH:MM
    const panelPattern = /영업시간<\/span><\/strong>.*?(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/s;
    const panelMatch = html.match(panelPattern);
    if (panelMatch) {
      return { text: `${panelMatch[1]}~${panelMatch[2]}`, source: 'panel' };
    }

    // 대안: Place 카드 내 시간 패턴 (영업시간 라벨 근처)
    const altPattern = /class="[^"]*place[^"]*"[^>]*>[\s\S]{0,2000}?영업시간[\s\S]{0,200}?(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/i;
    const altMatch = html.match(altPattern);
    if (altMatch) {
      return { text: `${altMatch[1]}~${altMatch[2]}`, source: 'card' };
    }

    // 페이지 전체에서 영업시간 뒤의 첫 시간 패턴
    const firstHalf = html.slice(0, Math.min(html.length, 80000));
    const broadPattern = /영업시간[^0-9]{0,50}(\d{1,2}:\d{2})\s*[-~\s]+(\d{1,2}:\d{2})/;
    const broadMatch = firstHalf.match(broadPattern);
    if (broadMatch) {
      return { text: `${broadMatch[1]}~${broadMatch[2]}`, source: 'broad' };
    }

    return null;
  } catch (err) {
    if (err.response?.status === 429) {
      return { error: 'rate_limited' };
    }
    return null;
  }
}

// data.js에서 RESTAURANTS 파싱
function parseDataJs() {
  const src = fs.readFileSync(DATA_PATH, 'utf-8');
  const match = src.match(/const RESTAURANTS\s*=\s*(\[[\s\S]*\]);/);
  if (!match) throw new Error('RESTAURANTS 배열을 찾을 수 없습니다.');
  return { src, restaurants: eval(match[1]) };
}

// data.js 업데이트
function updateDataJs(src, restaurants) {
  const entries = restaurants.map(r => {
    return '  ' + JSON.stringify(r, null, 2).split('\n').join('\n  ');
  });

  const updated = src.replace(
    /const RESTAURANTS\s*=\s*\[[\s\S]*\];/,
    `const RESTAURANTS = [\n${entries.join(',\n')}\n];`
  );

  fs.writeFileSync(DATA_PATH, updated, 'utf-8');
}

// 진행 상황 저장/로드
function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf-8');
}

// ─── 메인 ───
async function main() {
  const { src, restaurants } = parseDataJs();
  const progress = loadProgress();

  console.log(`🕐 ${restaurants.length}개 식당 영업시간 수집 시작...`);
  console.log(`   (이미 수집된 항목: ${Object.keys(progress).length}개)`);
  console.log(`   딜레이: ${DELAY_MS}ms | 예상 소요: ~${Math.round((restaurants.length - Object.keys(progress).length) * DELAY_MS / 60000)}분\n`);

  let found = 0;
  let notFound = 0;
  let skipped = 0;
  let rateLimited = 0;

  for (let i = 0; i < restaurants.length; i++) {
    const r = restaurants[i];

    // 이미 수집한 항목은 건너뛰기
    if (progress[r.id]) {
      r.openHours = progress[r.id].openHours;
      skipped++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${restaurants.length}] "${r.name}" ... `);

    const result = await searchHours(r.name, r.address);

    if (result && result.error === 'rate_limited') {
      console.log('⚠ Rate limited — 30초 대기...');
      rateLimited++;
      await sleep(30000);
      // 재시도
      const retry = await searchHours(r.name, r.address);
      if (retry && !retry.error && retry.text) {
        console.log(`  ✓ ${retry.text} [${retry.source}]`);
        r.openHours = retry.text;
        progress[r.id] = { openHours: retry.text, source: retry.source, status: 'found' };
        found++;
      } else {
        console.log('  ✗ 재시도 실패');
        r.openHours = '확인필요';
        progress[r.id] = { openHours: '확인필요', status: 'rate_limited' };
        notFound++;
      }
    } else if (result && result.text) {
      console.log(`✓ ${result.text} [${result.source}]`);
      r.openHours = result.text;
      progress[r.id] = { openHours: result.text, source: result.source, status: 'found' };
      found++;
    } else {
      console.log('✗ 없음');
      r.openHours = '확인필요';
      progress[r.id] = { openHours: '확인필요', status: 'not_found' };
      notFound++;
    }

    saveProgress(progress);
    await sleep(DELAY_MS);

    // 20개마다 중간 저장
    if ((i + 1) % 20 === 0) {
      updateDataJs(src, restaurants);
      console.log(`\n   💾 중간 저장 (${i + 1}/${restaurants.length}) — 발견: ${found} | 미발견: ${notFound}\n`);
    }
  }

  // 최종 저장
  updateDataJs(src, restaurants);

  console.log(`\n✅ 영업시간 수집 완료!`);
  console.log(`   발견: ${found}개 | 미발견: ${notFound}개 | 건너뜀: ${skipped}개 | Rate limited: ${rateLimited}회`);
  console.log(`   결과: ${DATA_PATH}`);
}

main().catch(err => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});
