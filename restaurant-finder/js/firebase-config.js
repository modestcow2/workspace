// ─── Firebase 초기화 ────────────────────────────────────────────────────────
// TODO: 아래 firebaseConfig를 본인의 Firebase 프로젝트 설정으로 교체하세요.
// Firebase 콘솔 → 프로젝트 설정 → 일반 → 내 앱 → Firebase SDK snippet
const firebaseConfig = {
  apiKey:            "AIzaSyBRpnbju_NLmwXGDjzhtOWDyVUJxHP__4Q",
  authDomain:        "kpc-restaurant-finder.firebaseapp.com",
  projectId:         "kpc-restaurant-finder",
  storageBucket:     "kpc-restaurant-finder.firebasestorage.app",
  messagingSenderId: "1021547379496",
  appId:             "1:1021547379496:web:73d7d3f9e172fba981ee1d",
  measurementId:     "G-C5QDKZ9WRD"
};

// 관리자 이메일 — Google 로그인 후 이 이메일만 관리자로 인정
const ADMIN_EMAIL = 'kpcykkim@gmail.com';

firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();
