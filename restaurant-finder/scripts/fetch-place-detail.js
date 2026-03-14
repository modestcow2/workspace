#!/usr/bin/env node
/**
 * 네이버 플레이스 상세 데이터 수집 스크립트
 *
 * 식당별로 네이버 검색 → Place 패널 HTML 파싱하여 수집:
 *   - 영업시간 (기존 fetch-hours.js 패턴 활용)
 *   - 대표 메뉴 + 가격
 *   - 리뷰 키워드/태그
 *   - 상세 카테고리
 *
 * 사용법: node fetch-place-detail.js [--reset]
 * 중단 후 재시작 가능 (place-detail-progress.json에 진행 저장)
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.resolve(__dirname, '..', 'js', 'data.js');
const PROGRESS_PATH = path.resolve(__dirname, 'place-detail-progress.json');
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

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf-8');
}

// 네이버 검색 HTML에서 상세 정보 추출
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
    const result = {
      openHours: null,
      menus: [],
      reviewKeywords: [],
      detailCategory: null,
      source: 'naver',
    };

    // 1. 영업시간 추출 (3단계 패턴)
    const panelPattern = /영업시간<\/span><\/strong>.*?(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/s;
    const panelMatch = html.match(panelPattern);
    if (panelMatch) {
      result.openHours = `${panelMatch[1]}~${panelMatch[2]}`;
    } else {
      const altPattern = /class="[^"]*place[^"]*"[^>]*>[\s\S]{0,2000}?영업시간[\s\S]{0,200}?(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/i;
      const altMatch = html.match(altPattern);
      if (altMatch) {
        result.openHours = `${altMatch[1]}~${altMatch[2]}`;
      } else {
        const firstHalf = html.slice(0, Math.min(html.length, 80000));
        const broadPattern = /영업시간[^0-9]{0,50}(\d{1,2}:\d{2})\s*[-~\s]+(\d{1,2}:\d{2})/;
        const broadMatch = firstHalf.match(broadPattern);
        if (broadMatch) {
          result.openHours = `${broadMatch[1]}~${broadMatch[2]}`;
        }
      }
    }

    // 2. 메뉴+가격 추출
    // 네이버 Place 패널의 메뉴 섹션: "메뉴명 가격" 패턴
    const menuPatterns = [
      // "메뉴명\n가격" 또는 "메뉴명 가격" 형태
      /class="[^"]*menu[^"]*"[^>]*>[\s\S]{0,5000}/gi,
    ];

    // 가격 패턴: "메뉴명 숫자,숫자원" 또는 "메뉴명 숫자원"
    const priceRegex = /([가-힣a-zA-Z\s]{2,20})\s*(\d{1,3}(?:,\d{3})*)\s*원/g;
    let priceMatch;
    const menuSection = html.slice(0, Math.min(html.length, 100000));
    while ((priceMatch = priceRegex.exec(menuSection)) !== null) {
      const menuName = priceMatch[1].trim();
      const price = parseInt(priceMatch[2].replace(/,/g, ''), 10);
      // 합리적인 메뉴 가격 범위 (1,000원 ~ 200,000원)
      if (price >= 1000 && price <= 200000 && menuName.length >= 2) {
        result.menus.push({ name: menuName, price });
      }
      if (result.menus.length >= 10) break;
    }

    // 3. 리뷰 키워드 추출
    // 네이버 Place의 방문자 리뷰 키워드 태그
    const keywordPatterns = [
      // "방문자리뷰" 근처의 키워드 태그들
      /(?:방문자\s*리뷰|리뷰\s*키워드|태그)[\s\S]{0,2000}/gi,
    ];

    const reviewKeywordRegex = /["""'']([가-힣\s]{2,15})["""'']/g;
    let kwMatch;
    const reviewSection = html.slice(0, Math.min(html.length, 120000));
    // 키워드 패턴 검색
    const kwAreaMatch = reviewSection.match(/(?:방문자\s*리뷰|리뷰\s*키워드|태그|키워드)[\s\S]{0,3000}/i);
    if (kwAreaMatch) {
      while ((kwMatch = reviewKeywordRegex.exec(kwAreaMatch[0])) !== null) {
        const kw = kwMatch[1].trim();
        if (kw.length >= 2 && !result.reviewKeywords.includes(kw)) {
          result.reviewKeywords.push(kw);
        }
        if (result.reviewKeywords.length >= 10) break;
      }
    }

    // 추가 키워드 추출: 볼드 태그나 특정 클래스 내 짧은 텍스트
    const tagRegex = /(?:class="[^"]*(?:tag|chip|keyword|badge)[^"]*"[^>]*>)\s*([가-힣\s]{2,10})\s*</gi;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(menuSection)) !== null) {
      const tag = tagMatch[1].trim();
      if (tag.length >= 2 && !result.reviewKeywords.includes(tag)) {
        result.reviewKeywords.push(tag);
      }
      if (result.reviewKeywords.length >= 15) break;
    }

    // 4. 상세 카테고리 추출
    // Place 패널의 카테고리 텍스트
    const catPattern = /(?:class="[^"]*(?:category|type)[^"]*"[^>]*>)\s*([가-힣>,\s·]+)\s*</gi;
    const catMatch = catPattern.exec(html);
    if (catMatch) {
      result.detailCategory = catMatch[1].trim();
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
  const restaurants = parseDataJs();
  const progress = loadProgress();

  const remaining = restaurants.filter(r => !progress[r.id]);
  console.log(`📋 네이버 플레이스 상세 수집 시작`);
  console.log(`   전체: ${restaurants.length}개 | 이미 수집: ${Object.keys(progress).length}개 | 남은: ${remaining.length}개`);
  console.log(`   딜레이: ${DELAY_MS}ms | 예상 소요: ~${Math.round(remaining.length * DELAY_MS / 60000)}분\n`);

  let found = 0, notFound = 0, skipped = 0, rateLimited = 0;

  for (let i = 0; i < restaurants.length; i++) {
    const r = restaurants[i];

    if (progress[r.id]) {
      skipped++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${restaurants.length}] "${r.name}" ... `);

    let result = await fetchPlaceDetail(r.name, r.address);

    // Rate limit 처리
    if (result && result.error === 'rate_limited') {
      console.log('⚠ Rate limited — 30초 대기...');
      rateLimited++;
      await sleep(RETRY_DELAY_MS);
      result = await fetchPlaceDetail(r.name, r.address);
      if (result && result.error === 'rate_limited') {
        console.log('  ✗ 재시도 실패');
        progress[r.id] = {
          status: 'rate_limited',
          openHours: '확인필요',
          menus: [],
          reviewKeywords: [],
          detailCategory: null,
        };
        notFound++;
        saveProgress(progress);
        await sleep(DELAY_MS);
        continue;
      }
    }

    if (result && !result.error) {
      const menuCount = result.menus.length;
      const kwCount = result.reviewKeywords.length;
      const hours = result.openHours || '확인필요';
      console.log(`✓ 시간:${hours} 메뉴:${menuCount}개 키워드:${kwCount}개`);

      progress[r.id] = {
        status: hours !== '확인필요' ? 'found' : 'partial',
        openHours: hours,
        menus: result.menus,
        reviewKeywords: result.reviewKeywords,
        detailCategory: result.detailCategory,
        source: 'naver',
      };
      found++;
    } else {
      console.log(`✗ ${result?.error || '없음'}`);
      progress[r.id] = {
        status: 'not_found',
        openHours: '확인필요',
        menus: [],
        reviewKeywords: [],
        detailCategory: null,
      };
      notFound++;
    }

    saveProgress(progress);
    await sleep(DELAY_MS);

    // 체크포인트
    if ((found + notFound) % CHECKPOINT_INTERVAL === 0 && (found + notFound) > 0) {
      console.log(`\n   💾 중간 저장 (${i + 1}/${restaurants.length}) — 발견: ${found} | 미발견: ${notFound}\n`);
    }
  }

  console.log(`\n✅ 네이버 플레이스 상세 수집 완료!`);
  console.log(`   발견: ${found}개 | 미발견: ${notFound}개 | 건너뜀: ${skipped}개 | Rate limited: ${rateLimited}회`);
  console.log(`   결과: ${PROGRESS_PATH}`);

  // 통계 출력
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
