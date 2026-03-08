/**
 * 중복 제거 모듈
 * 1차: roadAddress 정확 매칭
 * 2차: 정규화된 title + 주소 앞 2토큰
 * 3차: 같은 이름 + 좌표 50m 이내
 */

const { stripHtml } = require('./tag-inferrer');

function normalizeName(title) {
  return stripHtml(title)
    .replace(/\s+/g, '')
    .replace(/[·\-()（）「」『』[\]]/g, '')
    .toLowerCase();
}

function addressPrefix(addr, tokens = 2) {
  if (!addr) return '';
  return addr.split(/\s+/).slice(0, tokens).join(' ');
}

// Haversine 거리 (미터)
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deduplicate(items) {
  const seen = new Map();       // roadAddress → item
  const seenNameAddr = new Set(); // normName + addrPrefix
  const result = [];

  for (const item of items) {
    const road = item.roadAddress || '';
    const norm = normalizeName(item.title);
    const addrPfx = addressPrefix(road || item.address);
    const nameAddrKey = `${norm}|${addrPfx}`;

    // 1차: roadAddress 매칭
    if (road && seen.has(road)) continue;

    // 2차: 이름 + 주소 앞 2토큰
    if (seenNameAddr.has(nameAddrKey)) continue;

    // 3차: 같은 이름 + 50m 이내
    let tooClose = false;
    for (const existing of result) {
      if (normalizeName(existing.title) === norm) {
        const dist = distanceMeters(existing.lat, existing.lng, item.lat, item.lng);
        if (dist < 50) {
          tooClose = true;
          break;
        }
      }
    }
    if (tooClose) continue;

    if (road) seen.set(road, item);
    seenNameAddr.add(nameAddrKey);
    result.push(item);
  }

  return result;
}

module.exports = { deduplicate, distanceMeters };
