# MoneyBox – Firebase Firestore 연동 문의 (Gemini in Firebase)

> 이 문서를 **Firebase 콘솔의 Gemini**(우측 상단 ✨ 또는 Gemini 채팅)에 붙여넣고 아래 질문에 답을 받으세요.
> **데이터베이스 리전: asia-northeast3 (서울, 한국)**

---

## 1. 프로젝트 개요

- **무엇**: 환전소 내부 운영 시스템 (직원 약 5~6명, 지점 2곳 — 홍대·연남)
- **기술**: 순수 정적 웹앱 — HTML/CSS/JavaScript, **빌드 도구·프레임워크 없음**
- **현재 저장소**: 브라우저 **localStorage** (앱 데이터 키 24개)
- **목표**: 매장 PC·직원 휴대폰 등 **여러 기기에서 같은 데이터를 실시간 공유**
- **백엔드 없음** → **Firebase Firestore**로 실시간 동기화를 추가하는 중
- **인증**: 현재 Firebase Auth 미사용. 앱 자체 로그인(이름 + 4자리 비밀번호)만 있고, 자격증명도 localStorage(`mb_credentials`)에 보관 중

---

## 2. 현재 구현한 동기화 구조

- **SDK**: compat 버전 CDN 로드 (`firebase-app-compat.js`, `firebase-firestore-compat.js` v10.12.0)
- **데이터 모델**: 컬렉션 경로 `mb_workspaces/{workspace}/data/{key}`
  - 문서 1개 = localStorage 키 1개
  - 문서 형식: `{ v: <해당 값 전체(배열/객체)>, at: serverTimestamp }`
  - 동기화 키 24개: 직원·근무표·출퇴근·연차·인수인계·거래공지·거래기록·업무체크리스트·무인기(시재보충/정산/특이사항/메모)·보관함 월별정산·자료실·자격증명·감사로그 등
- **쓰기(write-through)**: 앱이 `localStorage.setItem` 할 때마다 같은 키 문서를 `set()`
- **읽기**: 키마다 `onSnapshot` 구독 → 원격 변경 시 localStorage 갱신 + 화면 새로고침 이벤트 발생
- **echo(되울림) 방지**: `_applyingRemote` 플래그 + `_lastPushed` 동일값(JSON) 비교

### 핵심 코드 발췌 (mb-sync.js)

```js
// 데이터 모델: mb_workspaces/{workspace}/data/{key}
const col = db.collection('mb_workspaces').doc(ws).collection('data');

// ① 쓰기 — 앱이 localStorage 저장할 때마다 호출
window.mbCloudPush = function (key, value) {
  if (_applyingRemote) return;                              // 원격 적용 중 재전송 방지
  if (_lastPushed[key] === JSON.stringify(value)) return;   // 동일 값 중복 전송 방지
  col.doc(key).set({ v: value, at: firebase.firestore.FieldValue.serverTimestamp() });
};

// ② 읽기 — 키마다 실시간 구독
KEYS.forEach(key => col.doc(key).onSnapshot(snap => {
  if (!snap.exists) return;
  applyRemote(key, snap.data().v);   // → localStorage 갱신 + 화면 갱신 이벤트(dispatch)
}));

// ③ 최초 1회 이관 — 클라우드에 없고 로컬에 있으면 업로드
KEYS.forEach(key => col.doc(key).get().then(snap => {
  if (!snap.exists && localStorage.getItem(key) !== null) {
    col.doc(key).set({ v: JSON.parse(localStorage.getItem(key)), at: serverTimestamp });
  }
}));
```

---

## 3. 문의 사항 (이 질문들에 답해주세요)

### Q1. 보안 규칙 (가장 중요)
테스트 모드는 30일 후 잠깁니다. 그 이후 쓸 **적절한 Firestore 보안 규칙**이 필요합니다.
- 현재 **Firebase Auth가 없고**, 소규모 내부용입니다.
- (a) **익명 인증(Anonymous Auth)** 또는 이메일/비밀번호 인증을 붙여서 *"인증된 사용자만 `mb_workspaces/...` 읽기/쓰기 허용"* 하는 **규칙 예시**를 주세요.
- (b) 인증을 붙이지 **않을** 경우의 최소 보호 방법과 위험을 (a)와 비교해 주세요.
- 우리 상황(소규모·내부용·자격증명을 Firestore에 저장)에 맞는 **권장 방향**을 정해 주세요.

### Q2. 리전 (서울 / asia-northeast3)
- compat CDN SDK 사용 시 리전 관련 **추가 설정**이 필요한가요? (projectId만으로 자동 라우팅되는지)
- 한국 사용자 기준 **지연시간·비용**에 영향이 있나요?
- 한 번 정한 리전은 **변경 불가**가 맞나요? (처음에 꼭 asia-northeast3로 만들어야 하는지)

### Q3. 데이터 모델 적정성
"키별 문서 1개(문서 안에 배열/객체를 통째로 저장)" 방식이 괜찮은가요?
- **문서 1MB 제한** 관점에서 위험한 키(계속 쌓이는 거래기록 `mb_transactions`, 감사로그 `mb_audit_log`)는 어떻게 구조화하는 게 좋나요? (서브컬렉션 분리?)
- 여러 사람이 같은 키(예: 같은 날 거래시트)를 **동시에 수정**하면 문서 전체 `set()`이라 **마지막 저장이 앞 저장을 덮어씁니다**. 이 충돌을 줄이는 방법(행 단위 문서 분리 / 트랜잭션 / `update`·`merge`)을 제안해 주세요.

### Q4. onSnapshot · 비용
- 키 24개에 각각 `onSnapshot`을 거는 구조가 적절한가요?
- **오프라인 지속성**(`enablePersistence`)을 켜는 게 좋나요?
- 직원 5~6명·기기 5~10대 기준으로 **무료 할당량(일 읽기 5만 / 쓰기 2만)** 안에서 운영 가능한가요? 읽기 폭증을 막는 팁이 있나요?

### Q5. echo(무한 루프) 방지
"원격 스냅샷 적용 → localStorage 변경 → 다시 클라우드로 push" 되는 되울림을 막아야 합니다. 지금은 플래그 + 동일 JSON 비교로 막고 있는데, 더 **견고한 표준 패턴**이 있나요? (예: 문서에 작성자 clientId 기록 후 자기 변경 무시)

### Q6. 초기 데이터 이관(시드)
기존 localStorage 데이터를 최초 1회 Firestore로 올립니다. 여러 기기가 **동시에 처음 접속**하면 서로 다른 로컬 데이터로 **덮어쓰기 충돌**이 날 수 있습니다. 안전한 초기 이관 방법을 알려주세요.

---

## 4. 원하는 답변 형태
- **Q1 보안 규칙**은 그대로 복사해 붙여넣을 수 있는 **규칙 코드(`rules_version = '2'`)**로 주세요.
- 코드 예시는 가능하면 **compat SDK 기준**으로 주세요.
- 우선순위: **Q1(보안) → Q3(충돌) → Q6(초기이관) → 나머지** 순으로 답해 주시면 좋습니다.
