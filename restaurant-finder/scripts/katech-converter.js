/**
 * 좌표 변환 모듈
 * 네이버 API 응답의 mapx/mapy를 WGS84 좌표로 변환한다.
 *
 * 네이버 지역 검색 API는 좌표를 정수 형태로 반환한다.
 * - WGS84 형태: mapx=1269770000, mapy=375796000 (÷10^7 → 126.977, 37.5796)
 * - Katech TM128: mapx=311259, mapy=553044 (6~7자리, proj4로 변환 필요)
 */

const proj4 = require('proj4');

// Katech TM128 좌표계 정의
const KATECH =
  '+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 ' +
  '+ellps=bessel +units=m ' +
  '+towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43 +no_defs';

const WGS84 = 'EPSG:4326';

function convertCoords(mapx, mapy) {
  const x = Number(mapx);
  const y = Number(mapy);

  // 이미 WGS84 형태(÷10^7)인 경우: 자릿수가 9~10자리
  if (x > 100000000) {
    return { lng: x / 1e7, lat: y / 1e7 };
  }

  // Katech TM128 변환
  const [lng, lat] = proj4(KATECH, WGS84, [x, y]);
  return { lat, lng };
}

function isInSeoulRange(lat, lng) {
  return lat >= 37.4 && lat <= 37.7 && lng >= 126.8 && lng <= 127.1;
}

module.exports = { convertCoords, isInSeoulRange };
