// ─────────────────────────────────────────────────────────────
// mb-sync.js — Firebase Firestore 실시간 동기화 (기기 간)
//   · 쓰기: mbSet() → localStorage + Firestore 동시 저장
//   · 읽기: Firestore onSnapshot → localStorage 반영 + 화면 자동 갱신
//   · 설정(firebase-config.js)이 비어 있으면 자동으로 꺼짐(로컬 전용)
// ─────────────────────────────────────────────────────────────
(function () {
  const cfg = window.MB_FIREBASE_CONFIG;

  if (!cfg || !cfg.projectId) {
    console.info('[mb-sync] Firebase 미설정 — 로컬(localStorage) 전용 모드');
    return;
  }
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    console.warn('[mb-sync] Firebase SDK 로드 실패 — 로컬 전용으로 동작');
    return;
  }

  // 동기화할 localStorage 키 (앱 데이터 전체)
  const KEYS = [
    'mb_employees', 'mb_schedule', 'mb_attendance', 'mb_leave_requests',
    'mb_handovers', 'mb_trade_notices', 'mb_main_trades', 'mb_daily_tasks',
    'mb_branch_transfers', 'mb_transactions', 'mb_work_checklist', 'mb_task_gate',
    'mb_task_template_v2', 'mb_atm_refill', 'mb_atm_settle', 'mb_atm_issues',
    'mb_atm_gate', 'mb_atm_memo', 'mb_storage_sales', 'mb_storage_price',
    'mb_storage_monthly', 'mb_archive', 'mb_credentials', 'mb_audit_log'
  ];

  let app;
  try { app = firebase.initializeApp(cfg); }
  catch (e) { app = firebase.app(); } // 이미 초기화된 경우
  const db = firebase.firestore();
  const ws = cfg.workspace || 'moneybox';
  const col = db.collection('mb_workspaces').doc(ws).collection('data');

  let _applyingRemote = false;   // 원격 적용 중 재전송 방지
  const _lastPushed = {};        // 동일 값 중복 전송 방지

  // ── 로컬 쓰기 → 클라우드 ──
  window.mbCloudPush = function (key, value) {
    if (_applyingRemote) return;
    if (KEYS.indexOf(key) === -1) return;
    const json = JSON.stringify(value);
    if (_lastPushed[key] === json) return;
    _lastPushed[key] = json;
    col.doc(key).set({ v: value, at: firebase.firestore.FieldValue.serverTimestamp() })
      .catch(e => console.warn('[mb-sync] 저장 실패', key, e));
  };

  // ── 클라우드 변경 → 로컬 + 화면 ──
  function applyRemote(key, value) {
    const json = JSON.stringify(value);
    if (json === localStorage.getItem(key)) return;  // 동일하면 스킵
    _applyingRemote = true;
    _lastPushed[key] = json;
    localStorage.setItem(key, json);
    _applyingRemote = false;
    // 같은 탭에서 화면 갱신을 위한 이벤트
    window.dispatchEvent(new CustomEvent('mb-remote', { detail: { key } }));
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: key, newValue: json }));
    } catch (e) { /* 일부 브라우저 StorageEvent 생성 제한 */ }
  }

  KEYS.forEach(key => {
    col.doc(key).onSnapshot(
      snap => {
        if (!snap.exists) return;
        const d = snap.data();
        if (!d || !('v' in d)) return;
        applyRemote(key, d.v);
      },
      err => console.warn('[mb-sync] 수신 오류', key, err)
    );
  });

  // ── 최초 1회: 클라우드에 없고 로컬에 있으면 업로드(초기 이관) ──
  KEYS.forEach(key => {
    col.doc(key).get().then(snap => {
      if (!snap.exists) {
        const local = localStorage.getItem(key);
        if (local !== null) {
          try { col.doc(key).set({ v: JSON.parse(local), at: firebase.firestore.FieldValue.serverTimestamp() }); }
          catch (e) { /* noop */ }
        }
      }
    }).catch(() => {});
  });

  console.info('[mb-sync] Firebase 동기화 활성화 ·', cfg.projectId, '/ workspace:', ws);
})();
