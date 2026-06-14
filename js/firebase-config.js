// ─────────────────────────────────────────────────────────────
// firebase-config.js
//
//  ⚠️ 보통 여기는 비워둡니다. 설정값은 채팅·깃허브에 올리지 않기 위해
//     "setup.html" 페이지에서 입력 → 브라우저(localStorage)에만 저장합니다.
//
//  (개발자 도움으로) 비공개 배포에 한 번만 넣고 싶을 때만 아래를 채우세요.
//  projectId 가 비어 있으면 동기화는 자동으로 꺼지고 로컬 전용으로 작동합니다.
// ─────────────────────────────────────────────────────────────
window.MB_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",

  // 한 매장(공유 작업공간) 이름. 그대로 두면 'moneybox' 공유 공간을 사용합니다.
  workspace: "moneybox"
};
