#!/usr/bin/env node
/**
 * 변경 감지 스크립트
 *
 * 이전 data.js vs 새 data.js를 비교하여:
 * - 신규 식당, 폐업 식당, 변경 식당을 감지
 * - tracking.json으로 연속 미감지 횟수 추적 (2회 연속 미감지 시 폐업 처리)
 * - change-report.md 자동 생성
 *
 * 사용법:
 *   node detect-changes.js [--prev path/to/old-data.js]
 */

const fs = require('fs');
const path = require('path');

const DATA_JS_PATH = path.resolve(__dirname, '..', 'js', 'data.js');
const BACKUP_DIR = path.join(__dirname, 'backups');
const TRACKING_PATH = path.join(__dirname, 'tracking.json');
const REPORT_PATH = path.join(__dirname, 'change-report.md');

/**
 * data.js에서 RESTAURANTS 배열 파싱
 */
function parseDataJs(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  // RESTAURANTS 배열 추출
  const match = content.match(/const RESTAURANTS = \[([\s\S]*)\];/);
  if (!match) return [];

  try {
    // JSON으로 파싱 가능하도록 가공
    const arrStr = '[' + match[1] + ']';
    return JSON.parse(arrStr);
  } catch (e) {
    // eval 대안: vm 모듈 사용
    const vm = require('vm');
    const sandbox = {};
    vm.runInNewContext(content, sandbox);
    return sandbox.RESTAURANTS || [];
  }
}

/**
 * tracking.json 로드
 */
function loadTracking() {
  if (fs.existsSync(TRACKING_PATH)) {
    return JSON.parse(fs.readFileSync(TRACKING_PATH, 'utf-8'));
  }
  return {};
}

/**
 * tracking.json 저장
 */
function saveTracking(tracking) {
  fs.writeFileSync(TRACKING_PATH, JSON.stringify(tracking, null, 2), 'utf-8');
}

/**
 * data.js 백업
 */
function backupCurrentData() {
  if (!fs.existsSync(DATA_JS_PATH)) return null;
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const date = new Date().toISOString().slice(0, 10);
  const backupPath = path.join(BACKUP_DIR, `data_${date}.js`);

  // 같은 날짜 백업이 없을 때만 생성
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(DATA_JS_PATH, backupPath);
    console.log(`📦 백업 생성: ${backupPath}`);
  }

  return backupPath;
}

/**
 * 이전 데이터 경로 결정
 */
function getPreviousDataPath() {
  // --prev 인자 확인
  const prevIdx = process.argv.indexOf('--prev');
  if (prevIdx !== -1 && process.argv[prevIdx + 1]) {
    return path.resolve(process.argv[prevIdx + 1]);
  }

  // 가장 최근 백업 찾기
  if (!fs.existsSync(BACKUP_DIR)) return null;

  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('data_') && f.endsWith('.js'))
    .sort()
    .reverse();

  if (backups.length === 0) return null;
  return path.join(BACKUP_DIR, backups[0]);
}

// ─── 메인 ───
function main() {
  console.log('🔍 변경 감지 시작...\n');

  // 현재 data.js 백업
  backupCurrentData();

  // 이전 데이터 로드
  const prevPath = getPreviousDataPath();
  if (!prevPath || !fs.existsSync(prevPath)) {
    console.log('ℹ️  이전 데이터가 없습니다. 첫 실행으로 간주합니다.');
    console.log('   tracking.json을 초기화합니다.');

    const current = parseDataJs(DATA_JS_PATH);
    const tracking = {};
    const today = new Date().toISOString().slice(0, 10);
    for (const r of current) {
      tracking[r.id] = { lastSeen: today, missedRuns: 0 };
    }
    saveTracking(tracking);

    // 빈 리포트 생성
    const report = `# 변경 리포트 — ${today}\n\n첫 실행: ${current.length}개 식당 등록\n`;
    fs.writeFileSync(REPORT_PATH, report, 'utf-8');
    console.log(`📝 리포트 생성: ${REPORT_PATH}`);
    return;
  }

  console.log(`📂 이전 데이터: ${prevPath}`);
  console.log(`📂 현재 데이터: ${DATA_JS_PATH}`);

  const prevRestaurants = parseDataJs(prevPath);
  const currRestaurants = parseDataJs(DATA_JS_PATH);
  const tracking = loadTracking();
  const today = new Date().toISOString().slice(0, 10);

  console.log(`  이전: ${prevRestaurants.length}개, 현재: ${currRestaurants.length}개\n`);

  // 매핑 생성
  const prevById = new Map(prevRestaurants.map(r => [r.id, r]));
  const currById = new Map(currRestaurants.map(r => [r.id, r]));

  // ── 신규 식당 ──
  const added = currRestaurants.filter(r => !prevById.has(r.id));

  // ── 사라진 식당 ──
  const missing = prevRestaurants.filter(r => !currById.has(r.id));

  // ── 변경된 식당 ──
  const changed = [];
  for (const curr of currRestaurants) {
    const prev = prevById.get(curr.id);
    if (!prev) continue;

    const changes = [];
    if (prev.name !== curr.name) changes.push(`이름: "${prev.name}" → "${curr.name}"`);
    if (prev.address !== curr.address) changes.push(`주소: "${prev.address}" → "${curr.address}"`);
    if (prev.priceRange !== curr.priceRange) changes.push(`가격: ${prev.priceRange} → ${curr.priceRange}`);

    if (changes.length > 0) {
      changed.push({ restaurant: curr, changes });
    }
  }

  // ── Tracking 업데이트 ──
  // 현재 존재하는 식당: lastSeen 갱신, missedRuns 리셋
  for (const r of currRestaurants) {
    tracking[r.id] = { lastSeen: today, missedRuns: 0 };
  }

  // 사라진 식당: missedRuns 증가
  const closed = [];
  const pendingClose = [];
  for (const r of missing) {
    const t = tracking[r.id] || { lastSeen: today, missedRuns: 0 };
    t.missedRuns = (t.missedRuns || 0) + 1;
    tracking[r.id] = t;

    if (t.missedRuns >= 2) {
      closed.push(r);
    } else {
      pendingClose.push(r);
    }
  }

  saveTracking(tracking);

  // ── 리포트 생성 ──
  const lines = [];
  lines.push(`# 변경 리포트 — ${today}`);
  lines.push('');
  lines.push(`| 항목 | 수 |`);
  lines.push(`|------|-----|`);
  lines.push(`| 이전 총 식당 | ${prevRestaurants.length} |`);
  lines.push(`| 현재 총 식당 | ${currRestaurants.length} |`);
  lines.push(`| 신규 추가 | ${added.length} |`);
  lines.push(`| 폐업 확정 (2회 미감지) | ${closed.length} |`);
  lines.push(`| 폐업 대기 (1회 미감지) | ${pendingClose.length} |`);
  lines.push(`| 정보 변경 | ${changed.length} |`);
  lines.push('');

  if (added.length > 0) {
    lines.push('## 신규 식당');
    lines.push('');
    for (const r of added.slice(0, 50)) {
      lines.push(`- **${r.name}** — ${r.address} (${r.distanceKm}km)`);
    }
    if (added.length > 50) {
      lines.push(`- ... 외 ${added.length - 50}건`);
    }
    lines.push('');
  }

  if (closed.length > 0) {
    lines.push('## 폐업 확정');
    lines.push('');
    for (const r of closed) {
      lines.push(`- ~~${r.name}~~ — ${r.address}`);
    }
    lines.push('');
  }

  if (pendingClose.length > 0) {
    lines.push('## 폐업 대기 (다음 실행에서 재확인)');
    lines.push('');
    for (const r of pendingClose) {
      lines.push(`- ⚠️ ${r.name} — ${r.address}`);
    }
    lines.push('');
  }

  if (changed.length > 0) {
    lines.push('## 정보 변경');
    lines.push('');
    for (const { restaurant, changes } of changed.slice(0, 30)) {
      lines.push(`- **${restaurant.name}**: ${changes.join(', ')}`);
    }
    if (changed.length > 30) {
      lines.push(`- ... 외 ${changed.length - 30}건`);
    }
    lines.push('');
  }

  const report = lines.join('\n');
  fs.writeFileSync(REPORT_PATH, report, 'utf-8');

  // ── 콘솔 요약 ──
  console.log('📊 변경 감지 결과:');
  console.log(`  ✅ 신규: ${added.length}건`);
  console.log(`  ❌ 폐업 확정: ${closed.length}건`);
  console.log(`  ⚠️  폐업 대기: ${pendingClose.length}건`);
  console.log(`  📝 변경: ${changed.length}건`);
  console.log(`\n📝 리포트: ${REPORT_PATH}`);

  // 변경 여부를 exit code로 전달 (GitHub Actions에서 활용)
  const hasChanges = added.length > 0 || closed.length > 0 || changed.length > 0;
  if (!hasChanges) {
    console.log('\n✅ 변경 사항 없음');
  }

  // 변경 여부를 파일로도 저장 (CI에서 활용)
  fs.writeFileSync(
    path.join(__dirname, 'has-changes.txt'),
    hasChanges ? 'true' : 'false',
    'utf-8'
  );
}

main();
