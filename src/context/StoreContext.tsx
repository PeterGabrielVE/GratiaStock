import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AppSettings,
  DatabaseBackup,
  Investment,
  PaymentMethod,
  PaymentRecord,
  Product,
  Sale,
  SaleItem,
  SaleStatus,
  StockMovement,
  StockMovementType,
  Supplier,
} from '../types/models';
import { createInitialSeedData, DEFAULT_SETTINGS } from '../db/seedData';
import { loadDatabase, saveFullSnapshot } from '../db/storage';
import { generateFolio, generateId } from '../utils/format';

export interface CreateSaleInput {
  customerName: string;
  customerPhone: string;
  parishOrGroup: string;
  discount: number;
  initialPayment: number;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  dueDate: string;
  notes: string;
  cart: {
    productId: string;
    quantity: number;
    unitPrice?: number;
  }[];
}

export interface AddPaymentInput {
  saleId: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  notes: string;
}

export interface CreateInvestmentInput {
  title: string;
  category: Investment['category'];
  amount: number;
  paidAmount: number;
  supplierId: string | null;
  productId: string | null;
  quantityAdded: number;
  newUnitCost?: number;
  paymentMethod: PaymentMethod;
  date: string;
  notes: string;
}

interface StoreContextValue {
  isLoading: boolean;
  settings: AppSettings;
  products: Product[];
  suppliers: Supplier[];
  sales: Sale[];
  investments: Investment[];
  stockMovements: StockMovement[];
  getBackupSnapshot: () => DatabaseBackup;
  // Productos y Stock
  saveProduct: (
    product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  adjustStock: (
    productId: string,
    delta: number,
    type: StockMovementType,
    reason: string
  ) => Promise<void>;
  // Ventas y Pagos
  createSale: (input: CreateSaleInput) => Promise<Sale>;
  registerSalePayment: (input: AddPaymentInput) => Promise<void>;
  deleteSale: (saleId: string, restoreStock: boolean) => Promise<void>;
  // Inversiones
  saveInvestment: (input: CreateInvestmentInput & { id?: string }) => Promise<void>;
  payInvestmentBalance: (investmentId: string, amount: number) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
  // Proveedores
  saveSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  // Configuración y Respaldos
  updateSettings: (next: Partial<AppSettings>) => Promise<void>;
  restoreFromBackup: (backup: DatabaseBackup) => Promise<void>;
  resetWithDemoData: () => Promise<void>;
  clearAllData: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

function computeSaleStatus(total: number, paidAmount: number): SaleStatus {
  if (paidAmount >= total - 0.009) return 'paid';
  if (paidAmount > 0.009) return 'partial';
  return 'pending';
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  useEffect(() => {
    let mounted = true;
    loadDatabase()
      .then((snapshot) => {
        if (!mounted) return;
        setSettings(snapshot.settings);
        setProducts(snapshot.products);
        setSuppliers(snapshot.suppliers);
        setSales(snapshot.sales);
        setInvestments(snapshot.investments);
        setStockMovements(snapshot.stockMovements);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const persistAll = useCallback(async (next: DatabaseBackup) => {
    setSettings(next.settings);
    setProducts(next.products);
    setSuppliers(next.suppliers);
    setSales(next.sales);
    setInvestments(next.investments);
    setStockMovements(next.stockMovements);
    await saveFullSnapshot(next);
  }, []);

  const getBackupSnapshot = useCallback(
    (): DatabaseBackup => ({
      version: 1,
      exportedAt: new Date().toISOString(),
      appName: 'GratiaStock',
      settings,
      suppliers,
      products,
      sales,
      investments,
      stockMovements,
    }),
    [settings, suppliers, products, sales, investments, stockMovements]
  );

  const saveProduct = useCallback(
    async (input: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
      const now = new Date().toISOString();
      const snapshot = getBackupSnapshot();
      let nextProducts: Product[];
      const nextMovements = [...snapshot.stockMovements];

      if (input.id) {
        const prev = snapshot.products.find((p) => p.id === input.id);
        nextProducts = snapshot.products.map((p) =>
          p.id === input.id
            ? {
                ...p,
                ...input,
                id: input.id,
                updatedAt: now,
              }
            : p
        );
        if (prev && prev.stock !== input.stock) {
          nextMovements.unshift({
            id: generateId('mov'),
            productId: prev.id,
            productName: input.name,
            type: 'adjustment',
            quantity: input.stock - prev.stock,
            previousStock: prev.stock,
            newStock: input.stock,
            reason: 'Edición directa de ficha de producto',
            createdAt: now,
          });
        }
      } else {
        const newProduct: Product = {
          ...input,
          id: generateId('prod'),
          createdAt: now,
          updatedAt: now,
        };
        nextProducts = [newProduct, ...snapshot.products];
        if (newProduct.stock > 0) {
          nextMovements.unshift({
            id: generateId('mov'),
            productId: newProduct.id,
            productName: newProduct.name,
            type: 'in',
            quantity: newProduct.stock,
            previousStock: 0,
            newStock: newProduct.stock,
            reason: 'Stock inicial al crear producto',
            createdAt: now,
          });
        }
      }

      await persistAll({
        ...snapshot,
        products: nextProducts,
        stockMovements: nextMovements,
      });
    },
    [getBackupSnapshot, persistAll]
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const snapshot = getBackupSnapshot();
      await persistAll({
        ...snapshot,
        products: snapshot.products.filter((p) => p.id !== id),
      });
    },
    [getBackupSnapshot, persistAll]
  );

  const adjustStock = useCallback(
    async (productId: string, delta: number, type: StockMovementType, reason: string) => {
      if (delta === 0) return;
      const now = new Date().toISOString();
      const snapshot = getBackupSnapshot();
      const target = snapshot.products.find((p) => p.id === productId);
      if (!target) return;

      const newStock = Math.max(0, target.stock + delta);
      const actualDelta = newStock - target.stock;
      const nextProducts = snapshot.products.map((p) =>
        p.id === productId ? { ...p, stock: newStock, updatedAt: now } : p
      );
      const movement: StockMovement = {
        id: generateId('mov'),
        productId: target.id,
        productName: target.name,
        type,
        quantity: actualDelta,
        previousStock: target.stock,
        newStock,
        reason: reason || (actualDelta > 0 ? 'Entrada manual de inventario' : 'Salida manual de inventario'),
        createdAt: now,
      };

      await persistAll({
        ...snapshot,
        products: nextProducts,
        stockMovements: [movement, ...snapshot.stockMovements],
      });
    },
    [getBackupSnapshot, persistAll]
  );

  const createSale = useCallback(
    async (input: CreateSaleInput): Promise<Sale> => {
      const now = new Date().toISOString();
      const snapshot = getBackupSnapshot();
      const productMap = new Map(snapshot.products.map((p) => [p.id, p]));
      const saleId = generateId('sale');
      const folio = generateFolio(snapshot.sales.length + 1);

      const saleItems: SaleItem[] = [];
      let subtotal = 0;

      const nextProducts = [...snapshot.products];
      const nextMovements = [...snapshot.stockMovements];

      for (const entry of input.cart) {
        const prod = productMap.get(entry.productId);
        if (!prod || entry.quantity <= 0) continue;
        const unitPrice = entry.unitPrice ?? prod.salePrice;
        const itemSubtotal = Number((unitPrice * entry.quantity).toFixed(2));
        subtotal += itemSubtotal;

        saleItems.push({
          id: generateId('sitem'),
          saleId,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          category: prod.category,
          quantity: entry.quantity,
          unitPrice,
          unitCost: prod.costPrice,
          subtotal: itemSubtotal,
        });

        const prodIdx = nextProducts.findIndex((p) => p.id === prod.id);
        if (prodIdx >= 0) {
          const prevStock = nextProducts[prodIdx].stock;
          const updatedStock = Math.max(0, prevStock - entry.quantity);
          nextProducts[prodIdx] = {
            ...nextProducts[prodIdx],
            stock: updatedStock,
            updatedAt: now,
          };
          nextMovements.unshift({
            id: generateId('mov'),
            productId: prod.id,
            productName: prod.name,
            type: 'sale',
            quantity: updatedStock - prevStock,
            previousStock: prevStock,
            newStock: updatedStock,
            reason: `Venta ${folio}${input.customerName ? ` · ${input.customerName}` : ''}`,
            createdAt: now,
          });
        }
      }

      subtotal = Number(subtotal.toFixed(2));
      const discount = Math.min(subtotal, Math.max(0, Number(input.discount.toFixed(2))));
      const total = Number(Math.max(0, subtotal - discount).toFixed(2));
      const paidAmount = Number(Math.min(total, Math.max(0, input.initialPayment)).toFixed(2));
      const balance = Number(Math.max(0, total - paidAmount).toFixed(2));
      const status = computeSaleStatus(total, paidAmount);

      const payments: PaymentRecord[] = [];
      if (paidAmount > 0) {
        payments.push({
          id: generateId('pay'),
          saleId,
          amount: paidAmount,
          method: input.paymentMethod,
          reference: input.paymentReference.trim(),
          notes: status === 'paid' ? 'Pago de contado' : 'Abono inicial',
          paidAt: now,
        });
      }

      const newSale: Sale = {
        id: saleId,
        folio,
        customerName: input.customerName.trim() || 'Cliente de Mostrador',
        customerPhone: input.customerPhone.trim(),
        parishOrGroup: input.parishOrGroup.trim(),
        subtotal,
        discount,
        total,
        paidAmount,
        balance,
        status,
        dueDate: balance > 0 ? input.dueDate : '',
        notes: input.notes.trim(),
        createdAt: now,
        items: saleItems,
        payments,
      };

      await persistAll({
        ...snapshot,
        products: nextProducts,
        sales: [newSale, ...snapshot.sales],
        stockMovements: nextMovements,
      });

      return newSale;
    },
    [getBackupSnapshot, persistAll]
  );

  const registerSalePayment = useCallback(
    async (input: AddPaymentInput) => {
      if (input.amount <= 0) return;
      const now = new Date().toISOString();
      const snapshot = getBackupSnapshot();

      const nextSales = snapshot.sales.map((sale) => {
        if (sale.id !== input.saleId) return sale;
        const applied = Number(Math.min(sale.balance, input.amount).toFixed(2));
        if (applied <= 0) return sale;

        const newPaid = Number((sale.paidAmount + applied).toFixed(2));
        const newBalance = Number(Math.max(0, sale.total - newPaid).toFixed(2));
        const newStatus = computeSaleStatus(sale.total, newPaid);
        const newPayment: PaymentRecord = {
          id: generateId('pay'),
          saleId: sale.id,
          amount: applied,
          method: input.method,
          reference: input.reference.trim(),
          notes: input.notes.trim() || (newBalance === 0 ? 'Liquidación total' : 'Abono a cuenta'),
          paidAt: now,
        };

        return {
          ...sale,
          paidAmount: newPaid,
          balance: newBalance,
          status: newStatus,
          payments: [newPayment, ...sale.payments],
        };
      });

      await persistAll({
        ...snapshot,
        sales: nextSales,
      });
    },
    [getBackupSnapshot, persistAll]
  );

  const deleteSale = useCallback(
    async (saleId: string, restoreStock: boolean) => {
      const now = new Date().toISOString();
      const snapshot = getBackupSnapshot();
      const targetSale = snapshot.sales.find((s) => s.id === saleId);
      if (!targetSale) return;

      const nextProducts = [...snapshot.products];
      const nextMovements = [...snapshot.stockMovements];

      if (restoreStock) {
        for (const item of targetSale.items) {
          const idx = nextProducts.findIndex((p) => p.id === item.productId);
          if (idx >= 0) {
            const prevStock = nextProducts[idx].stock;
            const newStock = prevStock + item.quantity;
            nextProducts[idx] = {
              ...nextProducts[idx],
              stock: newStock,
              updatedAt: now,
            };
            nextMovements.unshift({
              id: generateId('mov'),
              productId: item.productId,
              productName: item.productName,
              type: 'in',
              quantity: item.quantity,
              previousStock: prevStock,
              newStock,
              reason: `Devolución por anulación de venta ${targetSale.folio}`,
              createdAt: now,
            });
          }
        }
      }

      await persistAll({
        ...snapshot,
        products: nextProducts,
        sales: snapshot.sales.filter((s) => s.id !== saleId),
        stockMovements: nextMovements,
      });
    },
    [getBackupSnapshot, persistAll]
  );

  const saveInvestment = useCallback(
    async (input: CreateInvestmentInput & { id?: string }) => {
      const now = new Date().toISOString();
      const snapshot = getBackupSnapshot();
      const nextProducts = [...snapshot.products];
      const nextMovements = [...snapshot.stockMovements];

      let nextInvestments: Investment[];

      if (input.id) {
        nextInvestments = snapshot.investments.map((inv) =>
          inv.id === input.id
            ? {
                id: input.id,
                title: input.title.trim(),
                category: input.category,
                amount: input.amount,
                paidAmount: Math.min(input.amount, input.paidAmount),
                supplierId: input.supplierId,
                productId: input.productId,
                quantityAdded: input.quantityAdded,
                paymentMethod: input.paymentMethod,
                date: input.date || now,
                notes: input.notes.trim(),
              }
            : inv
        );
      } else {
        const newInv: Investment = {
          id: generateId('inv'),
          title: input.title.trim(),
          category: input.category,
          amount: input.amount,
          paidAmount: Math.min(input.amount, input.paidAmount),
          supplierId: input.supplierId,
          productId: input.productId,
          quantityAdded: input.quantityAdded,
          paymentMethod: input.paymentMethod,
          date: input.date || now,
          notes: input.notes.trim(),
        };
        nextInvestments = [newInv, ...snapshot.investments];

        if (input.productId && input.quantityAdded > 0) {
          const idx = nextProducts.findIndex((p) => p.id === input.productId);
          if (idx >= 0) {
            const prev = nextProducts[idx];
            const updatedStock = prev.stock + input.quantityAdded;
            nextProducts[idx] = {
              ...prev,
              stock: updatedStock,
              costPrice:
                input.newUnitCost && input.newUnitCost > 0 ? input.newUnitCost : prev.costPrice,
              updatedAt: now,
            };
            nextMovements.unshift({
              id: generateId('mov'),
              productId: prev.id,
              productName: prev.name,
              type: 'investment',
              quantity: input.quantityAdded,
              previousStock: prev.stock,
              newStock: updatedStock,
              reason: `Compra/Inversión: ${newInv.title}`,
              createdAt: now,
            });
          }
        }
      }

      await persistAll({
        ...snapshot,
        products: nextProducts,
        investments: nextInvestments,
        stockMovements: nextMovements,
      });
    },
    [getBackupSnapshot, persistAll]
  );

  const payInvestmentBalance = useCallback(
    async (investmentId: string, amount: number) => {
      if (amount <= 0) return;
      const snapshot = getBackupSnapshot();
      const nextInvestments = snapshot.investments.map((inv) => {
        if (inv.id !== investmentId) return inv;
        const nextPaid = Number(Math.min(inv.amount, inv.paidAmount + amount).toFixed(2));
        return { ...inv, paidAmount: nextPaid };
      });
      await persistAll({
        ...snapshot,
        investments: nextInvestments,
      });
    },
    [getBackupSnapshot, persistAll]
  );

  const deleteInvestment = useCallback(
    async (id: string) => {
      const snapshot = getBackupSnapshot();
      await persistAll({
        ...snapshot,
        investments: snapshot.investments.filter((i) => i.id !== id),
      });
    },
    [getBackupSnapshot, persistAll]
  );

  const saveSupplier = useCallback(
    async (input: Omit<Supplier, 'id' | 'createdAt'> & { id?: string }) => {
      const now = new Date().toISOString();
      const snapshot = getBackupSnapshot();
      let nextSuppliers: Supplier[];

      if (input.id) {
        nextSuppliers = snapshot.suppliers.map((s) =>
          s.id === input.id ? { ...s, ...input, id: input.id } : s
        );
      } else {
        nextSuppliers = [
          {
            ...input,
            id: generateId('sup'),
            createdAt: now,
          },
          ...snapshot.suppliers,
        ];
      }

      await persistAll({
        ...snapshot,
        suppliers: nextSuppliers,
      });
    },
    [getBackupSnapshot, persistAll]
  );

  const deleteSupplier = useCallback(
    async (id: string) => {
      const snapshot = getBackupSnapshot();
      const nextProducts = snapshot.products.map((p) =>
        p.supplierId === id ? { ...p, supplierId: null } : p
      );
      const nextInvestments = snapshot.investments.map((inv) =>
        inv.supplierId === id ? { ...inv, supplierId: null } : inv
      );
      await persistAll({
        ...snapshot,
        suppliers: snapshot.suppliers.filter((s) => s.id !== id),
        products: nextProducts,
        investments: nextInvestments,
      });
    },
    [getBackupSnapshot, persistAll]
  );

  const updateSettings = useCallback(
    async (next: Partial<AppSettings>) => {
      const snapshot = getBackupSnapshot();
      await persistAll({
        ...snapshot,
        settings: {
          ...snapshot.settings,
          ...next,
        },
      });
    },
    [getBackupSnapshot, persistAll]
  );

  const restoreFromBackup = useCallback(
    async (backup: DatabaseBackup) => {
      await persistAll(backup);
    },
    [persistAll]
  );

  const resetWithDemoData = useCallback(async () => {
    const demo = createInitialSeedData();
    await persistAll(demo);
  }, [persistAll]);

  const clearAllData = useCallback(async () => {
    const empty: DatabaseBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      appName: 'GratiaStock',
      settings,
      suppliers: [],
      products: [],
      sales: [],
      investments: [],
      stockMovements: [],
    };
    await persistAll(empty);
  }, [persistAll, settings]);

  const value = useMemo<StoreContextValue>(
    () => ({
      isLoading,
      settings,
      products,
      suppliers,
      sales,
      investments,
      stockMovements,
      getBackupSnapshot,
      saveProduct,
      deleteProduct,
      adjustStock,
      createSale,
      registerSalePayment,
      deleteSale,
      saveInvestment,
      payInvestmentBalance,
      deleteInvestment,
      saveSupplier,
      deleteSupplier,
      updateSettings,
      restoreFromBackup,
      resetWithDemoData,
      clearAllData,
    }),
    [
      isLoading,
      settings,
      products,
      suppliers,
      sales,
      investments,
      stockMovements,
      getBackupSnapshot,
      saveProduct,
      deleteProduct,
      adjustStock,
      createSale,
      registerSalePayment,
      deleteSale,
      saveInvestment,
      payInvestmentBalance,
      deleteInvestment,
      saveSupplier,
      deleteSupplier,
      updateSettings,
      restoreFromBackup,
      resetWithDemoData,
      clearAllData,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore debe usarse dentro de StoreProvider');
  }
  return ctx;
}
