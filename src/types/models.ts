export type ProductCategory =
  | 'Biblias Católicas'
  | 'Camándulas y Rosarios'
  | 'Libros y Devocionarios'
  | 'Imágenes y Crucifijos'
  | 'Medallas y Escapularios'
  | 'Velones y Liturgia'
  | 'Otros';

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Biblias Católicas',
  'Camándulas y Rosarios',
  'Libros y Devocionarios',
  'Imágenes y Crucifijos',
  'Medallas y Escapularios',
  'Velones y Liturgia',
  'Otros',
];

export type PaymentMethod =
  | 'Efectivo'
  | 'Transferencia'
  | 'Pago Móvil'
  | 'Tarjeta'
  | 'Divisas / Zelle'
  | 'Otro';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Efectivo',
  'Transferencia',
  'Pago Móvil',
  'Tarjeta',
  'Divisas / Zelle',
  'Otro',
];

export type SaleStatus = 'paid' | 'partial' | 'pending';

export type InvestmentCategory =
  | 'Compra de Stock'
  | 'Capital Inicial'
  | 'Mobiliario y Vitrinas'
  | 'Transporte y Envíos'
  | 'Ferias Parroquiales'
  | 'Gastos Operativos';

export const INVESTMENT_CATEGORIES: InvestmentCategory[] = [
  'Compra de Stock',
  'Capital Inicial',
  'Mobiliario y Vitrinas',
  'Transporte y Envíos',
  'Ferias Parroquiales',
  'Gastos Operativos',
];

export type StockMovementType = 'in' | 'out' | 'adjustment' | 'sale' | 'investment';

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  specialty: string;
  paymentTerms: string;
  notes: string;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  editionOrDetail: string; // ej. Letra Grande, Tapa Dura, Madera de Olivo
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  location: string; // ej. Vitrina A1, Estante Biblias
  supplierId: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  sku: string;
  category: ProductCategory;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  subtotal: number;
}

export interface PaymentRecord {
  id: string;
  saleId: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  notes: string;
  paidAt: string;
}

export interface Sale {
  id: string;
  folio: string;
  customerName: string;
  customerPhone: string;
  parishOrGroup: string;
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  balance: number;
  status: SaleStatus;
  dueDate: string;
  notes: string;
  createdAt: string;
  items: SaleItem[];
  payments: PaymentRecord[];
}

export interface Investment {
  id: string;
  title: string;
  category: InvestmentCategory;
  amount: number;
  paidAmount: number;
  supplierId: string | null;
  productId: string | null;
  quantityAdded: number;
  paymentMethod: PaymentMethod;
  date: string;
  notes: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number; // positivo entrada, negativo salida
  previousStock: number;
  newStock: number;
  reason: string;
  createdAt: string;
}

export interface AppSettings {
  storeName: string;
  storeSubtitle: string;
  currencySymbol: string;
  defaultMinStock: number;
  parishOrAddress: string;
  phoneContact: string;
}

export interface DatabaseBackup {
  version: number;
  exportedAt: string;
  appName: string;
  settings: AppSettings;
  suppliers: Supplier[];
  products: Product[];
  sales: Sale[];
  investments: Investment[];
  stockMovements: StockMovement[];
}
