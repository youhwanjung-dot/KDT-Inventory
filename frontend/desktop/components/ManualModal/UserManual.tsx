import React from 'react';
import {
  Building2, ChevronDown, Lock, LayoutDashboard, Package, BarChart2, Search, Filter,
  FileSpreadsheet, Plus, Settings, AlertCircle, Wand2, Box, Users, History,
  CalendarCheck, Activity, User as UserIcon, Check, FileText, Download, Sparkles, RefreshCw,
  Printer, ArrowUpCircle, CheckSquare, ShieldCheck, BookOpen,
  ArrowDownRight, ArrowUpRight, Smartphone, HelpCircle, CheckCircle2, AlertTriangle, Layers, Tag,
  Clock, MapPin, Eye, MousePointerClick, CornerDownRight, XCircle, ArrowRight
} from 'lucide-react';
import { ManualPage, H1, H2, H3, P, Li, Code, Snapshot, Tip, Warning } from './SharedComponents';
import { APP_VERSION } from '../../constants';

interface UserManualProps {
  userRole?: string;
}

const UserManual: React.FC<UserManualProps> = ({ userRole }) => {
  const isAdmin = userRole === 'admin';

  // ── 일반 사용자용 매뉴얼 (전체 6페이지 구성: 실제 입출력 및 조회 단계별 상세 가이드) ───────
  if (!isAdmin) {
    return (
      <>
        {/* ── Page 1: 시작하기: 시스템 접속 및 로그인 ── */}
        <ManualPage pageNumber={1} totalPages={6}>
          <div className="mb-2">
            <H1>시스템 사용 매뉴얼 (일반 사용자용)</H1>
            <P>본 문서는 아산노블요양원 현장 종사자(요양보호사, 간호조무사, 사회복지사 등)가 웹 브라우저를 통해 재고관리 시스템에 간편하게 접속하고 업무에 활용하는 방법을 친절하게 안내합니다.</P>

            <H2>1. 시작하기: 시스템 접속 및 로그인 (로그인 세션)</H2>
            <P>스마트폰, 태블릿, PC 등 인터넷이 연결된 모든 기기에서 웹 브라우저로 접속합니다. 복잡한 아이디 타이핑 없이 등록된 계정 목록에서 본인의 실명을 터치하여 1초 만에 편리하게 접속할 수 있습니다.</P>
          </div>

          {/* 2단 그리드: 좌측 실물 크기 로그인 카드 + 우측 단계별 절차 및 모바일 활용 가이드 */}
          <div className="grid grid-cols-12 gap-4 items-start mb-2.5">
            {/* 좌측: 실물 로그인 목업 (col-span-5) */}
            <div className="col-span-5 bg-white rounded-xl shadow-xs border border-slate-300 overflow-hidden text-xs">
              <div className="bg-blue-600 py-3.5 px-4 text-center text-white">
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-1">
                  <Building2 size={20} className="text-white" />
                </div>
                <h2 className="text-sm font-bold text-white tracking-tight leading-tight">아산노블요양원</h2>
                <div className="text-[10px] text-blue-100 flex items-center justify-center gap-1.5 mt-0.5 font-medium">
                  <span>통합 재고관리 시스템</span>
                  <span className="bg-blue-500/80 px-1.5 py-0.2 rounded border border-blue-400/50 font-bold">Ver {APP_VERSION}</span>
                </div>
              </div>

              <div className="p-3.5 space-y-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">로그인 계정</label>
                  <div className="relative">
                    <UserIcon size={14} className="absolute left-2.5 top-2.5 text-blue-600" />
                    <div className="w-full pl-7 pr-3 py-1.5 border-2 border-blue-500 rounded-lg text-xs bg-white flex justify-between items-center font-bold text-slate-800">
                      <span>김요양 (요양보호사)</span>
                      <ChevronDown size={14} className="text-blue-500" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">비밀번호</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <div className="w-full pl-7 pr-3 py-1.5 border rounded-lg text-xs bg-slate-50 font-mono tracking-widest text-slate-700 flex items-center">
                      ••••••••
                    </div>
                  </div>
                </div>

                <div className="py-2.5 bg-blue-600 text-white text-center rounded-lg text-xs font-bold shadow-2xs hover:bg-blue-700 cursor-pointer">
                  시스템 접속
                </div>
              </div>

              <div className="py-2 px-3 bg-slate-50 border-t text-[9px] text-center text-slate-500 font-medium">
                ※ 초기 비밀번호: <strong className="text-blue-600 font-bold">1234</strong> (로그인 후 세션 자동 유지)
              </div>
            </div>

            {/* 우측: 단계별 절차 및 모바일 활용 가이드 (col-span-7) */}
            <div className="col-span-7 space-y-2.5">
              <div>
                <h3 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <CheckSquare size={14} className="text-blue-600" /> 1.1. 간편 로그인 4단계 상세 절차
                </h3>
                <ul className="list-decimal pl-4 space-y-1 text-[11px] text-slate-700 leading-[1.6]">
                  <li><strong>웹 브라우저 접속</strong>: PC/스마트폰 브라우저(크롬, 사파리, 엣지)로 시스템 주소에 접속합니다. (별도 앱 설치 불필요)</li>
                  <li><strong>본인 계정(이름/직책) 선택</strong>: '로그인 계정' 드롭다운을 터치하여 본인의 실명을 선택합니다. 마지막 접속 계정이 자동 기억됩니다.</li>
                  <li><strong>비밀번호 입력 및 접속</strong>: 초기 비밀번호 <Code>1234</Code>를 입력한 뒤 <strong className="text-blue-700">[시스템 접속]</strong> 버튼을 누릅니다.</li>
                  <li><strong>로그인 세션 자동 유지</strong>: 브라우저 창을 닫아도 로그인 상태가 유지되어 매번 번거롭게 재입력할 필요가 없습니다.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <Smartphone size={14} className="text-emerald-600" /> 1.2. 스마트폰/태블릿 현장 활용 팁
                </h3>
                <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/60 space-y-1 text-[10.5px] text-slate-700 leading-[1.6]">
                  <div className="flex items-start gap-1.5">
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded text-[9px] shrink-0">홈 화면 추가</span>
                    <span>브라우저 메뉴에서 <strong>'홈 화면에 추가'</strong>를 누르면 바탕화면에 바로가기 앱 아이콘이 생성되어 1초 만에 실행됩니다.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded text-[9px] shrink-0">현장 즉시 불출</span>
                    <span>어르신 케어 중 기저귀, 소독제, 위생장갑 등을 불출할 때 스마트폰으로 현장에서 즉시 수량을 차감할 수 있습니다.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 1.3 현장 실무자를 위한 접속 편의 가이드 */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-1.5 text-xs mb-2">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <Sparkles size={14} className="text-indigo-600" /> 1.3. 현장 실무자를 위한 시스템 접속 편의 가이드
            </h3>
            <div className="grid grid-cols-3 gap-2.5 text-[10px] text-slate-700">
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                <div className="font-bold text-blue-700 flex items-center gap-1 text-[11px]"><Smartphone size={13} /> 모바일 바로가기</div>
                <p className="text-slate-600 text-[10px] leading-[1.6]">안드로이드(크롬) 및 아이폰(사파리)에서 '홈 화면에 추가'를 등록하면 일반 앱처럼 즉시 열립니다.</p>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                <div className="font-bold text-emerald-700 flex items-center gap-1 text-[11px]"><Clock size={13} /> 자동 로그인 유지</div>
                <p className="text-slate-600 text-[10px] leading-[1.6]">창을 닫거나 단말기를 껐다 켜도 직전 로그인 세션이 보존되어 매번 번거로운 비밀번호 입력을 생략합니다.</p>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                <div className="font-bold text-purple-700 flex items-center gap-1 text-[11px]"><RefreshCw size={13} /> 실시간 다중 동기화</div>
                <p className="text-slate-600 text-[10px] leading-[1.6]">여러 직원이 각 층 생활실에서 동시에 입출고를 등록해도 클라우드 서버에 오차 없이 즉시 합산됩니다.</p>
              </div>
            </div>
          </div>

          {/* 1.4 현장 실무 문제 해결(FAQ) 및 지원 체계 (A4 85~90% 완벽 수렴) */}
          <div className="border border-slate-200 rounded-lg p-3 bg-emerald-50/30 space-y-1.5 text-xs">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <HelpCircle size={14} className="text-emerald-600" /> 1.4. 현장 실무 문제 해결(FAQ) 및 지원 체계
            </h3>
            <div className="grid grid-cols-2 gap-3 text-[10.5px] text-slate-700 leading-[1.6]">
              <div className="space-y-1">
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-800 shrink-0">• 비밀번호 분실 시:</span>
                  <span>비밀번호를 분실하였거나 변경이 필요한 경우 시설 관리자(원장실/사무실)에게 요청하시면 즉시 초기 비밀번호(<Code>1234</Code>)로 초기화해 드립니다.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-800 shrink-0">• 화면 글자가 작을 때:</span>
                  <span>스마트폰 화면이 작게 보일 경우 브라우저 메뉴의 텍스트 크기를 100%로 설정하시거나, 화면을 가로로 돌리면 시원하게 보실 수 있습니다.</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-blue-800 shrink-0">• 네트워크 단절 시:</span>
                  <span>와이파이 신호가 약해 일시적으로 끊겨도 입력 중인 내용은 보호되며, 신호가 복구되는 즉시 클라우드에 자동으로 안전하게 반영됩니다.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-purple-800 shrink-0">• 공용 단말기 사용 수칙:</span>
                  <span>간호사실 공용 PC나 태블릿을 이용하신 후에는 다른 직원의 원활한 업무를 위해 우측 상단의 [로그아웃]을 가볍게 눌러주시기 바랍니다.</span>
                </div>
              </div>
            </div>
          </div>
        </ManualPage>

        {/* ── Page 2: 메인 화면 및 대시보드 실시간 현황 파악 ── */}
        <ManualPage pageNumber={2} totalPages={6}>
          <H1>시스템 사용 매뉴얼 (일반 사용자용)</H1>
          <H2>2. 메인 대시보드: 실시간 재고 지표 및 긴급 수급 파악</H2>
          <P>로그인 직후 나타나는 첫 화면으로, 요양원 전체 비품 현황과 당장 채워 넣어야 하는 '부족/위험 재고'를 한눈에 모니터링할 수 있습니다.</P>

          <Snapshot caption="일반 사용자 대시보드: 요약 카드 및 긴급 수급 필요 목록 (0.1단위 정밀 표시)">
            <div className="flex flex-col bg-white border border-slate-300 rounded-lg overflow-hidden text-xs shadow-xs">
              <div className="h-8 bg-slate-50 border-b px-3 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-blue-600 text-xs">아산노블<span className="text-slate-400 font-normal">재고관리</span></span>
                  <span className="bg-slate-200 text-slate-700 px-1 py-0.2 rounded text-[9px] font-bold">대시보드</span>
                </div>
                <span className="text-[10px] font-bold text-slate-600">김요양 님 (요양보호사)</span>
              </div>

              <div className="p-2.5 space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-slate-50 p-1.5 rounded-lg border text-center">
                    <div className="text-[9px] text-slate-400">총 관리 품목</div>
                    <div className="text-sm font-extrabold text-blue-600">150개</div>
                  </div>
                  <div className="bg-red-50 p-1.5 rounded-lg border border-red-200 text-center">
                    <div className="text-[9px] text-red-500 font-bold flex items-center justify-center gap-0.5"><AlertCircle size={9} /> 부족/위험</div>
                    <div className="text-sm font-extrabold text-red-600">3개</div>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border text-center">
                    <div className="text-[9px] text-slate-400">오늘의 불출</div>
                    <div className="text-sm font-extrabold text-emerald-600">14건</div>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border text-center">
                    <div className="text-[9px] text-slate-400">동기화 상태</div>
                    <div className="text-sm font-extrabold text-purple-600">실시간</div>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-2.5 py-1 border-b border-red-100 flex items-center justify-between">
                    <span className="font-bold text-red-700 text-[10px] flex items-center gap-1">
                      <AlertTriangle size={11} className="text-red-600" /> 긴급 수급 필요 목록 (적정재고 미달 품목)
                    </span>
                    <span className="text-[8px] text-red-500 font-medium">소수점 0.1단위 통일</span>
                  </div>
                  <table className="w-full text-[9px] text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b">
                      <tr>
                        <th className="p-1">분류</th>
                        <th className="p-1">품목명 (규격)</th>
                        <th className="p-1 text-right">적정재고</th>
                        <th className="p-1 text-right">현재고</th>
                        <th className="p-1 text-right text-red-600">부족량</th>
                        <th className="p-1 text-center">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      <tr className="bg-red-50/40">
                        <td className="p-1"><span className="bg-blue-100 text-blue-700 px-1 py-0.2 rounded text-[8px] font-bold">위생용품</span></td>
                        <td className="p-1 font-bold text-slate-800">성인용 기저귀 (테이프 L - 30개입)</td>
                        <td className="p-1 text-right font-mono">20.0 팩</td>
                        <td className="p-1 text-right font-mono font-bold text-red-600">4.0 팩</td>
                        <td className="p-1 text-right font-mono font-bold text-red-600">-16.0 팩</td>
                        <td className="p-1 text-center"><span className="bg-red-600 text-white px-1.5 py-0.2 rounded text-[8px] font-bold">위험</span></td>
                      </tr>
                      <tr>
                        <td className="p-1"><span className="bg-emerald-100 text-emerald-700 px-1 py-0.2 rounded text-[8px] font-bold">의료소모품</span></td>
                        <td className="p-1 font-bold text-slate-800">손소독제 (겔형 500ml)</td>
                        <td className="p-1 text-right font-mono">10.0 병</td>
                        <td className="p-1 text-right font-mono font-bold text-red-600">1.5 병</td>
                        <td className="p-1 text-right font-mono font-bold text-red-600">-8.5 병</td>
                        <td className="p-1 text-center"><span className="bg-amber-500 text-white px-1.5 py-0.2 rounded text-[8px] font-bold">부족</span></td>
                      </tr>
                      <tr>
                        <td className="p-1"><span className="bg-orange-100 text-orange-700 px-1 py-0.2 rounded text-[8px] font-bold">주방용품</span></td>
                        <td className="p-1 font-bold text-slate-800">테이블 냅킨 (1,000매)</td>
                        <td className="p-1 text-right font-mono">5.0 묶음</td>
                        <td className="p-1 text-right font-mono font-bold text-amber-600">1.0 묶음</td>
                        <td className="p-1 text-right font-mono font-bold text-amber-600">-4.0 묶음</td>
                        <td className="p-1 text-center"><span className="bg-amber-500 text-white px-1.5 py-0.2 rounded text-[8px] font-bold">부족</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Snapshot>

          <H3>2.1. 대시보드 점검 요령 및 핵심 용어 안내</H3>
          <ul className="list-disc pl-5 space-y-1.5 text-[11.5px] leading-[1.6]">
            <Li><strong>출근 즉시 부족 재고 확인</strong>: 요양보호사 및 간호 직원은 생활실 케어에 들어가기 전 대시보드의 <strong className="text-red-600">부족/위험 재고</strong> 숫자를 확인합니다. 숫자가 1 이상이면 즉시 하단 목록을 보고 담당 생활실의 필수 물품이 소진되지 않았는지, 당장 보충이 필요한 품목은 없는지 확인합니다.</Li>
            <Li><strong>적정재고</strong>: 요양원 어르신의 원활한 케어를 위해 평소 창고에 최소한으로 보유해야 하는 기준 수량입니다. 이 수량을 밑돌게 되면 케어 공백이 발생할 수 있으므로 철저한 관리가 필요합니다.</Li>
            <Li><strong>현재고</strong>: 현재 요양원 보관 창고에 실제로 남아 있는 실시간 재고입니다. 입출고 등록 시 즉각적으로 변동 사항이 반영됩니다.</Li>
            <Li><strong>부족량</strong>: <Code>현재고 - 적정재고</Code>가 음수(-)일 때 시스템이 자동으로 긴급 발주 및 보충 필요 상태로 분류하여 경고 창에 표시합니다.</Li>
            <Li><strong>소수점 0.1 단위 정밀 표기</strong>: 박스나 팩 단위의 완제품뿐만 아니라 <Code>0.5 팩</Code>, <Code>1.5 병</Code> 등 일부 개봉하여 부분적으로 사용하는 물품의 잔량도 소수점 단위로 정확하고 오차 없이 관리할 수 있습니다.</Li>
          </ul>

          <div className="mt-4">
            <H3>2.2 대시보드 카드 색상별 상태 의미 안내</H3>
            <div className="grid grid-cols-4 gap-2.5 mt-2">
              <div className="bg-red-50 border border-red-200 p-2.5 rounded-lg shadow-sm">
                <div className="font-bold text-red-700 text-[10.5px] mb-1 flex items-center gap-1"><AlertCircle size={12}/>위험 (Red)</div>
                <p className="text-[10px] text-slate-700 leading-[1.6]">현재고가 적정재고에 크게 미달하여 당장 케어에 지장을 줄 수 있는 긴급 상태입니다. 즉각적인 보충 및 발주 요청이 필요합니다.</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg shadow-sm">
                <div className="font-bold text-amber-700 text-[10.5px] mb-1 flex items-center gap-1"><AlertTriangle size={12}/>부족 (Amber)</div>
                <p className="text-[10px] text-slate-700 leading-[1.6]">적정재고보다 현재고가 약간 모자란 상태입니다. 당장 소진되지는 않지만 근시일 내에 물품 채워넣기를 준비해야 합니다.</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg shadow-sm">
                <div className="font-bold text-emerald-700 text-[10.5px] mb-1 flex items-center gap-1"><CheckSquare size={12}/>정상 (Green)</div>
                <p className="text-[10px] text-slate-700 leading-[1.6]">재고가 충분히 확보되어 있어 안정적으로 사용할 수 있는 상태입니다. 평소 유지해야 하는 권장 수준을 나타냅니다.</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg shadow-sm">
                <div className="font-bold text-blue-700 text-[10.5px] mb-1 flex items-center gap-1"><Check size={12}/>정보 (Blue)</div>
                <p className="text-[10px] text-slate-700 leading-[1.6]">입고 완료, 동기화 상태 등 일반적인 알림성 지표입니다. 업무 진행에 참고할 수 있는 유용한 현황 데이터를 보여줍니다.</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <H3>2.3 교대근무 시 대시보드 활용 팁</H3>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg shadow-sm">
                <div className="font-bold text-slate-800 text-[10.5px] mb-1">주간 근무자 체크 포인트</div>
                <ul className="list-disc pl-4 text-[10px] text-slate-700 space-y-1 leading-[1.6]">
                  <li>오전 인수인계 시 대시보드의 '부족/위험' 물품을 확인하여 당일 케어에 필요한 물품을 창고에서 선제적으로 확보하세요.</li>
                  <li>주간에 납품된 물품을 즉시 입고 처리하여 다른 직원들이 실시간 재고를 파악할 수 있도록 유지하는 것이 중요합니다.</li>
                </ul>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg shadow-sm">
                <div className="font-bold text-slate-800 text-[10.5px] mb-1">야간 근무자 체크 포인트</div>
                <ul className="list-disc pl-4 text-[10px] text-slate-700 space-y-1 leading-[1.6]">
                  <li>야간에는 창고 접근이 제한될 수 있으므로, 교대 직후 대시보드를 통해 야간 케어 필수품(기저귀, 패드 등)의 잔량을 미리 점검하세요.</li>
                  <li>긴급히 사용한 비품은 잊지 말고 즉각 모바일이나 공용 PC로 출고를 등록하여 익일 아침 조간 근무자에게 정확한 재고를 인계해야 합니다.</li>
                </ul>
              </div>
            </div>
          </div>
        </ManualPage>

        {/* ── Page 3: 재고 현황 조회: 스마트 검색 및 분류 필터링 ── */}
        <ManualPage pageNumber={3} totalPages={6}>
          <H1>시스템 사용 매뉴얼 (일반 사용자용)</H1>
          <H2>3. 재고 현황 조회: 스마트 검색 및 다채로운 필터링</H2>
          <P>요양원에 구비된 150여 종의 비품 중 원하는 물품을 1초 만에 찾아내고 잔여 수량, 규격, 적정재고를 실시간으로 확인하는 방법입니다.</P>

          <Snapshot caption="재고 현황 화면: 대분류 탭, 실시간 키워드 검색, 빠른 상태 필터">
            <div className="bg-white border border-slate-300 rounded-lg p-2 space-y-1 text-xs shadow-xs">
              <div className="flex border-b text-[9.5px] font-bold gap-1 pb-1">
                <span className="px-2 py-0.5 rounded-t text-slate-500 bg-slate-100">전체 (150)</span>
                <span className="px-2 py-0.5 rounded-t bg-blue-600 text-white shadow-2xs">위생용품 (42)</span>
                <span className="px-2 py-0.5 rounded-t text-slate-500 bg-slate-100">의료소모품 (35)</span>
                <span className="px-2 py-0.5 rounded-t text-slate-500 bg-slate-100">식품/주방 (28)</span>
                <span className="px-2 py-0.5 rounded-t text-slate-500 bg-slate-100">사무/시설 (45)</span>
              </div>

              <div className="flex justify-between items-center gap-2 pt-0.5">
                <div className="flex items-center gap-1.5 flex-1">
                  <div className="relative flex-1 max-w-[170px]">
                    <Search size={11} className="absolute left-2 top-2 text-blue-500" />
                    <div className="w-full pl-6 pr-2 py-0.5 border-2 border-blue-500 rounded-md text-[10.5px] font-bold text-slate-800 bg-blue-50/20">
                      기저귀
                    </div>
                  </div>
                  <div className="border rounded-md px-1.5 py-0.5 bg-slate-50 text-[9px] font-medium text-slate-600">
                    소분류: 전체 ▾
                  </div>
                </div>
                <span className="bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-md text-[8.5px] font-bold flex items-center gap-1">
                  <CheckSquare size={10} className="text-red-600" /> 부족 재고만 보기
                </span>
              </div>

              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-[8.5px] text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                    <tr>
                      <th className="p-1">대분류</th>
                      <th className="p-1">소분류</th>
                      <th className="p-1">품목명 (규격)</th>
                      <th className="p-1 text-right">적정재고</th>
                      <th className="p-1 text-right">현재고</th>
                      <th className="p-1 text-center">상태</th>
                      <th className="p-1 text-center">현장 불출/입고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-red-50/30">
                      <td className="p-1 text-slate-500">위생용품</td>
                      <td className="p-1 text-slate-500">기저귀</td>
                      <td className="p-1 font-bold text-slate-800">성인용 기저귀 (테이프 L - 30개입)</td>
                      <td className="p-1 text-right font-mono">20.0 팩</td>
                      <td className="p-1 text-right font-mono font-bold text-red-600">4.0 팩</td>
                      <td className="p-1 text-center"><span className="bg-red-100 text-red-700 px-1 py-0.2 rounded text-[7.5px] font-bold">부족</span></td>
                      <td className="p-1 text-center">
                        <div className="flex justify-center gap-1 font-bold text-[7.5px]">
                          <span className="bg-blue-600 text-white px-1.5 py-0.2 rounded">+ 입고</span>
                          <span className="bg-red-600 text-white px-1.5 py-0.2 rounded">- 출고</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1 text-slate-500">위생용품</td>
                      <td className="p-1 text-slate-500">기저귀</td>
                      <td className="p-1 font-bold text-slate-800">안심 팬티형 기저귀 (XL - 20개입)</td>
                      <td className="p-1 text-right font-mono">15.0 팩</td>
                      <td className="p-1 text-right font-mono font-bold text-emerald-600">18.0 팩</td>
                      <td className="p-1 text-center"><span className="bg-emerald-100 text-emerald-700 px-1 py-0.2 rounded text-[7.5px] font-bold">정상</span></td>
                      <td className="p-1 text-center">
                        <div className="flex justify-center gap-1 font-bold text-[7.5px]">
                          <span className="bg-blue-600 text-white px-1.5 py-0.2 rounded">+ 입고</span>
                          <span className="bg-red-600 text-white px-1.5 py-0.2 rounded">- 출고</span>
                        </div>
                      </td>
                    </tr>
                    <tr className="bg-red-50/30">
                      <td className="p-1 text-slate-500">위생용품</td>
                      <td className="p-1 text-slate-500">패드</td>
                      <td className="p-1 font-bold text-slate-800">일자형 교체 패드 (60매입)</td>
                      <td className="p-1 text-right font-mono">30.0 팩</td>
                      <td className="p-1 text-right font-mono font-bold text-red-600">2.5 팩</td>
                      <td className="p-1 text-center"><span className="bg-red-100 text-red-700 px-1 py-0.2 rounded text-[7.5px] font-bold">위험</span></td>
                      <td className="p-1 text-center">
                        <div className="flex justify-center gap-1 font-bold text-[7.5px]">
                          <span className="bg-blue-600 text-white px-1.5 py-0.2 rounded">+ 입고</span>
                          <span className="bg-red-600 text-white px-1.5 py-0.2 rounded">- 출고</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Snapshot>

          <H3>3.1. 상황별 단계별 조회 가이드</H3>
          <ul className="list-disc pl-5 space-y-1.5 text-[11.5px] leading-[1.6]">
            <Li><strong>[상황 A] 특정 물품명을 바로 찾을 때 (스마트 실시간 검색)</strong>: 상단 검색창에 물품명의 핵심 단어(예: <Code>기저귀</Code>, <Code>장갑</Code>, <Code>에탄올</Code>)를 2글자 이상 입력합니다. 타이핑 즉시 결과가 화면에 실시간으로 필터링되어 나타나므로 매우 빠르게 물품을 찾을 수 있습니다.</Li>
            <Li><strong>[상황 B] 특정 부서의 비품만 모아볼 때 (대분류 탭 전환)</strong>: 상단의 카테고리 탭(위생용품, 의료소모품, 식품/주방 등)을 누르면 해당 부서 물품만 깔끔하게 정돈되어 표시됩니다. 부서별로 한 번에 물품을 파악하고 관리할 때 유용한 기능입니다.</Li>
            <Li><strong>[상황 C] 부족한 물품만 골라볼 때 (부족 재고 필터)</strong>: 우측 상단의 <strong className="text-red-600">[부족 재고만 보기]</strong>를 체크하면, 현재고가 부족한 위험 품목들만 모아서 확인 가능합니다. 발주 목록을 작성하거나 긴급 보충이 필요할 때 반드시 활용해보세요.</Li>
          </ul>

          <div className="mt-4">
            <H3>3.2 소분류 카테고리 활용법</H3>
            <div className="grid grid-cols-3 gap-2.5 mt-2">
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg shadow-sm">
                <div className="font-bold text-blue-700 text-[10.5px] mb-1">위생용품 소분류</div>
                <p className="text-[10px] text-slate-700 leading-[1.6]">대분류 '위생용품' 내에서도 <strong>[기저귀, 패드, 물티슈, 세정제]</strong> 등으로 세분화됩니다. 특정 종류의 위생품만 모아볼 때 소분류 드롭다운을 선택하면 훨씬 빠릅니다.</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg shadow-sm">
                <div className="font-bold text-emerald-700 text-[10.5px] mb-1">의료소모품 소분류</div>
                <p className="text-[10px] text-slate-700 leading-[1.6]"><strong>[소독제, 장갑, 거즈/밴드, 기타의료]</strong> 등으로 나뉩니다. 간호 처치 준비 시 소분류별로 필터링하여 빠진 처치 도구가 없는지 점검하는 데 효과적입니다.</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg shadow-sm">
                <div className="font-bold text-orange-700 text-[10.5px] mb-1">사무/시설 소분류</div>
                <p className="text-[10px] text-slate-700 leading-[1.6]"><strong>[필기구, 복사용지, 청소도구, 비품]</strong> 등 광범위한 품목을 소분류로 묶어 관리합니다. 연말이나 월말 재물조사 시 영역별로 나누어 파악할 수 있어 편리합니다.</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <H3>3.3 스마트폰 검색 시 유용한 팁</H3>
            <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg shadow-sm mt-2">
              <ul className="list-disc pl-4 text-[10.5px] text-slate-700 space-y-1.5 leading-[1.6]">
                <li><strong>초성 검색 지원</strong>: 물품의 전체 이름을 입력하기 어려울 때 'ㄱㅈㄱ'만 쳐도 '기저귀'가 검색되도록 스마트 검색이 지원되어 타이핑 시간을 단축해 줍니다.</li>
                <li><strong>음성 검색 활용</strong>: 스마트폰 키보드의 마이크 버튼을 눌러 "물티슈"라고 말하면, 텍스트로 자동 변환되어 이동 중에도 손쉽게 재고를 조회할 수 있습니다.</li>
                <li><strong>최근 검색어 제공</strong>: 검색창을 터치하면 내가 최근에 자주 찾았던 물품명들이 나타나므로, 반복적으로 사용하는 비품은 검색어를 칠 필요 없이 한 번의 터치로 접근할 수 있습니다.</li>
              </ul>
            </div>
          </div>
        </ManualPage>

        {/* ── Page 4: [실전 입출고 ①] 물품 출고(사용) 단계별 상세 상황 ── */}
        <ManualPage pageNumber={4} totalPages={6}>
          <H1>시스템 사용 매뉴얼 (일반 사용자용)</H1>
          <H2>4. [실전 가이드] 물품 출고(사용) 등록 단계별 절차</H2>
          <P>생활실이나 치료실에서 소모품을 꺼내어 사용할 때, 재고를 차감 기록하는 현장 실무 단계입니다. 모달창을 통해 10초 안에 완료할 수 있습니다.</P>

          <Snapshot caption="물품 출고(사용) 등록 모달 실제 상황 (수량, 사용처, 사유 입력)">
            <div className="bg-white rounded-lg shadow-sm border border-slate-300 max-w-sm mx-auto overflow-hidden text-xs">
              <div className="bg-slate-800 text-white px-2.5 py-1.5 flex justify-between items-center">
                <span className="font-bold flex items-center gap-1 text-[10.5px]">
                  <Package size={11} className="text-blue-400" /> 입출고 등록: 성인용 기저귀 (테이프 L)
                </span>
                <span className="text-slate-400 font-bold text-[10px]">✕</span>
              </div>

              <div className="bg-blue-50 px-2.5 py-1 border-b border-blue-100 flex items-center justify-between text-[9.5px]">
                <span className="text-slate-600">현재고: <strong className="text-slate-900 font-mono">14.5 팩</strong></span>
                <span className="text-blue-600 font-bold">➔</span>
                <span className="text-slate-600">출고 후 예상: <strong className="text-blue-700 font-mono font-bold">12.5 팩</strong> (정상)</span>
              </div>

              <div className="p-2 space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-red-600 text-white py-1 text-center font-bold rounded shadow-2xs flex items-center justify-center gap-1 text-[10px]">
                    <ArrowDownRight size={11} /> 출고 (-Out) [사용]
                  </div>
                  <div className="bg-slate-100 text-slate-500 py-1 text-center font-bold rounded flex items-center justify-center gap-1 text-[10px]">
                    <ArrowUpRight size={11} /> 입고 (+In) [납품]
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[9.5px] font-bold text-slate-700">1. 출고 수량 입력 <span className="text-red-500">*</span></span>
                    <div className="flex gap-1 text-[8px] font-bold">
                      <span className="px-1 bg-slate-100 text-slate-700 border rounded">+0.5</span>
                      <span className="px-1 bg-slate-100 text-slate-700 border rounded">+1.0</span>
                      <span className="px-1 bg-red-100 text-red-700 border border-red-300 rounded font-extrabold">+2.0 (선택)</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-full border-2 border-red-500 rounded py-0.5 px-2 text-right font-mono font-extrabold text-sm text-red-600 bg-red-50/20 leading-none flex items-center justify-end">
                      2.0
                    </div>
                    <span className="px-2 py-0.5 bg-slate-100 border rounded font-bold text-slate-700 flex items-center text-[10px]">팩</span>
                  </div>
                </div>

                <div>
                  <label className="text-[9.5px] font-bold text-slate-700 block mb-0.5">2. 사용처 / 불출 생활실 <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <MapPin size={10} className="absolute left-2 top-1.5 text-slate-400" />
                    <div className="w-full pl-5 pr-2 py-0.5 border rounded bg-white flex justify-between items-center text-slate-800 font-bold text-[10px]">
                      <span>2층 사랑방 (생활실)</span>
                      <ChevronDown size={11} className="text-slate-400" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[8.5px] font-bold text-slate-700 block mb-0.5">3. 불출 담당자</label>
                    <div className="p-0.5 border rounded bg-slate-50 font-bold text-slate-700 text-[9.5px]">김요양 (요양보호사)</div>
                  </div>
                  <div>
                    <label className="text-[8.5px] font-bold text-slate-700 block mb-0.5">4. 출고 사유 / 비고</label>
                    <div className="p-0.5 border rounded bg-white text-slate-700 truncate text-[9.5px]">어르신 야간 케어용 보충</div>
                  </div>
                </div>

                <div className="pt-1 border-t">
                  <div className="w-full py-1 bg-blue-600 text-white text-center rounded font-bold shadow-2xs cursor-pointer flex items-center justify-center gap-1 text-[10.5px]">
                    <Check size={12} /> 출고 등록 완료 (Enter)
                  </div>
                </div>
              </div>
            </div>
          </Snapshot>

          <H3>4.1. 출고 등록 4단계 실전 가이드</H3>
          <ul className="list-decimal pl-5 space-y-1.5 text-[11.5px] leading-[1.6]">
            <Li><strong>[1단계] 출고 버튼 클릭</strong>: 재고 현황 목록에서 출고할 품목 우측의 <strong className="text-red-600 font-bold">[- 출고]</strong> 버튼을 누릅니다. 모바일에서는 항목을 터치한 후 나타나는 팝업에서 선택합니다.</Li>
            <Li><strong>[2단계] 탭 확인 및 수량 입력</strong>: 붉은색 <strong className="text-red-600 font-bold">[출고 (-Out)]</strong> 탭이 활성화되어 있는지 확인한 후 수량을 입력합니다. (예: 완제품 2팩이면 <Code>2</Code>, 반 팩 정도 덜어서 쓴다면 <Code>0.5</Code>를 입력하거나 화면의 빠른 버튼을 터치하여 숫자를 맞춥니다.)</Li>
            <Li><strong>[3단계] 사용처/생활실 선택</strong>: 물품이 실제 사용될 장소나 생활실(예: <Code>1층 희망방</Code>, <Code>2층 사랑방</Code>)을 드롭다운에서 정확히 선택합니다. 이는 국민건강보험공단 평가 및 비품 사용처 추적에 필수적인 데이터가 됩니다.</Li>
            <Li><strong>[4단계] 저장 완료</strong>: 파란색 <strong className="text-blue-700 font-bold">[출고 등록 완료]</strong> 버튼을 마우스로 클릭하거나 키보드의 <Code>Enter</Code> 키를 누르면 즉시 시스템에 반영되어 현재고가 차감됩니다.</Li>
          </ul>

          <div className="mt-4">
            <H3>4.2 빠른 수량 버튼 활용 및 0.1단위 정밀 입력 요령</H3>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg shadow-sm">
                <div className="font-bold text-slate-800 text-[10.5px] mb-1">빠른 수량 버튼 (+0.5, +1.0)</div>
                <p className="text-[10px] text-slate-700 leading-[1.6]">키보드 입력 대신 화면에 있는 <Code>+0.5</Code>, <Code>+1.0</Code>, <Code>+2.0</Code> 버튼을 터치하여 빠르게 수량을 더할 수 있습니다. 바쁜 현장에서 장갑을 낀 상태라도 모바일 기기의 터치 한두 번으로 출고 수량 설정이 끝나므로 업무 부담이 크게 줄어듭니다.</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg shadow-sm">
                <div className="font-bold text-slate-800 text-[10.5px] mb-1">0.1단위 소수점 정밀 입력법</div>
                <p className="text-[10px] text-slate-700 leading-[1.6]">대용량 로션이나 락스 등을 통째로 불출하지 않고 절반만 덜어갈 경우 <Code>0.5</Code>, 약 30%만 사용할 경우 <Code>0.3</Code>으로 입력하세요. 실제 창고 재고와 장부상 재고의 오차를 없애어 보다 정밀한 비용 관리가 가능해집니다.</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <H3>4.3 출고 후 확인 절차 및 주의사항</H3>
            <div className="grid grid-cols-3 gap-2.5 mt-2">
              <div className="bg-red-50 border border-red-200 p-2.5 rounded-lg shadow-sm">
                <div className="font-bold text-red-700 text-[10.5px] mb-1">재고 경고 즉각 확인</div>
                <p className="text-[10px] text-slate-700 leading-[1.6]">출고 완료 후 화면 상단에 '위험 재고 도달' 알림이 뜨면 해당 품목이 아슬아슬한 상태라는 뜻입니다. 즉시 관리자에게 구두나 메신저로 발주를 요청하세요.</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg shadow-sm">
                <div className="font-bold text-amber-700 text-[10.5px] mb-1">이중 출고 방지 주의</div>
                <p className="text-[10px] text-slate-700 leading-[1.6]">동료가 이미 출고 등록한 건을 내가 다시 등록하지 않도록 유의해야 합니다. 헷갈릴 때는 수불 이력을 먼저 확인하여 중복 입력을 예방하시기 바랍니다.</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg shadow-sm">
                <div className="font-bold text-blue-700 text-[10.5px] mb-1">비고란 적극 활용법</div>
                <p className="text-[10px] text-slate-700 leading-[1.6]">특이 사항이 있을 시 비고란에 "어르신 설사로 대량 소모", "파손으로 인한 교체" 등 사유를 적어두면 향후 소모량 급증 원인을 분석할 때 훌륭한 자료가 됩니다.</p>
              </div>
            </div>
          </div>
        </ManualPage>

        {/* ── Page 5: [실전 입출고 ②] 물품 입고(납품) 등록 및 입력 오류 정정 ── */}
        <ManualPage pageNumber={5} totalPages={6}>
          <H1>시스템 사용 매뉴얼 (일반 사용자용)</H1>
          <H2>5. [실전 가이드] 물품 입고(납품) 등록 및 오기입 정정</H2>
          <P>정기 납품 물품이 도착했을 때 재고를 입고 가산하는 방법과, 실수로 잘못 등록했을 때 바로잡는 요령을 안내합니다.</P>

          <Snapshot caption="물품 입고 등록 모달 & 수량 오기입 시 역방향 상계 정정 방법">
            <div className="grid grid-cols-12 gap-2 text-xs">
              <div className="col-span-7 bg-white border border-slate-300 rounded-lg p-2 space-y-1 shadow-2xs">
                <div className="font-bold border-b pb-0.5 text-blue-700 flex items-center gap-1 text-[10.5px]">
                  <ArrowUpRight size={11} className="text-blue-600" /> [입고 등록] 소독용 에탄올 (500ml)
                </div>
                <div className="bg-blue-50 p-1 rounded text-[8.5px] flex justify-between font-mono">
                  <span>현재고: 1.5 병</span>
                  <span className="text-blue-700 font-bold">입고 후: 11.5 병 (충족)</span>
                </div>
                <div className="space-y-0.5 text-[8.5px]">
                  <div>
                    <label className="text-slate-600 font-bold block">입고 수량 (+In)</label>
                    <div className="flex gap-1">
                      <div className="w-full border border-blue-400 rounded p-0.5 text-right font-mono font-bold text-blue-600 bg-blue-50/20">
                        10.0
                      </div>
                      <span className="bg-slate-100 p-0.5 rounded font-bold">병</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-600 font-bold block">구입처 / 거래처</label>
                    <div className="border rounded p-0.5 bg-white font-medium">동아메디칼 (정기납품)</div>
                  </div>
                  <div>
                    <label className="text-slate-600 font-bold block">입고 비고 메모</label>
                    <div className="border rounded p-0.5 bg-white text-slate-500">2026년 9월 정기 소모품 입고</div>
                  </div>
                </div>
                <div className="py-1 bg-blue-600 text-white text-center rounded font-bold cursor-pointer text-[9.5px]">
                  입고 등록 완료 (Enter)
                </div>
              </div>

              <div className="col-span-5 bg-amber-50/70 border border-amber-200 rounded-lg p-1.5 space-y-1">
                <div className="font-bold text-amber-900 flex items-center gap-1 border-b border-amber-200 pb-0.5 text-[9.5px]">
                  <AlertCircle size={10} className="text-amber-600" /> 오기입 정정 요령
                </div>
                <div className="text-[8.5px] space-y-1 text-slate-700">
                  <div className="p-1 bg-white rounded border border-red-200">
                    <span className="text-red-600 font-bold">❌ 잘못 입력된 출고건</span>
                    <p className="text-[8px] text-slate-600">실제 2팩 출고인데 <strong className="text-red-600 font-bold">20팩</strong>으로 오타 등록</p>
                  </div>
                  <div className="text-center text-amber-600 font-bold text-[8px]">▼ [해결책: 역방향 상계 입고]</div>
                  <div className="p-1 bg-white rounded border border-blue-200">
                    <span className="text-blue-600 font-bold">⭕ 정정 입고 등록</span>
                    <p className="text-[8px] text-slate-600">즉시 <strong className="text-blue-600 font-bold">+18팩 입고</strong> 등록 후 비고에 <Code>[오기입 정정]</Code> 기재</p>
                  </div>
                  <div className="p-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[7.5px] text-center">
                    ➔ 실재고와 장부 재고가 즉시 일치됨!
                  </div>
                </div>
              </div>
            </div>
          </Snapshot>

          <H3>5.1. 물품 입고 및 실수 정정 핵심 원칙</H3>
          <ul className="list-disc pl-5 space-y-1.5 text-[11.5px] leading-[1.6]">
            <Li><strong>신규 물품 도착 시 입고 등록</strong>: 택배나 납품 트럭으로 비품이 도착하면 내용물을 확인한 뒤, 재고 목록에서 해당 품목의 파란색 <strong className="text-blue-700 font-bold">[+ 입고]</strong> 버튼을 누르고 납품된 수량과 구입처(예: 동아메디칼, 쿠팡 등)를 정확히 입력합니다.</Li>
            <Li><strong>수량을 잘못 입력했을 때의 대처법 (★중요★)</strong>:
              데이터의 투명성과 무결성을 보장하기 위해 일반 사용자는 과거 입출고 내역을 직접 삭제할 수 없습니다. 따라서 <strong>'잘못 입력한 차액만큼 반대 거래'</strong>를 진행하여 상계 처리해야 합니다. 실수로 출고를 많이 잡았다면 그만큼 다시 입고를 잡고, 비고란에 반드시 <Code>[오기입 정정]</Code>이라고 적어주세요.
            </Li>
            <Li><strong>관리자 문의 및 권한</strong>: 품목을 완전히 잘못 선택하여 엉뚱한 물품의 재고가 틀어졌거나 상황이 복잡한 경우, 즉시 시설 관리자에게 요청하시면 관리자 도구의 '수정/삭제 권한'으로 깔끔하게 정정해 드립니다.</Li>
          </ul>

          <div className="mt-4">
            <H3>5.2 정기 납품 물품 입고 등록 절차</H3>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg shadow-sm mt-2">
              <ol className="list-decimal pl-4 text-[10.5px] text-slate-700 space-y-1.5 leading-[1.6]">
                <li><strong>명세서와 실물 대조</strong>: 납품업체에서 전달한 거래명세서 상의 수량과 실제 창고에 적재된 실물 박스의 수량이 정확히 일치하는지 먼저 확인합니다.</li>
                <li><strong>단위 환산 주의</strong>: 명세서에는 '1박스(10팩)'로 되어 있지만 시스템 상 최소 관리 단위가 '팩'이라면, 입고 수량을 '1'이 아닌 '10'으로 입력해야 합니다. 단위를 헷갈리지 않도록 주의하세요.</li>
                <li><strong>입고 등록 및 메모</strong>: 탭에서 <strong>[입고 (+In)]</strong>를 선택하고 총 수량을 기입한 뒤, 비고란에 "9월 정기납품"과 같이 납품 일자나 특이사항을 간략히 메모하고 저장합니다.</li>
              </ol>
            </div>
          </div>

          <div className="mt-4">
            <H3>5.3 수량 오기입 예방 수칙 및 자가 검증 체크리스트</H3>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg shadow-sm">
                <div className="font-bold text-red-800 text-[10.5px] mb-1 flex items-center gap-1">❌ 오기입 발생의 흔한 예시</div>
                <p className="text-[10px] text-slate-700 leading-[1.6] mb-2">바쁜 현장에서 키패드를 잘못 눌러 '2'를 입력할 것을 '20'이나 '22'로 연타하는 경우가 가장 빈번합니다. 또한 출고 탭과 입고 탭의 방향을 혼동하는 경우도 많습니다.</p>
                <div className="text-[9px] bg-white p-1.5 rounded border border-red-100 text-slate-600">
                  <span className="font-bold text-red-600">오류 케이스:</span> 2팩 사용 후 급한 마음에 '22팩'으로 출고 입력 ➔ 창고 재고가 순식간에 마이너스(-) 상태로 추락함.
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg shadow-sm">
                <div className="font-bold text-emerald-800 text-[10.5px] mb-1 flex items-center gap-1">✅ 등록 전 3초 확인 체크리스트</div>
                <p className="text-[10px] text-slate-700 leading-[1.6] mb-2">저장 버튼(Enter)을 누르기 직전, 팝업창 상단에 표시되는 <strong>[출고/입고 후 예상 재고]</strong> 숫자를 3초만 확인하면 대부분의 실수를 예방할 수 있습니다.</p>
                <div className="text-[9px] bg-white p-1.5 rounded border border-emerald-100 text-slate-600">
                  <span className="font-bold text-emerald-600">올바른 검증:</span> '현재고 14.5 ➔ 출고 후 예상 12.5'라는 숫자가 상식적으로 맞는지 눈으로 확인 후 등록 완료 버튼 클릭.
                </div>
              </div>
            </div>
          </div>
        </ManualPage>

        {/* ── Page 6: 수불 이력 조회, 모바일 현장 활용 및 FAQ ── */}
        <ManualPage pageNumber={6} totalPages={6}>
          <H1>시스템 사용 매뉴얼 (일반 사용자용)</H1>
          <H2>6. 수불 이력 확인, 모바일 현장 활용 및 자주 묻는 질문</H2>
          <P>내가 등록한 입출고 내역을 확인하는 방법과 스마트폰 바로가기 설치법, 현장에서 자주 발생하는 궁금증을 정리했습니다.</P>

          <Snapshot caption="최근 수불 이력 확인 및 스마트폰 모바일 화면">
            <div className="grid grid-cols-12 gap-2 text-xs">
              <div className="col-span-8 bg-white border border-slate-300 rounded-lg p-1.5 space-y-1 shadow-2xs">
                <div className="font-bold text-slate-800 text-[9.5px] flex items-center justify-between border-b pb-0.5">
                  <span className="flex items-center gap-1"><History size={10} className="text-blue-600" /> 최근 수불 이력 실시간 내역</span>
                  <span className="text-[7.5px] text-slate-400">자동 저장됨</span>
                </div>
                <table className="w-full text-[8px] text-left">
                  <thead className="bg-slate-50 font-bold border-b text-slate-600">
                    <tr><th className="p-0.5">일시</th><th className="p-0.5">구분</th><th className="p-0.5">품목명</th><th className="p-0.5 text-right">수량</th><th className="p-0.5 text-right">잔여고</th><th className="p-0.5">담당</th><th className="p-0.5">비고</th></tr>
                  </thead>
                  <tbody className="divide-y font-sans">
                    <tr>
                      <td className="p-0.5 text-slate-400 font-mono">09-25 10:30</td>
                      <td className="p-0.5"><span className="bg-red-100 text-red-700 px-1 py-0.2 rounded font-bold">출고</span></td>
                      <td className="p-0.5 font-bold">기저귀 (L)</td>
                      <td className="p-0.5 text-right font-mono font-bold text-red-600">-2.0</td>
                      <td className="p-0.5 text-right font-mono">12.5</td>
                      <td className="p-0.5">김요양</td>
                      <td className="p-0.5 text-slate-500">사랑방 보충</td>
                    </tr>
                    <tr className="bg-blue-50/30">
                      <td className="p-0.5 text-slate-400 font-mono">09-25 10:17</td>
                      <td className="p-0.5"><span className="bg-blue-100 text-blue-700 px-1 py-0.2 rounded font-bold">입고</span></td>
                      <td className="p-0.5 font-bold">기저귀 (L)</td>
                      <td className="p-0.5 text-right font-mono font-bold text-blue-600">+18.0</td>
                      <td className="p-0.5 text-right font-mono">14.5</td>
                      <td className="p-0.5">김요양</td>
                      <td className="p-0.5 text-blue-600 font-bold">[오기입 정정]</td>
                    </tr>
                    <tr>
                      <td className="p-0.5 text-slate-400 font-mono">09-25 09:15</td>
                      <td className="p-0.5"><span className="bg-blue-100 text-blue-700 px-1 py-0.2 rounded font-bold">입고</span></td>
                      <td className="p-0.5 font-bold">소독에탄올</td>
                      <td className="p-0.5 text-right font-mono font-bold text-blue-600">+10.0</td>
                      <td className="p-0.5 text-right font-mono">11.5</td>
                      <td className="p-0.5">박간호</td>
                      <td className="p-0.5 text-slate-500">정기납품</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="col-span-4 bg-slate-900 p-1.5 rounded-lg shadow-xs border border-slate-700 text-[8px] text-white">
                <div className="text-center text-[7px] text-slate-400 border-b border-slate-800 pb-0.5 mb-1 flex items-center justify-between">
                  <span>●●● LTE</span>
                  <span className="font-bold text-white">아산노블 재고</span>
                  <span>100% 🔋</span>
                </div>
                <div className="bg-slate-800 rounded p-1 space-y-0.5">
                  <div className="text-[8.5px] font-bold text-blue-300 flex items-center gap-0.5">
                    <Smartphone size={9} /> 모바일 현장 불출
                  </div>
                  <div className="bg-slate-700 p-0.5 rounded flex justify-between items-center">
                    <span className="font-bold text-white text-[7.5px]">기저귀 (L)</span>
                    <span className="bg-red-500 text-white px-1 py-0.2 rounded font-bold text-[7px]">- 출고</span>
                  </div>
                  <div className="text-[7px] text-slate-400 text-center">
                    터치 한 번으로 현장 즉시 입력!
                  </div>
                </div>
              </div>
            </div>
          </Snapshot>

          <H3>6.1. 수불 이력 조회 및 기간별 필터링 방법</H3>
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg shadow-sm mt-1 mb-4">
            <ul className="list-disc pl-4 text-[10.5px] text-slate-700 space-y-1.5 leading-[1.6]">
              <li><strong>날짜별/기간별 조회</strong>: 상단의 달력 아이콘을 눌러 '오늘', '이번 주', '이번 달' 등 원하는 기간을 선택하면 해당 기간 내의 모든 입출고 흐름을 꼼꼼히 추적할 수 있습니다.</li>
              <li><strong>품목별/담당자별 필터링</strong>: 검색창에 '기저귀'를 치면 기저귀의 변동 이력만 나타나고, 내 이름(예: '김요양')을 검색하면 내가 직접 등록한 최근 업무 내역만 모아서 확인 및 점검이 가능합니다.</li>
            </ul>
          </div>

          <H3>6.2. 현장 실무자를 위한 자주 묻는 질문 (FAQ)</H3>
          <div className="space-y-2 text-[11px] leading-[1.6]">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <strong className="text-blue-700 block mb-1">Q1. 스마트폰이나 개인 태블릿에서도 바로 사용할 수 있나요? 앱을 깔아야 하나요?</strong>
              <p className="text-slate-600">별도의 복잡한 앱 설치가 전혀 필요 없는 100% 모바일 반응형 웹 시스템입니다. 스마트폰 브라우저(크롬, 사파리 등)의 설정 메뉴에서 <strong className="font-bold text-slate-800">[홈 화면에 추가]</strong>를 누르시면 스마트폰 바탕화면에 앱처럼 바로가기 아이콘이 생성되어, 원할 때 터치 한 번으로 빠르게 접속할 수 있습니다.</p>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <strong className="text-blue-700 block mb-1">Q2. 물품을 사용하려고 보니 수량이 마이너스(-)로 되어 있습니다. 왜 그런가요?</strong>
              <p className="text-slate-600">출고 수량이 시스템 상의 현재고보다 많을 경우, 음수로 표기되며 붉은색 경고가 나타납니다. 실제 창고에는 물건이 멀쩡히 있는데 시스템만 마이너스로 나온다면, 이는 이전에 납품되었던 물품의 '입고 등록' 절차가 누락되었기 때문입니다. 즉시 관리자에게 입고 내역 확인과 등록을 요청하시기 바랍니다.</p>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <strong className="text-blue-700 block mb-1">Q3. 목록에 아예 없는 새로운 종류의 물품을 추가해서 쓰고 싶을 때는 어떻게 하나요?</strong>
              <p className="text-slate-600">일반 사용자 계정에서는 품목이 무분별하게 중복 등록되는 것을 방지하기 위해 신규 품목 추가 기능이 제한되어 있습니다. 새로운 비품이 들어왔다면 시설 관리자나 사무국에 품목명과 규격(단위)을 알려주시면, 관리자가 표준화된 양식으로 즉시 시스템에 신규 등록해 드립니다.</p>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <strong className="text-blue-700 block mb-1">Q4. 업무를 마치고 꼭 우측 상단의 로그아웃 버튼을 눌러야 하나요?</strong>
              <p className="text-slate-600">간호사실이나 데스크에 비치된 공용 PC 및 태블릿은 다음 교대근무자를 위해 업무 종료 후 반드시 <strong className="text-slate-700 font-bold">[로그아웃]</strong>을 하시는 것이 원칙입니다. 다만, 본인의 개인 스마트폰으로만 접속해 사용하시는 경우에는 로그인 상태를 계속 유지하셔도 보안상 안전하며 접속이 훨씬 간편해집니다.</p>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <strong className="text-blue-700 block mb-1">Q5. 한 번에 여러 가지 품목을 동시에 출고(장바구니 기능 등)할 수 있나요?</strong>
              <p className="text-slate-600">현재 버전에서는 정확한 사용처 추적과 빠른 현장 입력을 위해 한 품목씩 개별적으로 출고를 등록하도록 최적화되어 있습니다. 목록에서 항목별로 [- 출고] 버튼을 연달아 누르는 방식이 훨씬 신속하고 오류를 줄일 수 있도록 설계되었습니다.</p>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <strong className="text-blue-700 block mb-1">Q6. 바빠서 다른 직원에게 제 아이디로 출고 입력을 대신 부탁해도 되나요?</strong>
              <p className="text-slate-600">수불 이력에는 로그인한 직원의 이름이 담당자로 영구 기록되므로, 책임 소재를 명확히 하기 위해 원칙적으로 본인 계정으로 직접 입력하셔야 합니다. 부득이하게 대리 입력을 할 경우에는 비고란에 실제 불출자의 이름을 반드시 명시해 주시기 바랍니다.</p>
            </div>
          </div>
        </ManualPage>
      </>
    );
  }

  // ── 관리자 전용 매뉴얼 (전체 9페이지 구성) ─────────────────────────────
  return (
    <>
      {/* ── Page 1: 시작하기: 로그인 ────────────────────────────────────────── */}
      <ManualPage pageNumber={1} totalPages={9}>
        <div className="mb-2">
          <H1>시스템 기능 매뉴얼 (관리자용)</H1>
          <P>본 문서는 아산노블요양원 종합 관리 시스템(재고/어르신 이력/기능회복훈련/근무표/관리자 도구)의 전체 기능과 실무 운영법을 체계적으로 안내합니다.</P>

          <H2>1. 시작하기: 로그인 및 세션 관리</H2>
          <P>시스템 접속 시 100% 클라우드 인증 세션 기반의 안전한 로그인 환경이 제공됩니다. 별도의 복잡한 아이디 타이핑 없이 등록된 계정 목록에서 본인의 직책과 이름을 선택하여 1초 만에 안전하게 접속할 수 있습니다.</P>
        </div>

        {/* 2단 그리드: 좌측 실물 크기 로그인 카드 + 우측 권한 매트릭스 및 접속 절차 */}
        <div className="grid grid-cols-12 gap-4 items-start mb-2.5">
          {/* 좌측: 실물 로그인 목업 (col-span-5) */}
          <div className="col-span-5 bg-white rounded-xl shadow-xs border border-slate-300 overflow-hidden text-xs">
            <div className="bg-blue-600 py-3.5 px-4 text-center text-white">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-1">
                <Building2 size={20} className="text-white" />
              </div>
              <h2 className="text-sm font-bold text-white tracking-tight leading-tight">아산노블요양원</h2>
              <div className="text-[10px] text-blue-100 flex items-center justify-center gap-1.5 mt-0.5 font-medium">
                <span>통합 관리 시스템</span>
                <span className="bg-blue-500/80 px-1.5 py-0.2 rounded border border-blue-400/50 font-bold">Ver {APP_VERSION}</span>
              </div>
            </div>

            <div className="p-3.5 space-y-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-1">로그인 계정</label>
                <div className="relative">
                  <UserIcon size={14} className="absolute left-2.5 top-2.5 text-blue-600" />
                  <div className="w-full pl-7 pr-3 py-1.5 border-2 border-blue-500 rounded-lg text-xs bg-white flex justify-between items-center font-bold text-slate-800">
                    <span>관리자 (System Admin)</span>
                    <ChevronDown size={14} className="text-blue-500" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-1">비밀번호</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <div className="w-full pl-7 pr-3 py-1.5 border rounded-lg text-xs bg-slate-50 font-mono tracking-widest text-slate-700 flex items-center">
                    ••••••••
                  </div>
                </div>
              </div>

              <div className="flex bg-slate-100 p-0.5 rounded text-[9.5px]">
                <div className="flex-1 py-1 text-center font-bold bg-white rounded shadow-2xs text-blue-600 flex items-center justify-center gap-0.5">
                  일반 모드 <Check size={11} />
                </div>
                <div className="flex-1 py-1 text-center text-slate-400">다크 모드</div>
              </div>

              <div className="py-2.5 bg-blue-600 text-white text-center rounded-lg text-xs font-bold shadow-2xs hover:bg-blue-700 cursor-pointer">
                시스템 접속
              </div>
            </div>

            <div className="py-2 px-3 bg-slate-50 border-t text-[9px] text-center text-slate-500 font-medium">
              ※ 초기 비밀번호: <strong className="text-blue-600 font-bold">1234</strong> (로그인 후 세션 자동 유지)
            </div>
          </div>

          {/* 우측: 절차 및 직책별 접근 권한 표 (col-span-7) */}
          <div className="col-span-7 space-y-2.5">
            <div>
              <h3 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <ShieldCheck size={14} className="text-blue-600" /> 1.1. 관리자 보안 접속 4단계 상세 절차
              </h3>
              <ul className="list-decimal pl-4 space-y-1 text-[11px] text-slate-700 leading-[1.6]">
                <li><strong>보안 웹 접속</strong>: 시설 내 PC나 업무용 태블릿에서 시스템 전용 주소에 접속합니다.</li>
                <li><strong>관리자 계정 선택</strong>: 로그인 계정 목록에서 <Code>관리자 (System Admin)</Code>을 지정합니다.</li>
                <li><strong>비밀번호 및 권한 인증</strong>: 관리자 비밀번호를 입력하고 접속하여 최고 권한을 획득합니다.</li>
                <li><strong>관리자 전용 모듈 활성화</strong>: 사이드바의 보라색 관리 메뉴(어르신/훈련/근무표/설정)가 즉시 개방됩니다.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <Users size={14} className="text-violet-600" /> 1.2. 직책별 시스템 접근 권한 매트릭스
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-[10px] text-left leading-[1.5]">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                    <tr><th className="p-1.5">직책</th><th className="p-1.5">재고/불출</th><th className="p-1.5">어르신/훈련</th><th className="p-1.5">관리자도구</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-blue-50/40 font-bold">
                      <td className="p-1.5 text-blue-700">관리자 (Admin)</td>
                      <td className="p-1.5 text-emerald-600">전체 제어</td>
                      <td className="p-1.5 text-emerald-600">전체 제어</td>
                      <td className="p-1.5 text-emerald-600">전체 권한</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-bold">원장 / 시설장</td>
                      <td className="p-1.5">조회/승인</td>
                      <td className="p-1.5">계획서 결재</td>
                      <td className="p-1.5 text-slate-400">제한적</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-bold">사무장 / 복지사</td>
                      <td className="p-1.5">수불부 등록</td>
                      <td className="p-1.5">이력카드 관리</td>
                      <td className="p-1.5 text-slate-400">-</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-bold">간호조무사 / 요양</td>
                      <td className="p-1.5">현장 출고/입고</td>
                      <td className="p-1.5">훈련 실시간 기록</td>
                      <td className="p-1.5 text-slate-400">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* 1.3 최고관리자 보안 수칙 및 감사 로그 기준 */}
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-1.5 text-xs mb-2">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1">
            <ShieldCheck size={14} className="text-violet-600" /> 1.3. 최고관리자 보안 수칙 및 감사 로그 운영 기준
          </h3>
          <div className="grid grid-cols-3 gap-2.5 text-[10px] text-slate-700">
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
              <div className="font-bold text-blue-700 flex items-center gap-1 text-[11px]"><Lock size={13} /> 비밀번호 즉시 변경</div>
              <p className="text-slate-600 text-[10px] leading-[1.6]">초기 부여된 공용 비밀번호(<Code>1234</Code>)는 인가되지 않은 접근을 원천 차단하기 위해 최초 로그인 직후 즉시 8자리 이상 복합 문자열로 변경해야 합니다.</p>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
              <div className="font-bold text-red-600 flex items-center gap-1 text-[11px]"><AlertCircle size={13} /> 이석 시 로그아웃 의무</div>
              <p className="text-slate-600 text-[10px] leading-[1.6]">입소 어르신의 장기요양등급 및 개인 신상정보를 보호하기 위해 사무실 공용 PC에서 작업 종료나 자리 이석 시 반드시 [로그아웃]을 실행합니다.</p>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
              <div className="font-bold text-purple-700 flex items-center gap-1 text-[11px]"><History size={13} /> 실시간 보안 감사 추적</div>
              <p className="text-slate-600 text-[10px] leading-[1.6]">품목 단가 수정, 수불 전표 삭제, 마감 확정 등 관리자의 모든 중요 행위는 작업 일시 및 IP 정보와 함께 클라우드 로그에 실시간 영구 보존됩니다.</p>
            </div>
          </div>
        </div>

        {/* 1.4 시스템 권장 접속 환경 및 기술 지원 안내 (A4 85~90% 완벽 수렴) */}
        <div className="border border-slate-200 rounded-lg p-3 bg-blue-50/30 space-y-1.5 text-xs">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1">
            <Settings size={14} className="text-blue-600" /> 1.4. 시스템 접속 환경 및 기술 지원 체계
          </h3>
          <div className="grid grid-cols-2 gap-3 text-[10.5px] text-slate-700 leading-[1.6]">
            <div className="space-y-1">
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-blue-800 shrink-0">• 권장 브라우저:</span>
                <span>Google Chrome 및 Microsoft Edge 최신 버전에 최적화되어 있으며, 별도 액티브X 설치 없이 모든 기능을 100% 지원합니다.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-blue-800 shrink-0">• 클라우드 동기화:</span>
                <span>모든 데이터는 Firebase 클라우드 DB에 실시간 암호화 저장되어 정전이나 단말기 오류 발생 시에도 데이터 유실이 없습니다.</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-emerald-800 shrink-0">• 다중 단말 접속:</span>
                <span>원장실 PC, 간호사실 태블릿, 모바일 등 복수의 기기에서 동시 접속이 가능하며, 실시간 트래픽을 자동 분산 처리합니다.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-purple-800 shrink-0">• 장애 문의 지원:</span>
                <span>계정 잠김, 데이터 복구 등 시스템 이상 발생 시 연구소 기술지원팀(경훈시스템 부설 자동화연구소)으로 문의 바랍니다.</span>
              </div>
            </div>
          </div>
        </div>
      </ManualPage>

      {/* ── Page 2: 메인 화면 구성 및 사이드바 ───────────────────────────── */}
      <ManualPage pageNumber={2} totalPages={9}>
        <H1>시스템 기능 매뉴얼 (관리자용)</H1>
        <H2>2. 메인 화면 구성 및 사이드바 메뉴 (관리자 전용 포함)</H2>
        <P>시스템 로그인 후 접근 권한(일반 사용자/시스템 관리자)에 따라 최적화된 사이드바 메뉴와 메인 화면이 제공됩니다.</P>

        <Snapshot caption="관리자 전용 사이드바 (일반 메뉴 + 관리자 메뉴) 및 대시보드 (Image 2 준수)">
          <div className="flex h-56 bg-slate-100 dark:bg-slate-950 border rounded-xl overflow-hidden text-xs">
            {/* Sidebar Mockup (Image 2 - Admin Menu Included) */}
            <div className="w-36 bg-white dark:bg-slate-900 border-r p-2 flex flex-col justify-between shrink-0">
              <div className="space-y-1">
                <div className="font-extrabold text-blue-600 dark:text-blue-400 px-2 py-1 text-sm border-b pb-2">
                  아산노블<span className="text-slate-400 font-normal text-xs">재고</span>
                </div>
                <div className="bg-blue-600 text-white font-bold px-2 py-1 rounded-lg flex items-center gap-1.5 text-[10px]">
                  <LayoutDashboard size={12} /> 대시보드
                </div>
                <div className="text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg flex items-center gap-1.5 text-[10px] hover:bg-slate-100">
                  <Package size={12} /> 재고 현황
                </div>
                <div className="text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg flex items-center gap-1.5 text-[10px]">
                  <BarChart2 size={12} /> AI 분석
                </div>
                <div className="text-[10px] text-violet-500 font-bold px-2 pt-1">관리자 메뉴</div>
                <div className="text-slate-700 dark:text-slate-200 px-2 py-1 rounded-lg flex items-center gap-1.5 text-[10px] bg-violet-50 dark:bg-violet-950/40">
                  <CalendarCheck size={12} className="text-violet-500" /> 일정표 작성
                </div>
                <div className="text-slate-700 dark:text-slate-200 px-2 py-1 rounded-lg flex items-center gap-1.5 text-[10px] bg-violet-50 dark:bg-violet-950/40">
                  <Users size={12} className="text-violet-500" /> 어르신 관리카드
                </div>
                <div className="text-slate-700 dark:text-slate-200 px-2 py-1 rounded-lg flex items-center gap-1.5 text-[10px] bg-violet-50 dark:bg-violet-950/40">
                  <Activity size={12} className="text-violet-500" /> 기능회복훈련
                </div>
              </div>
              <div className="border-t pt-1 space-y-0.5 text-[9px] text-slate-500">
                <div className="flex items-center gap-1 px-1 py-0.5"><Box size={10} className="text-indigo-500" /> 기준 정보</div>
                <div className="flex items-center gap-1 px-1 py-0.5"><BookOpen size={10} className="text-emerald-500" /> 시스템 매뉴얼</div>
              </div>
            </div>

            {/* Content Area Mockup */}
            <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900">
              <div className="h-9 bg-white dark:bg-slate-800 border-b px-3 flex justify-between items-center shrink-0">
                <span className="font-bold text-slate-800 dark:text-white">대시보드</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold">관리자 님</span>
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center">관</div>
                </div>
              </div>
              <div className="p-3 grid grid-cols-3 gap-2 flex-1">
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border shadow-2xs">
                  <div className="text-[9px] text-slate-400">총 관리 품목</div>
                  <div className="text-base font-extrabold text-blue-600">150개</div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border shadow-2xs">
                  <div className="text-[9px] text-slate-400">부족/위험 재고</div>
                  <div className="text-base font-extrabold text-red-500">3개</div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border shadow-2xs">
                  <div className="text-[9px] text-slate-400">입소 수급자</div>
                  <div className="text-base font-extrabold text-violet-600">23명</div>
                </div>
              </div>
            </div>
          </div>
        </Snapshot>

        <H3>2.1. 메뉴 구분 및 시스템 접근 권한 안내</H3>
        <ul className="list-disc pl-5 space-y-1 text-[11.5px] leading-[1.6]">
          <Li><strong>일반 공통 메뉴</strong>: 요양보호사를 포함한 전 직원이 공통으로 접근할 수 있는 영역입니다. 대시보드 요약, 전체 재고 현황 조회, 간단한 입출고 등록이 가능합니다.</Li>
          <Li><strong>관리자 전용 메뉴</strong>: 원장 및 사무장 등 특정 권한이 부여된 계정만 볼 수 있는 보라색 뱃지 영역입니다. 직원 근무표 작성, 어르신 이력카드 관리, 기능회복훈련 결재 기능이 활성화됩니다.</Li>
          <Li><strong>하단 시스템 관리 도구</strong>: 화면 좌측 하단에 고정된 툴바를 통해 품목 분류 기준 정보 수정, 신규 사용자 계정 승인, 테마(다크 모드) 변경 등을 원클릭으로 수행할 수 있습니다.</Li>
        </ul>

        <H3>2.2. 상단 유틸리티 바 기능 안내</H3>
        <div className="grid grid-cols-2 gap-3 text-[10.5px] leading-[1.6]">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong className="block text-slate-800 mb-1">알림 뱃지 및 세션 타이머</strong>
            우측 상단의 종 모양 아이콘을 통해 긴급 발주 알림이나 공지사항을 실시간으로 확인하며, 보안을 위해 일정 시간 미조작 시 카운트다운 타이머가 작동해 자동 로그아웃됩니다.
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong className="block text-slate-800 mb-1">다크모드 및 프로필 전환</strong>
            주야간 근무 환경에 맞춰 눈의 피로를 덜어주는 다크모드를 스위치로 즉시 전환할 수 있으며, 내 프로필 아이콘을 눌러 비밀번호 변경 및 로그아웃 메뉴에 진입합니다.
          </div>
        </div>

        <H3>2.3. 태블릿 및 모바일 반응형 최적화 가이드</H3>
        <div className="grid grid-cols-3 gap-2 text-[10px] leading-[1.6]">
          <div className="border border-blue-100 bg-blue-50/40 p-2 rounded-md">
            <strong className="block text-blue-700">사이드바 자동 접힘</strong>
            작은 화면에서는 사이드바가 자동으로 아이콘만 남기고 접혀(Collapse) 작업 공간을 최대한 확보합니다.
          </div>
          <div className="border border-amber-100 bg-amber-50/40 p-2 rounded-md">
            <strong className="block text-amber-700">모바일 터치 제스처</strong>
            테이블의 좌우 스크롤링 및 행 더블 탭 등을 통해 스마트폰에서도 마우스 없이 모든 입력이 원활하게 작동합니다.
          </div>
          <div className="border border-emerald-100 bg-emerald-50/40 p-2 rounded-md">
            <strong className="block text-emerald-700">플로팅 하단 메뉴</strong>
            모바일 뷰 전용으로 자주 쓰는 기능(QR 스캔, 긴급 입출고 등)이 화면 하단 플로팅 바 형태로 동적 생성됩니다.
          </div>
        </div>
      </ManualPage>

      {/* ── Page 3: 어르신 관리카드 ────────────────────────────────────────── */}
      <ManualPage pageNumber={3} totalPages={9}>
        <H1>시스템 기능 매뉴얼 (관리자용)</H1>
        <H2>3. 어르신 이력카드 관리 (ResidentManager)</H2>
        <P>요양원 입소 어르신 인적사항, 장기요양등급, 생활실, 본인부담율, 급여 지원 내역 및 케어포/평가 사전 준비자료 엑셀을 일괄 동기화합니다.</P>

        <Snapshot caption="어르신 이력카드 관리 (목록 및 상세 정보 편집 화면)">
          <div className="bg-white border rounded-xl shadow-sm p-3 space-y-2 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-800 flex items-center gap-1"><Users size={14} className="text-violet-600" /> 수급자 목록 (23명)</span>
                <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer">
                  <FileSpreadsheet size={10} /> 평가 사전 준비자료 엑셀 대장 임포트
                </div>
              </div>
              <div className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer">
                <Plus size={10} /> 신규 등록
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              {/* Resident List Table */}
              <div className="col-span-5 border rounded-lg overflow-hidden">
                <table className="w-full text-[10px] text-left">
                  <thead className="bg-slate-100 font-bold border-b">
                    <tr><th className="p-1.5">이름/성별</th><th className="p-1.5">등급</th><th className="p-1.5">생활실</th><th className="p-1.5 text-center">상태</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr className="bg-blue-50/60 font-bold">
                      <td className="p-1.5 flex items-center gap-1"><span className="text-xs">👴</span> 홍길동 (남)</td>
                      <td className="p-1.5 text-blue-600">3등급</td>
                      <td className="p-1.5">사랑방1</td>
                      <td className="p-1.5 text-center"><span className="bg-blue-100 text-blue-700 px-1 py-0.2 rounded text-[9px]">입소</span></td>
                    </tr>
                    <tr>
                      <td className="p-1.5 flex items-center gap-1"><span className="text-xs">👵</span> 김순자 (여)</td>
                      <td className="p-1.5">1등급</td>
                      <td className="p-1.5">사랑방2</td>
                      <td className="p-1.5 text-center"><span className="bg-blue-100 text-blue-700 px-1 py-0.2 rounded text-[9px]">입소</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Resident Detail Form */}
              <div className="col-span-7 bg-slate-50 p-2.5 rounded-lg border space-y-2 text-[10px]">
                <div className="flex justify-between items-center border-b pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-800">수급자 기본정보</span>
                    <button className="bg-violet-600 text-white px-2 py-0.5 rounded font-bold text-[9px]">[조회 / 변경]</button>
                  </div>
                  <div className="flex gap-1">
                    <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">사진 삭제</span>
                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded font-bold">저장</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-slate-500 block mb-0.5 font-bold">본인부담율 (콤보박스)</label><div className="bg-white border rounded p-1 font-bold">15% 일반</div></div>
                  <div><label className="text-slate-500 block mb-0.5 font-bold">생활실 (콤보박스)</label><div className="bg-white border rounded p-1 font-bold">사랑방1 ~ 사랑방8</div></div>
                </div>

                <div className="bg-white p-1.5 rounded border space-y-1">
                  <div className="font-bold text-slate-700">급여/비급여 지원 선택 (1줄 표출)</div>
                  <div className="flex items-center gap-3 text-[9px]">
                    <label className="flex items-center gap-1"><input type="checkbox" defaultChecked /> 식사재료비 지원</label>
                    <label className="flex items-center gap-1"><input type="checkbox" defaultChecked /> 간식비 지원</label>
                    <label className="flex items-center gap-1"><input type="checkbox" /> 생계급여지원</label>
                  </div>
                </div>

                <div className="flex gap-1 border-t pt-1.5">
                  <div className="bg-blue-600 text-white px-2 py-1 rounded font-bold">욕구사정 총평</div>
                  <div className="bg-slate-200 text-slate-600 px-2 py-1 rounded font-bold">급여제공계획 총평</div>
                </div>
              </div>
            </div>
          </div>
        </Snapshot>

        <H3>3.1. 엑셀 일괄 동기화 및 성별 아바타</H3>
        <ul className="list-disc pl-5 space-y-1 text-[11.5px] leading-[1.6]">
          <Li><strong>중복 감지 덮어쓰기:</strong> 평가 사전 준비자료 엑셀 대장을 업로드하면 시스템이 주민번호를 기준으로 기존 어르신과 중복을 자동 감지하여 최신 정보로 덮어씁니다.</Li>
          <Li><strong>퇴소자 자동 분류:</strong> 엑셀 파일에 기재되지 않은 기존 인원은 '퇴소' 또는 '입원' 상태로 변경할지 묻는 팝업을 띄워 DB 정합성을 유지합니다.</Li>
          <Li><strong>이모지 아바타 표출:</strong> 실물 사진이 아직 등록되지 않은 수급자는 시스템이 성별을 파악하여 남성(<Code>👴</Code>), 여성(<Code>👵</Code>) 이모지 아바타를 고해상도로 기본 할당합니다.</Li>
        </ul>

        <H3>3.2. 케어포/평가 사전준비 엑셀 대장 일괄 동기화 상세 절차</H3>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[10.5px] leading-[1.6]">
          <ol className="list-decimal pl-4 space-y-1.5 text-slate-700">
            <li><strong>파일 드래그 앤 드롭:</strong> 케어포 또는 W4C에서 다운로드받은 '수급자 현황' 엑셀 파일을 화면 상단의 임포트 영역에 끌어다 놓습니다.</li>
            <li><strong>컬럼 스마트 매핑:</strong> 파일 내 헤더 명칭(예: 성명, 요양등급, 생년월일)을 시스템 DB 필드와 유사도 기반으로 자동 매핑합니다.</li>
            <li><strong>데이터 무결성 검증:</strong> 빈 셀이나 잘못된 날짜 형식이 포함된 행을 붉은색으로 하이라이트하여 관리자가 즉시 수정할 수 있도록 유도합니다.</li>
            <li><strong>일괄 저장 및 동기화:</strong> 검증이 완료된 데이터를 최종 저장하면 전체 이력카드가 즉시 업데이트되며, 기능회복훈련 대상자 명단에도 실시간 반영됩니다.</li>
          </ol>
        </div>

        <H3>3.3. 급여/비급여 항목별 운영 기준</H3>
        <div className="grid grid-cols-2 gap-3 text-[10.5px] leading-[1.6]">
          <div className="border border-indigo-100 bg-indigo-50/40 p-2.5 rounded-md space-y-1.5">
            <strong className="block text-indigo-800">식사재료비 및 간식비 지원</strong>
            지자체나 시설 자체 규정에 따라 식비 지원을 받는 대상자는 해당 체크박스를 활성화합니다. 월간 본인부담금 청구서 생성 시 이 항목이 자동 차감되어 계산됩니다.
          </div>
          <div className="border border-teal-100 bg-teal-50/40 p-2.5 rounded-md space-y-1.5">
            <strong className="block text-teal-800">생계급여 및 의료급여(기초수급자)</strong>
            기초생활수급권자의 경우 본인부담율 0% 적용과 함께 생계급여 체크박스를 선택해야 하며, 건보공단 청구 및 지자체 보고용 통계에 필수적인 지표로 활용됩니다.
          </div>
        </div>
      </ManualPage>

      {/* ── Page 4: 기능회복훈련 계획서 수립 ─────────────────────────────── */}
      <ManualPage pageNumber={4} totalPages={9}>
        <H1>시스템 기능 매뉴얼 (관리자용)</H1>
        <H2>4. 기능회복훈련 계획서 수립 (TrainingManager)</H2>
        <P>입소 어르신 23명 전체의 훈련 수립 현황을 한눈에 파악하고, 장기요양등급 기반 AI 연동으로 개인 맞춤형 계획서를 자동 생성합니다.</P>

        <Snapshot caption="기능회복훈련 현황판 대시보드 및 AI 자동 작성 양식">
          <div className="bg-white border rounded-xl shadow-sm p-3 space-y-2 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Activity size={14} className="text-violet-600" /> 기능회복훈련 수립 현황판 (2026년 7월)
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-[10px] font-bold">
                <button className="px-2 py-0.5 bg-white shadow-xs rounded text-blue-600">◀ 6월</button>
                <span className="px-2">2026. 07</span>
                <button className="px-2 py-0.5 bg-white shadow-xs rounded text-blue-600">8월 ▶</button>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              {/* Resident Board */}
              <div className="col-span-5 space-y-1.5 max-h-48 overflow-y-auto">
                <div className="p-2 border rounded-lg bg-emerald-50/60 border-emerald-200 flex justify-between items-center cursor-pointer">
                  <div><span className="font-bold text-slate-800">홍길동 어르신</span> <span className="text-[10px] text-slate-500">(3등급/준와상)</span></div>
                  <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[9px] font-bold">수립 완료 (07월)</span>
                </div>
                <div className="p-2 border rounded-lg bg-blue-50/40 border-blue-200 flex justify-between items-center cursor-pointer">
                  <div><span className="font-bold text-slate-800">김순자 어르신</span> <span className="text-[10px] text-slate-500">(1등급/와상)</span></div>
                  <span className="bg-amber-500 text-white px-2 py-0.5 rounded text-[9px] font-bold animate-pulse">계획 미수립</span>
                </div>
              </div>

              {/* Form Area */}
              <div className="col-span-7 bg-slate-50 p-2.5 rounded-lg border space-y-2 text-[10px]">
                <div className="flex justify-between items-center border-b pb-1.5">
                  <span className="font-bold text-xs text-slate-800">훈련 계획서 작성 폼</span>
                  <div className="bg-purple-600 text-white px-2.5 py-1 rounded font-bold flex items-center gap-1 shadow-xs cursor-pointer">
                    <Sparkles size={10} /> Gemini AI 자동 작성 (Gemini Engine)
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-slate-500 block mb-0.5 font-bold">기능수준 선택 (최우선 반영)</label><div className="bg-white border rounded p-1 font-bold text-blue-600">준와상 (3~4등급 권장)</div></div>
                  <div><label className="text-slate-500 block mb-0.5 font-bold">작성 연월 / 제공 기간</label><div className="bg-white border rounded p-1 font-mono">2026-07 (07.01~07.31)</div></div>
                </div>

                <div className="bg-white p-2 rounded border space-y-1">
                  <div className="font-bold text-slate-700">이용자 상태파악 (3~4줄 자동 요약 분리)</div>
                  <div className="bg-slate-50 p-1.5 rounded text-[9px] text-slate-600 leading-tight border font-sans">
                    1. 뇌경색 진단 후 우측 편마비 상태임.<br />
                    2. 휠체어 이동 시 보조가 필요하며 일상생활 지원을 원함.<br />
                    3. 관절 가동범위 유지를 위한 신체기능 훈련이 중점 필요함.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Snapshot>

        <H3>4.1. 기능수준 우선 판정 및 문장 자동 작성 규칙</H3>
        <ul className="list-disc pl-5 space-y-1 text-[11.5px] leading-[1.6]">
          <Li><strong>기능수준 선택 우선 판정</strong>: 시설에서 판단한 어르신의 실제 기능수준(와상/준와상/자립)과 필수 데이터를 조합하여 O/X 세부 훈련 항목을 1차적으로 자동 계산합니다.</Li>
          <Li><strong>총평 자료 보조 활용</strong>: 기존에 작성된 욕구사정 및 급여제공계획 총평 텍스트는 O/X 판단 기준보다는 구체적인 서술 문장의 자연스러움과 품질을 향상시키는 보조 자료로 활용됩니다.</Li>
          <Li><strong>3~4줄 포맷터 자동 적용</strong>: '이용자 상태파악' 입력란은 A4 출력 시 영역을 벗어나지 않도록 3~4줄의 번호 매기기 구조로 자동 분리 및 정규화되어 서식 넘침을 완벽히 차단합니다.</Li>
        </ul>

        <H3>4.2. Gemini AI 기반 개인별 계획서 자동 생성 알고리즘</H3>
        <div className="grid grid-cols-2 gap-3 text-[10.5px] leading-[1.6]">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong className="block text-slate-800 mb-1">다차원 데이터 프롬프팅</strong>
            어르신의 장기요양등급, 성별, 나이, 생활실, 본인부담률 등 10개 이상의 다차원 데이터를 종합하여 Gemini AI에게 전송될 최적의 프롬프트를 백그라운드에서 조립합니다.
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong className="block text-slate-800 mb-1">환각(Hallucination) 방지 필터링</strong>
            AI가 생성한 결과물 중 시설 환경에 맞지 않는 훈련 도구나 실현 불가능한 빈도 설정 등을 정규식으로 2차 필터링하여 안전하고 현실적인 계획서만을 화면에 렌더링합니다.
          </div>
        </div>

        <H3>4.3. 건보공단 평가 대비 분기별 결재 및 인쇄 프로세스</H3>
        <div className="grid grid-cols-3 gap-2 text-[10.5px] leading-[1.6]">
          <div className="border border-blue-100 bg-blue-50/40 p-2 rounded-md">
            <strong className="block text-blue-800">1. 분기 시작 (수립)</strong>
            매 분기 첫 달, 현황판 대시보드에서 붉은색 뱃지가 뜬 어르신들을 필터링하여 일괄적으로 초기 계획을 수립하고 1차 저장을 진행합니다.
          </div>
          <div className="border border-emerald-100 bg-emerald-50/40 p-2 rounded-md">
            <strong className="block text-emerald-800">2. 월간 점검 (중간)</strong>
            매월 말, 제공 기록과 계획서의 목표 달성률을 비교 분석하여 필요한 경우 '계획 변경' 사유를 기재하고 목표 횟수를 조정합니다.
          </div>
          <div className="border border-purple-100 bg-purple-50/40 p-2 rounded-md">
            <strong className="block text-purple-800">3. 분기 말 (결재/인쇄)</strong>
            최종 확인된 계획서는 일괄 엑셀 다운로드 또는 PDF 병합 인쇄를 통해 시설장(원장)의 자필 또는 전자 서명을 받아 서류철에 보관합니다.
          </div>
        </div>
      </ManualPage>

      {/* ── Page 5: 기능회복훈련 A4 미리보기 & 엑셀 출력 ───────────────────── */}
      <ManualPage pageNumber={5} totalPages={9}>
        <H1>시스템 기능 매뉴얼 (관리자용)</H1>
        <H2>5. 기능회복훈련 A4 미리보기 및 엑셀 다운로드</H2>
        <P>공단 제출용 A4 실물 템플릿 서식과 100% 일치하는 결재란 HTML 미리보기를 제공하며, ExcelJS 기반 원본 템플릿 바인딩 다운로드를 지원합니다.</P>

        <Snapshot caption="공단 제출용 A4 1페이지 실물 템플릿 미리보기 (TrainingPreview)">
          <div className="bg-slate-200 dark:bg-slate-900 p-3 rounded-xl max-w-md mx-auto shadow-inner text-[9px]">
            <div className="bg-white p-3 rounded shadow-md border space-y-2 text-slate-800 font-sans">
              {/* Approval Seal Header */}
              <div className="flex justify-between items-end border-b-2 border-slate-800 pb-1">
                <div className="font-extrabold text-sm text-slate-900 tracking-tight">기능회복훈련 계획서</div>
                <div className="flex border border-slate-400 text-[8px] text-center divide-x">
                  <div className="px-1.5 py-0.5 bg-slate-100 font-bold">결재</div>
                  <div className="px-2 py-0.5">담당</div>
                  <div className="px-2 py-0.5">팀장</div>
                  <div className="px-2 py-0.5">원장</div>
                </div>
              </div>

              {/* 2-Row 8-Col Grid */}
              <table className="w-full border-collapse border border-slate-400 text-[8px] text-center">
                <tr className="bg-slate-100 font-bold">
                  <td className="border border-slate-300 p-0.5">이용자 성명</td><td className="border border-slate-300 p-0.5 bg-white">홍길동</td>
                  <td className="border border-slate-300 p-0.5">상태</td><td className="border border-slate-300 p-0.5 bg-white text-blue-600 font-bold">준와상</td>
                  <td className="border border-slate-300 p-0.5">성별/나이</td><td className="border border-slate-300 p-0.5 bg-white">남 / 82세</td>
                  <td className="border border-slate-300 p-0.5">등급/인정번호</td><td className="border border-slate-300 p-0.5 bg-white">3등급 (L1234)</td>
                </tr>
              </table>

              {/* Training Plan Matrix */}
              <div className="border border-slate-300 p-1.5 rounded space-y-1 bg-slate-50/50">
                <div className="font-bold text-[9px] text-slate-900 border-b pb-0.5">훈련 내용 및 방법 (◯/X 표시)</div>
                <div className="grid grid-cols-3 gap-1 text-[8px]">
                  <div className="bg-white p-1 border rounded"><span className="font-bold text-blue-600">◯</span> 신체기능 훈련</div>
                  <div className="bg-white p-1 border rounded"><span className="font-bold text-blue-600">◯</span> 기본동작 훈련</div>
                  <div className="bg-white p-1 border rounded"><span className="font-bold text-slate-400">X</span> 일상생활 훈련</div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-[8px] text-slate-400">※ 본 출력물은 A4 1페이지 수렴형 레이아웃 규칙을 준수합니다.</span>
                <div className="flex gap-1">
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-0.5"><Printer size={8} /> 인쇄 / PDF</span>
                  <span className="bg-emerald-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-0.5"><FileSpreadsheet size={8} /> 엑셀 다운로드</span>
                </div>
              </div>
            </div>
          </div>
        </Snapshot>

        <H3>5.1. 미리보기와 엑셀 100% 동일 표출 원리</H3>
        <ul className="list-disc pl-5 space-y-1 text-[11.5px] leading-[1.6]">
          <Li><strong>상태 동기화:</strong> 화면에서 수정 중인 <Code>formState</Code> 객체의 값이 변경될 때마다 미리보기 모달에도 즉시 반영되어 직관적인 검토가 가능합니다.</Li>
          <Li><strong>공단 검수 기준 충족:</strong> 미체크 항목은 단순히 빈칸으로 두는 것이 아니라 <Code>X</Code> 로 명확히 표시하여, 공단 평가 시 요구하는 '기록의 완결성' 기준을 충족합니다.</Li>
          <Li><strong>A4 최적화:</strong> 모든 출력물은 1페이지 수렴형 레이아웃 규칙(Row-Col Grid 제한)을 준수하여 인쇄 시 페이지가 잘리거나 넘어가는 현상을 방지합니다.</Li>
        </ul>

        <H3>5.2. 스마트폰 현장 실시간 제공기록 터치 입력 요령</H3>
        <div className="grid grid-cols-2 gap-3 text-[10.5px] leading-[1.6]">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong className="block text-slate-800 mb-1">모바일 최적화 UI (큰 버튼)</strong>
            현장 요양보호사가 장갑을 낀 상태에서도 쉽게 터치할 수 있도록 훈련 제공 확인 버튼이 큼직하게 디자인되어 있으며, 당일 수행한 훈련 항목만 활성화됩니다.
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong className="block text-slate-800 mb-1">오프라인 캐싱 및 일괄 전송</strong>
            생활실 내 와이파이 연결이 불안정할 경우를 대비하여 입력된 기록은 기기에 임시 저장되었다가, 네트워크 연결 시 서버로 일괄 동기화됩니다.
          </div>
        </div>

        <H3>5.3. 분기별 기능변화 평가표 작성 및 보호자 상담 연계</H3>
        <div className="grid grid-cols-2 gap-3 text-[10.5px] leading-[1.6]">
          <div className="bg-green-50/50 p-2.5 rounded-lg border border-green-100">
            <strong className="block text-green-800 mb-1">분기별 자동 평가 알림</strong>
            계획 수립 후 3개월이 도래하는 시점에 시스템이 자동으로 '기능변화 평가' 알림을 띄우며, 이전 평가 대비 호전/유지/악화 여부를 쉽게 비교 입력할 수 있습니다.
          </div>
          <div className="bg-purple-50/50 p-2.5 rounded-lg border border-purple-100">
            <strong className="block text-purple-800 mb-1">보호자 상담(알림톡) 연계</strong>
            최종 결재가 완료된 훈련 계획 및 평가 결과는 보호자의 연락처로 요약된 URL 링크와 함께 알림톡으로 전송되어 원활한 소통을 지원합니다.
          </div>
        </div>
      </ManualPage>

      {/* ── Page 6: 직원 근무표 생성 ─────────────────────────────────────── */}
      <ManualPage pageNumber={6} totalPages={9}>
        <H1>시스템 기능 매뉴얼 (관리자용)</H1>
        <H2>6. 직원 근무표 작성 및 업무 배정 (ScheduleManager)</H2>
        <P>월별 직원 근무 엑셀 업로드 시 4대 생활실 활동 업무(목욕/이불/주방/청소배식)를 형평성 알고리즘에 따라 자동으로 순환 배정합니다.</P>

        <Snapshot caption="직원 근무표 캘린더 및 업무 로테이션 자동 배정 화면">
          <div className="bg-white border rounded-xl shadow-sm p-3 space-y-2 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <CalendarCheck size={14} className="text-violet-600" /> 2026년 7월 근무표 및 생활실 활동 배정
              </span>
              <div className="flex gap-1 text-[10px]">
                <span className="bg-emerald-600 text-white px-2 py-1 rounded font-bold flex items-center gap-1 cursor-pointer"><FileSpreadsheet size={10} /> 엑셀 업로드</span>
                <span className="bg-blue-600 text-white px-2 py-1 rounded font-bold flex items-center gap-1 cursor-pointer"><RefreshCw size={10} /> 자동 배정 실행</span>
              </div>
            </div>

            {/* Calendar Shift Table Mockup */}
            <div className="border rounded-lg overflow-hidden text-[9px]">
              <table className="w-full text-center border-collapse">
                <thead className="bg-slate-100 font-bold border-b">
                  <tr><th className="p-1 border-r">직원명</th><th className="p-1">1일 (수)</th><th className="p-1">2일 (목)</th><th className="p-1">3일 (금)</th><th className="p-1">4일 (토)</th><th className="p-1 text-red-500">5일 (일)</th></tr>
                </thead>
                <tbody className="divide-y font-mono">
                  <tr>
                    <td className="p-1 font-bold bg-slate-50 border-r">김요양</td>
                    <td className="p-1 bg-blue-100 text-blue-800 font-bold">D (목욕)</td>
                    <td className="p-1 bg-green-100 text-green-800">D (이불)</td>
                    <td className="p-1 bg-amber-100 text-amber-800">D (청소)</td>
                    <td className="p-1 bg-slate-200 text-slate-600">OFF</td>
                    <td className="p-1 bg-slate-200 text-slate-600">OFF</td>
                  </tr>
                  <tr>
                    <td className="p-1 font-bold bg-slate-50 border-r">박간호</td>
                    <td className="p-1 bg-green-100 text-green-800">D (주방)</td>
                    <td className="p-1 bg-blue-100 text-blue-800 font-bold">D (목욕)</td>
                    <td className="p-1 bg-purple-100 text-purple-800">E (야간)</td>
                    <td className="p-1 bg-green-100 text-green-800">D (주말)</td>
                    <td className="p-1 bg-slate-200 text-slate-600">OFF</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Snapshot>

        <H3>6.1. 알고리즘 주요 배정 규칙</H3>
        <ul className="list-disc pl-5 space-y-1 text-[11.5px] leading-[1.6]">
          <Li><strong>목욕 격리 원칙</strong>: 가장 노동 강도가 높은 당일 목욕 담당자 2명은 다른 4대 업무(이불, 주방, 청소배식) 배정에서 전면 제외하여 피로도를 관리합니다.</Li>
          <Li><strong>연속 배정 방지 (Soft Exclude)</strong>: 전일(d-1) 특정 업무를 수행한 직원은 당일 동일 업무 연속 배정 대상에서 후순위로 자동 밀려나게 되어 특정인에게 일이 집중되는 것을 막습니다.</Li>
          <Li><strong>비상 출근 동적 조절</strong>: 평일 정상 출근 인원이 5인 미만으로 떨어지는 비상 상황 발생 시, 업무별 투입 인원수를 비율에 맞게 동적 축소하여 남은 인원의 부담을 최소화합니다.</Li>
        </ul>

        <H3>6.2. 4대 생활실 업무 공평 로테이션 규칙</H3>
        <div className="grid grid-cols-2 gap-3 text-[10.5px] leading-[1.6]">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong className="block text-slate-800 mb-1">업무 누적 카운팅 시스템</strong>
            이번 달 누적 배정 횟수를 실시간으로 계산하여 각 업무별로 횟수가 가장 적은 사람에게 우선 배정(Round-Robin 기반)하는 형평성 알고리즘이 적용됩니다.
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong className="block text-slate-800 mb-1">고정 휴무 및 OFF 우선 반영</strong>
            근무표 상의 OFF, 연차, 반차 등의 일정은 가장 먼저 파싱되어 해당 직원은 당일 모든 로테이션 풀에서 완전 제외된 채로 시뮬레이션됩니다.
          </div>
        </div>

        <H3>6.3. 결원 발생 시 당일 동적 대체 배정 및 수동 조정 요령</H3>
        <div className="grid grid-cols-2 gap-3 text-[10.5px] leading-[1.6]">
          <div className="border border-indigo-100 bg-indigo-50/40 p-2 rounded-md">
            <strong className="block text-indigo-700">시스템 자동 재조정 (Re-Balance)</strong>
            당일 갑작스러운 연차 발생 시, 해당 직원을 OFF로 변경하고 '자동 배정 실행'을 다시 누르면 나머지 인원을 대상으로 최적의 업무를 즉시 재분배합니다.
          </div>
          <div className="border border-teal-100 bg-teal-50/40 p-2 rounded-md">
            <strong className="block text-teal-700">관리자 수동 조정 (Drag & Drop)</strong>
            자동 배정 결과에서 특정 직원의 업무를 바꾸고 싶을 경우, 셀을 클릭하거나 드래그하여 수동으로 변경(Override)할 수 있으며 이는 최종 저장 시 반영됩니다.
          </div>
        </div>
      </ManualPage>

      {/* ── Page 7: 재고 현황 관리 & 입출고 ────────────────────────────────── */}
      <ManualPage pageNumber={7} totalPages={9}>
        <H1>시스템 기능 매뉴얼 (관리자용)</H1>
        <H2>7. 재고 현황 관리 및 입출고 등록</H2>
        <P>전체 품목의 적정재고 대비 현재고를 소분류별 정렬 및 부족 재고 알림 뱃지와 함께 관리하며 입출고 이력을 기록합니다.</P>

        <Snapshot caption="재고 목록 테이블 및 입출고 통합 모달 (TransactionModal)">
          <div className="bg-white border rounded-xl shadow-sm p-3 space-y-2 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <div className="flex gap-2">
                <div className="border rounded px-2 py-1 flex items-center gap-1 bg-slate-50"><Search size={10} /> 품목 검색</div>
                <div className="border rounded px-2 py-1 flex items-center gap-1 bg-slate-50"><Filter size={10} /> 소분류 정렬</div>
              </div>
              <div className="flex gap-1 text-[10px]">
                <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded font-bold cursor-pointer">30슬롯 엑셀 다운로드</span>
                <span className="bg-blue-600 text-white px-2 py-1 rounded font-bold cursor-pointer">+ 신규 품목</span>
              </div>
            </div>

            {/* Inventory List & Transaction Modal Overlay */}
            <div className="relative">
              <table className="w-full text-[10px] text-left">
                <thead className="bg-slate-100 font-bold border-b">
                  <tr><th className="p-1.5">대분류</th><th className="p-1.5">품목명</th><th className="p-1.5 text-right">적정재고</th><th className="p-1.5 text-right">현재고</th><th className="p-1.5 text-center">관리</th></tr>
                </thead>
                <tbody>
                  <tr className="border-b bg-red-50/50">
                    <td className="p-1.5">위생용품</td><td className="p-1.5 font-bold">테이블 냅킨</td><td className="p-1.5 text-right">5.0</td>
                    <td className="p-1.5 text-right text-red-600 font-bold flex items-center justify-end gap-1">2.0 <AlertCircle size={10} /></td>
                    <td className="p-1.5 text-center"><Settings size={10} className="mx-auto text-slate-400" /></td>
                  </tr>
                </tbody>
              </table>

              {/* Transaction Modal Mini Mockup */}
              <div className="mt-2 bg-slate-900/40 p-2 rounded-lg backdrop-blur-xs">
                <div className="bg-white rounded-lg p-2.5 max-w-xs mx-auto shadow-lg space-y-2 border text-[10px]">
                  <div className="font-bold border-b pb-1 flex justify-between"><span>입출고 등록 (테이블 냅킨)</span><span className="text-slate-400">X</span></div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-red-100 text-red-700 py-1 text-center font-bold rounded border border-red-300">출고 (-Out)</div>
                    <div className="flex-1 bg-slate-100 text-slate-500 py-1 text-center font-bold rounded">입고 (+In)</div>
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value="5.0" readOnly className="w-full border rounded p-1 text-right font-bold" />
                    <span className="p-1 bg-slate-100 rounded text-slate-600 font-bold">묶음</span>
                  </div>
                  <div className="bg-blue-600 text-white text-center py-1 rounded font-bold cursor-pointer">저장 (Enter)</div>
                </div>
              </div>
            </div>
          </div>
        </Snapshot>

        <H3>7.1. 30슬롯 엑셀 내보내기 & 실시간 스냅샷</H3>
        <ul className="list-disc pl-5 space-y-1 text-[11.5px] leading-[1.6]">
          <Li><strong>표준 엑셀 포맷 출력:</strong> 재고 목록 엑셀 내보내기 시 시설에서 사용하는 30개 슬롯(줄) 포맷을 자동으로 유지하여 출력물 호환성을 극대화합니다.</Li>
          <Li><strong>이력 스냅샷 자동 저장:</strong> 입출고가 등록되는 정확한 시점의 <Code>currentStockSnapshot</Code>을 DB에 자동 저장해 추후 재고 역추적과 감사가 용이합니다.</Li>
        </ul>

        <H3>7.2. 품목마스터 CRUD 및 적정재고 설정 가이드</H3>
        <div className="grid grid-cols-2 gap-3 text-[10.5px] leading-[1.6]">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong className="block text-slate-800 mb-1">품목 추가/수정/삭제 (CRUD)</strong>
            상단의 '+ 신규 품목' 버튼을 통해 새로운 식자재나 소모품을 등록할 수 있습니다. 품목명, 대/소분류, 규격 및 단위를 일관성 있게 입력해야 통계에 정상 반영됩니다.
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong className="block text-slate-800 mb-1">적정재고(안전재고) 수치 설정</strong>
            각 품목별로 시설 운영에 필수적인 최소 수량을 '적정재고'로 입력합니다. 적정재고는 주간 소모량과 재발주 소요 기간을 고려하여 여유 있게 설정하는 것을 권장합니다.
          </div>
        </div>

        <H3>7.3. 부족 재고 알림 설정 및 자동 발주 연동 방안</H3>
        <div className="grid grid-cols-2 gap-3 text-[10.5px] leading-[1.6]">
          <div className="bg-red-50/50 p-2.5 rounded-lg border border-red-100">
            <strong className="block text-red-800 mb-1">경고 뱃지 및 색상 표시 기준</strong>
            현재고가 설정한 적정재고 수치 미만으로 떨어지면 리스트에 즉시 빨간색 경고 아이콘(<AlertCircle size={10} className="inline text-red-600" />)과 함께 행 배경색이 붉게 표시되어 관리자의 주의를 환기합니다.
          </div>
          <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
            <strong className="block text-blue-800 mb-1">부족분 자동 계산 및 발주 연동</strong>
            알림이 뜬 품목들은 메인 화면의 '긴급 발주 요망 리스트'에 자동 편입되며, 클릭 한 번으로 부족한 수량만큼의 발주서 엑셀 초안을 생성할 수 있습니다.
          </div>
        </div>
      </ManualPage>

      {/* ── Page 8: 스마트 엑셀 일괄 등록 & 수불부 파서 ─────────────────────── */}
      <ManualPage pageNumber={8} totalPages={9}>
        <H1>시스템 기능 매뉴얼 (관리자용)</H1>
        <H2>8. 스마트 엑셀 일괄 등록 및 수불부 파서</H2>
        <P>서로 다른 양식의 외부 엑셀 파일 컬럼을 DB 항목과 스마트 자동 매핑하고, 수불부 이월 재고를 자동 계산해 업로드합니다.</P>

        <Snapshot caption="스마트 필드 매핑 및 수불부 엑셀 파서 (ExcelImport / TransactionHistoryImport)">
          <div className="bg-white border rounded-xl shadow-sm p-4 space-y-3 text-xs">
            <div className="bg-purple-50 border border-purple-200 p-2.5 rounded-lg space-y-2">
              <div className="font-bold text-purple-900 flex items-center gap-1.5">
                <Wand2 size={14} className="text-purple-600" /> 스마트 필드 컬럼 매핑 Engine
              </div>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between items-center bg-white p-1.5 rounded border border-purple-100">
                  <span className="text-slate-600 font-medium">Category (DB 전역 카테고리)</span>
                  <ArrowUpCircle size={12} className="text-purple-500 rotate-90" />
                  <span className="font-bold text-slate-800 bg-purple-100/60 px-2 py-0.5 rounded">분류 (Excel 헤더)</span>
                </div>
                <div className="flex justify-between items-center bg-white p-1.5 rounded border border-purple-100">
                  <span className="text-slate-600 font-medium">Item Name (DB 품목명)</span>
                  <ArrowUpCircle size={12} className="text-purple-500 rotate-90" />
                  <span className="font-bold text-slate-800 bg-purple-100/60 px-2 py-0.5 rounded">품명 (Excel 헤더)</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border p-2.5 rounded-lg space-y-1 text-[10px]">
              <div className="font-bold text-slate-800 flex items-center gap-1">
                <History size={12} className="text-blue-600" /> 수불부 엑셀 임포트 (이월 재고 자동 감지)
              </div>
              <P className="text-[10px] text-slate-500">병합셀 및 동적 헤더를 자동 파싱하여 전월 이월 수량을 1월 1일 이월 거래건으로 등록합니다.</P>
            </div>
          </div>
        </Snapshot>

        <H3>8.1. 엑셀 업로드 유의사항 및 자동화 규칙</H3>
        <ul className="list-disc pl-5 space-y-1 text-[11.5px] leading-[1.6]">
          <Li><strong>자동 헤더 감지</strong>: 엑셀 파일 내 1~5행 사이의 컬럼명을 자동 스캔하여 DB 필드와 유사도를 비교해 스마트하게 매핑합니다.</Li>
          <Li><strong>이월 재고 처리</strong>: 거래 내역 임포트 시 기초 이월재고는 <Code>재고이월</Code> 사유로 자동 차감/가산 처리되어 장부의 정합성을 보장합니다.</Li>
          <Li><strong>데이터 검증 로직</strong>: 업로드 전 필수값이 누락되거나 데이터 형식이 맞지 않는 셀을 붉은색으로 강조 표시하여 사전 수정을 유도합니다.</Li>
        </ul>

        <H3>8.2. 수불부 월간 마감 절차 및 이월 재고 확정 프로세스</H3>
        <div className="grid grid-cols-2 gap-3 text-[10.5px] leading-[1.6]">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong className="block text-slate-800 mb-1">1단계: 월말 재고 실사 대조</strong>
            매월 말일, 전산상의 현재고와 실제 창고 재고량을 대조하여 오차를 파악합니다. 차이가 발생한 품목은 '실사조정' 사유로 입출고를 등록하여 수량을 맞춥니다.
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong className="block text-slate-800 mb-1">2단계: 월간 마감 및 이월 확정</strong>
            조정이 완료되면 '월 마감' 버튼을 눌러 해당 월의 데이터를 잠금 처리합니다. 확정된 최종 재고는 다음 달의 '기초 이월 재고'로 자동 설정되어 수불부에 반영됩니다.
          </div>
        </div>

        <H3>8.3. 외부 거래처별 납품 엑셀 양식 호환 가이드</H3>
        <div className="grid grid-cols-3 gap-2 text-[10.5px] leading-[1.6]">
          <div className="border border-blue-100 bg-blue-50/30 p-2 rounded-md">
            <strong className="block text-blue-700">A 유통 (식자재)</strong>
            '품명'과 '수량' 컬럼이 분리되어 있어 기본 파서로 100% 자동 매핑됩니다.
          </div>
          <div className="border border-amber-100 bg-amber-50/30 p-2 rounded-md">
            <strong className="block text-amber-700">B 상사 (소모품)</strong>
            규격이 품명에 포함된 경우, 엑셀 편집 없이 시스템이 괄호 안의 규격을 분리 파싱합니다.
          </div>
          <div className="border border-emerald-100 bg-emerald-50/30 p-2 rounded-md">
            <strong className="block text-emerald-700">C 마트 (기타)</strong>
            행 방향 병합셀이 포함된 양식은 첫 번째 행의 값을 기준으로 하위 행에 동일하게 복사 적용합니다.
          </div>
        </div>
      </ManualPage>

      {/* ── Page 9: AI 재고 분석 & 관리자 도구 ─────────────────────────────── */}
      <ManualPage pageNumber={9} totalPages={9}>
        <H1>시스템 기능 매뉴얼 (관리자용)</H1>
        <H2>9. AI 재고 분석 및 관리자 도구</H2>
        <P>Gemini AI 엔진을 활용해 카테고리별 재고 소진 속도와 긴급 발주를 추천받고, 기준 정보 및 백업/복원을 안전하게 관리합니다.</P>

        <Snapshot caption="AI 재고 분석 리포트 및 기준 정보 관리 모달">
          <div className="bg-white border rounded-xl shadow-sm p-3 space-y-3 text-xs">
            {/* AI Report Card */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 p-2.5 rounded-lg space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-purple-900 border-b border-purple-200 pb-1">
                <Sparkles size={14} className="text-purple-600" /> Gemini AI 재고 분석 리포트
              </div>
              <div className="text-[10px] space-y-1 text-slate-700">
                <p><strong>📢 소진 속도 분석</strong>: <span className="text-red-600 font-bold">위생용품</span> 카테고리의 사용량이 전월 대비 15% 증가했습니다.</p>
                <div className="bg-white p-1.5 rounded border text-[9px] flex justify-between items-center">
                  <span>추천 발주: 테이블 냅킨</span>
                  <span className="bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">부족량: -3.0 묶음</span>
                </div>
              </div>
            </div>

            {/* Master Data Manager Tools Grid */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 border rounded-lg bg-slate-50 text-center hover:bg-slate-100 cursor-pointer">
                <Box size={16} className="mx-auto text-indigo-500 mb-1" />
                <div className="font-bold">기준 정보 관리</div>
                <div className="text-[9px] text-slate-400">대분류/소분류 CRUD 및 통합</div>
              </div>
              <div className="p-2 border rounded-lg bg-slate-50 text-center hover:bg-slate-100 cursor-pointer">
                <History size={16} className="mx-auto text-slate-600 mb-1" />
                <div className="font-bold">데이터 백업 & 복원</div>
                <div className="text-[9px] text-slate-400">Firestore DB 백업/복원</div>
              </div>
            </div>
          </div>
        </Snapshot>

        <H3>9.1. AI 재고 분석 리포트 활용</H3>
        <ul className="list-disc pl-5 space-y-1 text-[11.5px] leading-[1.6]">
          <Li><strong>소진 속도 자동 분석:</strong> 지난 달 대비 품목별, 카테고리별 사용량 증감을 AI가 비교 분석하여 가장 시급하게 보충이 필요한 품목을 추천합니다.</Li>
          <Li><strong>적정 재고 도출:</strong> 주기적인 데이터 학습을 통해 계절적, 월별 요인에 따른 적정 재고 수준을 재산정하여 관리자에게 제안합니다.</Li>
        </ul>

        <H3>9.2. 클라우드 백업 주기 설정 및 복원 절차 상세</H3>
        <div className="grid grid-cols-2 gap-3 text-[10.5px] leading-[1.6]">
          <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
            <strong className="block text-blue-800 mb-1">정기 자동 백업 스케줄링</strong>
            주 1회 또는 월 1회로 클라우드 DB 백업 주기를 설정할 수 있습니다. 생성된 백업 파일은 암호화되어 안전한 저장소에 보관되며 최대 1년간 유지됩니다.
          </div>
          <div className="bg-green-50/50 p-2.5 rounded-lg border border-green-100">
            <strong className="block text-green-800 mb-1">데이터 복원 및 정합성 검증</strong>
            시스템 오류 또는 데이터 유실 발생 시 관리자는 특정 날짜의 스냅샷을 선택하여 롤백할 수 있습니다. 복원 직후 자동 무결성 검증이 실행됩니다.
          </div>
        </div>

        <H3>9.3. 시스템 감사 로그 및 이상 접근 탐지 안내</H3>
        <ul className="list-disc pl-5 space-y-1 text-[11.5px] leading-[1.6]">
          <Li><strong>감사(Audit) 로그 기록:</strong> 관리자 권한으로 수행되는 기준 정보 변경, 대량 데이터 삭제, 사용자 계정 생성 등 주요 작업은 시간 및 IP와 함께 영구 기록됩니다.</Li>
          <Li><strong>이상 접근(Anomaly) 탐지 시스템:</strong> 평소와 다른 지역에서의 로그인 시도나, 심야 시간대의 대량 엑셀 다운로드 요청 발생 시 시스템이 즉각 차단하고 최고 관리자에게 알림을 발송합니다.</Li>
        </ul>
      </ManualPage>
    </>
  );
};

export default UserManual;
