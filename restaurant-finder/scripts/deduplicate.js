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

/**
 * 교차 소스 중복제거 (Stage 4)
 * 카카오(primary)와 네이버(secondary) 결과를 합치되,
 * 정규화된 이름 + 50m 이내 거리로 매칭.
 * - 좌표: 카카오 우선 (WGS84 네이티브)
 * - 카테고리: 더 상세한 쪽 채택
 * - 주소: 카카오 우선
 */
function deduplicateCrossSource(primaryItems, secondaryItems) {
  const merged = [...primaryItems];

  for (const sec of secondaryItems) {
    const secNorm = normalizeName(sec.title);
    let isDuplicate = false;

    for (const pri of merged) {
      const priNorm = normalizeName(pri.title);

      // 이름이 같고 50m 이내면 중복
      if (priNorm === secNorm) {
        const dist = distanceMeters(pri.lat, pri.lng, sec.lat, sec.lng);
        if (dist < 50) {
          // 카테고리가 더 상세한 쪽으로 보강
          if (sec.category && pri.category) {
            const secDepth = sec.category.split('>').length;
            const priDepth = pri.category.split('>').length;
            if (secDepth > priDepth) {
              pri.categoryNaver = sec.category;
            }
          }
          isDuplicate = true;
          break;
        }
      }

      // 이름이 다르더라도 같은 주소(roadAddress) + 50m 이내면 중복
      if (pri.roadAddress && sec.roadAddress && pri.roadAddress === sec.roadAddress) {
        const dist = distanceMeters(pri.lat, pri.lng, sec.lat, sec.lng);
        if (dist < 100) {
          isDuplicate = true;
          break;
        }
      }
    }

    if (!isDuplicate) {
      merged.push(sec);
    }
  }

  return merged;
}

module.exports = { deduplicate, deduplicateCrossSource, distanceMeters };
