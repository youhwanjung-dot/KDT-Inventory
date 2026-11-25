import React, { useMemo, useState, useRef } from 'react';
import { X, AlertTriangle, Package, Clock, Wand2, Loader2, HardDrive, FileText } from 'lucide-react';
import { InventoryItem, InventoryTransaction } from '../types';
import ReactMarkdown from 'react-markdown';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import ConfirmationModal from './ConfirmationModal';

interface ReportProps {
  items: InventoryItem[];
  transactions: InventoryTransaction[];
  onClose: () => void;
}

const reportPrintStyle = `
  @page inventory-analysis {
    size: A3 portrait;
    margin: 10mm;
  }
  @media print {
    .report-page {
      page: inventory-analysis;
      width: 277mm !important;
      min-height: 400mm !important;
      height: 400mm !important;
      padding: 10mm !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      break-after: page !important;
      page-break-after: always !important;
    }
    .report-page > header {
      display: flex !important;
    }
    .report-page:last-child {
      break-after: avoid !important;
      page-break-after: avoid !important;
    }
  }
`;

const InventoryReport: React.FC<ReportProps> = ({ items, transactions, onClose }) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [aiInsight, setAiInsight] = useState('');
  const reportContentRef = useRef<HTMLDivElement>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: React.ReactNode } | null>(null);

  // Older Excel imports stored 1 as a missing safe-stock placeholder; treat it like absent data.
  const analysisItems = useMemo(() => items.map((item) => {
    const safeStock = Number(item.safeStock) || 0;
    const legacyMissingValue = safeStock === 1 && item.id.startsWith('IMP-');
    return {
      ...item,
      safeStock: safeStock > 0 && !legacyMissingValue ? safeStock : 0,
    };
  }), [items]);

  // --- Analysis Logic (All limited to Top 5) ---
  // 명시적 적정재고(safeStock > 0)가 있으면 그 기준으로, 없으면 현재고 0일 때만 부족
  const shortageData = useMemo(() => analysisItems
    .filter(i => i.safeStock > 0 ? i.currentStock < i.safeStock : i.currentStock === 0)
    .map(i => ({...i, shortage: i.safeStock > 0 ? i.safeStock - i.currentStock : 0}))
    .sort((a,b) => b.shortage - a.shortage)
    .slice(0, 5), [analysisItems]);
  const overstockData = useMemo(() => analysisItems.filter(i => i.safeStock > 0 && i.currentStock > i.safeStock * 2.5).map(i => ({...i, excess: i.currentStock - i.safeStock, ratio: ((i.currentStock - i.safeStock) / i.safeStock) * 100})).sort((a,b) => b.ratio - a.ratio).slice(0, 5), [analysisItems]);
  const deadStockData = useMemo(() => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const lastOutMap = new Map<string, string>();
    transactions.filter(t => t.type === 'OUT').forEach(t => { if (!lastOutMap.has(t.itemId) || t.date > lastOutMap.get(t.itemId)!) { lastOutMap.set(t.itemId, t.date); }});
    return items.filter(item => { const lastOutDate = lastOutMap.get(item.id); if (item.currentStock <= 0) return false; if (!lastOutDate) return true; return new Date(lastOutDate) < ninetyDaysAgo; }).map(item => ({ ...item, lastOutDate: lastOutMap.get(item.id) || 'N/A' })).sort((a, b) => (a.lastOutDate > b.lastOutDate ? 1 : -1)).slice(0, 5);
  }, [items, transactions]);
  const turnoverData = useMemo(() => {
    const outCounts = new Map<string, number>();
    transactions.filter(t => t.type === 'OUT').forEach(t => { outCounts.set(t.itemId, (outCounts.get(t.itemId) || 0) + 1); });
    return items.map(item => ({ ...item, outCount: outCounts.get(item.id) || 0 })).filter(item => item.outCount > 0).sort((a, b) => b.outCount - a.outCount).slice(0, 5);
  }, [items, transactions]);

  // --- Handlers (Deterministic Statistical Summary without external AI) ---
  const handleGenerateInsight = async () => {
    setIsGeneratingInsight(true);
    try {
      const lines: string[] = [
        `### KDT 자재 재고 요약 분석`,
        `- **관리 대상 품목**: 총 **${items.length.toLocaleString('ko-KR')}개** / 누적 수불 **${transactions.length.toLocaleString('ko-KR')}건**`,
        `- **적정재고 미달**: **${shortageData.length}건** ${shortageData.length > 0 ? `(주요: ${shortageData.map(i => `${i.category} ${i.name}`).join(', ')})` : '(없음)'}`,
        `- **장기 미출고(90일+)**: **${deadStockData.length}건**`,
        `- **출고 빈도 상위**: ${turnoverData.length > 0 ? turnoverData.map(i => `${i.name}(${i.outCount}회)`).join(', ') : '출고 이력 없음'}`,
      ];
      setAiInsight(lines.join('\n'));
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const handleDownloadPDF = async () => {
    const reportContainer = reportContentRef.current;
    if (!reportContainer || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      await document.fonts.ready;
      const pdf = new jsPDF('p', 'mm', 'a3');
      const pageElements = reportContainer.querySelectorAll('.report-page');
      
      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i] as HTMLElement;
        const canvas = await html2canvas(pageEl, { 
            scale: 2, 
            useCORS: true, 
            backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff' 
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        if (i > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      pdf.save(`InventoryAnalytics_${dateStr}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      setAlertModal({ title: 'PDF 생성 오류', message: 'PDF 생성 중 오류가 발생했습니다.' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // --- Render Helpers ---
  const SummaryCard: React.FC<{ icon: React.ElementType, title: string, value: string | number, color: string, unit: string }> = ({ icon: Icon, title, value, color, unit }) => (
    <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${color}`} strokeWidth={2.5} />
        <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{title}</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{value} <span className="text-sm font-medium">{unit}</span></p>
        </div>
    </div>
  );

  const ReportSection: React.FC<{ title: React.ReactNode, children: React.ReactNode, className?: string }> = ({ title, children, className }) => (
    <section className={`report-section break-inside-avoid ${className}`}>
      <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3 print:text-black">{title}</h2>
      {children}
    </section>
  );

  const ReportPageFooter = () => (
     <footer className="text-center pt-8 mt-auto text-xs text-slate-400 dark:text-slate-500">
        <p>KDT 재고관리 시스템 | 본 리포트는 시스템 데이터에 기반하여 작성되었습니다.</p>
    </footer>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 dark:bg-black/70 backdrop-blur-sm flex flex-col items-center p-0 printable-area-container animate-fade-in">
        <style>{reportPrintStyle}</style>
        <div className="w-full bg-slate-50 dark:bg-slate-900 flex justify-between items-center p-3 border-b border-slate-200 dark:border-slate-800 no-print sticky top-0 z-10">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Wand2 size={20} className="text-violet-500" /> AI 재고 분석 리포트</h2>
            <div className="flex items-center gap-3">
                <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg flex items-center gap-2 text-sm font-bold disabled:opacity-60 shadow-sm">
                    {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} PDF 저장
                </button>
                <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"><X size={20} /></button>
            </div>
        </div>
        <div className="w-full flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-100 dark:bg-slate-950">
          <div ref={reportContentRef} className="flex flex-col items-center gap-8">
            {/* Page 1: Data Analysis */}
            <div className="report-page w-[297mm] min-h-[420mm] bg-white dark:bg-slate-800 shadow-lg p-10 text-slate-800 dark:text-slate-200 rounded-lg flex flex-col">
              <header className="break-after-avoid pb-4 border-b-2 border-slate-800 dark:border-slate-300">
                  <div className="flex justify-between items-start">
                      <div>
                          <h1 className="text-2xl font-bold text-slate-900 dark:text-white print:text-black">KDT 재고분석 보고서</h1>
                          <p className="text-sm text-slate-600 dark:text-slate-400 print:text-gray-600">자재관리 데이터 분석 리포트</p>
                      </div>
                      <div className="text-right text-xs text-slate-500 dark:text-slate-400 print:text-gray-500">
                          <p>분석일자: {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                          <p>Generated by System AI</p>
                      </div>
                  </div>
              </header>
              <main className="py-10 flex-1 grid grid-cols-12 gap-x-10">
                <div className="col-span-4 space-y-6">
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 print:text-black">데이터 요약</h2>
                    <div className="grid grid-cols-1 divide-y divide-slate-200 dark:divide-slate-700 border rounded-lg shadow-sm bg-white dark:bg-slate-800 print:bg-white">
                        <div className="p-4"><SummaryCard icon={HardDrive} title="전체 품목" value={items.length} color="text-slate-500" unit="개" /></div>
                        <div className="p-4"><SummaryCard icon={AlertTriangle} title="긴급 발주" value={shortageData.length} color="text-red-500" unit="건" /></div>
                        <div className="p-4"><SummaryCard icon={Package} title="적정재고 초과" value={overstockData.length} color="text-orange-500" unit="건" /></div>
                        <div className="p-4"><SummaryCard icon={Clock} title="장기 미사용" value={deadStockData.length} color="text-orange-500" unit="건" /></div>
                    </div>
                </div>
                <div className="col-span-8 space-y-8">
                    <ReportSection title={<><span className="text-red-600">1.</span> 긴급 발주 요망 품목 (Top 5)</>}>
                        <table className="w-full table-fixed text-xs text-left"><colgroup><col style={{ width: '27%' }} /><col style={{ width: '23%' }} /><col style={{ width: '16%' }} /><col style={{ width: '17%' }} /><col style={{ width: '17%' }} /></colgroup><thead className="bg-slate-100 dark:bg-slate-700 print:bg-gray-100"><tr className="break-inside-avoid"><th className="p-2 font-medium whitespace-nowrap">품목명</th><th className="p-2 font-medium whitespace-nowrap">카테고리</th><th className="p-2 font-medium text-center whitespace-nowrap">현재고</th><th className="p-2 font-medium text-center whitespace-nowrap">적정재고</th><th className="p-2 font-medium text-center text-red-600 whitespace-nowrap">부족분</th></tr></thead>
                        <tbody>{shortageData.map(item => (<tr key={item.id} className="border-b dark:border-slate-700 print:border-gray-200 break-inside-avoid bg-red-50 dark:bg-red-900/20 print:bg-white"><td title={item.name} className="p-2 font-medium whitespace-nowrap overflow-hidden text-ellipsis">{item.name}</td><td title={item.category} className="p-2 whitespace-nowrap overflow-hidden text-ellipsis">{item.category}</td><td className="p-2 text-center font-bold text-red-600 whitespace-nowrap">{Math.round(item.currentStock).toLocaleString('ko-KR')}</td><td className="p-2 text-center whitespace-nowrap">{Math.round(item.safeStock).toLocaleString('ko-KR')}</td>
<td className="p-2 text-center font-bold text-red-600 whitespace-nowrap">{Math.round(-item.shortage).toLocaleString('ko-KR')}</td></tr>))}
                        {shortageData.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-500">데이터 없음</td></tr>}</tbody></table>
                    </ReportSection>
                    <ReportSection title={<><span className="text-orange-600">2.</span> 과다 보유 / 공간 낭비 (Top 5)</>}>
                        <table className="w-full table-fixed text-xs text-left"><colgroup><col style={{ width: '25%' }} /><col style={{ width: '19%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /><col style={{ width: '18%' }} /><col style={{ width: '10%' }} /></colgroup><thead className="bg-slate-100 dark:bg-slate-700 print:bg-gray-100"><tr className="break-inside-avoid"><th className="p-2 font-medium whitespace-nowrap">품목명</th><th className="p-2 font-medium whitespace-nowrap">카테고리</th><th className="p-2 font-medium text-center whitespace-nowrap">현재고</th><th className="p-2 font-medium text-center whitespace-nowrap">적정재고</th><th className="p-2 font-medium text-center text-orange-600 whitespace-nowrap">초과 수량</th><th className="p-2 font-medium text-center text-orange-600 whitespace-nowrap">초과율</th></tr></thead>
                        <tbody>{overstockData.map(item => (<tr key={item.id} className="border-b dark:border-slate-700 print:border-gray-200 break-inside-avoid"><td title={item.name} className="p-2 font-medium whitespace-nowrap overflow-hidden text-ellipsis">{item.name}</td><td title={item.category} className="p-2 whitespace-nowrap overflow-hidden text-ellipsis">{item.category}</td><td className="p-2 text-center font-bold whitespace-nowrap">{Math.round(item.currentStock).toLocaleString('ko-KR')}</td><td className="p-2 text-center whitespace-nowrap">{Math.round(item.safeStock).toLocaleString('ko-KR')}</td><td className="p-2 text-center font-bold text-orange-600 whitespace-nowrap">+ {Math.round(item.excess).toLocaleString('ko-KR')}</td><td className="p-2 text-center font-bold text-orange-600 whitespace-nowrap">{item.ratio.toFixed(1)}%</td></tr>))}
                        {overstockData.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-500">데이터 없음</td></tr>}</tbody></table>
                    </ReportSection>
                    <div className="grid grid-cols-1 gap-8">
                        <ReportSection title={<><span className="text-orange-600">3.</span> 장기 미사용 (Top 5, 90일 이상)</>}>
                            <table className="w-full table-fixed text-xs text-left"><colgroup><col style={{ width: '32%' }} /><col style={{ width: '25%' }} /><col style={{ width: '18%' }} /><col style={{ width: '25%' }} /></colgroup><thead className="bg-slate-100 dark:bg-slate-700 print:bg-gray-100"><tr className="break-inside-avoid"><th className="p-2 font-medium whitespace-nowrap">품목명</th><th className="p-2 font-medium whitespace-nowrap">카테고리</th><th className="p-2 font-medium text-center whitespace-nowrap">현재고</th><th className="p-2 font-medium whitespace-nowrap">최종출고일</th></tr></thead>
                            <tbody>{deadStockData.map(item => (<tr key={item.id} className="border-b dark:border-slate-700 print:border-gray-200 break-inside-avoid"><td title={item.name} className="p-2 font-medium whitespace-nowrap overflow-hidden text-ellipsis">{item.name}</td><td title={item.category} className="p-2 whitespace-nowrap overflow-hidden text-ellipsis">{item.category}</td><td className="p-2 text-center font-bold whitespace-nowrap">{Math.round(item.currentStock).toLocaleString('ko-KR')}</td><td className="p-2 text-slate-500 text-xs whitespace-nowrap">{item.lastOutDate}</td></tr>))}
                            {deadStockData.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-500">데이터 없음</td></tr>}</tbody></table>
                        </ReportSection>
                        <ReportSection title={<><span className="text-green-600">4.</span> 재고 회전율 (Top 5)</>}>
                            <table className="w-full table-fixed text-xs text-left"><colgroup><col style={{ width: '38%' }} /><col style={{ width: '32%' }} /><col style={{ width: '30%' }} /></colgroup><thead className="bg-slate-100 dark:bg-slate-700 print:bg-gray-100"><tr className="break-inside-avoid"><th className="p-2 font-medium whitespace-nowrap">품목명</th><th className="p-2 font-medium whitespace-nowrap">카테고리</th><th className="p-2 font-medium text-center whitespace-nowrap">누적 출고량</th></tr></thead>
                            <tbody>{turnoverData.map(item => (<tr key={item.id} className="border-b dark:border-slate-700 print:border-gray-200 break-inside-avoid"><td title={item.name} className="p-2 font-medium whitespace-nowrap overflow-hidden text-ellipsis">{item.name}</td><td title={item.category} className="p-2 whitespace-nowrap overflow-hidden text-ellipsis">{item.category}</td><td className="p-2 text-center font-bold whitespace-nowrap">{item.outCount} 회</td></tr>))}
                            {turnoverData.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-slate-500">출고 데이터 없음</td></tr>}</tbody></table>
                        </ReportSection>
                    </div>
                </div>
              </main>
              <ReportPageFooter />
            </div>
            
            {/* Page 2: AI Insight */}
            <div className="report-page w-[297mm] min-h-[420mm] bg-white dark:bg-slate-800 shadow-lg p-10 text-slate-800 dark:text-slate-200 rounded-lg flex flex-col">
              <main className="py-8 flex-1 flex flex-col">
                <div className="pt-6 border-t-2 border-slate-800 dark:border-slate-300 flex-1 flex flex-col">
                    <ReportSection title="✨ 전문가 종합 의견 (AI Insight)">
                        <div className="flex justify-end no-print mb-3 -mt-10"><button onClick={handleGenerateInsight} disabled={isGeneratingInsight} className="px-3 py-1 bg-violet-100 text-violet-700 border border-violet-300 hover:bg-violet-200 dark:bg-violet-900/50 dark:text-violet-300 dark:border-violet-700 dark:hover:bg-violet-900 rounded-md flex items-center gap-2 text-xs font-bold disabled:opacity-60"><Wand2 size={12} /> AI 의견 생성/갱신</button></div>
                        <div className="p-6 border rounded-lg bg-slate-50 dark:bg-slate-900/50 min-h-[150px] border-slate-200 dark:border-slate-700 flex-1 flex flex-col justify-center">
                            {isGeneratingInsight ? <div className="flex items-center justify-center h-full text-slate-500"><Loader2 size={24} className="animate-spin" /> <p className="ml-3">AI가 종합 의견을 생성 중입니다...</p></div> :
                            aiInsight ? <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-h2:mb-2 prose-h2:mt-4 prose-strong:text-slate-800 dark:prose-strong:text-slate-100"><ReactMarkdown>{aiInsight}</ReactMarkdown></div> :
                            <div className="text-sm text-slate-400 text-center">
                                <p>위 데이터를 바탕으로 AI가 전략적 조언을 제공합니다.</p>
                                <p className="font-bold mt-1">'AI 의견 생성' 버튼을 눌러주세요.</p>
                                <p className="text-xs mt-2">(인쇄 시 생성된 의견이 여기에 포함됩니다.)</p>
                            </div>
                            }
                        </div>
                    </ReportSection>
                </div>
              </main>
              <ReportPageFooter />
            </div>
          </div>
        </div>
      {alertModal && (
        <ConfirmationModal
          title={alertModal.title}
          message={alertModal.message}
          confirmLabel="확인"
          onConfirm={() => setAlertModal(null)}
        />
      )}
    </div>
  );
};

export default InventoryReport;
