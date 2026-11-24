import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { DatabaseBackup } from '../types/models';
import { formatCurrency, formatDate, formatDateTime } from './format';

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  // UTF-8 BOM para que Excel en español reconozca tildes y ñ automáticamente
  const bom = '\uFEFF';
  const headerLine = headers.map(escapeCsvCell).join(',');
  const bodyLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return bom + [headerLine, ...bodyLines].join('\r\n');
}

export async function shareOrDownloadFile(
  fileName: string,
  content: string,
  mimeType: string
): Promise<string> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return fileName;
  }

  const targetFile = new File(Paths.cache, fileName);
  targetFile.create({ overwrite: true, intermediates: true });
  await targetFile.write(content);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(targetFile.uri, {
      mimeType,
      dialogTitle: `Exportar ${fileName}`,
    });
  }
  return targetFile.uri;
}

export type ExportDatasetKind =
  | 'inventory_csv'
  | 'sales_csv'
  | 'payments_csv'
  | 'investments_csv'
  | 'suppliers_csv'
  | 'movements_csv'
  | 'full_backup_json';

export async function exportDataset(
  kind: ExportDatasetKind,
  data: DatabaseBackup
): Promise<string> {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const supplierMap = new Map(data.suppliers.map((s) => [s.id, s.name]));

  switch (kind) {
    case 'inventory_csv': {
      const headers = [
        'SKU',
        'Producto',
        'Categoría',
        'Edición / Detalle',
        'Stock Actual',
        'Stock Mínimo',
        'Estado Stock',
        'Precio Costo',
        'Precio Venta',
        'Margen Unitario',
        'Valor Costo Total',
        'Valor Venta Total',
        'Ubicación',
        'Proveedor',
        'Notas',
      ];
      const rows = data.products.map((p) => [
        p.sku,
        p.name,
        p.category,
        p.editionOrDetail,
        p.stock,
        p.minStock,
        p.stock <= p.minStock ? 'BAJO STOCK' : 'ÓPTIMO',
        p.costPrice.toFixed(2),
        p.salePrice.toFixed(2),
        (p.salePrice - p.costPrice).toFixed(2),
        (p.stock * p.costPrice).toFixed(2),
        (p.stock * p.salePrice).toFixed(2),
        p.location,
        p.supplierId ? supplierMap.get(p.supplierId) ?? '' : '',
        p.notes,
      ]);
      const csv = buildCsv(headers, rows);
      return shareOrDownloadFile(`gratiastock_inventario_${dateStamp}.csv`, csv, 'text/csv');
    }

    case 'sales_csv': {
      const headers = [
        'Folio',
        'Fecha',
        'Cliente',
        'Teléfono',
        'Parroquia / Grupo',
        'Artículos',
        'Subtotal',
        'Descuento',
        'Total Venta',
        'Total Pagado',
        'Saldo Pendiente',
        'Estado Pago',
        'Fecha Compromiso',
        'Notas',
      ];
      const rows = data.sales.map((s) => [
        s.folio,
        formatDateTime(s.createdAt),
        s.customerName || 'Venta de Mostrador',
        s.customerPhone,
        s.parishOrGroup,
        s.items.map((i) => `${i.quantity}x ${i.productName}`).join(' | '),
        s.subtotal.toFixed(2),
        s.discount.toFixed(2),
        s.total.toFixed(2),
        s.paidAmount.toFixed(2),
        s.balance.toFixed(2),
        s.status === 'paid' ? 'PAGADO' : s.status === 'partial' ? 'ABONO PARCIAL' : 'PENDIENTE',
        s.dueDate ? formatDate(s.dueDate) : '',
        s.notes,
      ]);
      const csv = buildCsv(headers, rows);
      return shareOrDownloadFile(`gratiastock_ventas_${dateStamp}.csv`, csv, 'text/csv');
    }

    case 'payments_csv': {
      const headers = [
        'Folio Venta',
        'Cliente',
        'Fecha de Pago',
        'Monto Abonado',
        'Método de Pago',
        'Referencia',
        'Saldo Restante de Venta',
        'Notas',
      ];
      const rows: (string | number)[][] = [];
      for (const sale of data.sales) {
        for (const pay of sale.payments) {
          rows.push([
            sale.folio,
            sale.customerName || 'Venta de Mostrador',
            formatDateTime(pay.paidAt),
            pay.amount.toFixed(2),
            pay.method,
            pay.reference,
            sale.balance.toFixed(2),
            pay.notes,
          ]);
        }
      }
      const csv = buildCsv(headers, rows);
      return shareOrDownloadFile(`gratiastock_pagos_abonos_${dateStamp}.csv`, csv, 'text/csv');
    }

    case 'investments_csv': {
      const headers = [
        'Fecha',
        'Concepto / Inversión',
        'Categoría',
        'Monto Total',
        'Monto Pagado',
        'Por Pagar a Proveedor',
        'Método de Pago',
        'Proveedor',
        'Unidades Sumadas al Stock',
        'Notas',
      ];
      const rows = data.investments.map((inv) => [
        formatDate(inv.date),
        inv.title,
        inv.category,
        inv.amount.toFixed(2),
        inv.paidAmount.toFixed(2),
        Math.max(0, inv.amount - inv.paidAmount).toFixed(2),
        inv.paymentMethod,
        inv.supplierId ? supplierMap.get(inv.supplierId) ?? '' : '',
        inv.quantityAdded,
        inv.notes,
      ]);
      const csv = buildCsv(headers, rows);
      return shareOrDownloadFile(`gratiastock_inversiones_${dateStamp}.csv`, csv, 'text/csv');
    }

    case 'suppliers_csv': {
      const headers = [
        'Proveedor / Editorial',
        'Contacto',
        'Teléfono',
        'Correo',
        'Ciudad',
        'Especialidad',
        'Condiciones de Pago',
        'Notas',
      ];
      const rows = data.suppliers.map((sup) => [
        sup.name,
        sup.contactName,
        sup.phone,
        sup.email,
        sup.city,
        sup.specialty,
        sup.paymentTerms,
        sup.notes,
      ]);
      const csv = buildCsv(headers, rows);
      return shareOrDownloadFile(`gratiastock_proveedores_${dateStamp}.csv`, csv, 'text/csv');
    }

    case 'movements_csv': {
      const headers = [
        'Fecha',
        'Producto',
        'Tipo Movimiento',
        'Cantidad',
        'Stock Anterior',
        'Stock Nuevo',
        'Motivo / Referencia',
      ];
      const rows = data.stockMovements.map((m) => [
        formatDateTime(m.createdAt),
        m.productName,
        m.type.toUpperCase(),
        m.quantity,
        m.previousStock,
        m.newStock,
        m.reason,
      ]);
      const csv = buildCsv(headers, rows);
      return shareOrDownloadFile(`gratiastock_kardex_${dateStamp}.csv`, csv, 'text/csv');
    }

    case 'full_backup_json': {
      const payload: DatabaseBackup = {
        ...data,
        exportedAt: new Date().toISOString(),
      };
      const json = JSON.stringify(payload, null, 2);
      return shareOrDownloadFile(
        `gratiastock_respaldo_${dateStamp}.json`,
        json,
        'application/json'
      );
    }
  }
}

export function buildExecutiveSummaryText(data: DatabaseBackup): string {
  const sym = data.settings.currencySymbol;
  const totalUnits = data.products.reduce((acc, p) => acc + p.stock, 0);
  const stockCostValue = data.products.reduce((acc, p) => acc + p.stock * p.costPrice, 0);
  const stockSaleValue = data.products.reduce((acc, p) => acc + p.stock * p.salePrice, 0);
  const lowStockCount = data.products.filter((p) => p.stock <= p.minStock).length;

  const totalSales = data.sales.reduce((acc, s) => acc + s.total, 0);
  const totalCollected = data.sales.reduce((acc, s) => acc + s.paidAmount, 0);
  const totalReceivable = data.sales.reduce((acc, s) => acc + s.balance, 0);

  const totalInvested = data.investments.reduce((acc, i) => acc + i.amount, 0);
  const supplierDebt = data.investments.reduce(
    (acc, i) => acc + Math.max(0, i.amount - i.paidAmount),
    0
  );

  return [
    `✝️ REPORTE EJECUTIVO — ${data.settings.storeName.toUpperCase()}`,
    `${data.settings.storeSubtitle}`,
    `Fecha: ${formatDateTime(new Date().toISOString())}`,
    `────────────────────────────`,
    `📦 INVENTARIO CATÓLICO`,
    `• Productos registrados: ${data.products.length} (${totalUnits} uds.)`,
    `• Valor en costo: ${formatCurrency(stockCostValue, sym)}`,
    `• Valor en venta: ${formatCurrency(stockSaleValue, sym)}`,
    `• Alertas de stock bajo: ${lowStockCount} productos`,
    ``,
    `💰 VENTAS Y PAGOS`,
    `• Ventas acumuladas (${data.sales.length}): ${formatCurrency(totalSales, sym)}`,
    `• Dinero cobrado: ${formatCurrency(totalCollected, sym)}`,
    `• Cuentas por cobrar (abonos pendientes): ${formatCurrency(totalReceivable, sym)}`,
    ``,
    `📈 INVERSIONES Y PROVEEDORES`,
    `• Total invertido: ${formatCurrency(totalInvested, sym)}`,
    `• Saldo por pagar a proveedores: ${formatCurrency(supplierDebt, sym)}`,
    `• Proveedores activos: ${data.suppliers.length}`,
  ].join('\n');
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

export async function pickAndParseBackupJson(): Promise<DatabaseBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  let rawText = '';

  if (Platform.OS === 'web' && asset.file) {
    rawText = await asset.file.text();
  } else {
    const pickedFile = new File(asset.uri);
    rawText = await pickedFile.text();
  }

  const parsed = JSON.parse(rawText) as Partial<DatabaseBackup>;
  if (
    !parsed ||
    !Array.isArray(parsed.products) ||
    !Array.isArray(parsed.sales) ||
    !Array.isArray(parsed.suppliers) ||
    !Array.isArray(parsed.investments)
  ) {
    throw new Error('El archivo seleccionado no tiene un formato válido de respaldo de GratiaStock.');
  }

  return {
    version: parsed.version ?? 1,
    exportedAt: parsed.exportedAt ?? new Date().toISOString(),
    appName: 'GratiaStock',
    settings: parsed.settings ?? {
      storeName: 'GratiaStock',
      storeSubtitle: 'Librería y Artículos Católicos',
      currencySymbol: '$',
      defaultMinStock: 5,
      parishOrAddress: '',
      phoneContact: '',
    },
    suppliers: parsed.suppliers,
    products: parsed.products,
    sales: parsed.sales,
    investments: parsed.investments,
    stockMovements: Array.isArray(parsed.stockMovements) ? parsed.stockMovements : [],
  };
}
