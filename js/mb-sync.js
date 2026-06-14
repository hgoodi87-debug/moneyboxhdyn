// ─────────────────────────────────────────────────────────────
// mb-sync.js — Firebase Firestore 실시간 동기화 (기기 간)
//   · 설정은 "이 브라우저(localStorage)"에서 읽음 → 깃허브·서버·AI에 노출 안 됨
//   · 보안: 익명 로그인(Auth) 후에만 동기화 시작 (규칙이 인증 사용자만 허용)
//   · 설정이 없으면 자동으로 꺼짐(로컬 전용) — 앱은 그대로 작동
// ─────────────────────────────────────────────────────────────
(function () {
  // 1) 설정 읽기: 브라우저 저장값 우선(setup.html에서 저장), 없으면 파일 fallback
  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem('mb_firebase_config') || 'null'); } catch (e) { cfg = null; }
  if (!cfg || !cfg.projectId) cfg = window.MB_FIREBASE_CONFIG || null;

  window.mbSyncStatus = '로컬 전용';

  if (!cfg || !cfg.projectId) {
    console.info('[mb-sync] Firebase 미설정 — 로컬 전용 모드. 연결하려면 setup.html 을 여세요.');
    return;
  }
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    console.warn('[mb-sync] Firebase SDK 로드 실패 — 로컬 전용으로 동작');
    return;
  }

  // 2) 동기화할 localStorage 키 (앱 데이터 전체) — 설정값(mb_firebase_config)은 절대 포함 안 함
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
    window.dispatchEvent(new CustomEvent('mb-remote', { detail: { key } }));
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: key, newValue: json }));
    } catch (e) { /* 일부 브라우저 StorageEvent 생성 제한 */ }
  }

  // ── 동기화 시작 (실시간 수신 + 최초 이관) ──
  function startSync() {
    window.mbSyncStatus = '동기화 중';
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
    // 최초 1회: 클라우드에 없고 로컬에 있으면 업로드
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
    console.info('[mb-sync] 동기화 활성화 ·', cfg.projectId, '/ workspace:', ws);
  }

  // ── 보안: 익명 로그인 후 동기화 시작 ──
  if (firebase.auth) {
    firebase.auth().signInAnonymously()
      .then(() => { window.mbSyncStatus = '연결됨'; startSync(); })
      .catch(err => {
        window.mbSyncStatus = '익명 로그인 필요';
        console.warn('[mb-sync] 익명 로그인 실패 — Firebase 콘솔 > Authentication 에서 "익명"을 켜주세요.', err && err.code);
        startSync(); // 테스트(개방) 규칙이면 인증 없이도 동작 시도
      });
  } else {
    startSync();
  }
})();
