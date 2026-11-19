# KDT 자재 재고관리 시스템 구축 작업계획서 (KDT-Inventory)

> 작성: 경훈시스템 부설 자동화 연구소 수석연구원 최박사
> 최초 작성: 2026-11-19 / 최종 개정: 2026-11-19 (Ver 1.3.14 반영)
> 기준 프로젝트: `D:\M_PROJECT\Asan-Inventory_3400` (Ver 5.34.0, 읽기 전용 참조)
> 대상 프로젝트: `D:\M_PROJECT\KDT-Inventory_3500`
> Firebase Project: `kdt-inventory` (#932423332610) / 리전: `asia-northeast3` (서울) / Blaze 요금제
> GitHub: `https://github.com/youhwanjung-dot/KDT-Inventory.git`
> 질의응답 채널: [`_user/QmA.md`](./_user/QmA.md)

---

## 1. 개요 및 기본 원칙

아산노블 재고관리 시스템(Asan-Inventory, Ver 5.34.0)에서 운영 검증된 아키텍처와 코딩 기법을 그대로 계승하여,
KDT 제조 현장의 **ZONE(대분류) 단위 자재 입출고 및 재고관리 시스템**을 구축합니다.

| 원칙 | 확정 내용 |
|---|---|
| **아키텍처 동일성** | React 18 + Vite 5 + TypeScript + Tailwind / Firebase Hosting + Cloud Functions(v2) + Firestore |
| **검증 코드 재활용** | 아산노블 **재고관리 파트**만 선별 이관, 스키마·도메인 용어 등 불가피한 부분만 수정 (재활용률 ~85%) |
| **이관 제외** | 요양원 전용 플러그인 4종(일정표·어르신 관리카드·기능회복훈련·설문지), AI 어드바이저, Python 서버 |
| **수량 관리 원칙** | **실수량만 반영** (비고는 참고용), **최종 개수(`EA`, 정수) 단일 기준** 관리 (소포장 단위 참고/환산 병기) |
| **2차 확장 선반영** | ZONE별 목표 생산수량 및 제품 1대당 소요량(`1 SET`)은 2차 과제로 두되 **DB 스키마에 선반영** |
| **연구소 규약 준수** | `Ver 1.0.0` 시작 / `Version.json` / `_Local_run_KDT.bat`·`_Cloud_run_KDT.bat` / 1,000라인 리팩토링 / backup / MODE Flag |

---

## 2. 확정 도메인 요구사항 요약

1. **대분류 = ZONE**: 독립 대분류이며 고객사별 별칭 변경 가능(`ZONE+숫자`, `Fluid+숫자` 등) → **불변 `zoneId` + 변경 가능한 표시명** 구조로 이력 보존
2. **ZONE별 분리 수불**: 공통 자재(예: 부스바)가 많으나 대분류 단위로 공급·소모되므로 입고·출고·재고 이력은 ZONE별 분리 관리
3. **품목 식별 확장**: `품명 + 도금(3가/SUS) + 규격(M6*16 등)` 3요소로 품목 식별
4. **SET 구성품 개별 관리**: `육각볼트 SET`의 총 SET 수량·구성비율은 무시하고, 실제 관리 대상인 **구성품(볼트/너트/스프링와셔/평와셔)**별로 개별 입출고 관리
5. **입출고 항목**: 작업자, 일자, 품목, 수량, 입고/출고 + 보관위치(`location`), 비고(`note`) — 기본 화면은 아산노블 기준
6. **엑셀 공동작업 양방향**: 요약 시트 + ZONE별 **40개 고정 슬롯(미등록 품목 빈 슬롯 포함)** 수불부 양방향 Import/Export, ZONE명 동기화, `_user/KDT-Inventory.xlsx` 입고 리스트 초기 이관 지원
7. **초기 사용자 (6명)**: `관리자`, `김수현 팀장`, `황호동 반장`, `문자운 조장`, `김민기 조장`, `이호준 계장` (사용자관리에서 추가/수정/삭제)

---

## 3. 재활용 매트릭스 (Asan → KDT)

| 구분 | 대상 | 처리 방침 |
|---|---|---|
| **그대로 재사용** | `Login`, `ConfirmationModal`, `UserManagerModal`, `DataMigrationModal`, `ManualModal` 골격, `utils/*`(api, logger, cacheBuster, formatters), `functions/auth.ts`·`users.ts`·`migration.ts`, Vite/ESLint/TS 설정, `backup_ver.ps1` | 명칭(`KDT`)·포트(`3500`)·리전(`asia-northeast3`)·기본 사용자 치환 |
| **스키마 반영 수정** | `types.ts`, `InventoryList`(**1,000라인 초과→폴더 분리 리팩토링**), `StockForm`, `TransactionModal`, `Dashboard`, `MasterDataManagerModal`(대분류→ZONE + 별칭/생산수량), `ReportModal`·`MonthlyReportModal`·`MonthlyUsageReportModal`, `ExcelImport/*`, `TransactionHistoryImport`, `functions/inventory.ts`·`transactions.ts`·`masterData.ts`·`excel.ts`, `firestore.rules`/`indexes` | 도금·규격·단위·eaPerUnit·보관위치·2차 BOM 필드 반영, 정수 EA 처리 |
| **신규 작성** | `KDT template.xlsx` (요약 시트 + ZONE별 40슬롯 수불부), `KDT-Inventory.xlsx` 입고시트 파서(초기 데이터 임포트), `_Local_run_KDT.bat`, `_Cloud_run_KDT.bat` | KDT 전용 리소스 및 스크립트 |
| **제외 (미이관)** | `_plugin/*` 4종, `AIAdvisor`, `scripts/*_server.py`, `hwp_generator.py`, `functions/schedule.ts`·`survey.ts` | 완전 제거 |

---

## 4. 최종 DB 스키마 (Firestore — `asia-northeast3`)

> 아산노블 컬렉션 구조(`inventory`, `transactions`, `masterData`, `config/users`, `metadata`)를 그대로 유지하여 기존 실시간 구독(`onSnapshot`) 및 Cloud Functions 로직을 최대한 재활용합니다.

### 4.1. `inventory/{itemId}` — 자재 마스터 및 ZONE별 현재고

| 필드 | 타입 | 필수 | 설명 | 비고 |
|---|---|:---:|---|---|
| `id` | string | O | Firestore 문서 ID | Asan 동일 |
| `category` | string | O | ZONE 표시명 (예: `ZONE16_Plus`, `ZONE18`) | Asan `category` 호환 |
| `zoneId` | string | O | **[신규]** 불변 ZONE ID (예: `Z001`) | 별칭 변경 시 이력 유지 |
| `name` | string | O | 품명 (소분류) | Asan 동일 |
| `plating` | string | - | **[신규]** 도금 (예: `3가`, `SUS`, `""`) | 품목 식별 요소 |
| `spec` | string | - | **[신규]** 규격 (예: `M6*25`, `M8`, `""`) | 품목 식별 요소 |
| `unit` | `'EA' \| 'SET' \| 'BOX'` | O | 공급/표시 단위 (기본 `EA`) | 참고 환산용 |
| `eaPerUnit` | number | O | **[신규]** 1단위당 EA 수량 (기본 `1`, 가스켓 `2`, 스티커 `3`, 드라이업 `60`) | 화면 환산 병기 |
| `currentStock` | number | O | 현재고 (**정수 EA 기준**) | Asan 동일 |
| `safeStock` | number | O | 적정재고 (EA) | Asan 동일 |
| `location` | string | - | 보관위치 (랙/선반 등) | Asan `location` |
| `note` | string | - | 비고 (소포장 pkg 내역 등 참고용) | Asan `note` |
| `qtyPerProduct` | number | - | **[2차 선반영]** 완제품 1대당 소요 수량 (엑셀 `1 SET` 열) | 2차 BOM 자동계산용 |
| `setGroup` | string | - | **[2차 선반영]** 소속 SET 그룹명 (예: `육각볼트 SET M6*25`) | 2차 BOM 그룹핑용 |
| `orderCategory` / `orderName` | number | - | 정렬 순서 | Asan 동일 |
| `lastUpdated` | string | O | 최종수정일 (`YYYY-MM-DD`) | Asan 동일 |

### 4.2. `transactions/{txId}` — ZONE별 입출고 수불 이력

| 필드 | 타입 | 설명 |
|---|---|---|
| `id`, `itemId`, `date`, `type` (`'IN' \| 'OUT'`) | string | Asan 동일 |
| `category`, `zoneId` | string | ZONE 표시명 + 불변 ID |
| `itemName`, `plating`, `spec` | string | 품목 스냅샷 |
| `quantity` | number | 입출고 실수량 (**정수 EA**) |
| `worker` | string | 작업자 (기본 사용자 연동) |
| `department`, `reason` | string | 부서 / 사유·비고 (소포장 참고 메모 포함) |
| `currentStockSnapshot` | number | 거래 직후 현재고 스냅샷 (EA) |

### 4.3. `masterData/custom` — ZONE 목록 및 정렬·메타정보

```ts
{
  categories: string[];                   // ZONE 표시명 순서 (Asan 호환)
  namesByCategory: Record<string, string[]>; // ZONE별 품목 표시키 순서 (Asan 호환)
  nameOrder: string[];                    // 전역 정렬 보조 (Asan 호환)
  zoneMeta: Record<string, {              // [신규 + 2차 선반영] key = zoneId
    zoneId: string;                       // 불변 내부 ID (예: "Z001")
    displayName: string;                  // 현재 표시명 (예: "ZONE18" → "Fluid18")
    customer?: string;                    // 고객사명
    plannedProductionQty?: number;        // [2차 선반영] 목표 생산 수량 (예: 9600)
    actualProductionQty?: number;         // [2차 선반영] 실적 수량
    aliasHistory?: { name: string; changedAt: string }[];
  }>;
}
```

### 4.4. `config/users` — 사용자 및 권한 (Asan 동일 구조)
- 초기 시드: `관리자`(admin), `김수현 팀장`, `황호동 반장`, `문자운 조장`, `김민기 조장`, `이호준 계장`

---

## 5. 엑셀 공동작업 파일 (양방향 — 대분류별 40슬롯 고정 & 연도별 캘린더)

1. **요약 시트 (기본 `현 재고`)**:
   - 컬럼: `연번 | ZONE(대분류) | 품명 | 도금 | 규격 | 단위/환산 | 현재고(EA) | 보관위치 | 1대당소요 | 비고`
   - 선택된 대상 연도(`targetYear`, 예: 2026년 → 2027년)에 맞춰 타이틀(`{targetYear}년 KDT 자재 재고현황`) 및 각 ZONE 시트 연간 최종 잔량(`=ZONE시트!D390` 등) 자동 수식 참조
2. **ZONE별 일자 수불부 시트 (대분류당 40슬롯 고정)**:
   - 시트명 = ZONE 표시명 (`ZONE16_Plus`, `ZONE18` 등)
   - **고정 슬롯**: ZONE당 정확히 **40개 품목 슬롯** (`col = 2, 6, 10 ... 158`, 4열 간격), 미등록 품목용 빈 슬롯 포함. 등록 품목은 슬롯 앞에서부터 순서대로 배치
   - **수불 이력 검증**: 품명 없는 슬롯은 직전 품목명을 상속하지 않으며, 템플릿의 날짜별 샘플 입출고 수량은 새 슬롯으로 복사하지 않음
   - **인쇄 배율**: 요약 및 ZONE 시트의 페이지 설정을 40%로 고정
   - **연도별 캘린더 자동 갱신 (2026 → 2027 등)**:
     - 엑셀 내보내기 시 대상 연도(`targetYear`)를 기준으로 A열 1월~12월 일자 및 상단 연도 헤더를 자동 갱신
     - `targetYear` 이전 누적 잔고는 **Row 4 (기초 이월재고)** 로 자동 합산 이월하고, `targetYear` 당해 연도 입출고만 일자별 셀에 기록
   - 상단 헤더(R3): 고유 표시키 (`품명 [도금/규격]`) → 동일 품명 충돌 방지
3. **월별 재고 수불 보고서**:
   - 대분류별 정확히 40행(등록 품목 + 미등록 슬롯)으로 고정하고 대분류마다 1페이지 출력
   - 미리보기와 인쇄를 A3 세로 방향으로 통일하고, 대분류가 2개면 총 2페이지 (월별 보고서에만 적용)
   - 월 경계는 `[월초, 다음 달 1일)` 반개구간으로 처리해 월말 거래를 포함하고 다음 달 1일 거래는 제외
   - 선택 월에 입출고가 없는 품목을 체크박스로 미리보기 및 인쇄에서 함께 숨김 처리
4. **공통 소분류 기준정보**:
   - 한 ZONE에서 신규 소분류를 등록하면 모든 ZONE의 `namesByCategory`에 추가하고 누락된 ZONE별 재고 품목 레코드를 생성
   - 신규 품목은 `currentStock: 0`으로 시작하며, 0수량 재고이월 등 거래 이력은 생성하지 않음
5. **ZONE 간 중복(공통) 소분류 및 현장 혼입·정산 대응**:
   - **엄격한 4요소 키 매칭**: `ZONE + 품명 + 도금 + 규격` 조합으로 ZONE별 장부 분리
   - **[공통자재 합산 뷰 (현장 혼입 실사 모드)]**: 재고 현황 화면에서 `품명 + 도금 + 규격` 기준으로 전 ZONE 재고를 합산해 **작업장 실물 총재고**와 **ZONE별 장부 배분량**을 동시에 대조하는 토글 뷰 제공
   - **[ZONE 완료 반납·이관 정산 기능]**: ZONE 작업 완료 시 잔여 재고를 반납 정산(출고)하거나 신규 ZONE으로 일괄 이관(정산출고 + 신규 ZONE 이관입고)하는 정산 모달 지원

---

## 6. 환경 및 배포 구성

| 항목 | Asan-Inventory | KDT-Inventory |
|---|---|---|
| Firebase Project | `asannoble-inventory` | `kdt-inventory` (#932423332610) |
| Firestore / Functions 리전 | `us-central1` | **`asia-northeast3` (서울)** (`firebase.json` rewrites에도 `"region": "asia-northeast3"` 명시) |
| Hosting URL | asannoble-inventory.web.app | `https://kdt-inventory.web.app/login` |
| 로컬 포트 | 3400 / 3410 | **`3500`** (단일 포트) |
| 빌드 스크립트 | `_Local_run_inventory.bat` / `_Cloud_run_inventory.bat` | **`_Local_run_KDT.bat`** / **`_Cloud_run_KDT.bat`** (영문 ASCII 표준) |
| 시작 버전 | Ver 5.34.0 | **`Ver 1.0.0`** (현재 **`Ver 1.3.14`**, Hosting 배포 대기) |

| MODE Flag (`Version.json`) | 초기값 | 비고 |
|---|---|---|
| `VERSION_MODE` | `1.3.7` | 하드코딩 금지, `Version.json` → Vite 주입 → 로그인 모달 표시 |
| `MOCKUP_MODE` | ON → OFF | 초기 GUI 검증용 목업 분기 유지 (삭제 금지) |
| `STORAGE_MODE` | `Cloud` | Firebase Firestore + 로컬 분기 코드 보존 (캐시 금지) |

---

## 7. 단계별 추진 일정 및 실시간 모니터링 (Master Roadmap)

> **실시간 상태**: **Phase 1 ~ Phase 4 구축 완료, 공통 소분류 동기화·삭제 이력 경고, 월별 수불 이월 잔액 분리 및 재고분석 적정재고 규칙/A3 세로 보고서 최적화; 타입검사/프로덕션 빌드 통과, Hosting 배포 대기** (최종 갱신: `2026-11-19` / 버전: `Ver 1.3.14`)
> **운영 접속 URL**: **`https://kdt-inventory.web.app/login`** (서울 리전 `asia-northeast3` Cloud Functions v2 + Firestore 실시간 연동 완료)

| 단계 | 세부 작업 | 상태 | 반영 버전 |
|:---|:---|:---:|:---:|
| **Phase 0** | 1차·2차·3차 QnA 완료, DB 스키마 및 입출고 권한(C1~C4) 최종 확정 | **완료** | – |
| **Phase 1** | Firebase `kdt-inventory` 웹앱·서울 설정, Asan 재고 코어 선별 이식, Functions v2 서울 리전 + KDT 스키마/6명 사용자 백엔드, 빌드 스크립트 2종, 클린빌드 0에러, `backup/Ver1.0.0`, GitHub 1차 푸시 | **완료** | Ver 1.0.0 |
| **Phase 2** | **KDT 핵심 UI·권한·Rule 5 리팩토링 + 50슬롯/연도캘린더/혼입합산·정산**: `UserManagerModal`, `TransactionModal`, `StockForm`, `InventoryList/`(50슬롯·연도별 캘린더·공통자재 합산뷰·ZONE 정산), `MasterDataManagerModal/`(ZONE 별칭·생산수량), `TransactionHistoryImport`, `ReportModal` | **완료** | Ver 1.1.0 |
| **Phase 3** | **초기 32품목/33건 데이터 시드 & 입고시트 전용 파서 & 대시보드**: `_user/KDT-Inventory.xlsx` 32품목/33건(`ZONE16_Plus` 10품목, `ZONE18` 22품목, 평와셔 M8 46,100 EA 통합) `initialData.ts`·`initialTransactions.ts` 및 원클릭 초기 적재 기능 탑재, `LegacyParser.ts` 입고시트(`육각볼트 SET`+`ㅁ` 구성품 분리) 직접 임포트 지원, 대시보드 정수 EA 최적화 | **완료** | Ver 1.2.0 |
| **Phase 4** | **배포 및 실접속 검증**: 클린빌드 검증 → `backup/Ver1.2.0` → Firebase(`kdt-inventory`, 서울 리전 `asia-northeast3`) 배포 → 운영 DB 초기 32품목/33건/6명 사용자/`zoneMeta` 시드 적재 → `https://kdt-inventory.web.app/login` 실접속 및 API 200 OK 검증 완료 | **완료 (100%)** | Ver 1.3.0 |
| **Hotfix** | **빌드 에러 해결 및 호환 심볼 추가**: `StepPreview.tsx`와 `formatters.ts`의 `formatStockWithRef` 누락 심볼 수정, `functions/src` 엄격 타입 검사 수정, Vite 클린 빌드(0 에러) 검증 후 Hosting 재배포 완료 | **완료 (100%)** | Ver 1.3.1 |
| **Cleanup** | **마이그레이션 마무리 정리 및 운영 품질 정비**: 프론트엔드 `typecheck` 오류 수정, 로컬 Tailwind 빌드 복구(`tailwind.config.cjs`, `postcss.config.cjs`), 매뉴얼/내장 템플릿 및 엑셀 Import UI의 아산노블·요양원 잔재 제거, 클린빌드 및 Hosting 재배포 완료 | **완료 (100%)** | Ver 1.3.2 |
| **Excel ZONE 동기화/이력 안정화** | 기준정보·요약·데이터 시트의 ZONE명 동기화, ZONE당 40슬롯 고정, 빈 슬롯 샘플 이력 제거, 대분류 일치 매칭, 인쇄 40% 고정 및 원본 엑셀 정정본 검증 | **완료 (클린빌드, 배포 대기)** | Ver 1.3.6 |
| **월별 재고 수불 보고서** | 로컬 시간대 월말 경계 처리, 대분류별 40행 고정, 미리보기·인쇄 A3 세로 1페이지/대분류 (현재 2개 대분류 = 2페이지) | **완료 (클린빌드, 배포 대기)** | Ver 1.3.9 |
| **공통 소분류 기준정보** | 신규 소분류를 모든 ZONE의 기준정보와 재고목록에 동기화, 초기 현재고 0·거래 이력 미생성, 월별 보고서 무거래 품목 필터 문구 명확화 | **완료 (클린빌드, 배포 대기)** | Ver 1.3.10 |
| **출고 사유 명확화** | `불량교체` 사유를 `불량폐기`로 변경하고 일반 출고의 재고 차감 로직을 유지 | **완료 (클린빌드, 배포 대기)** | Ver 1.3.11 |
| **소품목 추가 안내** | 신규 품명 미입력 시 안내 표시와 입력란 포커스 제공; 품목은 모든 ZONE에 현재고 0·거래 이력 없이 준비 | **완료 (클린빌드, Firebase Hosting 반영)** | Ver 1.3.12 |
| **공통 소품목·삭제 이력 경고** | 기준정보 저장 성공 후 모든 ZONE에 0재고 품목 생성; 타 ZONE 동일 품목 이력이 있을 때 커스텀 확인 모달 표시 | **완료 (클린빌드, 배포 대기)** | Ver 1.3.13 |
| **월별 수불·재고분석 보고서** | 월별 `재고이월` 기준의 기초재고 계산 및 월간 입출고 분리; 미입력 적정재고 fallback, 표 줄바꿈 방지, 두 보고서 A3 세로 출력 최적화 | **완료 (클린빌드, 배포 대기)** | Ver 1.3.14 |
| **2차 과제** | ZONE 목표 생산수량 × `qtyPerProduct`(1대당 소요량) 기반 필요/부족 자재 자동 산출 (DB 스키마 선반영 완료) | 예정 | Ver 2.0.0 |

### ▶ Phase 4 (`Ver 1.3.0` ~ `Ver 1.3.2`) 세부 진행 로그 (실시간 갱신)
- [x] `4-1` 프론트엔드 및 백엔드(`functions/lib`, Node.js 22 2nd Gen, Lazy Admin SDK) 클린빌드 0에러 검증 완료
- [x] `4-2` `backup/Ver1.2.0` 롤백 아카이브 생성 및 GitHub 커밋/푸시 완료
- [x] `4-3` Firebase(`kdt-inventory`, 서울 리전 `asia-northeast3`) Firestore Rules/Indexes, Cloud Functions v2 (8개 전체 함수), Hosting(`https://kdt-inventory.web.app`) 배포 완료
- [x] `4-4` 운영 Firestore DB 초기 데이터(`ZONE16_Plus` 10품목 + `ZONE18` 22품목 = 32품목, 33건 입고 이력, 6명 기본 사용자, `masterData.zoneMeta`) 시드 적재 및 라이브 API 200 OK 검증 완료
- [x] `4-5` `formatStockWithRef` export 누락 및 functions 타입 에러 긴급 패치(Hotfix) 완료
- [x] `4-6` Vite 클린 빌드 0에러 확인, Firebase Hosting 배포 완료, 라이브 웹앱 정상 로드 및 8개 API 엔드포인트 200 OK 검증 완료
- [x] `4-7` `Ver 1.3.1` 최종 버전 갱신, 로컬(`3500`) 및 클라우드(`https://kdt-inventory.web.app/login`) 정상 가동 완료
- [x] `4-8` `LegacyParser.ts`, `excelExport.ts` 프론트엔드 `typecheck` 오류 수정 및 프로덕션 `tailwind CDN` 제거 후 로컬 Tailwind 빌드 체계 복구 완료
- [x] `4-9` `ManualModal/*`, `sourceExporter.ts`, 엑셀 업로드/매핑/수불부 UI 문구를 KDT 기준으로 정리하여 아산노블·요양원 잔재 제거 완료
- [x] `4-10` `_Cloud_run_KDT.bat` 재실행으로 `Ver 1.3.2` 클린빌드 및 Firebase Functions/Hosting 재배포 완료
- [x] `4-11` ZONE 기준정보/Excel Main 및 데이터 탭 양방향 명칭 동기화, 수불부 ZONE 엄격 매칭, 타입검사 및 프로덕션 빌드 통과 (`Ver 1.3.4`, 배포 대기)
- [x] `4-12` 수불 이력의 빈 4열 슬롯 품명 상속 및 템플릿 샘플 수량 복제 수정, 전체 Excel 인쇄 배율 40% 고정 (`Ver 1.3.6`)
- [x] `4-13` `_user/KDT-Inventory-2026-20261119.xlsx`의 ZONE/품목 일치 및 빈 슬롯 48곳 검수, 원본 보존 정정본 생성; 품목 데이터 유지와 40% 배율 확인
- [x] `4-14` 월별 재고 보고서의 한국 시간대 월 경계 보정 및 대분류당 40행/A3 세로 미리보기·인쇄 구성 (`Ver 1.3.9`)
- [x] `4-15` 신규 소분류의 모든 ZONE 기준정보 동기화 및 누락 재고 레코드 0개 생성, 0수량 거래 이력 미생성; 월별 보고서 기존 무거래 품목 필터 문구 정리 (`Ver 1.3.10`)
- [x] `4-16` 출고 사유 `불량교체`를 `불량폐기`로 통일하고 기존 출고 재고 차감 로직 유지; 운영 거래 32건에서 기존 사유 0건 확인 (`Ver 1.3.11`)
- [x] `4-17` 소품목 추가 시 빈 품명 입력을 안내하고 입력란으로 포커스; 타입검사·빌드 및 Firebase Hosting 배포 확인 (`Ver 1.3.12`)
- [x] `4-18` 소품목 기준정보 저장 성공을 기다려 전 ZONE 0재고 품목 생성; 타 ZONE 이력 삭제 경고를 커스텀 모달로 표시 (`Ver 1.3.13`)
- [x] `4-19` 월별 보고서에서 `재고이월`을 기초재고 기준점으로 처리하고 거래 합계/필터에서 제외; 재고분석 누락 적정재고를 현재고 기준으로 처리하고 표·PDF를 A3 세로로 최적화 (`Ver 1.3.14`)
