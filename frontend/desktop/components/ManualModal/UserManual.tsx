import React from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  BookOpen,
  Boxes,
  FileSpreadsheet,
  LayoutDashboard,
  Layers,
  Package,
  Settings,
  ShieldCheck,
  Users,
  Warehouse,
} from 'lucide-react';
import { ManualPage, H1, H2, H3, P, Li, Code, Snapshot, Tip, Warning } from './SharedComponents';
import { APP_VERSION } from '../../constants';

interface UserManualProps {
  userRole?: string;
}

const UserManual: React.FC<UserManualProps> = ({ userRole }) => {
  const isAdmin = userRole === 'admin';

  if (!isAdmin) {
    return (
      <>
        <ManualPage pageNumber={1} totalPages={4}>
          <div>
            <H1>KDT 자재 재고관리 시스템 사용 매뉴얼</H1>
            <P>
              본 문서는 KDT 제조 현장의 작업자와 관리자 모두가 웹 브라우저에서 재고 현황을 확인하고,
              입고/출고를 정확하게 기록할 수 있도록 현재 시스템 기준으로 정리한 안내서입니다.
            </P>

            <H2>1. 시스템 접속과 로그인</H2>
            <P>
              접속 주소는 <Code>https://kdt-inventory.web.app/login</Code> 입니다. 계정 목록에서 본인 이름을
              선택하고 비밀번호를 입력한 뒤 <Code>시스템 접속</Code> 버튼을 누릅니다.
            </P>

            <Snapshot caption="로그인 화면 구성">
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-2 font-bold text-slate-800">
                    <BookOpen size={14} className="text-emerald-600" />
                    로그인 계정 선택
                  </div>
                  <p>등록된 사용자 목록에서 본인 계정을 선택합니다.</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-2 font-bold text-slate-800">
                    <ShieldCheck size={14} className="text-blue-600" />
                    권한 구분
                  </div>
                  <p>관리자 / 입고 담당 / 출고 담당 권한이 로그인 계정별로 표시됩니다.</p>
                </div>
              </div>
            </Snapshot>

            <Tip>
              김수현 팀장은 <strong>입고 전용</strong>, 나머지 현장 작업자는 <strong>출고 전용</strong>으로
              설정될 수 있으며, 관리자 계정은 모든 기능을 사용할 수 있습니다.
            </Tip>
          </div>
        </ManualPage>

        <ManualPage pageNumber={2} totalPages={4}>
          <div>
            <H2>2. 대시보드와 재고 현황</H2>
            <P>
              로그인 후 기본 화면은 <Code>대시보드</Code>입니다. 주요 통계와 최근 입출고 추이를 빠르게 확인한 뒤,
              <Code>재고 현황</Code> 메뉴에서 ZONE별 상세 품목을 조회합니다.
            </P>

            <H3>2.1. 재고 조회 기본 원칙</H3>
            <ul className="list-disc pl-5">
              <Li>모든 수량은 <strong>EA(최종 개수)</strong> 기준으로 관리됩니다.</Li>
              <Li>
                <Code>SET</Code>, <Code>BOX</Code> 단위는 화면에서 참고 환산값으로 병기됩니다.
              </Li>
              <Li>품목 식별은 보통 <strong>품명 + 도금 + 규격</strong> 조합으로 이루어집니다.</Li>
              <Li>같은 품명이라도 ZONE이 다르면 장부와 이력이 분리됩니다.</Li>
            </ul>

            <Snapshot caption="재고 화면에서 확인할 항목">
              <div className="grid grid-cols-3 gap-2 text-[10.5px]">
                <div className="rounded border border-slate-200 p-2 text-center">
                  <Warehouse size={16} className="mx-auto mb-1 text-indigo-600" />
                  ZONE(대분류)
                </div>
                <div className="rounded border border-slate-200 p-2 text-center">
                  <Package size={16} className="mx-auto mb-1 text-blue-600" />
                  품명 / 도금 / 규격
                </div>
                <div className="rounded border border-slate-200 p-2 text-center">
                  <Boxes size={16} className="mx-auto mb-1 text-emerald-600" />
                  현재고(EA) / 위치 / 비고
                </div>
              </div>
            </Snapshot>

            <Tip>
              상단 검색창에서는 품명뿐 아니라 도금, 규격, 보관위치, 비고까지 함께 검색할 수 있습니다.
            </Tip>
          </div>
        </ManualPage>

        <ManualPage pageNumber={3} totalPages={4}>
          <div>
            <H2>3. 입고 / 출고 등록</H2>
            <P>
              재고 화면에서 대상 품목을 선택한 뒤 입출고 모달에서 수량과 작업자를 입력합니다. 시스템은 거래
              저장 후 현재고를 즉시 갱신하고, 수불 이력을 남깁니다.
            </P>

            <H3>3.1. 기록 항목</H3>
            <ul className="list-disc pl-5">
              <Li>일자</Li>
              <Li>작업자</Li>
              <Li>품목</Li>
              <Li>수량</Li>
              <Li>입고 / 출고 구분</Li>
              <Li>부서/라인, 비고(참고 메모)</Li>
            </ul>

            <H3>3.2. KDT 운영 원칙</H3>
            <ul className="list-disc pl-5">
              <Li>재고 반영은 항상 <strong>실수량</strong> 기준입니다.</Li>
              <Li>비고는 포장 단위, 실검수 메모 등 참고 정보로만 사용합니다.</Li>
              <Li>육각볼트 SET 같은 묶음 품목도 실제 관리는 <strong>구성품별</strong>로 처리합니다.</Li>
            </ul>

            <Warning>
              출고 담당 계정에서는 입고 메뉴가 비활성화될 수 있고, 입고 담당 계정에서는 출고 메뉴가 비활성화될
              수 있습니다. 이는 의도된 권한 제어입니다.
            </Warning>
          </div>
        </ManualPage>

        <ManualPage pageNumber={4} totalPages={4}>
          <div>
            <H2>4. 엑셀 공동작업과 주의사항</H2>
            <P>
              KDT 시스템은 엑셀과 프로그램을 양방향으로 활용하는 구조입니다. 입고 원본 엑셀을 일괄 등록할 수
              있고, ZONE별 수불부와 현 재고 요약도 엑셀로 내보낼 수 있습니다.
            </P>

            <Snapshot caption="엑셀 관련 주요 메뉴">
              <div className="space-y-2 text-[11px]">
                <div className="flex items-center gap-2 rounded border border-slate-200 p-2">
                  <FileSpreadsheet size={14} className="text-green-600" />
                  <span>
                    <strong>일괄 등록</strong>: KDT 입고 엑셀을 읽어 품목을 등록합니다.
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded border border-slate-200 p-2">
                  <ArrowDownUp size={14} className="text-blue-600" />
                  <span>
                    <strong>수불부 등록</strong>: 일자별 수불부 기록을 가져옵니다.
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded border border-slate-200 p-2">
                  <Layers size={14} className="text-amber-600" />
                  <span>
                    <strong>공통자재 합산보기</strong>: ZONE 혼입 가능 품목의 전체 합산 재고를 확인합니다.
                  </span>
                </div>
              </div>
            </Snapshot>

            <Warning>
              같은 품명이라도 ZONE이 다르면 별도 품목처럼 관리됩니다. 엑셀 Import 전에는 ZONE, 품명, 도금,
              규격이 올바른지 먼저 확인해 주세요.
            </Warning>

            <P className="mt-4 text-[10px] text-slate-500">
              KDT Inventory System Ver {APP_VERSION}
            </P>
          </div>
        </ManualPage>
      </>
    );
  }

  return (
    <>
      <ManualPage pageNumber={1} totalPages={5}>
        <div>
          <H1>KDT 자재 재고관리 시스템 관리자 매뉴얼</H1>
          <P>
            관리자 매뉴얼은 KDT 시스템의 운영 기준, 사용자 권한, 기준정보, 데이터 이전, 보고서 활용까지 현재
            구축된 기능을 기준으로 정리한 문서입니다.
          </P>

          <H2>1. 시스템 개요</H2>
          <ul className="list-disc pl-5">
            <Li>ZONE 단위 자재 수불 및 재고 관리</Li>
            <Li>EA 정수 기준 수량 관리</Li>
            <Li>Cloud Functions + Firestore 실시간 연동</Li>
            <Li>입고/출고 담당자 권한 분리</Li>
            <Li>엑셀 Import / Export 양방향 지원</Li>
          </ul>

          <Snapshot caption="관리자 주요 기능">
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="rounded border border-slate-200 p-3">
                <div className="mb-1 flex items-center gap-2 font-bold">
                  <Users size={14} className="text-slate-700" /> 사용자 관리
                </div>
                권한, 비밀번호, 입출고 역할 관리
              </div>
              <div className="rounded border border-slate-200 p-3">
                <div className="mb-1 flex items-center gap-2 font-bold">
                  <Settings size={14} className="text-indigo-600" /> ZONE·기준정보 관리
                </div>
                ZONE 별칭, 정렬, 생산수량 메타 관리
              </div>
            </div>
          </Snapshot>
        </div>
      </ManualPage>

      <ManualPage pageNumber={2} totalPages={5}>
        <div>
          <H2>2. 사용자와 권한</H2>
          <P>현재 시스템은 관리자 / 입고 전용 / 출고 전용 권한을 구분하여 운영합니다.</P>

          <ul className="list-disc pl-5">
            <Li><strong>관리자</strong>: 전체 메뉴 접근, 사용자/기준정보/데이터 이전 가능</Li>
            <Li><strong>김수현 팀장</strong>: 입고 전용</Li>
            <Li><strong>현장 반장/조장/계장</strong>: 출고 전용</Li>
          </ul>

          <Tip>
            입출고 권한은 사용자관리에서 <Code>ALL</Code>, <Code>IN_ONLY</Code>, <Code>OUT_ONLY</Code>
            로 관리됩니다.
          </Tip>

          <H3>2.1. 운영 시 확인 사항</H3>
          <ul className="list-disc pl-5">
            <Li>관리자 계정은 시스템 유지보수용으로만 사용합니다.</Li>
            <Li>실무 입출고는 실제 담당자 계정으로 기록해야 이력 추적이 정확합니다.</Li>
            <Li>권한 설정이 바뀌면 로그인 화면과 입출고 모달에 즉시 반영됩니다.</Li>
          </ul>
        </div>
      </ManualPage>

      <ManualPage pageNumber={3} totalPages={5}>
        <div>
          <H2>3. 기준정보와 품목 구조</H2>
          <P>
            품목은 ZONE, 품명, 도금, 규격, 단위, 단위당 EA, 위치, 비고를 기준으로 관리합니다. 2차 과제를 위해
            생산수량 및 1대당 소요량 필드도 스키마에 선반영되어 있습니다.
          </P>

          <H3>3.1. 관리자 점검 포인트</H3>
          <ul className="list-disc pl-5">
            <Li>ZONE 표시명 변경 시 별칭 이력이 유지되는지 확인</Li>
            <Li>품목 정렬 순서와 카테고리 순서가 현장 기준과 맞는지 확인</Li>
            <Li>
              <Code>eaPerUnit</Code>, <Code>qtyPerProduct</Code>, <Code>setGroup</Code> 값이 필요한 품목에
              올바르게 입력되었는지 확인
            </Li>
          </ul>

          <Warning>
            육각볼트 SET은 BOM 자동계산 대상이 아니라, 구성품별 재고관리용 참고 그룹으로만 선반영되어 있습니다.
          </Warning>
        </div>
      </ManualPage>

      <ManualPage pageNumber={4} totalPages={5}>
        <div>
          <H2>4. 데이터 이전과 엑셀 운영</H2>
          <P>
            데이터 이전 모달에서는 초기 시드 적재, 백업/복원, 기준정보 포함 마이그레이션을 수행할 수 있습니다.
            엑셀 Import/Export는 KDT 운영 흐름과 연결되는 핵심 기능입니다.
          </P>

          <Snapshot caption="관리자용 운영 메뉴">
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center gap-2 rounded border border-slate-200 p-2">
                <LayoutDashboard size={14} className="text-blue-600" />
                대시보드: 위험재고와 ZONE별 현황 확인
              </div>
              <div className="flex items-center gap-2 rounded border border-slate-200 p-2">
                <FileSpreadsheet size={14} className="text-green-600" />
                일괄 등록 / 수불부 등록: 엑셀 데이터 반영
              </div>
              <div className="flex items-center gap-2 rounded border border-slate-200 p-2">
                <Warehouse size={14} className="text-indigo-600" />
                재고 현황: ZONE별 조회, 공통자재 합산보기, 정산 기능
              </div>
            </div>
          </Snapshot>

          <Tip>
            연도별 엑셀 내보내기는 기초 이월재고를 자동 계산하므로, 배포 전후로 템플릿과 내보내기 결과를 함께
            검증하는 것이 좋습니다.
          </Tip>
        </div>
      </ManualPage>

      <ManualPage pageNumber={5} totalPages={5}>
        <div>
          <H2>5. 운영 체크리스트</H2>
          <ul className="list-disc pl-5">
            <Li>빌드 전 <Code>Version.json</Code> 버전과 주석 확인</Li>
            <Li><Code>_Local_run_KDT.bat</Code> 또는 <Code>npm run build</Code> 로 사전 검증</Li>
            <Li><Code>_Cloud_run_KDT.bat</Code> 로 클린빌드 및 배포 수행</Li>
            <Li>배포 후 로그인 화면, 주요 API, 엑셀 내보내기 정상 여부 확인</Li>
            <Li>중요 변경 전에는 <Code>backup/VerX.Y.Z</Code> 로 로컬 백업 유지</Li>
          </ul>

          <Warning>
            현재 2차 과제로 남아 있는 항목은 <strong>목표 생산수량 × 1대당 소요량 기반 필요/부족 자재 자동 계산</strong>
            입니다. 스키마는 선반영되었지만 계산 로직은 별도 구현 대상입니다.
          </Warning>

          <P className="mt-4 text-[10px] text-slate-500">
            본 매뉴얼은 KDT Inventory System Ver {APP_VERSION} 기준으로 작성되었습니다.
          </P>
        </div>
      </ManualPage>
    </>
  );
};

export default UserManual;
