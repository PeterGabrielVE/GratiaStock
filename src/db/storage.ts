import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import {
  AppSettings,
  DatabaseBackup,
  Investment,
  PaymentRecord,
  Product,
  Sale,
  SaleItem,
  StockMovement,
  Supplier,
} from '../types/models';
import { createInitialSeedData, DEFAULT_SETTINGS } from './seedData';

const DB_NAME = 'gratiastock_v1.db';
const WEB_STORAGE_KEY = 'gratiastock_web_backup_v1';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let memoryFallback: DatabaseBackup | null = null;

async function getNativeDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
  await dbInstance.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS kv_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      contactName TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      city TEXT NOT NULL,
      specialty TEXT NOT NULL,
      paymentTerms TEXT NOT NULL,
      notes TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      editionOrDetail TEXT NOT NULL,
      costPrice REAL NOT NULL,
      salePrice REAL NOT NULL,
      stock INTEGER NOT NULL,
      minStock INTEGER NOT NULL,
      location TEXT NOT NULL,
      supplierId TEXT,
      notes TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY NOT NULL,
      folio TEXT NOT NULL,
      customerName TEXT NOT NULL,
      customerPhone TEXT NOT NULL,
      parishOrGroup TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL NOT NULL,
      total REAL NOT NULL,
      paidAmount REAL NOT NULL,
      balance REAL NOT NULL,
      status TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      notes TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY NOT NULL,
      saleId TEXT NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT NOT NULL,
      sku TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unitPrice REAL NOT NULL,
      unitCost REAL NOT NULL,
      subtotal REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS payment_records (
      id TEXT PRIMARY KEY NOT NULL,
      saleId TEXT NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      reference TEXT NOT NULL,
      notes TEXT NOT NULL,
      paidAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS investments (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      paidAmount REAL NOT NULL,
      supplierId TEXT,
      productId TEXT,
      quantityAdded INTEGER NOT NULL,
      paymentMethod TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      previousStock INTEGER NOT NULL,
      newStock INTEGER NOT NULL,
      reason TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);
  return dbInstance;
}

function readWebSnapshot(): DatabaseBackup | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(WEB_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as DatabaseBackup;
      }
    }
  } catch {
    // fallback to memory
  }
  return memoryFallback;
}

function writeWebSnapshot(snapshot: DatabaseBackup): void {
  memoryFallback = snapshot;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(snapshot));
    }
  } catch {
    // ignore quota errors
  }
}

export async function saveFullSnapshot(snapshot: DatabaseBackup): Promise<void> {
  if (Platform.OS === 'web') {
    writeWebSnapshot(snapshot);
    return;
  }

  const db = await getNativeDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM kv_meta;
      DELETE FROM suppliers;
      DELETE FROM products;
      DELETE FROM sales;
      DELETE FROM sale_items;
      DELETE FROM payment_records;
      DELETE FROM investments;
      DELETE FROM stock_movements;
    `);

    await db.runAsync(
      'INSERT INTO kv_meta (key, value) VALUES (?, ?), (?, ?)',
      ['seeded', 'true', 'settings', JSON.stringify(snapshot.settings || DEFAULT_SETTINGS)]
    );

    for (const s of snapshot.suppliers) {
      await db.runAsync(
        `INSERT INTO suppliers (id, name, contactName, phone, email, city, specialty, paymentTerms, notes, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.name, s.contactName, s.phone, s.email, s.city, s.specialty, s.paymentTerms, s.notes, s.createdAt]
      );
    }

    for (const p of snapshot.products) {
      await db.runAsync(
        `INSERT INTO products (id, sku, name, category, editionOrDetail, costPrice, salePrice, stock, minStock, location, supplierId, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.sku,
          p.name,
          p.category,
          p.editionOrDetail,
          p.costPrice,
          p.salePrice,
          p.stock,
          p.minStock,
          p.location,
          p.supplierId,
          p.notes,
          p.createdAt,
          p.updatedAt,
        ]
      );
    }

    for (const sale of snapshot.sales) {
      await db.runAsync(
        `INSERT INTO sales (id, folio, customerName, customerPhone, parishOrGroup, subtotal, discount, total, paidAmount, balance, status, dueDate, notes, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sale.id,
          sale.folio,
          sale.customerName,
          sale.customerPhone,
          sale.parishOrGroup,
          sale.subtotal,
          sale.discount,
          sale.total,
          sale.paidAmount,
          sale.balance,
          sale.status,
          sale.dueDate,
          sale.notes,
          sale.createdAt,
        ]
      );

      for (const item of sale.items) {
        await db.runAsync(
          `INSERT INTO sale_items (id, saleId, productId, productName, sku, category, quantity, unitPrice, unitCost, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            sale.id,
            item.productId,
            item.productName,
            item.sku,
            item.category,
            item.quantity,
            item.unitPrice,
            item.unitCost,
            item.subtotal,
          ]
        );
      }

      for (const pay of sale.payments) {
        await db.runAsync(
          `INSERT INTO payment_records (id, saleId, amount, method, reference, notes, paidAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [pay.id, sale.id, pay.amount, pay.method, pay.reference, pay.notes, pay.paidAt]
        );
      }
    }

    for (const inv of snapshot.investments) {
      await db.runAsync(
        `INSERT INTO investments (id, title, category, amount, paidAmount, supplierId, productId, quantityAdded, paymentMethod, date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inv.id,
          inv.title,
          inv.category,
          inv.amount,
          inv.paidAmount,
          inv.supplierId,
          inv.productId,
          inv.quantityAdded,
          inv.paymentMethod,
          inv.date,
          inv.notes,
        ]
      );
    }

    for (const mov of snapshot.stockMovements) {
      await db.runAsync(
        `INSERT INTO stock_movements (id, productId, productName, type, quantity, previousStock, newStock, reason, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          mov.id,
          mov.productId,
          mov.productName,
          mov.type,
          mov.quantity,
          mov.previousStock,
          mov.newStock,
          mov.reason,
          mov.createdAt,
        ]
      );
    }
  });
}

export async function loadDatabase(): Promise<DatabaseBackup> {
  if (Platform.OS === 'web') {
    const existing = readWebSnapshot();
    if (existing) return existing;
    const initial = createInitialSeedData();
    writeWebSnapshot(initial);
    return initial;
  }

  const db = await getNativeDb();
  const seededRow = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM kv_meta WHERE key = ?',
    ['seeded']
  );

  if (!seededRow) {
    const initial = createInitialSeedData();
    await saveFullSnapshot(initial);
    return initial;
  }

  const settingsRow = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM kv_meta WHERE key = ?',
    ['settings']
  );
  let settings: AppSettings = DEFAULT_SETTINGS;
  if (settingsRow?.value) {
    try {
      settings = { ...DEFAULT_SETTINGS, ...(JSON.parse(settingsRow.value) as Partial<AppSettings>) };
    } catch {
      settings = DEFAULT_SETTINGS;
    }
  }

  const suppliers = await db.getAllAsync<Supplier>(
    'SELECT * FROM suppliers ORDER BY name ASC'
  );
  const products = await db.getAllAsync<Product>(
    'SELECT * FROM products ORDER BY name ASC'
  );
  const saleRows = await db.getAllAsync<Omit<Sale, 'items' | 'payments'>>(
    'SELECT * FROM sales ORDER BY createdAt DESC'
  );
  const allItems = await db.getAllAsync<SaleItem>('SELECT * FROM sale_items');
  const allPayments = await db.getAllAsync<PaymentRecord>(
    'SELECT * FROM payment_records ORDER BY paidAt DESC'
  );

  const itemsBySale = new Map<string, SaleItem[]>();
  for (const item of allItems) {
    const list = itemsBySale.get(item.saleId) ?? [];
    list.push(item);
    itemsBySale.set(item.saleId, list);
  }

  const paymentsBySale = new Map<string, PaymentRecord[]>();
  for (const pay of allPayments) {
    const list = paymentsBySale.get(pay.saleId) ?? [];
    list.push(pay);
    paymentsBySale.set(pay.saleId, list);
  }

  const sales: Sale[] = saleRows.map((row) => ({
    ...row,
    items: itemsBySale.get(row.id) ?? [],
    payments: paymentsBySale.get(row.id) ?? [],
  }));

  const investments = await db.getAllAsync<Investment>(
    'SELECT * FROM investments ORDER BY date DESC'
  );
  const stockMovements = await db.getAllAsync<StockMovement>(
    'SELECT * FROM stock_movements ORDER BY createdAt DESC LIMIT 500'
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    appName: 'GratiaStock',
    settings,
    suppliers,
    products,
    sales,
    investments,
    stockMovements,
  };
}
