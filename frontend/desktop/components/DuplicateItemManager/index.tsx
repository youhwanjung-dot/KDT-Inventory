import React, { useMemo, useState } from 'react';
import { X, GitMerge, Trash2, AlertTriangle, Search, CheckCircle2 } from 'lucide-react';
import { InventoryItem, InventoryTransaction } from '../../types';
import { normalizeName } from '../../utils/formatters';

interface DuplicateItemManagerProps {
  inventory: InventoryItem[];
  transactions: InventoryTransaction[];
  onClose: () => void;
  onMerge: (survivorId: string, mergedIds: string[]) => void;
  onDelete: (ids: string[]) => void;
}

interface DuplicateGroup {
  key: string;
  category: string;
  normalizedName: string;
  members: InventoryItem[];
}

// 연결된 컴포넌트(Union-Find)로 중복 그룹 탐지
// 같은 ZONE + 같은 정규화된 품명 내에서 spec/plating이 매칭되는 품목들을 한 그룹으로 묶음
const detectDuplicates = (inventory: InventoryItem[]): DuplicateGroup[] => {
  // ZONE + 정규화 품명으로 1차 그룹핑
  const byZoneName = new Map<string, InventoryItem[]>();
  inventory.forEach((item) => {
    const key = `${item.category}::${normalizeName(item.name)}`;
    if (!byZoneName.has(key)) byZoneName.set(key, []);
    byZoneName.get(key)!.push(item);
  });

  const groups: DuplicateGroup[] = [];

  byZoneName.forEach((items, zoneNameKey) => {
    if (items.length < 2) return;
    const [category, normalizedName] = zoneNameKey.split('::');

    // Union-Find
    const parent = items.map((_, i) => i);
    const find = (x: number): number => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    const union = (a: number, b: number) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };

    const match = (a: InventoryItem, b: InventoryItem): boolean => {
      const aSpec = String(a.spec || '').trim();
      const bSpec = String(b.spec || '').trim();
      const aPlating = String(a.plating || '').trim();
      const bPlating = String(b.plating || '').trim();
      const specMatch = !aSpec || !bSpec || aSpec === bSpec;
      const platingMatch = !aPlating || !bPlating || aPlating === bPlating;
      return specMatch && platingMatch;
    };

    // 모든 쌍 비교
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (match(items[i], items[j])) union(i, j);
      }
    }

    // 루트별로 그룹핑
    const clusters = new Map<number, InventoryItem[]>();
    items.forEach((item, i) => {
      const root = find(i);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root)!.push(item);
    });

    clusters.forEach((members) => {
      if (members.length >= 2) {
        groups.push({
          key: `${zoneNameKey}::${members.map((m) => m.id).join(',')}`,
          category,
          normalizedName,
          members,
        });
      }
    });
  });

  return groups.sort((a, b) => b.members.length - a.members.length);
};

const DuplicateItemManager: React.FC<DuplicateItemManagerProps> = ({
  inventory,
  transactions,
  onClose,
  onMerge,
  onDelete,
}) => {
  const [zoneFilter, setZoneFilter] = useState<string>('전체');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [survivorMap, setSurvivorMap] = useState<Record<string, string>>({});
  const [confirmAction, setConfirmAction] = useState<
    { type: 'merge' | 'delete'; groupKey: string; ids: string[] } | null
  >(null);

  const allZones = useMemo(() => {
    return Array.from(new Set(inventory.map((i) => i.category).filter(Boolean))).sort();
  }, [inventory]);

  const txCountById = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((tx) => {
      map.set(tx.itemId, (map.get(tx.itemId) || 0) + 1);
    });
    return map;
  }, [transactions]);

  const allGroups = useMemo(() => detectDuplicates(inventory), [inventory]);

  const filteredGroups = useMemo(() => {
    return allGroups.filter((g) => {
      if (zoneFilter !== '전체' && g.category !== zoneFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const hasMatch = g.members.some(
          (m) =>
            m.name.toLowerCase().includes(term) ||
            String(m.spec || '').toLowerCase().includes(term) ||
            String(m.plating || '').toLowerCase().includes(term)
        );
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [allGroups, zoneFilter, searchTerm]);

  const totalDuplicateItems = allGroups.reduce((sum, g) => sum + g.members.length, 0);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setSurvivor = (groupKey: string, itemId: string) => {
    setSurvivorMap((prev) => ({ ...prev, [groupKey]: itemId }));
  };

  // 기본 생존 품목: 트랜잭션 건수가 가장 많은 품목 (같으면 currentStock 높은 순)
  const getSurvivor = (group: DuplicateGroup): string => {
    if (survivorMap[group.key]) return survivorMap[group.key];
    return [...group.members]
      .sort((a, b) => {
        const ta = txCountById.get(a.id) || 0;
        const tb = txCountById.get(b.id) || 0;
        if (tb !== ta) return tb - ta;
        return (b.currentStock || 0) - (a.currentStock || 0);
      })[0].id;
  };

  const handleMerge = (group: DuplicateGroup) => {
    const survivorId = getSurvivor(group);
    const mergedIds = group.members.map((m) => m.id).filter((id) => id !== survivorId);
    setConfirmAction({ type: 'merge', groupKey: group.key, ids: [survivorId, ...mergedIds] });
  };

  const handleDelete = (group: DuplicateGroup) => {
    const survivorId = getSurvivor(group);
    const deleteIds = group.members.map((m) => m.id).filter((id) => id !== survivorId);
    if (deleteIds.length === 0) return;
    setConfirmAction({ type: 'delete', groupKey: group.key, ids: deleteIds });
  };

  const executeAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'merge') {
      const [survivorId, ...mergedIds] = confirmAction.ids;
      onMerge(survivorId, mergedIds);
    } else {
      onDelete(confirmAction.ids);
    }
    setSurvivorMap((prev) => {
      const next = { ...prev };
      delete next[confirmAction.groupKey];
      return next;
    });
    setConfirmAction(null);
  };

  const renderGroupName = (group: DuplicateGroup) => {
    const representative = group.members[0];
    const specs = Array.from(new Set(group.members.map((m) => m.spec).filter(Boolean)));
    const platings = Array.from(new Set(group.members.map((m) => m.plating).filter(Boolean)));
    return (
      <span className="font-semibold text-slate-800 dark:text-slate-100">
        {representative.name}
        {specs.length > 0 && <span className="text-slate-500 dark:text-slate-400 ml-2">규격: {specs.join(', ')}</span>}
        {platings.length > 0 && <span className="text-slate-500 dark:text-slate-400 ml-2">도금: {platings.join(', ')}</span>}
      </span>
    );
  };

  const confirmGroup = confirmAction
    ? allGroups.find((g) => g.key === confirmAction.groupKey)
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-t-xl shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <GitMerge size={20} className="text-orange-600" />
              중복품목 관리
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              동일 ZONE 내 품명·규격·도금이 일치하는 품목을 탐지하여 병합 또는 삭제합니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* Summary bar */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-orange-50/50 dark:bg-orange-950/20 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-600 dark:text-slate-300">
                중복그룹: <strong className="text-orange-600 dark:text-orange-400">{allGroups.length}개</strong>
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                중복품목: <strong className="text-orange-600 dark:text-orange-400">{totalDuplicateItems}개</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="전체">전체 ZONE</option>
                {allZones.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="품명, 규격, 도금 검색"
                  className="border border-slate-300 dark:border-slate-600 rounded-lg pl-9 pr-3 py-1.5 text-sm w-56 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 flex-1 custom-scrollbar bg-white dark:bg-slate-900">
          {filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
              <CheckCircle2 size={48} className="mb-3 text-green-500" />
              <p className="font-medium">중복 품목이 없습니다.</p>
              <p className="text-xs mt-1">데이터가 정합합니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((group) => {
                const isExpanded = expandedKeys.has(group.key);
                const survivorId = getSurvivor(group);
                const totalStock = group.members.reduce((sum, m) => sum + (m.currentStock || 0), 0);
                return (
                  <div
                    key={group.key}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800/40"
                  >
                    <button
                      onClick={() => toggleExpand(group.key)}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-orange-500 shrink-0">{isExpanded ? '▼' : '▶'}</span>
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded shrink-0">
                          {group.category}
                        </span>
                        <span className="truncate">{renderGroupName(group)}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                        <span>{group.members.length}개 품목</span>
                        <span>총재고: {totalStock.toLocaleString('ko-KR')} EA</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-200 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-slate-900/40">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                <th className="py-2 px-2 w-10"></th>
                                <th className="py-2 px-2">품명</th>
                                <th className="py-2 px-2">규격</th>
                                <th className="py-2 px-2">도금</th>
                                <th className="py-2 px-2 text-right">현재고</th>
                                <th className="py-2 px-2 text-right">적정재고</th>
                                <th className="py-2 px-2 text-right">트랜잭션</th>
                                <th className="py-2 px-2">최종수정일</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.members.map((member) => {
                                const isSurvivor = member.id === survivorId;
                                const txCount = txCountById.get(member.id) || 0;
                                return (
                                  <tr
                                    key={member.id}
                                    className={`border-b border-slate-100 dark:border-slate-700/50 ${isSurvivor ? 'bg-green-50 dark:bg-green-950/20' : ''}`}
                                  >
                                    <td className="py-2 px-2">
                                      <input
                                        type="radio"
                                        name={`survivor-${group.key}`}
                                        checked={isSurvivor}
                                        onChange={() => setSurvivor(group.key, member.id)}
                                        className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                                      />
                                    </td>
                                    <td className="py-2 px-2">
                                      <span className="font-medium text-slate-800 dark:text-slate-100">{member.name}</span>
                                      {isSurvivor && (
                                        <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-bold">(생존)</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-2 text-slate-600 dark:text-slate-300">{member.spec || '-'}</td>
                                    <td className="py-2 px-2 text-slate-600 dark:text-slate-300">{member.plating || '-'}</td>
                                    <td className="py-2 px-2 text-right font-mono text-slate-800 dark:text-slate-100">
                                      {(member.currentStock || 0).toLocaleString('ko-KR')}
                                    </td>
                                    <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-300">
                                      {(member.safeStock || 0).toLocaleString('ko-KR')}
                                    </td>
                                    <td className="py-2 px-2 text-right font-mono">
                                      <span className={txCount > 0 ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-400'}>
                                        {txCount}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 text-xs text-slate-500 dark:text-slate-400">{member.lastUpdated || '-'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-3">
                          <button
                            onClick={() => handleDelete(group)}
                            className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <Trash2 size={14} />
                            생존 외 삭제
                          </button>
                          <button
                            onClick={() => handleMerge(group)}
                            className="px-3 py-1.5 rounded-lg bg-orange-600 text-white hover:bg-orange-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            <GitMerge size={14} />
                            생존 품목으로 병합
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirmAction && confirmGroup && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={20} className={confirmAction.type === 'merge' ? 'text-orange-500' : 'text-red-500'} />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {confirmAction.type === 'merge' ? '병합 확인' : '삭제 확인'}
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {confirmAction.type === 'merge' ? (
                  <>
                    <strong>{confirmGroup.members.length - 1}개</strong> 품목을 생존 품목에 병합합니다.
                    <br />
                    • 재고가 합산되고, 트랜잭션 이력이 생존 품목으로 이전됩니다.
                    <br />
                    • 병합된 품목은 삭제됩니다.
                  </>
                ) : (
                  <>
                    <strong>{confirmAction.ids.length}개</strong> 품목을 삭제합니다.
                    <br />
                    {confirmGroup.members.some((m) => confirmAction.ids.includes(m.id) && (txCountById.get(m.id) || 0) > 0) && (
                      <span className="text-red-600 dark:text-red-400 block mt-1">
                        ⚠ 트랜잭션이 있는 품목이 포함되어 있습니다. 이력이 손실될 수 있으니 병합을 권장합니다.
                      </span>
                    )}
                  </>
                )}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-1">
                <AlertTriangle size={12} />
                병합·삭제 전 엑셀 백업을 권장합니다.
              </p>
            </div>
            <div className="p-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                취소
              </button>
              <button
                onClick={executeAction}
                className={`px-4 py-2 rounded-lg text-sm font-bold text-white ${
                  confirmAction.type === 'merge' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmAction.type === 'merge' ? '병합 실행' : '삭제 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DuplicateItemManager;
