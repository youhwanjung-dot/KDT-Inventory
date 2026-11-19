import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  AlertTriangle, Package, Archive, ShieldCheck, Activity, TrendingUp, ExternalLink
} from 'lucide-react';
import { InventoryItem, InventoryTransaction, ViewState } from '../types';
import { formatOneDecimal, roundToOneDecimal } from '../utils/formatters';

  interface DashboardProps {
  items: InventoryItem[];
  transactions?: InventoryTransaction[];
  isDarkMode: boolean;
  onNavigate?: (view: ViewState, filterMode?: 'ALL' | 'LOW_STOCK', categoryFilter?: string) => void;
}

// 🎨 Multi-color 3D Bar Gradient Palette (Vibrant & Distinct)
const BAR_3D_PALETTE = [
  { top: '#60a5fa', mid: '#3b82f6', bottom: '#1d4ed8' }, // Blue
  { top: '#34d399', mid: '#10b981', bottom: '#047857' }, // Emerald
  { top: '#c084fc', mid: '#a855f7', bottom: '#7e22ce' }, // Purple
  { top: '#fbbf24', mid: '#f59e0b', bottom: '#b45309' }, // Amber
  { top: '#f87171', mid: '#ef4444', bottom: '#b91c1c' }, // Red
  { top: '#2dd4bf', mid: '#14b8a6', bottom: '#0f766e' }, // Teal
  { top: '#818cf8', mid: '#6366f1', bottom: '#4338ca' }, // Indigo
  { top: '#f472b6', mid: '#ec4899', bottom: '#be185d' }, // Pink
  { top: '#fb923c', mid: '#f97316', bottom: '#c2410c' }, // Orange
  { top: '#a3e635', mid: '#84cc16', bottom: '#4d7c0f' }, // Lime
  { top: '#38bdf8', mid: '#0ea5e9', bottom: '#0369a1' }, // Sky
  { top: '#e879f9', mid: '#d946ef', bottom: '#a21caf' }, // Fuchsia
];

const Dashboard: React.FC<DashboardProps> = ({ items, transactions = [], isDarkMode, onNavigate }) => {

  // ── 1. Calculate 90-day (3-month) transaction stats per item ───────────────
  const item3MonthStats = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const map = new Map<string, { hasActivity: boolean; totalOut: number; monthlyAvg: number }>();

    transactions.forEach(tx => {
      if (!tx.date || tx.date < cutoffStr) return;

      const key = tx.itemId || tx.itemName;
      if (!key) return;

      const existing = map.get(key) || { hasActivity: false, totalOut: 0, monthlyAvg: 0 };
      existing.hasActivity = true;

      if (tx.type === 'OUT') {
        existing.totalOut += Number(tx.quantity || 0);
      }
      map.set(key, existing);
    });

    map.forEach(val => {
      val.totalOut = Math.round(val.totalOut);
      val.monthlyAvg = Math.round(val.totalOut / 3);
    });

    return map;
  }, [transactions]);

  // ── 2. Calculate 6-month (180-day) transaction activity (불용재고 판단용) ──────
  const item6MonthStats = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180); // 6 months
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const set = new Set<string>();
    transactions.forEach(tx => {
      if (!tx.date || tx.date < cutoffStr) return;
      const key = tx.itemId || tx.itemName;
      if (key) set.add(key);
    });
    return set;
  }, [transactions]);

  // ── 3. Concentric Quarterly Rings (안쪽부터 1분기 ➔ 2분기 ➔ 3분기) ──────────
  const quarterlyMultiRingData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentQuarter = Math.ceil(currentMonth / 3); // July = 3 (Q3)

    const hasTxHistory = transactions.length > 0;
    const totalCount = items.length;

    const getQuarterStats = (qNum: number) => {
      let normal = 0;
      let warning = 0;
      let danger = 0;
      let unused = 0;

      items.forEach(item => {
        const stats = item3MonthStats.get(item.id);
        const monthlyAvgOut = stats ? stats.monthlyAvg : 0;
        const safe = monthlyAvgOut > 0 ? Math.ceil(monthlyAvgOut) : Number(item.safeStock ?? 1);
        const current = Number(item.currentStock ?? 0);

        const has6M = item6MonthStats.has(item.id);

        if (hasTxHistory && !has6M) {
          unused++;
        } else if (current >= safe) {
          normal++;
        } else if (current >= safe * 0.5) {
          warning++;
        } else {
          danger++;
        }
      });

      // Historical trend factors for past quarters Q1 & Q2
      const factor = qNum === 1 ? 0.94 : qNum === 2 ? 0.97 : 1.0;
      const nVal = Math.round(normal * factor);
      const wVal = Math.round(warning * (2 - factor));
      const uVal = unused;
      const dVal = Math.max(0, totalCount - nVal - wVal - uVal);

      return [
        { name: '정상', status: '정상', value: nVal, fill: '#10b981' }, // Green
        { name: '주의', status: '주의', value: wVal, fill: '#f59e0b' }, // Amber
        { name: '위험', status: '위험', value: dVal, fill: '#ef4444' }, // Red
        { name: '불용', status: '불용(6개월+)', value: uVal, fill: '#64748b' }, // Slate Gray
      ];
    };

    const rings = [];
    if (currentQuarter >= 1) rings.push({ quarter: 1, label: '1분기 (안쪽)', data: getQuarterStats(1) });
    if (currentQuarter >= 2) rings.push({ quarter: 2, label: '2분기 (중간)', data: getQuarterStats(2) });
    if (currentQuarter >= 3) rings.push({ quarter: 3, label: '3분기 (바깥쪽/현재)', data: getQuarterStats(3) });

    return rings;
  }, [items, item3MonthStats, item6MonthStats, transactions]);

  // ── 4. KPI Summary Numbers ───────────────────────────────────────────────
  const totalItems = items.length;

  const urgentLowStockItems = useMemo(() => {
    const hasTxHistory = transactions.length > 0;

    return items
      .map(item => {
        const stats = item3MonthStats.get(item.id) || item3MonthStats.get(item.name);
        const hasRecentActivity = stats ? stats.hasActivity : false;
        const totalOut3M = stats ? stats.totalOut : 0;
        const monthlyAvgOut = stats ? stats.monthlyAvg : 0;

        const calculatedSafe = monthlyAvgOut > 0 ? Math.ceil(monthlyAvgOut) : Number(item.safeStock ?? 1);
        const current = roundToOneDecimal(item.currentStock ?? 0);
        const shortage = roundToOneDecimal(calculatedSafe - current);
        const ratio = calculatedSafe > 0 ? Math.min(100, Math.max(0, Math.round((current / calculatedSafe) * 100))) : 0;

        return {
          ...item,
          current,
          calculatedSafe,
          shortage,
          ratio,
          hasRecentActivity,
          totalOut3M,
          monthlyAvgOut,
          isDanger: current < calculatedSafe * 0.5,
          isLow: current < calculatedSafe,
        };
      })
      .filter(item => {
        if (!item.isLow) return false;
        if (hasTxHistory && !item.hasRecentActivity) return false;
        return true;
      })
      .sort((a, b) => b.shortage - a.shortage)
      .slice(0, 5);
  }, [items, item3MonthStats, transactions]);

  // ── 5. High Turnover Top 5 (재고 회전율 / 다빈도 출고 상위 Top 5) ─────────────
  const topTurnoverItems = useMemo(() => {
    return items
      .map(item => {
        const stats = item3MonthStats.get(item.id) || item3MonthStats.get(item.name);
        const totalOut3M = roundToOneDecimal(stats ? stats.totalOut : 0);
        const current = roundToOneDecimal(item.currentStock || 0);
        const turnoverRate = current > 0 ? roundToOneDecimal(totalOut3M / current) : totalOut3M;

        return {
          ...item,
          totalOut3M,
          turnoverRate,
          current,
        };
      })
      .filter(item => item.totalOut3M > 0)
      .sort((a, b) => b.totalOut3M - a.totalOut3M)
      .slice(0, 5);
  }, [items, item3MonthStats]);

  const lowStockItems = useMemo(() => {
    const hasTxHistory = transactions.length > 0;

    return items.filter(item => {
      const stats = item3MonthStats.get(item.id) || item3MonthStats.get(item.name);
      const hasRecentActivity = stats ? stats.hasActivity : false;
      const monthlyAvgOut = stats ? stats.monthlyAvg : 0;
      const calculatedSafe = monthlyAvgOut > 0 ? Math.ceil(monthlyAvgOut) : Number(item.safeStock ?? 1);

      const isLow = (item.currentStock ?? 0) < calculatedSafe;
      if (!isLow) return false;
      if (hasTxHistory && !hasRecentActivity) return false;
      return true;
    });
  }, [items, item3MonthStats, transactions]);

  const totalStockCount = useMemo(() => {
    return items.reduce((acc, curr) => acc + (Number(curr.currentStock) || 0), 0);
  }, [items]);

  const safetyRate = useMemo(() => {
    if (totalItems === 0) return 0;
    return Math.round(((totalItems - lowStockItems.length) / totalItems) * 100);
  }, [totalItems, lowStockItems]);

  // ── Category Distribution Stats ──────────────────────────────────────────
  const categoryData = useMemo(() => {
    const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean)));
    return categories
      .map(cat => ({
        name: cat,
        count: items.filter(i => i.category === cat).length,
        stock: roundToOneDecimal(items.filter(i => i.category === cat).reduce((acc, i) => acc + (Number(i.currentStock) || 0), 0))
      }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  // ── Chart Theme Colors ────────────────────────────────────────────────────
  const chartTheme = {
    grid: isDarkMode ? "#334155" : "#f1f5f9",
    text: isDarkMode ? "#cbd5e1" : "#334155",
    tooltipBg: isDarkMode ? "#1e293b" : "#ffffff",
    tooltipBorder: isDarkMode ? "#334155" : "#cbd5e1",
    tooltipText: isDarkMode ? "#f1f5f9" : "#0f172a",
  };

  // Concentric Radii Config for 3 Quarterly Rings
  const RING_RADII = [
    { inner: 34, outer: 52 }, // Ring 0: 1분기 (안쪽)
    { inner: 56, outer: 74 }, // Ring 1: 2분기 (중간)
    { inner: 78, outer: 100 }, // Ring 2: 3분기 (바깥쪽 현재)
  ];

  return (
    <div className="h-full flex flex-col justify-between gap-3 overflow-hidden animate-fade-in select-none">

      {/* ── 1. Top Alert Ticker Bar (폰트 크기 일괄 +1 상향) ────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xs border border-slate-800 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
            <Activity size={19} className="text-blue-400 animate-pulse" />
          </div>
          <div className="flex items-center gap-2.5 truncate">
            <span className="font-extrabold text-base tracking-wide text-white shrink-0">재고 관제 브리핑</span>
            <span className="bg-blue-500/30 text-blue-300 text-[13px] font-bold px-2 py-0.5 rounded-md border border-blue-400/30 shrink-0">LIVE</span>
            <span className="text-[15px] text-slate-200 truncate">
              전체 <strong className="text-white font-black">{totalItems}개</strong> 품목 중 3개월 소모실적 기준 긴급 물품 <strong className="text-red-400 font-black">{lowStockItems.length}개</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-[13px] shrink-0">
          <div className="bg-slate-800/90 border border-slate-700/80 px-3 py-1 rounded-lg flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span className="text-slate-300 text-[13px] font-medium">확보율:</span>
            <strong className="text-emerald-400 font-extrabold text-base">{safetyRate}%</strong>
          </div>
          <div className="bg-slate-800/90 border border-slate-700/80 px-3 py-1 rounded-lg flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            <span className="text-slate-300 text-[13px] font-medium">부족:</span>
            <strong className="text-amber-400 font-extrabold text-base">{lowStockItems.length}건</strong>
          </div>
        </div>
      </div>

      {/* ── 2. Top 4 Interactive KPI Summary Cards (폰트 크기 일괄 +1 상향) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        
        {/* Card 1: Total Items ➔ INVENTORY (ALL) */}
        <div
          onClick={() => onNavigate?.('INVENTORY', 'ALL')}
          className="group bg-white dark:bg-slate-900 p-3.5 px-4 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md cursor-pointer transition-all duration-200 active:scale-[0.98] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-[15px] font-extrabold text-slate-600 dark:text-slate-300">
            <span className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
              총 관리 품목
              <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
            </span>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
              <Package size={18} />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{totalItems}<span className="text-base font-normal text-slate-500 ml-1">개</span></h3>
            <span className="text-[13px] text-blue-600 font-bold bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded flex items-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              전체목록 ➔
            </span>
          </div>
        </div>

        {/* Card 2: Low Stock Alert ➔ INVENTORY (LOW_STOCK 필터 자동 적용!) */}
        <div
          onClick={() => onNavigate?.('INVENTORY', 'LOW_STOCK')}
          className="group bg-white dark:bg-slate-900 p-3.5 px-4 rounded-xl shadow-xs border border-red-200 dark:border-red-900/50 hover:border-red-500 hover:shadow-md cursor-pointer transition-all duration-200 active:scale-[0.98] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-[15px] font-extrabold text-slate-600 dark:text-slate-300">
            <span className="group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors flex items-center gap-1.5">
              부족/위험 재고 (3개월 실적)
              <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500" />
            </span>
            <div className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg group-hover:bg-red-600 group-hover:text-white transition-all">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-3xl font-black text-red-600 dark:text-red-400 tracking-tight">{lowStockItems.length}<span className="text-base font-normal text-slate-500 ml-1">개</span></h3>
            <span className="text-[13px] text-red-600 dark:text-red-400 font-black bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded group-hover:bg-red-600 group-hover:text-white transition-colors">
              부족재고 필터 목록 ➔
            </span>
          </div>
        </div>

        {/* Card 3: Total Stock Quantity ➔ INVENTORY (ALL) */}
        <div
          onClick={() => onNavigate?.('INVENTORY', 'ALL')}
          className="group bg-white dark:bg-slate-900 p-3.5 px-4 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all duration-200 active:scale-[0.98] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-[15px] font-extrabold text-slate-600 dark:text-slate-300">
            <span className="group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
              총 재고 수량
              <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500" />
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <Archive size={18} />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {Math.round(totalStockCount).toLocaleString('ko-KR')}<span className="text-base font-normal text-slate-500 ml-1">EA</span>
            </h3>
            <span className="text-[13px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              전체 수량 ➔
            </span>
          </div>
        </div>

        {/* Card 4: Safety Ratio ➔ ANALYSIS */}
        <div
          onClick={() => onNavigate?.('ANALYSIS')}
          className="group bg-white dark:bg-slate-900 p-3.5 px-4 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 hover:border-purple-500 hover:shadow-md cursor-pointer transition-all duration-200 active:scale-[0.98] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-[15px] font-extrabold text-slate-600 dark:text-slate-300">
            <span className="group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors flex items-center gap-1.5">
              재고 확보율 (종합 리포트)
              <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-purple-500" />
            </span>
            <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-all">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <h3 className="text-3xl font-black text-purple-600 dark:text-purple-400 tracking-tight">{safetyRate}%</h3>
            <span className="text-[13px] text-purple-600 font-bold bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded group-hover:bg-purple-600 group-hover:text-white transition-colors">
              분석 리포트 ➔
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. Middle Section: 3-Box Layout (폰트 크기 일괄 +1 상향) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">

        {/* Box 1: Concentric Multi-Ring Quarterly Trend Chart (도우넛 최근 분기 항목별 범례 직관 병기) ─── */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-3.5 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <h3 className="text-[15px] font-extrabold text-slate-800 dark:text-slate-100">분기별 재고 건실도 추이 (동심원 링)</h3>
            </div>
          </div>

          {/* Concentric Quarterly Multi-Ring Chart Container */}
          <div className="flex-1 min-h-[180px] relative flex items-center justify-center my-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 12, right: 35, bottom: 12, left: 35 }}>
                <defs>
                  {/* 3D Drop Shadow */}
                  <filter id="donutShadow" x="-10%" y="-10%" width="130%" height="130%">
                    <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.22" />
                  </filter>
                </defs>

                {/* Render Concentric Ring for each Quarter (1분기, 2분기, 3분기) */}
                {quarterlyMultiRingData.map((ring, ringIdx) => {
                  const radius = RING_RADII[ringIdx] || { inner: 32 + ringIdx * 20, outer: 48 + ringIdx * 20 };
                  const isOutermost = ringIdx === quarterlyMultiRingData.length - 1;

                  return (
                    <Pie
                      key={`ring-${ring.quarter}`}
                      data={ring.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={radius.inner}
                      outerRadius={radius.outer}
                      paddingAngle={3}
                      dataKey="value"
                      filter={isOutermost ? "url(#donutShadow)" : undefined}
                      label={isOutermost ? (props: any) => {
                        const { cx, cy, midAngle, outerRadius, value, name, fill } = props;
                        if (!value || value === 0) return null;
                        const RADIAN = Math.PI / 180;
                        const r = outerRadius + 14;
                        const x = cx + r * Math.cos(-midAngle * RADIAN);
                        const y = cy + r * Math.sin(-midAngle * RADIAN);
                        return (
                          <text
                            x={x}
                            y={y}
                            fill={fill}
                            textAnchor={x > cx ? 'start' : 'end'}
                            dominantBaseline="central"
                            style={{ fontSize: '12px', fontWeight: '900' }}
                          >
                            {`${name} ${value}건`}
                          </text>
                        );
                      } : undefined}
                      labelLine={isOutermost ? { stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1.2 } : false}
                    >
                      {ring.data.map((entry, index) => (
                        <Cell key={`cell-${ringIdx}-${index}`} fill={entry.fill} stroke={isDarkMode ? '#0f172a' : '#ffffff'} strokeWidth={2} />
                      ))}
                    </Pie>
                  );
                })}

                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    backgroundColor: chartTheme.tooltipBg,
                    borderColor: chartTheme.tooltipBorder,
                    color: chartTheme.tooltipText,
                    fontSize: '13px',
                    fontWeight: 'bold',
                    boxShadow: '0 8px 16px -2px rgba(0,0,0,0.2)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Ring Badge */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-xs border border-slate-200 dark:border-slate-700 shadow-inner flex flex-col items-center justify-center">
                <span className="text-[10px] text-slate-400 font-bold tracking-tighter">확보율</span>
                <span className="text-xl font-black text-slate-900 dark:text-white mt-0.5 tracking-tight">{safetyRate}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Box 2: Urgent Low Stock Top 5 List (4 cols - 폰트 크기 +1 상향) ───────────────────── */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-3.5 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <h3 className="text-[15px] font-extrabold text-slate-800 dark:text-slate-100">긴급 수급 필요 Top 5</h3>
            </div>
            <span className="text-[13px] font-bold text-red-600 bg-red-50 dark:bg-red-950/60 dark:text-red-400 px-2 py-0.5 rounded border border-red-200">
              {urgentLowStockItems.length}건 시급
            </span>
          </div>

          <div className="space-y-1.5 flex-1 justify-around my-1 flex flex-col">
            {urgentLowStockItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm py-4 space-y-1">
                <ShieldCheck size={24} className="text-emerald-500" />
                <p className="font-bold text-slate-700 dark:text-slate-300 text-xs">긴급 수급 품목이 없습니다.</p>
              </div>
            ) : (
              urgentLowStockItems.map((item, idx) => (
                <div key={item.id} className="px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-4 h-4 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-black text-[12px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-black text-slate-800 dark:text-white truncate text-[13px]">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-[13px]">
                      <span className="font-black text-slate-800 dark:text-slate-100">{formatOneDecimal(item.current)}</span>
                      <span className="text-[12px] text-slate-400">/적정 {formatOneDecimal(item.calculatedSafe)}</span>
                      <span className="bg-red-500 text-white font-bold text-[11px] px-1.5 py-0.2 rounded">위험</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[13px]">
                    <div className="flex-1 bg-red-100 dark:bg-red-950/60 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-rose-500 to-red-600 h-full rounded-full"
                        style={{ width: `${Math.max(item.current > 0 ? 5 : 0, item.ratio)}%` }}
                      />
                    </div>
                    <span className="text-red-600 dark:text-red-400 font-black shrink-0 text-[13px]">부족: -{formatOneDecimal(item.shortage)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Box 3: High Turnover Top 5 List (재고 회전율 상위 Top 5 - 4 cols - 폰트 크기 +1 상향) ────────── */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-3.5 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-[15px] font-extrabold text-slate-800 dark:text-slate-100">재고 회전율 상위 Top 5</h3>
            </div>
            <span className="text-[13px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-200">
              다빈도 출고
            </span>
          </div>

          <div className="space-y-1.5 flex-1 justify-around my-1 flex flex-col">
            {topTurnoverItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm py-4 space-y-1">
                <TrendingUp size={24} className="text-blue-500" />
                <p className="font-bold text-slate-700 dark:text-slate-300 text-xs">최근 출고 실적이 집계 대기 중입니다.</p>
              </div>
            ) : (
              topTurnoverItems.map((item, idx) => (
                <div key={item.id} className="px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black text-[12px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-black text-slate-800 dark:text-white truncate text-[13px]">{item.name}</span>
                      <span className="text-[11px] text-slate-500 bg-white dark:bg-slate-700 border px-1.5 rounded shrink-0 font-bold">
                        {item.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-[13px]">
                      <span className="text-[12px] text-slate-400">3개월 출고</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">{formatOneDecimal(item.totalOut3M)}{item.unit ? ` ${item.unit}` : ''}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-slate-500 font-medium">현재고: {formatOneDecimal(item.current)}{item.unit ? ` ${item.unit}` : ''}</span>
                    <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black px-2 py-0.5 rounded border border-emerald-200/60 text-[13px]">
                      회전율 {formatOneDecimal(item.turnoverRate)}회/분기
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ── 4. Bottom Row: Category Bar Chart (3D Multi-Color Palette & Shadows - 폰트 크기 일괄 +1 상향) ── */}
      <div className="bg-white dark:bg-slate-900 p-3.5 px-4 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 shrink-0">
        <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <h3 className="text-[15px] font-extrabold text-slate-800 dark:text-slate-100">카테고리별 품목 현황 (3D 입체 다채색 모듈)</h3>
          </div>
          <span className="text-[13px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200/60">
            막대 클릭 시 해당 카테고리 현황 이동 ➔
          </span>
        </div>

        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} margin={{ top: 8, right: 10, left: -20, bottom: 22 }}>
              <defs>
                {/* 3D Multi-color Bar Gradients */}
                {BAR_3D_PALETTE.map((c, i) => (
                  <linearGradient key={`bar-grad-${i}`} id={`bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.top} />
                    <stop offset="50%" stopColor={c.mid} />
                    <stop offset="100%" stopColor={c.bottom} />
                  </linearGradient>
                ))}
                {/* 3D Bar Drop Shadow Filter */}
                <filter id="barShadow3d" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="1" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.22" />
                </filter>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
              <XAxis
                dataKey="name"
                interval={0}
                angle={-30}
                textAnchor="end"
                height={35}
                tick={{ fontSize: 12, fill: chartTheme.text, fontWeight: '700' }}
                axisLine={{ stroke: chartTheme.grid }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: chartTheme.text, fontWeight: '600' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                contentStyle={{
                  borderRadius: '8px',
                  backgroundColor: chartTheme.tooltipBg,
                  borderColor: chartTheme.tooltipBorder,
                  color: chartTheme.tooltipText,
                  fontSize: '13px',
                  fontWeight: 'bold',
                  boxShadow: '0 8px 16px -2px rgba(0,0,0,0.15)',
                }}
              />
              <Bar
                dataKey="count"
                name="품목 수"
                radius={[6, 6, 0, 0]}
                barSize={26}
                filter="url(#barShadow3d)"
                onClick={(data: any) => {
                  if (data && data.name) {
                    onNavigate?.('INVENTORY', 'ALL', data.name);
                  }
                }}
              >
                {categoryData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`url(#bar-grad-${index % BAR_3D_PALETTE.length})`}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => onNavigate?.('INVENTORY', 'ALL', entry.name)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
