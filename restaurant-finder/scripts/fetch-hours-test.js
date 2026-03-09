#!/usr/bin/env node
/**
 * fetch-hours 테스트: 처음 10개 식당만 수집
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.resolve(__dirname, '..', 'js', 'data.js');
const DELAY_MS = 3000;
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function searchHours(name, address) {
  const guMatch = address.match(/([가-힣]+구)/);
  const query = guMatch ? `${name} ${guMatch[1]}` : name;
  const url = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query)}`;

  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': DESKTOP_UA },
      timeout: 15000,
    });
    const html = res.data;

    // Place 패널 영업시간
    const panelPattern = /영업시간<\/span><\/strong>.*?(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/s;
    const panelMatch = html.match(panelPattern);
    if (panelMatch) return { text: `${panelMatch[1]}~${panelMatch[2]}`, source: 'panel' };

    // 페이지 전체 영업시간 패턴
    const firstHalf = html.slice(0, 80000);
    const broadPattern = /영업시간[^0-9]{0,50}(\d{1,2}:\d{2})\s*[-~\s]+(\d{1,2}:\d{2})/;
    const broadMatch = firstHalf.match(broadPattern);
    if (broadMatch) return { text: `${broadMatch[1]}~${broadMatch[2]}`, source: 'broad' };

    return null;
  } catch (err) {
    return { error: err.response?.status || err.code };
  }
}

// Parse restaurants from data.js
const src = fs.readFileSync(DATA_PATH, 'utf-8');
const match = src.match(/const RESTAURANTS\s*=\s*(\[[\s\S]*\]);/);
const restaurants = eval(match[1]).slice(0, 10);

async function main() {
  console.log('🧪 처음 10개 식당 영업시간 수집 테스트\n');

  let found = 0;
  for (const r of restaurants) {
    process.stdout.write(`"${r.name}" → `);
    const result = await searchHours(r.name, r.address);

    if (result && result.error) {
      console.log(`✗ Error: ${result.error}`);
    } else if (result && result.text) {
      console.log(`✓ ${result.text} [${result.source}]`);
      found++;
    } else {
      console.log('✗ 없음');
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n결과: ${found}/10개 발견`);
}

main().catch(err => console.error('Error:', err));
