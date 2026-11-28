import { utils } from 'xlsx';
import type { WorkBook } from 'xlsx';
import { InventoryItem, InventoryTransaction, MasterData, ZoneArchiveData } from '../../types';

export interface DatabaseBackupData {
  inventory: InventoryItem[];
  transactions: InventoryTransaction[];
  masterData: MasterData;
  zoneArchives?: ZoneArchiveData[];
  zoneArchivesIncluded?: boolean;
}

export interface DatabaseBackupCounts {
  inventory: number;
  transactions: number;
  masterDataEntries: number;
  zoneArchives: number;
  archivedInventory: number;
  archivedTransactions: number;
}

const REQUIRED_SHEETS = ['DB_품목원본', 'DB_거래원본', 'DB_기준정보'];
const BACKUP_FORMAT = 'KDT_DB_BACKUP_V1';

const readJsonRecords = (workbook: WorkBook, sheetName: string): unknown[] => {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error(`복구 원본 시트가 없습니다: ${sheetName}`);

  const rows = utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];
  if (rows[1]?.[1] !== BACKUP_FORMAT) {
    throw new Error(`${sheetName}의 백업 형식 표시가 올바르지 않습니다.`);
  }

  const expectedCount = Number(rows[1]?.[3]);
  const headers = (rows[3] || []).map((cell) => String(cell || '').trim());
  const jsonColumns = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => /^원본 JSON(?:\s+\d+)?$/.test(header))
    .map(({ index }) => index);
  if (jsonColumns.length === 0) throw new Error(`${sheetName}에서 원본 JSON 열을 찾을 수 없습니다.`);

  const records: unknown[] = [];
  for (let rowIndex = 4; rowIndex < rows.length; rowIndex++) {
    const raw = jsonColumns.map((column) => String(rows[rowIndex]?.[column] || '')).join('');
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    try {
      records.push(JSON.parse(raw));
    } catch {
      throw new Error(`${sheetName} ${rowIndex + 1}행의 원본 JSON을 읽을 수 없습니다.`);
    }
  }

  if (!Number.isFinite(expectedCount) || expectedCount !== records.length) {
    throw new Error(
      `${sheetName}의 레코드 수가 맞지 않습니다. 표기 ${rows[1]?.[3] ?? '없음'}건 / 실제 ${records.length}건`
    );
  }
  return records;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseDatabaseBackupWorkbook = (
  workbook: WorkBook
): { data: DatabaseBackupData; counts: DatabaseBackupCounts } => {
  const missingSheets = REQUIRED_SHEETS.filter((name) => !workbook.Sheets[name]);
  if (missingSheets.length > 0) {
    throw new Error(`DB 복구용 원본 시트가 누락되었습니다: ${missingSheets.join(', ')}`);
  }

  const rawInventory = readJsonRecords(workbook, 'DB_품목원본');
  const rawTransactions = readJsonRecords(workbook, 'DB_거래원본');
  const rawMasterEntries = readJsonRecords(workbook, 'DB_기준정보');
  const archiveHeaderSheet = workbook.Sheets['DB_ZONE아카이브'];
  const archiveDataSheet = workbook.Sheets['DB_ZONE아카이브원본'];
  if (Boolean(archiveHeaderSheet) !== Boolean(archiveDataSheet)) {
    throw new Error('ZONE 아카이브 복구 시트가 일부 누락되었습니다.');
  }
  const rawArchiveHeaders = archiveHeaderSheet
    ? readJsonRecords(workbook, 'DB_ZONE아카이브')
    : [];
  const rawArchiveRows = archiveDataSheet
    ? readJsonRecords(workbook, 'DB_ZONE아카이브원본')
    : [];

  if (!rawInventory.every((item) =>
    isObject(item) &&
    typeof item.id === 'string' &&
    typeof item.category === 'string' &&
    typeof item.name === 'string'
  )) {
    throw new Error('품목 원본에 ID·ZONE·품명이 없는 레코드가 있습니다.');
  }
  if (!rawTransactions.every((tx) =>
    isObject(tx) &&
    typeof tx.id === 'string' &&
    typeof tx.itemId === 'string' &&
    typeof tx.date === 'string' &&
    (tx.type === 'IN' || tx.type === 'OUT') &&
    Number.isFinite(Number(tx.quantity))
  )) {
    throw new Error('거래 원본에 필수 항목이 없거나 수량이 올바르지 않습니다.');
  }

  const inventory = rawInventory as InventoryItem[];
  const transactions = rawTransactions as InventoryTransaction[];
  const itemIds = new Set(inventory.map((item) => item.id));
  const txIds = new Set<string>();
  if (itemIds.size !== inventory.length) throw new Error('품목 원본에 중복 ID가 있습니다.');
  for (const tx of transactions) {
    if (txIds.has(tx.id)) throw new Error(`거래 원본에 중복 ID가 있습니다: ${tx.id}`);
    txIds.add(tx.id);
  }

  const masterDataRecord = Object.fromEntries(rawMasterEntries.map((entry) => {
    if (!isObject(entry) || typeof entry.key !== 'string' || !('value' in entry)) {
      throw new Error('기준정보 원본 행의 항목명 또는 값이 올바르지 않습니다.');
    }
    return [entry.key, entry.value];
  }));
  if (!Array.isArray(masterDataRecord.categories) ||
      !isObject(masterDataRecord.namesByCategory) ||
      !Array.isArray(masterDataRecord.nameOrder)) {
    throw new Error('기준정보 원본에 필수 항목(categories, namesByCategory, nameOrder)이 없습니다.');
  }

  const archivesById = new Map<string, ZoneArchiveData>();
  for (const entry of rawArchiveHeaders) {
    if (!isObject(entry) ||
        typeof entry.id !== 'string' ||
        typeof entry.zoneId !== 'string' ||
        typeof entry.displayName !== 'string' ||
        (entry.status !== 'ARCHIVED' && entry.status !== 'RESTORED')) {
      throw new Error('ZONE 아카이브 목록에 필수 항목이 없거나 상태가 올바르지 않습니다.');
    }
    if (archivesById.has(entry.id)) throw new Error(`중복 아카이브 ID가 있습니다: ${entry.id}`);
    archivesById.set(entry.id, {
      ...(entry as unknown as ZoneArchiveData),
      inventory: [],
      transactions: [],
    });
  }
  for (const entry of rawArchiveRows) {
    if (!isObject(entry) ||
        typeof entry.archiveId !== 'string' ||
        !isObject(entry.record) ||
        (entry.recordType !== 'inventory' && entry.recordType !== 'transaction')) {
      throw new Error('ZONE 아카이브 원본 행의 형식이 올바르지 않습니다.');
    }
    const archive = archivesById.get(entry.archiveId);
    if (!archive) throw new Error(`아카이브 원본이 목록에 없습니다: ${entry.archiveId}`);
    if (entry.recordType === 'inventory') {
      if (typeof entry.record.id !== 'string' || typeof entry.record.name !== 'string') {
        throw new Error(`아카이브 품목 원본이 올바르지 않습니다: ${entry.archiveId}`);
      }
      archive.inventory.push(entry.record as unknown as InventoryItem);
    } else {
      if (typeof entry.record.id !== 'string' ||
          typeof entry.record.itemId !== 'string' ||
          !Number.isFinite(Number(entry.record.quantity))) {
        throw new Error(`아카이브 수불 원본이 올바르지 않습니다: ${entry.archiveId}`);
      }
      archive.transactions.push(entry.record as unknown as InventoryTransaction);
    }
  }
  for (const archive of archivesById.values()) {
    if (archive.inventory.length !== Number(archive.itemCount) ||
        archive.transactions.length !== Number(archive.transactionCount)) {
      throw new Error(`아카이브 ${archive.displayName}의 원본 건수가 일치하지 않습니다.`);
    }
  }
  const zoneArchives = Array.from(archivesById.values());

  return {
    data: {
      inventory,
      transactions,
      masterData: masterDataRecord as unknown as MasterData,
      zoneArchives,
      zoneArchivesIncluded: Boolean(archiveHeaderSheet && archiveDataSheet),
    },
    counts: {
      inventory: inventory.length,
      transactions: transactions.length,
      masterDataEntries: rawMasterEntries.length,
      zoneArchives: zoneArchives.length,
      archivedInventory: zoneArchives.reduce((sum, archive) => sum + archive.inventory.length, 0),
      archivedTransactions: zoneArchives.reduce((sum, archive) => sum + archive.transactions.length, 0),
    },
  };
};
