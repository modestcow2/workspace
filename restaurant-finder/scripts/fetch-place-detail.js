#!/usr/bin/env node
/**
 * 네이버 플레이스 상세 데이터 수집 스크립트
 *
 * 식당별로 네이버 검색 → cheerio로 Place 패널(api_subject_bx) 파싱:
 *   - 영업시간 (기존 fetch-hours.js 3단계 regex 패턴 유지)
 *   - 대표 메뉴 + 가격 (패널 텍스트에서 "메뉴명 + 가격원" 추출)
 *   - 리뷰 키워드 (패널 텍스트에서 "키워드"이 키워드를 선택한 인원 패턴)
 *   - SSR JSON 내 VisitorReviewStatsAnalysisThemes에서 추가 키워드
 *
 * 사용법: node fetch-place-detail.js [--reset] [--test N]
 * 중단 후 재시작 가능 (place-detail-progress.json에 진행 저장)
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.resolve(__dirname, '..', 'js', 'data.js');
const PROGRESS_PATH = path.resolve(__dirname, 'place-detail-progress.json');
const HOURS_PROGRESS_PATH = path.resolve(__dirname, 'hours-progress.json');
const DELAY_MS = 3000;
const RETRY_DELAY_MS = 30000;
const CHECKPOINT_INTERVAL = 20;
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

// 진행 상황 저장/로드
function loadProgress() {
  if (process.argv.includes('--reset')) return {};
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

// 기존 hours-progress.json에서 영업시간 데이터 병합
function mergeHoursProgress(progress) {
  try {
    const hoursData = JSON.parse(fs.readFileSync(HOURS_PROGRESS_PATH, 'utf-8'));
    let merged = 0;
    for (const [id, data] of Object.entries(hoursData)) {
      if (progress[id]) continue;
      if (data.status === 'found' && data.openHours && data.openHours !== '-' && data.openHours !== '확인필요') {
        progress[id] = {
          status: 'found',
          openHours: data.openHours,
          menus: [],
          reviewKeywords: [],
          detailCategory: null,
          source: data.source || 'naver',
          needsMenuKeywords: true,
        };
        merged++;
      }
    }
    if (merged > 0) {
      console.log(`   📂 hours-progress.json에서 영업시간 ${merged}건 병합 완료`);
    }
    return merged;
  } catch {
    return 0;
  }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf-8');
}

// ─── 영업시간 추출 (검증된 3단계 regex) ───
function extractHours(html) {
  const panelPattern = /영업시간<\/span><\/strong>.*?(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/s;
  const panelMatch = html.match(panelPattern);
  if (panelMatch) return `${panelMatch[1]}~${panelMatch[2]}`;

  const altPattern = /class="[^"]*place[^"]*"[^>]*>[\s\S]{0,2000}?영업시간[\s\S]{0,200}?(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/i;
  const altMatch = html.match(altPattern);
  if (altMatch) return `${altMatch[1]}~${altMatch[2]}`;

  const firstHalf = html.slice(0, Math.min(html.length, 80000));
  const broadPattern = /영업시간[^0-9]{0,50}(\d{1,2}:\d{2})\s*[-~\s]+(\d{1,2}:\d{2})/;
  const broadMatch = firstHalf.match(broadPattern);
  if (broadMatch) return `${broadMatch[1]}~${broadMatch[2]}`;

  return null;
}

// ─── 메뉴+가격 추출 (패널 텍스트 + HTML 구조 기반) ───
function extractMenus($, html) {
  const menus = [];
  const seen = new Set();

  // 방법 1: api_subject_bx 패널의 HTML에서 메뉴 가격 추출
  // 패턴: ">메뉴명</...>...대표...숫자,숫자 원"
  const panel = $('.api_subject_bx').first();
  if (panel.length) {
    const panelHtml = panel.html() || '';
    // 네이버 Place 메뉴 구조: "메뉴명</span>...</span> 대표 가격 원"
    // HTML에서 "메뉴명" 뒤에 "대표" 라벨과 "가격 원"이 따라옴
    const menuPriceRegex = />([가-힣a-zA-Z\s]{2,20})<\/[^>]+>[^<]*<[^>]*>[^<]*(?:대표)?[^<]*<[^>]*>[^<]*?(\d{1,3}(?:,\d{3})+)\s*원/g;
    let m;
    while ((m = menuPriceRegex.exec(panelHtml)) !== null) {
      const name = m[1].trim();
      const price = parseInt(m[2].replace(/,/g, ''), 10);
      if (price >= 1000 && price <= 200000 && name.length >= 2 && !seen.has(name)) {
        seen.add(name);
        menus.push({ name, price });
      }
      if (menus.length >= 10) break;
    }
  }

  // 방법 2: 패널 텍스트에서 메뉴 추출
  if (menus.length === 0 && panel.length) {
    const panelText = panel.text();
    // "메뉴" 라벨 뒤부터 "메뉴판 전체보기" 또는 "방문자 리뷰"까지의 텍스트
    const menuAreaMatch = panelText.match(/메뉴(.{0,500}?)(?:메뉴판\s*전체|방문자\s*리뷰|블로그)/);
    if (menuAreaMatch) {
      const menuArea = menuAreaMatch[1];
      // "메뉴명대표가격원" 패턴 — "대표" 라벨을 분리
      const itemRegex = /([가-힣a-zA-Z\s]{2,20})대표(\d{1,3}(?:,\d{3})*)\s*원/g;
      let m;
      while ((m = itemRegex.exec(menuArea)) !== null) {
        let name = m[1].trim();
        const price = parseInt(m[2].replace(/,/g, ''), 10);
        if (price >= 1000 && price <= 200000 && name.length >= 2 && !seen.has(name)) {
          seen.add(name);
          menus.push({ name, price });
        }
        if (menus.length >= 10) break;
      }
      // "대표" 없는 메뉴도 시도
      if (menus.length === 0) {
        const itemRegex2 = /([가-힣a-zA-Z\s]{2,20})(\d{1,3}(?:,\d{3})*)\s*원/g;
        while ((m = itemRegex2.exec(menuArea)) !== null) {
          let name = m[1].trim();
          const price = parseInt(m[2].replace(/,/g, ''), 10);
          if (price >= 1000 && price <= 200000 && name.length >= 2 && !seen.has(name)) {
            seen.add(name);
            menus.push({ name, price });
          }
          if (menus.length >= 10) break;
        }
      }
    }
  }

  // 후처리: 메뉴명에서 "대표", "배달의민족" 등 불필요 텍스트 제거
  for (const menu of menus) {
    menu.name = menu.name
      .replace(/대표/g, '')
      .replace(/배달의민족/g, '')
      .replace(/네이버/g, '')
      .replace(/인기/g, '')
      .trim();
  }
  // 빈 이름 제거
  const cleaned = menus.filter(m => m.name.length >= 2);
  menus.length = 0;
  menus.push(...cleaned);

  // 방법 3: SSR JSON에서 menuInfo 추출
  if (menus.length === 0) {
    const menuJsonMatch = html.match(/"menuSource"[^}]*"menus\([^)]*\)"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
    if (menuJsonMatch) {
      try {
        const menuData = JSON.parse(menuJsonMatch[1]);
        for (const item of menuData) {
          const name = item.name || item.menuName;
          const price = item.price || item.unitprice;
          if (name && price && !seen.has(name)) {
            seen.add(name);
            menus.push({ name, price: typeof price === 'string' ? parseInt(price.replace(/,/g, ''), 10) : price });
          }
          if (menus.length >= 10) break;
        }
      } catch { /* ignore parse errors */ }
    }
  }

  return menus;
}

// ─── 리뷰 키워드 추출 (패널 텍스트 + SSR JSON) ───
function extractKeywords($, html) {
  const keywords = [];
  const seen = new Set();

  // 방법 1: 패널 텍스트에서 "키워드"이 키워드를 선택한 인원N 패턴
  const panel = $('.api_subject_bx').first();
  if (panel.length) {
    const panelText = panel.text();
    // 방문자 리뷰 섹션에서 "키워드명"이 키워드를 선택한 인원 패턴
    const kwRegex = /["""]([가-힣\s!·,.]{2,20})["""]\s*이\s*키워드를\s*선택한/g;
    let m;
    while ((m = kwRegex.exec(panelText)) !== null) {
      const kw = m[1].trim();
      if (!seen.has(kw)) {
        seen.add(kw);
        keywords.push(kw);
      }
      if (keywords.length >= 15) break;
    }
  }

  // 방법 2: SSR JSON에서 VisitorReviewStatsAnalysisThemes 추출
  // 패턴: "menus":[{"__typename":"VisitorReviewStatsAnalysisThemes","label":"국밥","count":27}]
  const themesRegex = /"label"\s*:\s*"([가-힣a-zA-Z\s]{1,15})"\s*,\s*"count"\s*:\s*(\d+)/g;
  let m;
  while ((m = themesRegex.exec(html)) !== null) {
    const label = m[1].trim();
    const count = parseInt(m[2], 10);
    if (count >= 3 && label.length >= 1 && !seen.has(label)) {
      seen.add(label);
      keywords.push(label);
    }
    if (keywords.length >= 15) break;
  }

  return keywords;
}

// ─── 상세 카테고리 추출 ───
function extractCategory($) {
  const panel = $('.api_subject_bx').first();
  if (!panel.length) return null;

  // 패널 텍스트 앞부분에서 카테고리 추출 (이름 바로 뒤)
  const panelText = panel.text();
  // 패턴: "+숫자식당이름카테고리방문자 리뷰"
  const catMatch = panelText.match(/^[^가-힣]*[가-힣\s\w]+?(한식|중식|일식|양식|분식|카페|베이커리|아시안|동남아|인도|멕시코|퓨전|패스트푸드|뷔페|해산물|치킨|피자|햄버거|고깃집|국수|술집|주점)/);
  if (catMatch) return catMatch[1];

  return null;
}

// ─── 네이버 검색 HTML에서 상세 정보 추출 ───
async function fetchPlaceDetail(name, address) {
  const guMatch = address.match(/([가-힣]+구)/);
  const query = guMatch ? `${name} ${guMatch[1]}` : name;
  const url = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query)}`;

  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': DESKTOP_UA },
      timeout: 15000,
    });

    const html = res.data;
    const $ = cheerio.load(html);

    return {
      openHours: extractHours(html),
      menus: extractMenus($, html),
      reviewKeywords: extractKeywords($, html),
      detailCategory: extractCategory($),
      source: 'naver',
    };
  } catch (err) {
    if (err.response?.status === 429) {
      return { error: 'rate_limited' };
    }
    return { error: err.message };
  }
}

// ─── 메인 ───
async function main() {
  const restaurants = parseDataJs();
  const progress = loadProgress();

  // 기존 hours-progress.json 병합
  mergeHoursProgress(progress);

  // --test N 옵션 처리
  const testIdx = process.argv.indexOf('--test');
  const testLimit = testIdx !== -1 ? parseInt(process.argv[testIdx + 1] || '5', 10) : 0;

  const remaining = restaurants.filter(r => {
    if (!progress[r.id]) return true;
    if (progress[r.id].needsMenuKeywords) return true;
    return false;
  });

  console.log(`📋 네이버 플레이스 상세 수집 시작`);
  console.log(`   전체: ${restaurants.length}개 | 이미 완료: ${Object.keys(progress).length - remaining.filter(r => progress[r.id]).length}개 | 남은: ${remaining.length}개`);
  if (testLimit > 0) {
    console.log(`   🧪 테스트 모드: 처음 ${testLimit}개만 수집`);
  }
  console.log(`   딜레이: ${DELAY_MS}ms | 예상 소요: ~${Math.round(remaining.length * DELAY_MS / 60000)}분\n`);

  let found = 0, notFound = 0, skipped = 0, rateLimited = 0;
  let processed = 0;

  for (let i = 0; i < restaurants.length; i++) {
    const r = restaurants[i];

    if (progress[r.id] && !progress[r.id].needsMenuKeywords) {
      skipped++;
      continue;
    }

    if (testLimit > 0 && processed >= testLimit) break;

    process.stdout.write(`[${i + 1}/${restaurants.length}] "${r.name}" ... `);

    let result = await fetchPlaceDetail(r.name, r.address);

    // Rate limit 처리
    if (result && result.error === 'rate_limited') {
      console.log('⚠ Rate limited - 30초 대기...');
      rateLimited++;
      await sleep(RETRY_DELAY_MS);
      result = await fetchPlaceDetail(r.name, r.address);
      if (result && result.error === 'rate_limited') {
        console.log('  ✗ 재시도 실패');
        if (!progress[r.id]) {
          progress[r.id] = {
            status: 'rate_limited',
            openHours: '확인필요',
            menus: [],
            reviewKeywords: [],
            detailCategory: null,
          };
        }
        if (progress[r.id]) delete progress[r.id].needsMenuKeywords;
        notFound++;
        saveProgress(progress);
        await sleep(DELAY_MS);
        processed++;
        continue;
      }
    }

    if (result && !result.error) {
      const existing = progress[r.id] || {};
      const menuCount = result.menus.length;
      const kwCount = result.reviewKeywords.length;
      const hours = result.openHours || existing.openHours || '확인필요';
      console.log(`✓ 시간:${hours} 메뉴:${menuCount}개 키워드:${kwCount}개`);

      progress[r.id] = {
        status: hours !== '확인필요' ? 'found' : 'partial',
        openHours: hours,
        menus: result.menus.length > 0 ? result.menus : (existing.menus || []),
        reviewKeywords: result.reviewKeywords.length > 0 ? result.reviewKeywords : (existing.reviewKeywords || []),
        detailCategory: result.detailCategory || existing.detailCategory || null,
        source: 'naver',
      };
      found++;
    } else {
      console.log(`✗ ${result?.error || '없음'}`);
      if (!progress[r.id]) {
        progress[r.id] = {
          status: 'not_found',
          openHours: '확인필요',
          menus: [],
          reviewKeywords: [],
          detailCategory: null,
        };
      }
      if (progress[r.id]) delete progress[r.id].needsMenuKeywords;
      notFound++;
    }

    saveProgress(progress);
    processed++;
    await sleep(DELAY_MS);

    if (processed % CHECKPOINT_INTERVAL === 0 && processed > 0) {
      console.log(`\n   💾 중간 저장 (${processed}건 처리) - 발견: ${found} | 미발견: ${notFound}\n`);
    }
  }

  console.log(`\n✅ 네이버 플레이스 상세 수집 완료!`);
  console.log(`   발견: ${found}개 | 미발견: ${notFound}개 | 건너뜀: ${skipped}개 | Rate limited: ${rateLimited}회`);
  console.log(`   결과: ${PROGRESS_PATH}`);

  const all = Object.values(progress);
  const withHours = all.filter(p => p.openHours && p.openHours !== '확인필요').length;
  const withMenus = all.filter(p => p.menus && p.menus.length > 0).length;
  const withKeywords = all.filter(p => p.reviewKeywords && p.reviewKeywords.length > 0).length;
  console.log(`\n📊 수집 통계:`);
  console.log(`   영업시간 확보: ${withHours}/${all.length} (${(withHours/all.length*100).toFixed(1)}%)`);
  console.log(`   메뉴+가격 확보: ${withMenus}/${all.length} (${(withMenus/all.length*100).toFixed(1)}%)`);
  console.log(`   리뷰 키워드 확보: ${withKeywords}/${all.length} (${(withKeywords/all.length*100).toFixed(1)}%)`);
}

main().catch(err => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});
