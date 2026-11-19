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
    'mb_storage_monthly', 'mb_archive', 'mb_credentials', 'mb_audit_log',
    'mb_marketing_plans', 'mb_marketing_inflow', 'mb_weekly_reports', 'mb_biliber_support',
    'mb_calendar_events', 'mb_customers', 'mb_cust_visits',
    'mb_sales_goals', 'mb_assignments', 'mb_branch_counts', 'mb_plan_members'
  ];

  let app;
  try { app = firebase.initializeApp(cfg); }
  catch (e) { app = firebase.app(); } // 이미 초기화된 경우
  const db = firebase.firestore();
  const ws = cfg.workspace || 'moneybox';
  const col = db.collection('mb_workspaces').doc(ws).collection('data');

  let _applyingRemote = false;   // 원격 적용 중 재전송 방지
  const _lastPushed = {};        // 동일 값 중복 전송 방지
  // 이 브라우저(세션) 고유 ID — 내가 올린 변경이 다시 내려와 내 입력을 덮어쓰는 것을 막음
  const _clientId = 'c' + Math.random().toString(36).slice(2) + '_' + Date.now();
  const _pushTimers = {};        // 키별 디바운스 타이머
  const _pendingVal = {};        // 키별 보류 중 값
  const _holdAt = {};            // 키별 '처음 보류한 시각' — 디바운스 상한 계산용
  const PUSH_MAX_HOLD = 900;     // 쉬지 않고 입력해도 이 시간 안에는 반드시 전송한다(ms)

  // ─────────────────────────────────────────────────────────────
  //  레코드 배열은 통째로 덮어쓰지 않고 "내가 바꾼 것만" 원격에 반영한다.
  //  예전에는 set() 으로 배열 전체를 교체해서, 낡은 사본을 들고 있던 기기가
  //  저장하는 순간 그 사이 다른 사람이 남긴 기록이 통째로 사라졌다.
  //  (2026-10: 초초 님이 오후 출근을 찍으면 패니 님 아침 출근이 지워지던 문제)
  // ─────────────────────────────────────────────────────────────
  const _base = {};              // 이 클라이언트가 마지막으로 확인한 "원격의 값"
  const _retry = {};             // 키별 재시도 횟수

  function _recKey(r) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
    if (r.id !== undefined && r.id !== null) return 'id:' + r.id;
    if (r.date !== undefined && r.employeeId !== undefined)     // 근무표처럼 id 가 없는 레코드
      return 'de:' + r.date + '|' + r.employeeId;
    return null;
  }
  function _mergeable(v) { return Array.isArray(v) && v.every(function (x) { return _recKey(x) !== null; }); }
  function _indexBy(arr) {
    const m = new Map();
    (arr || []).forEach(function (x) { const k = _recKey(x); if (k) m.set(k, x); });
    return m;
  }
  //  원격(remote)을 기준으로, base→mine 사이에 내가 만든 변경만 덧씌운다.
  //  · 내가 건드리지 않은 남의 레코드는 그대로 보존된다
  //  · 내가 추가/수정한 것은 반영, 내가 지운 것(base 엔 있고 mine 엔 없음)은 삭제
  //  한 레코드 안에서도 칸(필드) 단위로 병합한다.
  //  A 가 금액을, B 가 환율을 고쳐도 둘 다 살아남아야 하므로
  //  "내가 base 에서 바꾼 칸"만 원격 레코드 위에 덧씌운다.
  function _mergeRec(base, mine, remote) {
    const out = Object.assign({}, remote);
    Object.keys(mine).forEach(function (k) {
      if (JSON.stringify(mine[k]) !== JSON.stringify(base[k])) out[k] = mine[k];   // 내가 바꾼 칸
    });
    Object.keys(base).forEach(function (k) {                                       // 내가 지운 칸
      if (!(k in mine) && k in out && JSON.stringify(base[k]) === JSON.stringify(out[k])) delete out[k];
    });
    return out;
  }
  function _merge(base, mine, remote) {
    const B = _indexBy(base), M = _indexBy(mine), out = _indexBy(remote);
    M.forEach(function (v, k) {
      const b = B.get(k);
      if (!b) { out.set(k, v); return; }                        // 내가 새로 추가한 레코드
      if (JSON.stringify(b) === JSON.stringify(v)) return;      // 내가 안 건드림 → 원격 그대로
      const r = out.get(k);
      out.set(k, r ? _mergeRec(b, v, r) : v);                   // 칸 단위로 합침
    });
    B.forEach(function (v, k) { if (!M.has(k)) out.delete(k); });
    return Array.from(out.values());
  }

  // ── 로컬 쓰기 → 클라우드 (디바운스: 빠른 연속 입력을 한 번으로 모아 경합·유실 방지) ──
  window.mbCloudPush = function (key, value) {
    if (_applyingRemote) return;
    if (KEYS.indexOf(key) === -1) return;
    _pendingVal[key] = value;
    //  디바운스는 키 입력마다 리셋되므로, 쉬지 않고 치면 영원히 전송되지 않는다.
    //  그래서 '처음 보류한 시각 + 900ms' 를 상한으로 둔다. 쉬지 않고 쳐도 0.9초마다는 올라간다.
    //  (이 상한이 없으면 유실 가능 구간이 '타이핑하는 내내' 로 무한정 열린다)
    if (!_holdAt[key]) _holdAt[key] = Date.now();
    const wait = Math.max(0, Math.min(350, _holdAt[key] + PUSH_MAX_HOLD - Date.now()));
    clearTimeout(_pushTimers[key]);
    _pushTimers[key] = setTimeout(function () { _flushPush(key); }, wait);
  };
  function _flushPush(key) {
    if (!(key in _pendingVal)) return;
    const value = _pendingVal[key];
    delete _pendingVal[key];
    delete _holdAt[key];
    //  병합 기준을 '보낼 때' 로 고정한다.
    //  예전엔 트랜잭션 콜백(서버 왕복 뒤) 안에서 _base[key] 를 그때 읽었는데,
    //  왕복 중에 남의 변경이 수신되면 _base 만 먼저 최신이 되어
    //  '내가 보낸 값에 없는 남의 새 행' 을 _merge 가 "내가 지웠다" 로 판정해 서버에서 지웠다.
    const sentBase = _base[key] || [];
    const json = JSON.stringify(value);
    if (_lastPushed[key] === json) return;
    const ref = col.doc(key);
    const stamp = firebase.firestore.FieldValue.serverTimestamp();

    if (!_mergeable(value)) {            // 레코드 배열이 아니면(설정 객체 등) 기존처럼 통째로
      _lastPushed[key] = json;
      ref.set({ v: value, by: _clientId, at: stamp })
        .catch(function (e) { _pushFail(key, value, e); });
      return;
    }
    // 트랜잭션: 지금 원격 값을 읽어 내 변경만 얹어 저장 (남의 기록 보존)
    db.runTransaction(function (tx) {
      return tx.get(ref).then(function (snap) {
        const d = snap.exists ? (snap.data() || {}) : {};
        const remote = Array.isArray(d.v) ? d.v : [];
        const merged = _merge(sentBase, value, remote);
        tx.set(ref, { v: merged, by: _clientId, at: firebase.firestore.FieldValue.serverTimestamp() });
        return merged;
      });
    }).then(function (merged) {
      _retry[key] = 0;
      _lastPushed[key] = json;
      _base[key] = merged;
      applyRemote(key, merged);         // 병합 결과를 로컬에도 반영(남이 넣은 기록이 바로 보이게)
    }).catch(function (e) { _pushFail(key, value, e); });
  }
  //  실패(오프라인 등) 시 값을 버리지 않고 백오프로 재시도 — 로컬엔 남아 있으므로 화면은 정상
  function _pushFail(key, value, e) {
    console.warn('[mb-sync] 저장 실패 — 재시도 예정', key, e && (e.code || e.message));
    delete _lastPushed[key];
    if (!(key in _pendingVal)) _pendingVal[key] = value;
    const n = (_retry[key] = (_retry[key] || 0) + 1);
    clearTimeout(_pushTimers[key]);
    _pushTimers[key] = setTimeout(function () { _flushPush(key); }, Math.min(30000, 1000 * Math.pow(2, n)));
  }
  window.addEventListener('online', function () {      // 연결이 돌아오면 즉시 재시도
    Object.keys(_pendingVal).forEach(function (k) { clearTimeout(_pushTimers[k]); _flushPush(k); });
  });
  function _flushAll() { Object.keys(_pendingVal).forEach(function (k) { clearTimeout(_pushTimers[k]); _flushPush(k); }); }
  // 탭을 닫거나 숨길 때 보류 중인 저장을 즉시 반영 (데이터 유실 방지)
  window.addEventListener('beforeunload', _flushAll);
  //  사파리·iOS 는 페이지를 떠날 때 beforeunload 가 아니라 pagehide 를 주 경로로 쓴다.
  //  (맥북에서 더 자주 유실된다는 신고의 한 갈래. 플러시만으로 전부 구제되지는 않는다 — 아래 주석 참고)
  window.addEventListener('pagehide', _flushAll);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') _flushAll(); });

  // ── 클라우드 변경 → 로컬 + 화면 ──
  function applyRemote(key, value) {
    const json = JSON.stringify(value);
    if (json === localStorage.getItem(key)) return;  // 동일하면 스킵
    //  try/finally 가 없으면, 저장 공간이 꽉 찼거나 사파리가 저장을 막아 setItem 이 한 번 던지는 순간
    //  _applyingRemote 가 true 로 영원히 굳어 그 탭의 모든 저장이 클라우드로 안 간다.
    //  화면도 콘솔도 멀쩡해 보여서 알아챌 방법이 없었다.
    _applyingRemote = true;
    try {
      localStorage.setItem(key, json);
      _lastPushed[key] = json;          // 실제로 쓰인 뒤에만 '올렸다' 로 표시한다
    } catch (e) {
      console.warn('[mb-sync] 로컬 저장 실패 — 이 변경은 화면에만 반영됨', key, e && e.name);
      delete _lastPushed[key];
      return;
    } finally {
      _applyingRemote = false;
    }
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
          _base[key] = d.v;                // 내 변경이든 아니든 "원격의 현재 값"은 항상 기억
          if (d.by === _clientId) return;  // 내가 올린 변경의 메아리는 무시 (내 입력 보존)
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
            try { col.doc(key).set({ v: JSON.parse(local), by: _clientId, at: firebase.firestore.FieldValue.serverTimestamp() }); }
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
