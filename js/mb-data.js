// ============================================================
// MoneyBox 내부 운영 시스템 - 공통 데이터 헬퍼
// localStorage 기반. 추후 Supabase 이식 예정.
// ============================================================

const MB = {
  EMPLOYEES_KEY: 'mb_employees',
  DEFAULT_EMPLOYEES: [
    { id: 'e1', name: '김동교', role: 'admin',  joinDate: '2024-11-01', branch: null,   password: '0000' },
    { id: 'e2', name: '임재원', role: 'senior', joinDate: '2024-03-06', branch: '홍대', password: '0000' },
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

  CURRENCIES: ['KRW','USD','JPY','EUR','CNY','HKD','SGD','THB','VND','TWD','AUD','CAD','GBP','PHP','IDR','MYR'],
};

// ─── 기본 헬퍼 ───────────────────────────────────────────────
function mbGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function mbSet(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
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
  if (user.branch === '홍대') {
    const atmGate = mbGetOrDefault(MB.ATM_GATE_KEY, {});
    if (atmGate[dateStr]?.[user.id] !== true) {
      return { ok: false, reason: '무인기 마감 담당자 체크 미완료' };
    }
  }
  return { ok: true };
}

function handleClockInOut() {
  const user = getCurrentUser();
  if (!user) { showUserSelectModal(); return; }
  const todayStr = today();
  const records = mbGetOrDefault(MB.ATTENDANCE_KEY, []);
  const rec = records.find(r => r.employeeId === user.id && r.date === todayStr);

  if (!rec) {
    records.push({
      id: uid(), employeeId: user.id, date: todayStr,
      clockIn: nowTime(), clockOut: null,
      branch: user.branch, shiftType: '', workMinutes: 0,
    });
    mbSet(MB.ATTENDANCE_KEY, records);
  } else if (!rec.clockOut) {
    const gate = checkClockOutGate(user, todayStr);
    if (!gate.ok) {
      alert('퇴근할 수 없습니다.\n사유: ' + gate.reason);
      return;
    }
    rec.clockOut = nowTime();
    const [ih, im] = rec.clockIn.split(':').map(Number);
    const [oh, om] = rec.clockOut.split(':').map(Number);
    rec.workMinutes = (oh*60 + om) - (ih*60 + im);
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
    btn.className = 'px-4 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#0EA371] text-white font-bold text-xs transition';
    btn.textContent = '출근';
    btn.disabled = false;
    if (status) status.textContent = '미출근';
  } else if (!rec.clockOut) {
    const gate = checkClockOutGate(user, todayStr);
    if (gate.ok) {
      btn.className = 'px-4 py-1.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-xs transition';
      btn.textContent = '퇴근';
      btn.disabled = false;
    } else {
      btn.className = 'px-4 py-1.5 rounded-lg bg-[#374151] text-gray-400 font-bold text-xs cursor-not-allowed';
      btn.textContent = '퇴근 대기';
      btn.disabled = false;
    }
    if (status) status.textContent = `출근 ${rec.clockIn}`;
  } else {
    btn.className = 'px-4 py-1.5 rounded-lg bg-[#374151] text-gray-400 font-bold text-xs cursor-not-allowed';
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
  }
  document.querySelectorAll('.nav-link').forEach(a => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href === activePage);
  });
  const td = document.getElementById('today-date');
  if (td) td.textContent = formatDate();
  renderClockBtn();
}

// ─── 초기 데이터 시드 ────────────────────────────────────────
function mbInit() {
  if (!mbGet(MB.EMPLOYEES_KEY)) {
    mbSet(MB.EMPLOYEES_KEY, MB.DEFAULT_EMPLOYEES);
  } else {
    // 기존 직원 데이터에 password 필드가 없으면 '0000' 마이그레이션
    const employees = mbGet(MB.EMPLOYEES_KEY);
    let updated = false;
    employees.forEach(e => { if (!e.password) { e.password = '0000'; updated = true; } });
    if (updated) mbSet(MB.EMPLOYEES_KEY, employees);
  }
  if (!mbGet(MB.STORAGE_PRICE_KEY)) {
    mbSet(MB.STORAGE_PRICE_KEY, { XL: 15000, L: 12000, M: 9000, S: 6000 });
  }
  if (!mbGet(MB.SCHEDULE_KEY)) {
    const t = today();
    mbSet(MB.SCHEDULE_KEY, [
      { date: t, employeeId: 'e2', branch: '홍대', shiftType: '오픈' },
      { date: t, employeeId: 'e4', branch: '홍대', shiftType: '마감' },
      { date: t, employeeId: 'e3', branch: '연남', shiftType: '오픈' },
    ]);
  }
  if (!mbGet(MB.CREDENTIALS_KEY)) {
    mbSet(MB.CREDENTIALS_KEY, [
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
function mbBoot(activePage) {
  mbInit();
  if (!getCurrentUser()) {
    window.location.href = 'login.html';
    return false;
  }
  renderSidebar(activePage);
  return true;
}
