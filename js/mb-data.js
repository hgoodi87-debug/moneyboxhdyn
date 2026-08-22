// ============================================================
// MoneyBox 내부 운영 시스템 - 공통 데이터 헬퍼
// localStorage 기반. 추후 Supabase 이식 예정.
// ============================================================

const MB = {
  EMPLOYEES_KEY: 'mb_employees',
  DEFAULT_EMPLOYEES: [
    { id: 'e1', name: '김동교', role: 'admin',  joinDate: '2024-11-01', branch: '홍대', password: '0000' },
    { id: 'e3', name: '박진호', role: 'senior', joinDate: '2024-08-08', branch: '연남', password: '0000' },
    { id: 'e4', name: '류천명', role: 'senior', joinDate: '2025-05-19', branch: '홍대', password: '0000' },
  ],

  SESSION_KEY: 'mb_session',
  CURRENT_USER_KEY: 'mb_current_user',
  ATTENDANCE_KEY: 'mb_attendance',
  SCHEDULE_KEY: 'mb_schedule',
  LEAVE_KEY: 'mb_leave_requests',
  HANDOVERS_KEY: 'mb_handovers',
  TRADE_NOTICES_KEY: 'mb_trade_notices',
  MAIN_TRADES_KEY: 'mb_main_trades',
  DAILY_TASKS_KEY: 'mb_daily_tasks',
  TRANSFERS_KEY: 'mb_branch_transfers',
  TRANSACTIONS_KEY: 'mb_transactions',
  CHECKLIST_KEY: 'mb_work_checklist',
  TASK_GATE_KEY: 'mb_task_gate',
  ATM_REFILL_KEY: 'mb_atm_refill',
  ATM_SETTLE_KEY: 'mb_atm_settle',
  ATM_ISSUES_KEY: 'mb_atm_issues',
  ATM_GATE_KEY: 'mb_atm_gate',
  STORAGE_KEY: 'mb_storage_sales',
  STORAGE_PRICE_KEY: 'mb_storage_price',
  ARCHIVE_KEY: 'mb_archive',
  CREDENTIALS_KEY: 'mb_credentials',
  AUDIT_LOG_KEY: 'mb_audit_log',
  ATM_MEMO_KEY: 'mb_atm_memo',
  MARKETING_PLANS_KEY: 'mb_marketing_plans',
  MARKETING_INFLOW_KEY: 'mb_marketing_inflow',
  WEEKLY_REPORTS_KEY: 'mb_weekly_reports',
  LOG_RETENTION_DAYS: 30,

  // 공통 헤더 네비게이션
  NAV: [
    { href: 'index.html',      label: '대시보드' },
    { href: 'attendance.html', label: '근태관리' },
    { href: 'tasks.html',      label: '업무관리' },
    { href: 'trading.html',    label: '거래관리' },
    { href: 'incheon.html',    label: '인천공항' },
    { href: 'storage.html',    label: '보관함관리' },
    { href: 'atm.html',        label: '무인기관리' },
    { href: 'marketing.html',  label: '마케팅' },
    { href: 'archive.html',    label: '자료실' },
  ],
  ADMIN_NAV: [
    { href: 'calc.html',     label: '🧮 계산기' },
    { href: 'log.html',      label: '🗂 기록 로그' },
    { href: 'accounts.html', label: '🔑 로그인 관리' },
    { href: 'report.html',   label: '📄 주간보고서' },
  ],

  CURRENCIES: ['KRW','USD','JPY','EUR','CHF','CNY','RUB','HKD','SGD','THB','VND','TWD','AUD','CAD','GBP','PHP','IDR','MYR'],
};

// ─── 기본 헬퍼 ───────────────────────────────────────────────
function mbGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function mbSet(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
  // 클라우드 동기화 (mb-sync.js 로드 시에만 동작, 없으면 로컬 전용)
  if (typeof window !== 'undefined' && window.mbCloudPush) {
    try { window.mbCloudPush(key, data); } catch (e) { /* noop */ }
  }
}
function mbGetOrDefault(key, defaultValue) {
  const v = mbGet(key);
  return v === null || v === undefined ? defaultValue : v;
}
function mbPush(key, item) {
  const list = mbGetOrDefault(key, []);
  list.push(item);
  mbSet(key, list);
  return item;
}
function mbRemove(key, predicate) {
  const list = mbGetOrDefault(key, []).filter(x => !predicate(x));
  mbSet(key, list);
}
function mbUpdate(key, predicate, updater) {
  const list = mbGetOrDefault(key, []);
  list.forEach(x => { if (predicate(x)) updater(x); });
  mbSet(key, list);
}
function uid() { return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2,8); }

// ─── 시간 헬퍼 ───────────────────────────────────────────────
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function nowTs() { return Date.now(); }
function formatDate(d = new Date()) {
  if (typeof d === 'string') d = new Date(d);
  const days = ['일','월','화','수','목','금','토'];
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} (${days[d.getDay()]})`;
}
function dayOfWeek(dateStr) {
  const days = ['일','월','화','수','목','금','토'];
  return days[new Date(dateStr).getDay()];
}
function thisYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return Math.round(Number(n)).toLocaleString('ko-KR');
}
function fmtSigned(n) {
  if (!n) return '0';
  return (n > 0 ? '+' : '') + fmtNum(n);
}

// ─── 세션/인증 ───────────────────────────────────────────────
function getCurrentUser() {
  const session = mbGet(MB.SESSION_KEY);
  if (!session) return null;
  const employees = mbGetOrDefault(MB.EMPLOYEES_KEY, MB.DEFAULT_EMPLOYEES);
  return employees.find(e => e.id === session.userId) || null;
}
function isAdmin() { return getCurrentUser()?.role === 'admin'; }
function isSeniorOrAbove() { return ['admin','senior'].includes(getCurrentUser()?.role); }

function mbLogin(name, password) {
  const employees = mbGetOrDefault(MB.EMPLOYEES_KEY, MB.DEFAULT_EMPLOYEES);
  const emp = employees.find(e => e.name === name.trim());
  if (!emp) return { ok: false, msg: '이름을 찾을 수 없습니다.' };
  const pw = emp.password || '0000';
  if (pw !== password) return { ok: false, msg: '비밀번호가 맞지 않습니다.' };
  mbSet(MB.SESSION_KEY, { userId: emp.id, loginAt: nowTs() });
  return { ok: true, user: emp };
}

function logoutUser() {
  localStorage.removeItem(MB.SESSION_KEY);
  window.location.href = 'login.html';
}
function confirmLogout() {
  if (confirm('로그아웃하시겠습니까?')) logoutUser();
}

// 비밀번호 변경
function mbChangePassword(newPw) {
  const user = getCurrentUser();
  if (!user) return false;
  const employees = mbGetOrDefault(MB.EMPLOYEES_KEY, []);
  const emp = employees.find(e => e.id === user.id);
  if (!emp) return false;
  emp.password = newPw;
  mbSet(MB.EMPLOYEES_KEY, employees);
  return true;
}

// 직원 삭제 — 근무표/출퇴근/연차 등 모든 참조까지 함께 제거
function mbDeleteEmployee(id) {
  const emps = mbGetOrDefault(MB.EMPLOYEES_KEY, []);
  const emp = emps.find(e => e.id === id) || null;
  mbSet(MB.EMPLOYEES_KEY, emps.filter(e => e.id !== id));
  mbSet(MB.SCHEDULE_KEY,   mbGetOrDefault(MB.SCHEDULE_KEY, []).filter(s => s.employeeId !== id));
  mbSet(MB.ATTENDANCE_KEY, mbGetOrDefault(MB.ATTENDANCE_KEY, []).filter(a => a.employeeId !== id));
  mbSet(MB.LEAVE_KEY,      mbGetOrDefault(MB.LEAVE_KEY, []).filter(l => l.employeeId !== id));
  return emp;
}

// 비밀번호 변경 모달 (사이드바 ⚙ 클릭용)
function showChangePwModal() {
  const old = document.getElementById('_cpw-modal');
  if (old) old.remove();
  const div = document.createElement('div');
  div.id = '_cpw-modal';
  div.className = 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center';
  div.innerHTML = `
    <div class="bg-white rounded-2xl p-6 w-[360px] shadow-2xl">
      <h3 class="text-lg font-bold mb-4">🔑 비밀번호 변경</h3>
      <div class="space-y-3">
        <input type="password" id="_cpw-cur" placeholder="현재 비밀번호" class="border border-gray-200 rounded-lg px-3 py-2.5 w-full text-sm outline-none focus:border-[#F5A623]">
        <input type="password" id="_cpw-new" placeholder="새 비밀번호" class="border border-gray-200 rounded-lg px-3 py-2.5 w-full text-sm outline-none focus:border-[#F5A623]">
        <input type="password" id="_cpw-chk" placeholder="새 비밀번호 확인" class="border border-gray-200 rounded-lg px-3 py-2.5 w-full text-sm outline-none focus:border-[#F5A623]">
        <p id="_cpw-err" class="text-xs text-red-500 hidden"></p>
      </div>
      <div class="flex gap-2 mt-5">
        <button onclick="document.getElementById('_cpw-modal').remove()" class="flex-1 py-2.5 rounded-lg bg-gray-100 text-sm font-medium">취소</button>
        <button onclick="_doChangePw()" class="flex-1 py-2.5 rounded-lg bg-[#F5A623] text-white text-sm font-bold">변경</button>
      </div>
    </div>`;
  document.body.appendChild(div);
}
function _doChangePw() {
  const cur = document.getElementById('_cpw-cur').value;
  const nw  = document.getElementById('_cpw-new').value;
  const chk = document.getElementById('_cpw-chk').value;
  const err = document.getElementById('_cpw-err');
  const user = getCurrentUser();
  if (!user) return;
  if ((user.password || '0000') !== cur) { err.textContent='현재 비밀번호가 틀립니다.'; err.classList.remove('hidden'); return; }
  if (nw.length < 4) { err.textContent='4자리 이상 입력하세요.'; err.classList.remove('hidden'); return; }
  if (nw !== chk) { err.textContent='새 비밀번호가 일치하지 않습니다.'; err.classList.remove('hidden'); return; }
  mbChangePassword(nw);
  document.getElementById('_cpw-modal').remove();
  alert('비밀번호가 변경되었습니다.');
}

// ─── 출퇴근 게이트 ───────────────────────────────────────────
function checkClockOutGate(user, dateStr) {
  const taskGate = mbGetOrDefault(MB.TASK_GATE_KEY, {});
  const taskOk = taskGate[dateStr]?.[user.id] === true;
  if (!taskOk) return { ok: false, reason: '업무관리 담당자 체크 미완료' };
  return { ok: true };
}

// ─── 감사 로그 (삭제 기록 / 30일 보관) ──────────────────────
function _dateNDaysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
// 삭제된 항목을 스냅샷으로 로그에 기록. items: 단일 객체 또는 배열. descFn: 항목→설명문자열
function mbLogDelete(module, storeKey, items, descFn) {
  const arr = (Array.isArray(items) ? items : [items]).filter(Boolean);
  if (!arr.length) return;
  let desc = '';
  try { desc = descFn ? arr.map(descFn).join(' / ') : ''; } catch { desc = ''; }
  _mbLogPush({ action: 'delete', module, storeKey, desc, count: arr.length, snapshot: arr });
}
function _mbLogPush(entry) {
  const log = mbGetOrDefault(MB.AUDIT_LOG_KEY, []);
  log.push({
    id: uid(), date: today(), time: nowTime(), ts: nowTs(),
    user: getCurrentUser()?.name || '-', restored: false, ...entry,
  });
  const cutoff = _dateNDaysAgo(MB.LOG_RETENTION_DAYS);
  mbSet(MB.AUDIT_LOG_KEY, log.filter(e => (e.date || '') >= cutoff));
}
// 로그 항목 복구: 스냅샷을 원래 저장소로 되돌림 (id 중복은 건너뜀)
function mbLogRestore(logId) {
  const log = mbGetOrDefault(MB.AUDIT_LOG_KEY, []);
  const e = log.find(x => x.id === logId);
  if (!e || e.restored) return false;
  const list = mbGetOrDefault(e.storeKey, []);
  (e.snapshot || []).forEach(item => {
    if (!list.some(x => x.id === item.id)) list.push(item);
  });
  mbSet(e.storeKey, list);
  e.restored = true;
  e.restoredAt = (typeof nowTime==='function'?nowTime():'');
  e.restoredBy = getCurrentUser()?.name || '-';
  mbSet(MB.AUDIT_LOG_KEY, log);
  return true;
}

// ─── 시프트 정해진 근무시간 / 보정 ───────────────────────────
const SHIFT_HOURS = {
  '오픈': { start: '09:00', end: '18:00' },
  '마감': { start: '12:00', end: '21:00' },
  '풀':   { start: '09:00', end: '21:00' },
};
// 지점별 시프트 시간 — 홍대 마감은 9시 시작, 나머지는 공통
function mbShiftHours(shift, branch) {
  if (shift === '마감' && branch === '홍대') return { start: '09:00', end: '21:00' };
  return SHIFT_HOURS[shift] || null;
}
function _hmToMin(t) { if (!t) return null; const [h,m] = t.split(':').map(Number); return h*60 + m; }
// 직원의 요일별 고정 근무 템플릿 (구버전 필드 자동 변환)
function mbWeekTemplate(e) {
  if (e && e.weekTemplate) return e.weekTemplate;
  const t = {};
  for (let wd=0; wd<7; wd++) {
    if ((e && e.fixedOffWeekdays || []).includes(wd)) t[wd] = '|휴무';
    else if (e && e.defaultBranch && e.defaultShiftType) t[wd] = `${e.defaultBranch}|${e.defaultShiftType}`;
    else t[wd] = '';
  }
  return t;
}
// 해당 날짜의 배정 {branch, shift} (실제 일정 우선, 없으면 요일 고정 템플릿)
function mbAssignmentFor(employeeId, date) {
  const s = mbGetOrDefault(MB.SCHEDULE_KEY, []).find(x => x.date === date && x.employeeId === employeeId);
  if (s) return { branch: s.branch || null, shift: s.shiftType };
  const e = mbGetOrDefault(MB.EMPLOYEES_KEY, []).find(x => x.id === employeeId);
  if (!e) return null;
  const v = mbWeekTemplate(e)[new Date(date).getDay()];
  if (!v) return null;
  const [b, sh] = v.split('|');
  return { branch: b || e.branch || null, shift: sh };
}
// 해당 날짜의 배정 시프트만
function mbShiftFor(employeeId, date) {
  const a = mbAssignmentFor(employeeId, date);
  return a ? a.shift : null;
}
// 일찍 출근/늦게 퇴근을 정해진 근무시간으로 보정
function mbClampClock(shift, clockIn, clockOut, branch) {
  const h = mbShiftHours(shift, branch);
  if (!h) return { clockIn: clockIn || null, clockOut: clockOut || null };
  let ci = clockIn || null, co = clockOut || null;
  if (ci && _hmToMin(ci) < _hmToMin(h.start)) ci = h.start;
  if (co && _hmToMin(co) > _hmToMin(h.end))   co = h.end;
  return { clockIn: ci, clockOut: co };
}

function handleClockInOut() {
  const user = getCurrentUser();
  if (!user) { showUserSelectModal(); return; }
  const todayStr = today();
  const asg0 = mbAssignmentFor(user.id, todayStr);
  const shift = asg0 ? asg0.shift : null;
  const shiftBranch = asg0 ? (asg0.branch || user.branch) : user.branch;
  const records = mbGetOrDefault(MB.ATTENDANCE_KEY, []);
  const rec = records.find(r => r.employeeId === user.id && r.date === todayStr);

  if (!rec) {
    const ci = mbClampClock(shift, nowTime(), null, shiftBranch).clockIn;
    records.push({
      id: uid(), employeeId: user.id, date: todayStr,
      clockIn: ci, clockOut: null,
      branch: user.branch, shiftType: '', workMinutes: 0,
    });
    mbSet(MB.ATTENDANCE_KEY, records);
  } else if (!rec.clockOut) {
    const gate = checkClockOutGate(user, todayStr);
    if (!gate.ok) {
      alert('퇴근할 수 없습니다.\n사유: ' + gate.reason);
      return;
    }
    const c = mbClampClock(shift, rec.clockIn, nowTime(), shiftBranch);
    rec.clockIn = c.clockIn;
    rec.clockOut = c.clockOut;
    rec.workMinutes = Math.max(0, _hmToMin(rec.clockOut) - _hmToMin(rec.clockIn));
    mbSet(MB.ATTENDANCE_KEY, records);
  } else {
    alert('이미 퇴근 처리되었습니다.');
    return;
  }
  renderClockBtn();
}

function renderClockBtn() {
  const btn = document.getElementById('clock-btn');
  const status = document.getElementById('clock-status');
  if (!btn) return;
  const user = getCurrentUser();
  if (!user) return;
  const todayStr = today();
  const rec = mbGetOrDefault(MB.ATTENDANCE_KEY, [])
    .find(r => r.employeeId === user.id && r.date === todayStr);

  if (!rec) {
    btn.className = 'px-5 py-2 rounded-lg bg-[#10B981] hover:bg-[#0EA371] text-white font-bold text-sm transition';
    btn.textContent = '출근';
    btn.disabled = false;
    if (status) status.textContent = '미출근';
  } else if (!rec.clockOut) {
    const gate = checkClockOutGate(user, todayStr);
    if (gate.ok) {
      btn.className = 'px-5 py-2 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-sm transition';
      btn.textContent = '퇴근';
      btn.disabled = false;
    } else {
      btn.className = 'px-5 py-2 rounded-lg bg-[#374151] text-gray-400 font-bold text-sm cursor-not-allowed';
      btn.textContent = '퇴근 대기';
      btn.disabled = false;
    }
    if (status) status.textContent = `출근 ${rec.clockIn}`;
  } else {
    btn.className = 'px-5 py-2 rounded-lg bg-[#374151] text-gray-400 font-bold text-sm cursor-not-allowed';
    btn.textContent = '퇴근완료';
    btn.disabled = true;
    if (status) status.textContent = `${rec.clockIn}~${rec.clockOut}`;
  }
}

// ─── 사이드바 렌더 ───────────────────────────────────────────
function renderSidebar(activePage) {
  const user = getCurrentUser();
  const cu = document.getElementById('current-user');
  const cr = document.getElementById('current-role');
  if (cu && user) cu.textContent = user.name;
  if (cr && user) {
    const roleLabel = user.role === 'admin' ? '관리자' : user.role === 'senior' ? '시니어' : '직원';
    cr.textContent = roleLabel + (user.branch ? ' · ' + user.branch : '');
    cr.style.color = user.role === 'admin' ? '#F5A623' : user.role === 'senior' ? '#10B981' : 'rgba(255,255,255,.65)';
  }
  document.querySelectorAll('.nav-link').forEach(a => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href === activePage);
  });
  const td = document.getElementById('today-date');
  if (td) td.textContent = formatDate();
  renderClockBtn();
  setupAdminMenu();
}

// ─── 관리자 메뉴 (계산기 / 기록 로그) ─────────────────────────
function toggleAdminMenu(e) {
  if (e) e.stopPropagation();
  const m = document.getElementById('admin-menu');
  if (!m) return;
  m.style.display = (m.style.display === 'block') ? 'none' : 'block';
}
function setupAdminMenu() {
  const wrap = document.getElementById('admin-menu-wrap');
  if (!wrap) return;
  wrap.style.display = isAdmin() ? 'block' : 'none';
  if (!window._adminMenuBound) {
    document.addEventListener('click', () => {
      const m = document.getElementById('admin-menu');
      if (m) m.style.display = 'none';
    });
    window._adminMenuBound = true;
  }
}

// ─── 초기 데이터 시드 ────────────────────────────────────────
// 시드 전용: 로컬에만 기록(클라우드로 올리지 않음 → 새 기기가 클라우드 데이터를 덮어쓰지 않게)
function mbSeedLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}
// ─── 데이터 변경 시 페이지 자동 새로고침 (유기적 연동) ───
//  · 다른 탭/다른 기기에서 데이터가 바뀌면(storage·mb-remote) 등록한 새로고침 함수를 호출
//  · 이벤트가 누락돼도 4초마다 데이터 변경을 감지해 자동 새로고침(안전망)
//  · 입력 중(포커스가 입력칸)이면 잠시 미뤄서 화면이 끊기지 않게
let _mbRefreshFn = null, _mbRefreshTimer = null, _mbDataSig = '', _mbPollStarted = false;
function _mbDataSignature() {
  let s = '';
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('mb_') === 0 && k !== 'mb_session' && k !== 'mb_firebase_config') {
        s += k + ':' + (localStorage.getItem(k) || '').length + ';';
      }
    }
  } catch (e) {}
  return s;
}
function _mbBusy() { const ae = document.activeElement; return !!(ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)); }
function mbOnDataChange(fn) {
  _mbRefreshFn = fn;
  _mbDataSig = _mbDataSignature();
  function run() {
    if (_mbBusy()) { clearTimeout(_mbRefreshTimer); _mbRefreshTimer = setTimeout(run, 1500); return; }
    _mbDataSig = _mbDataSignature();
    try { if (_mbRefreshFn) _mbRefreshFn(); } catch (e) { /* noop */ }
  }
  const trigger = () => { clearTimeout(_mbRefreshTimer); _mbRefreshTimer = setTimeout(run, 200); };
  window.addEventListener('storage', trigger);
  window.addEventListener('mb-remote', trigger);
  // 안전망: 주기적으로 데이터 변경 감지 → 자동 새로고침 (이벤트 누락 대비)
  if (!_mbPollStarted) {
    _mbPollStarted = true;
    setInterval(function () {
      if (document.hidden || _mbBusy()) return; // 숨겨진 탭에선 폴링 생략 (성능)
      const s = _mbDataSignature();
      if (s !== _mbDataSig) { _mbDataSig = s; try { if (_mbRefreshFn) _mbRefreshFn(); } catch (e) {} }
    }, 4000);
  }
}
function mbInit() {
  if (!mbGet(MB.EMPLOYEES_KEY)) {
    mbSeedLocal(MB.EMPLOYEES_KEY, MB.DEFAULT_EMPLOYEES);
  } else {
    // 기존 직원 데이터에 password 필드가 없으면 '0000' 마이그레이션
    const employees = mbGet(MB.EMPLOYEES_KEY);
    let updated = false;
    employees.forEach(e => { if (!e.password) { e.password = '0000'; updated = true; } });
    // 김동교(e1) 지점 배정 마이그레이션
    const dk = employees.find(e => e.id === 'e1');
    if (dk && !dk.branch) { dk.branch = '홍대'; updated = true; }
    if (updated) mbSet(MB.EMPLOYEES_KEY, employees);
  }
  if (!mbGet(MB.STORAGE_PRICE_KEY)) {
    mbSeedLocal(MB.STORAGE_PRICE_KEY, { XL: 15000, L: 12000, M: 9000, S: 6000 });
  }
  if (!mbGet(MB.SCHEDULE_KEY)) {
    const t = today();
    mbSeedLocal(MB.SCHEDULE_KEY, [
      { date: t, employeeId: 'e2', branch: '홍대', shiftType: '오픈' },
      { date: t, employeeId: 'e4', branch: '홍대', shiftType: '마감' },
      { date: t, employeeId: 'e3', branch: '연남', shiftType: '오픈' },
    ]);
  }
  if (!mbGet(MB.CREDENTIALS_KEY)) {
    mbSeedLocal(MB.CREDENTIALS_KEY, [
      { id: uid(), brand: '머니박스', purpose: '인스타그램',  googleId: 'moneybox.kr@gmail.com', googlePw: 'samplePw1!', snsName: '인스타그램', snsId: 'moneybox.official', snsPw: 'instaPw!', note: '메인 계정' },
      { id: uid(), brand: '빌리버',   purpose: '구글계정',     googleId: 'beeliber@gmail.com',   googlePw: 'beePw1!',    snsName: '', snsId: '', snsPw: '', note: '' },
    ]);
  }
}

// ─── 거래 자동계산 ───────────────────────────────────────────
function calcKrw(tradeType, amount, rate) {
  if (tradeType === '지급완료' || tradeType === '외화미수금') return 0;
  const sign = tradeType === '매각' ? 1 : -1;
  return sign * Number(amount || 0) * Number(rate || 0);
}
function calcFx(tradeType, amount) {
  if (tradeType === '지급완료' || tradeType === '외화미수금') return 0;
  const sign = tradeType === '매각' ? -1 : 1;
  return sign * Number(amount || 0);
}

// ─── 연차 계산 ───────────────────────────────────────────────
function monthsBetween(fromStr, toStr) {
  const a = new Date(fromStr), b = new Date(toStr);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
    + (b.getDate() >= a.getDate() ? 0 : -1);
}
function calcLeave(joinDate) {
  const months = monthsBetween(joinDate, today());
  if (months < 0) return 0;
  const years = Math.floor(months / 12);
  if (years < 1) return Math.max(0, months);
  return Math.min(25, 15 + (years - 1));
}

// ─── 부트스트랩 ──────────────────────────────────────────────
// ─── 공통 헤더 생성 ──────────────────────────────────────────
function mbRenderHeader(active) {
  const nav = MB.NAV.map(n =>
    `<a href="${n.href}" class="nav-link${n.href === active ? ' active' : ''}">${n.label}</a>`
  ).join('\n      ');
  const adminItems = MB.ADMIN_NAV.map((n, i) =>
    `<a href="${n.href}" style="display:block;padding:.65rem 1rem;font-size:.88rem;color:#1E2A3A;text-decoration:none;white-space:nowrap;${i > 0 ? 'border-top:1px solid #F1F1F3' : ''}">${n.label}</a>`
  ).join('\n          ');
  return `<header class="fixed top-0 left-0 right-0 bg-[#1E2A3A] z-30" style="height:60px">
  <div class="flex items-center h-full px-10">
    <span id="today-date" class="mb-hide-sm" style="color:#fff;font-size:.75rem;white-space:nowrap;flex-shrink:0;margin-right:1.25rem"></span>
    <nav id="mb-nav" class="flex-1 flex justify-center items-center gap-1">
      ${nav}
    </nav>
    <div id="mb-userbox" class="flex items-center gap-5 shrink-0 border-l border-[#2D3D52] pl-8">
      <div id="admin-menu-wrap" style="position:relative;display:none">
        <button onclick="toggleAdminMenu(event)" style="background:#2D3D52;color:#fff;border:none;border-radius:.5rem;padding:.45rem .85rem;font-size:.8rem;font-weight:600;cursor:pointer;white-space:nowrap">⚙️ 관리자 ▾</button>
        <div id="admin-menu" style="display:none;position:absolute;right:0;top:calc(100% + 6px);background:#fff;border-radius:.6rem;box-shadow:0 8px 24px rgba(0,0,0,.18);overflow:hidden;min-width:150px;z-index:50">
          ${adminItems}
        </div>
      </div>
      <div class="mb-hide-sm" style="display:flex;align-items:center;gap:8px;white-space:nowrap">
        <span style="color:#fff;font-size:.875rem;font-weight:600" id="current-user">-</span>
        <span style="color:rgba(255,255,255,.65);font-size:.75rem" id="current-role">-</span>
      </div>
      <button id="clock-btn" onclick="handleClockInOut()" class="px-5 py-2 rounded-lg bg-[#10B981] text-white font-bold text-sm">출근</button>
      <p id="clock-status" class="hidden"></p>
      <button onclick="confirmLogout()" title="로그아웃" style="background:#374151;color:#fff;border:none;border-radius:.5rem;padding:.45rem .85rem;font-size:.8rem;font-weight:600;cursor:pointer;white-space:nowrap">로그아웃</button>
    </div>
    <button id="mb-burger" onclick="mbToggleNav()" title="메뉴" style="display:none;background:none;border:none;color:#fff;font-size:1.5rem;cursor:pointer;margin-left:.6rem;line-height:1">☰</button>
  </div>
</header>`;
}
function mbToggleNav() {
  const n = document.getElementById('mb-nav');
  if (n) n.classList.toggle('mb-open');
}

function mbBoot(activePage) {
  mbInit();
  if (!getCurrentUser()) {
    window.location.href = 'login.html';
    return false;
  }
  const ph = document.getElementById('mb-header');
  if (ph) ph.outerHTML = mbRenderHeader(activePage);
  renderSidebar(activePage);
  return true;
}

// ─── 홍콩 환전 수익률 계산기 ─────────────────────────────
const CALC_PASSWORD = '1234';
const HK_CURRENCIES = [
  { id:'KRW', label:'KRW', name:'원화',     mabang:'',      h1:'192',     h2:'',        threshold:1.4, type:'krw', main:true  },
  { id:'USD', label:'USD', name:'달러',     mabang:'1485',  h1:'7.81',    h2:'7.744',   threshold:1.4, type:'div', main:true  },
  { id:'JPY', label:'JPY', name:'엔',       mabang:'9.3',   h1:'0.0491',  h2:'0.0496',  threshold:1.4, type:'div', main:true  },
  { id:'HKD', label:'HKD', name:'홍콩달러', mabang:'189.3', h1:'1',       h2:'',        threshold:1.4, type:'div', main:true  },
  { id:'EUR', label:'EUR', name:'유로',     mabang:'1725',  h1:'9.11',    h2:'8.92',    threshold:1.6, type:'div', main:false },
  { id:'CNY', label:'CNY', name:'위안',     mabang:'217',   h1:'1.14745', h2:'1.08814', threshold:1.4, type:'div', main:false },
  { id:'TWD', label:'TWD', name:'대만달러', mabang:'45.4',  h1:'0.2405',  h2:'0.2475',  threshold:1.4, type:'div', main:false },
  { id:'AUD', label:'AUD', name:'호주달러', mabang:'1049',  h1:'5.6202',  h2:'5.94',    threshold:1.6, type:'div', main:false },
  { id:'SGD', label:'SGD', name:'싱가포르', mabang:'1152',  h1:'6.11',    h2:'6.01',    threshold:1.4, type:'div', main:false },
  { id:'CAD', label:'CAD', name:'캐나다',   mabang:'1067',  h1:'5.717',   h2:'5.69',    threshold:1.6, type:'div', main:false },
  { id:'GBP', label:'GBP', name:'파운드',   mabang:'1940',  h1:'10.43',   h2:'10.33',   threshold:1.6, type:'div', main:false },
  { id:'MYR', label:'MYR', name:'링깃',     mabang:'365',   h1:'1.98',    h2:'1.847',   threshold:1.4, type:'div', main:false },
];
const MEDALS = ['🥇','🥈','🥉'];
const HK_STATE_KEY = 'mb_hkcalc_state';

let _hkState = null;
function hkLoadState() {
  const saved = mbGet(HK_STATE_KEY);
  if (saved) return saved;
  const init = { usdt:'1493', hkdusd:'7.78', vals:{} };
  HK_CURRENCIES.forEach(c => {
    init.vals[c.id+'_m']  = c.mabang;
    init.vals[c.id+'_h1'] = c.h1;
    init.vals[c.id+'_h2'] = c.h2;
  });
  return init;
}
function hkSaveState() { mbSet(HK_STATE_KEY, _hkState); }
function hkCalcRate(c) {
  const m   = parseFloat(_hkState.vals[c.id+'_m']);
  const hku = parseFloat(_hkState.hkdusd);
  if (c.type === 'krw') {
    const h = parseFloat(_hkState.vals[c.id+'_h1']);
    return { r1: isNaN(h) ? null : h * hku, r2: null };
  }
  const h1 = c.id === 'HKD' ? 1 : parseFloat(_hkState.vals[c.id+'_h1']);
  const h2 = c.id !== 'HKD' && _hkState.vals[c.id+'_h2'] ? parseFloat(_hkState.vals[c.id+'_h2']) : null;
  return {
    r1: isNaN(m)||isNaN(h1) ? null : (m/h1)*hku,
    r2: h2 === null || isNaN(m) || isNaN(h2) ? null : (m/h2)*hku,
  };
}
function hkGetRanked(list) {
  const u = parseFloat(_hkState.usdt);
  return list.map(c => {
    const { r1, r2 } = hkCalcRate(c);
    const p1 = r1 === null || isNaN(u) ? null : ((u-r1)/r1)*100;
    const p2 = r2 === null || isNaN(u) ? null : ((u-r2)/r2)*100;
    const best = p1 !== null && p2 !== null ? Math.max(p1,p2) : (p1 ?? p2);
    const go = best !== null && best >= c.threshold;
    return { c, p1, p2, best, go };
  }).sort((a,b) => {
    if (a.best === null && b.best === null) return 0;
    if (a.best === null) return 1;
    if (b.best === null) return -1;
    if (a.go !== b.go) return a.go ? -1 : 1;
    return b.best - a.best;
  });
}

function openCalc() {
  if (!document.getElementById('calc-modal')) {
    const modal = document.createElement('div');
    modal.id = 'calc-modal';
    modal.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:1rem" onclick="if(event.target===this)closeCalc()">
        <!-- 비밀번호 단계 -->
        <div id="calc-pw-wrap" style="background:#fff;border-radius:1rem;padding:2rem 2.5rem;min-width:280px;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center">
          <div style="font-size:1.5rem;margin-bottom:1.25rem">🔒</div>
          <input id="calc-pw-input" type="password" maxlength="10" placeholder="비밀번호 입력"
            style="border:1.5px solid #E5E7EB;border-radius:.5rem;padding:.6rem 1rem;width:100%;font-size:1rem;outline:none;text-align:center;box-sizing:border-box;margin-bottom:.75rem"
            onkeydown="if(event.key==='Enter')checkCalcPw()">
          <div id="calc-pw-err" style="color:#EF4444;font-size:.8rem;height:1rem;margin-bottom:.5rem"></div>
          <button onclick="checkCalcPw()" style="background:#1E2A3A;color:#fff;border:none;border-radius:.5rem;padding:.65rem 2rem;font-size:.9rem;font-weight:600;cursor:pointer;width:100%">확인</button>
        </div>
        <!-- 계산기 본체 -->
        <div id="calc-body-wrap" style="display:none;background:#fff;border-radius:1rem;padding:1rem 1.25rem;width:720px;max-width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.4);font-family:sans-serif;font-size:13px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
            <div style="font-weight:700;font-size:.95rem;color:#1E2A3A">홍콩 환전 수익률 계산기</div>
            <button onclick="closeCalc()" style="background:none;border:none;color:#6B7280;cursor:pointer;font-size:1.1rem;line-height:1">✕</button>
          </div>
          <div id="hk-content"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('calc-pw-input')?.focus(), 50);
  } else {
    document.getElementById('calc-modal').style.display = '';
    document.getElementById('calc-pw-wrap').style.display = '';
    document.getElementById('calc-body-wrap').style.display = 'none';
    document.getElementById('calc-pw-input').value = '';
    document.getElementById('calc-pw-err').textContent = '';
    setTimeout(() => document.getElementById('calc-pw-input')?.focus(), 50);
  }
}
function closeCalc() { const m=document.getElementById('calc-modal'); if(m) m.style.display='none'; }
function checkCalcPw() {
  const pw = document.getElementById('calc-pw-input').value;
  if (pw === CALC_PASSWORD) {
    document.getElementById('calc-pw-wrap').style.display = 'none';
    document.getElementById('calc-body-wrap').style.display = '';
    _hkState = hkLoadState();
    hkRender();
  } else {
    const err = document.getElementById('calc-pw-err');
    err.textContent = '비밀번호가 틀렸습니다.';
    document.getElementById('calc-pw-input').value = '';
    setTimeout(() => { err.textContent = ''; }, 2000);
  }
}

function hkUpdate(key, value) {
  if (key === '_usdt') _hkState.usdt = value;
  else if (key === '_hkdusd') _hkState.hkdusd = value;
  else _hkState.vals[key] = value;
  hkSaveState();
  hkRenderResults();
}

function hkCurrencyRowHtml(c) {
  const td = 'padding:1px 6px;border:1px solid #d4d4d8;text-align:center;vertical-align:middle;height:24px';
  const inp = 'width:100%;font-size:13px;text-align:center;border:none;background:transparent;outline:none;padding:0';
  return `<tr>
    <td style="${td};padding-left:10px;text-align:left">
      <span style="font-size:12px;font-weight:600">${c.label}</span>
    </td>
    <td style="${td};background:#eff6ff">
      <input type="number" value="${_hkState.vals[c.id+'_m']||''}" oninput="hkUpdate('${c.id}_m',this.value)" style="${inp}" step="any">
    </td>
    <td style="${td}">
      ${c.id === 'HKD'
        ? '<span style="font-size:11px;color:#bbb">1 고정</span>'
        : `<input type="number" value="${_hkState.vals[c.id+'_h1']||''}" oninput="hkUpdate('${c.id}_h1',this.value)" style="${inp}" step="any">`}
    </td>
    <td style="${td}">
      ${c.h2 !== ''
        ? `<input type="number" value="${_hkState.vals[c.id+'_h2']||''}" oninput="hkUpdate('${c.id}_h2',this.value)" style="${inp}" step="any">`
        : '<span style="font-size:11px;color:#bbb">—</span>'}
    </td>
  </tr>`;
}

function hkRankCardHtml(item, rank) {
  const { c, p1, p2, best, go } = item;
  const isTop = go && rank < 3;
  const rcBase = 'display:flex;align-items:center;gap:8px;border-radius:6px;padding:6px 10px;border:1px solid #e5e5e5;background:#fff';
  if (best === null) {
    return `<div style="${rcBase}">
      <span style="font-size:12px;color:#aaa;min-width:18px;text-align:center">${rank+1}</span>
      <span style="font-size:13px;font-weight:600;color:#222;min-width:36px">${c.label}</span>
      <span style="font-size:12px;color:#aaa">—</span>
    </div>`;
  }
  const hasBoth = p1 !== null && p2 !== null;
  return `<div style="${rcBase};border-color:${go?'#86efac':'#fca5a5'};opacity:${go?1:0.55}">
    <span style="font-size:12px;color:#aaa;min-width:18px;text-align:center">${isTop?MEDALS[rank]:rank+1}</span>
    <span style="font-size:13px;font-weight:600;color:#222;min-width:36px">${c.label}</span>
    <span style="font-size:15px;font-weight:600;flex:1;color:${go?'#16a34a':'#dc2626'}">${best.toFixed(2)}%</span>
    <span style="font-size:10px;color:#aaa">${hasBoth?`${p1.toFixed(1)}·${p2.toFixed(1)}%`:`기준 ${c.threshold}%`}</span>
    <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:99px;white-space:nowrap;background:${go?'#dcfce7':'#fee2e2'};color:${go?'#16a34a':'#dc2626'}">${go?'GO':'NO'}</span>
  </div>`;
}

function hkRender() {
  const sl = 'font-size:10px;font-weight:500;color:#888;text-transform:uppercase;letter-spacing:.08em;margin:0 0 5px';
  const guides = [
    { t:'① 마뱅 (파란 칸)', d:'마이뱅크 앱에서 각 통화의 오늘 KRW 매입가 입력' },
    { t:'② h1 / h2 (흰 칸)', d:'ttrate에서 홍콩 환전소 2곳 HKD 환율 골라 입력. HKD는 1 고정.' },
    { t:'③ USDT 빗썸가', d:'빗썸 앱 USDT/KRW 현재가 입력. 모든 수익률 계산 기준점.' },
  ];
  const html = `
    <div style="display:grid;grid-template-columns:1fr 340px;gap:14px;align-items:start">
      <!-- 좌: 입력 영역 -->
      <div>
        <p style="${sl}">입력 가이드</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:10px 12px;margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          ${guides.map(g => `<div>
            <div style="font-size:13px;font-weight:600;color:#222;margin-bottom:3px">${g.t}</div>
            <div style="font-size:12px;color:#666;line-height:1.5">${g.d}</div>
          </div>`).join('')}
        </div>

        <p style="${sl}">기준값</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div style="background:#f5f5f5;border-radius:8px;padding:8px 10px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
              <label style="font-size:12px;color:#555;font-weight:500">USDT 김프가 (KRW)</label>
              <a href="https://kimpga.com" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#3b82f6;text-decoration:none">↗ 김프가</a>
            </div>
            <input type="number" value="${_hkState.usdt}" oninput="hkUpdate('_usdt',this.value)" style="width:100%;font-size:16px;font-weight:600;border:none;background:transparent;outline:none">
            <div style="font-size:11px;color:#888;margin-top:1px">김프가 → USDT/KRW 현재가 숫자만 입력</div>
          </div>
          <div style="background:#f5f5f5;border-radius:8px;padding:8px 10px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
              <label style="font-size:12px;color:#555;font-weight:500">HKD / USD 시세</label>
              <a href="https://hk.ttrate.com/en_us/index.php" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#3b82f6;text-decoration:none">↗ ttrate</a>
            </div>
            <input type="number" value="${_hkState.hkdusd}" oninput="hkUpdate('_hkdusd',this.value)" style="width:100%;font-size:16px;font-weight:600;border:none;background:transparent;outline:none">
            <div style="font-size:11px;color:#888;margin-top:1px">ttrate 상단 USD → HKD 환율 확인 후 입력</div>
          </div>
        </div>

        <p style="${sl}">환율 입력</p>
        <div style="border:1px solid #e5e5e5;border-radius:8px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;table-layout:fixed">
            <thead>
              <tr>
                <th style="font-size:9px;font-weight:500;color:#888;text-align:left;padding:5px 3px 5px 8px;background:#f5f5f5;border:1px solid #d4d4d8;width:60px">통화</th>
                <th style="font-size:9px;font-weight:500;color:#888;text-align:center;padding:4px 6px;background:#eff6ff;border:1px solid #d4d4d8">
                  마뱅<br><span style="font-size:8px;color:#aaa">KRW · 마이뱅크</span>
                </th>
                <th style="font-size:9px;font-weight:500;color:#888;text-align:center;padding:4px 6px;background:#f5f5f5;border:1px solid #d4d4d8">
                  h1 <a href="https://hk.ttrate.com/en_us/index.php" target="_blank" rel="noopener noreferrer" style="font-size:9px;color:#3b82f6;text-decoration:none">↗ttrate</a>
                  <br><span style="font-size:8px;color:#aaa">HKD 환율</span>
                </th>
                <th style="font-size:9px;font-weight:500;color:#888;text-align:center;padding:4px 6px;background:#f5f5f5;border:1px solid #d4d4d8">h2<br><span style="font-size:8px;color:#aaa">HKD 환율</span></th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="4" style="background:#f5f5f5;font-size:9px;font-weight:500;color:#888;padding:3px 8px;letter-spacing:.05em;text-transform:uppercase;border:1px solid #d4d4d8">⭐ 주요</td></tr>
              ${HK_CURRENCIES.filter(c => c.main).map(c => hkCurrencyRowHtml(c)).join('')}
              <tr><td colspan="4" style="background:#f5f5f5;font-size:9px;font-weight:500;color:#888;padding:3px 8px;letter-spacing:.05em;text-transform:uppercase;border:1px solid #d4d4d8">기타</td></tr>
              ${HK_CURRENCIES.filter(c => !c.main).map(c => hkCurrencyRowHtml(c)).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 우: 수익률 순위 -->
      <div style="position:sticky;top:68px">
        <p style="${sl}">수익률 순위</p>
        <div id="hk-results" style="display:flex;flex-direction:column;gap:10px"></div>
      </div>
    </div>
  `;
  document.getElementById('hk-content').innerHTML = html;
  hkRenderResults();
}

function hkRenderResults() {
  const mainRanked  = hkGetRanked(HK_CURRENCIES.filter(c => c.main));
  const otherRanked = hkGetRanked(HK_CURRENCIES.filter(c => !c.main));
  const block = (title, list) => `
    <div>
      <div style="font-size:12px;font-weight:600;color:#555;margin-bottom:5px">${title}</div>
      <div style="display:flex;flex-direction:column;gap:3px">
        ${list.map((item,i) => hkRankCardHtml(item,i)).join('')}
      </div>
    </div>`;
  const el = document.getElementById('hk-results');
  if (el) el.innerHTML = block('⭐ 주요 통화 · 수량 많음', mainRanked) + '<div style="height:10px"></div>' + block('기타 통화 · 수량 제한', otherRanked);
}
