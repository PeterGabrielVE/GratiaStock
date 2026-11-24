import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../context/StoreContext';
import { COLORS, CURRENCY_OPTIONS, SHADOWS } from '../../constants/theme';
import {
  ChipSelector,
  FormField,
  KpiCard,
  PrimaryButton,
  ScreenHeader,
  confirmAction,
} from '../../components/UI';
import { formatCurrency, parseNumericInput } from '../../utils/format';
import {
  ExportDatasetKind,
  buildExecutiveSummaryText,
  copyTextToClipboard,
  exportDataset,
  pickAndParseBackupJson,
} from '../../utils/exporter';

type SectionTab = 'Estadísticas' | 'Exportar y Respaldos' | 'Opciones';
type TimeRange = '7 días' | '30 días' | 'Todo';

export default function DatosExportarOpcionesScreen() {
  const {
    settings,
    products,
    sales,
    investments,
    suppliers,
    stockMovements,
    getBackupSnapshot,
    updateSettings,
    restoreFromBackup,
    resetWithDemoData,
    clearAllData,
  } = useStore();

  const sym = settings.currencySymbol;
  const [section, setSection] = useState<SectionTab>('Estadísticas');
  const [range, setRange] = useState<TimeRange>('Todo');
  const [referenceNow, setReferenceNow] = useState(() => Date.now());
  const [busyExport, setBusyExport] = useState(false);

  // Estado local de configuración editable
  const [storeName, setStoreName] = useState(settings.storeName);
  const [storeSubtitle, setStoreSubtitle] = useState(settings.storeSubtitle);
  const [parishOrAddress, setParishOrAddress] = useState(settings.parishOrAddress);
  const [phoneContact, setPhoneContact] = useState(settings.phoneContact);
  const [defaultMinStock, setDefaultMinStock] = useState(String(settings.defaultMinStock));

  const rangedSales = useMemo(() => {
    if (range === 'Todo') return sales;
    const days = range === '7 días' ? 7 : 30;
    const cutoff = referenceNow - days * 86400000;
    return sales.filter((s) => new Date(s.createdAt).getTime() >= cutoff);
  }, [sales, range, referenceNow]);

  const analytics = useMemo(() => {
    const grossSales = rangedSales.reduce((acc, s) => acc + s.total, 0);
    const collected = rangedSales.reduce((acc, s) => acc + s.paidAmount, 0);
    const pendingBalance = rangedSales.reduce((acc, s) => acc + s.balance, 0);

    let costOfGoodsSold = 0;
    const productStats = new Map<
      string,
      { name: string; qty: number; revenue: number }
    >();
    const categoryStats = new Map<string, number>();
    const methodStats = new Map<string, number>();

    for (const sale of rangedSales) {
      for (const item of sale.items) {
        costOfGoodsSold += item.unitCost * item.quantity;
        const prev = productStats.get(item.productId) ?? {
          name: item.productName,
          qty: 0,
          revenue: 0,
        };
        prev.qty += item.quantity;
        prev.revenue += item.subtotal;
        productStats.set(item.productId, prev);

        categoryStats.set(
          item.category,
          (categoryStats.get(item.category) ?? 0) + item.subtotal
        );
      }
      for (const pay of sale.payments) {
        methodStats.set(pay.method, (methodStats.get(pay.method) ?? 0) + pay.amount);
      }
    }

    const estimatedProfit = grossSales - costOfGoodsSold;
    const topProducts = Array.from(productStats.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    const byCategory = Array.from(categoryStats.entries()).sort((a, b) => b[1] - a[1]);
    const byMethod = Array.from(methodStats.entries()).sort((a, b) => b[1] - a[1]);

    const inventoryCost = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
    const inventoryRetail = products.reduce((s, p) => s + p.stock * p.salePrice, 0);
    const totalInvested = investments.reduce((s, i) => s + i.amount, 0);

    return {
      grossSales,
      collected,
      pendingBalance,
      estimatedProfit,
      topProducts,
      byCategory,
      byMethod,
      inventoryCost,
      inventoryRetail,
      totalInvested,
    };
  }, [rangedSales, products, investments]);

  const handleRunExport = async (kind: ExportDatasetKind, label: string) => {
    try {
      setBusyExport(true);
      const snapshot = getBackupSnapshot();
      await exportDataset(kind, snapshot);
    } catch (err) {
      Alert.alert(
        'Error al exportar',
        err instanceof Error ? err.message : `No se pudo exportar ${label}.`
      );
    } finally {
      setBusyExport(false);
    }
  };

  const handleCopySummary = async () => {
    const text = buildExecutiveSummaryText(getBackupSnapshot());
    await copyTextToClipboard(text);
    Alert.alert(
      'Resumen copiado',
      'El reporte ejecutivo fue copiado al portapapeles para enviarlo por WhatsApp o correo.'
    );
  };

  const handleImportBackup = async () => {
    try {
      const parsed = await pickAndParseBackupJson();
      if (!parsed) return;
      confirmAction(
        'Restaurar respaldo JSON',
        `Se cargarán ${parsed.products.length} productos, ${parsed.sales.length} ventas y ${parsed.suppliers.length} proveedores reemplazando los datos actuales.`,
        async () => {
          await restoreFromBackup(parsed);
          setStoreName(parsed.settings.storeName);
          setStoreSubtitle(parsed.settings.storeSubtitle);
          Alert.alert('Respaldo restaurado', 'Los datos se importaron exitosamente.');
        },
        Alert
      );
    } catch (err) {
      Alert.alert(
        'Archivo inválido',
        err instanceof Error ? err.message : 'No se pudo leer el archivo JSON.'
      );
    }
  };

  const handleSaveSettings = async () => {
    await updateSettings({
      storeName: storeName.trim() || 'GratiaStock',
      storeSubtitle: storeSubtitle.trim() || 'Librería y Artículos Católicos',
      parishOrAddress: parishOrAddress.trim(),
      phoneContact: phoneContact.trim(),
      defaultMinStock: Math.max(1, Math.round(parseNumericInput(defaultMinStock) || 5)),
    });
    Alert.alert('Opciones guardadas', 'La configuración de la tienda fue actualizada.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Datos, Exportación y Opciones"
        subtitle="Reportes financieros, archivos CSV para Excel, respaldos y ajustes"
      />

      <View style={styles.tabsStrip}>
        <ChipSelector
          options={['Estadísticas', 'Exportar y Respaldos', 'Opciones'] as const}
          selected={section}
          onSelect={setSection}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {section === 'Estadísticas' ? (
          <View style={{ gap: 14 }}>
            <View style={styles.rangeRow}>
              <Text style={styles.rangeLabel}>Período de análisis:</Text>
              <ChipSelector
                options={['7 días', '30 días', 'Todo'] as const}
                selected={range}
                onSelect={(nextRange) => {
                  setRange(nextRange);
                  setReferenceNow(Date.now());
                }}
              />
            </View>

            <View style={styles.kpiGrid}>
              <KpiCard
                label="Ventas Facturadas"
                value={formatCurrency(analytics.grossSales, sym)}
                hint={`${rangedSales.length} operaciones`}
                icon="cart-outline"
                tone="primary"
              />
              <KpiCard
                label="Utilidad Estimada"
                value={formatCurrency(analytics.estimatedProfit, sym)}
                hint="Precio venta − costo"
                icon="sparkles-outline"
                tone="success"
              />
              <KpiCard
                label="Efectivo Cobrado"
                value={formatCurrency(analytics.collected, sym)}
                hint={`Pendiente: ${formatCurrency(analytics.pendingBalance, sym)}`}
                icon="cash-outline"
                tone="info"
              />
              <KpiCard
                label="Patrimonio en Stock"
                value={formatCurrency(analytics.inventoryRetail, sym)}
                hint={`Costo: ${formatCurrency(analytics.inventoryCost, sym)}`}
                icon="layers-outline"
                tone="accent"
              />
            </View>

            {/* Top productos */}
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Top Productos Católicos Más Vendidos</Text>
              {analytics.topProducts.length === 0 ? (
                <Text style={styles.emptyHint}>Sin ventas registradas en este período.</Text>
              ) : (
                analytics.topProducts.map((prod, idx) => {
                  const maxRev = analytics.topProducts[0]?.revenue || 1;
                  const pct = Math.max(8, Math.round((prod.revenue / maxRev) * 100));
                  return (
                    <View key={prod.name} style={styles.barItem}>
                      <View style={styles.barHeader}>
                        <Text style={styles.barTitle} numberOfLines={1}>
                          {idx + 1}. {prod.name} ({prod.qty} uds.)
                        </Text>
                        <Text style={styles.barAmount}>
                          {formatCurrency(prod.revenue, sym)}
                        </Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%` }]} />
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Ventas por Categoría */}
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Ingresos por Categoría Católica</Text>
              {analytics.byCategory.length === 0 ? (
                <Text style={styles.emptyHint}>Aún no hay datos por categoría.</Text>
              ) : (
                analytics.byCategory.map(([cat, total]) => (
                  <View key={cat} style={styles.kvRow}>
                    <Text style={styles.kvKey}>{cat}</Text>
                    <Text style={styles.kvVal}>{formatCurrency(total, sym)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Cobros por Método de Pago */}
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Cobros por Método de Pago</Text>
              {analytics.byMethod.length === 0 ? (
                <Text style={styles.emptyHint}>Sin pagos registrados en el período.</Text>
              ) : (
                analytics.byMethod.map(([method, amount]) => (
                  <View key={method} style={styles.kvRow}>
                    <Text style={styles.kvKey}>{method}</Text>
                    <Text style={styles.kvVal}>{formatCurrency(amount, sym)}</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : null}

        {section === 'Exportar y Respaldos' ? (
          <View style={{ gap: 14 }}>
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>📊 Exportar Tablas a Excel / CSV</Text>
              <Text style={styles.panelDesc}>
                Archivos CSV codificados en UTF-8 con BOM listos para abrir directamente en
                Microsoft Excel, Google Sheets o enviar por correo/WhatsApp.
              </Text>

              <View style={styles.exportList}>
                <ExportRow
                  icon="book-outline"
                  title="Catálogo e Inventario Valorizado (.csv)"
                  subtitle={`${products.length} productos con costos, precios y márgenes`}
                  disabled={busyExport}
                  onPress={() => handleRunExport('inventory_csv', 'Inventario')}
                />
                <ExportRow
                  icon="receipt-outline"
                  title="Ventas y Cuentas por Cobrar (.csv)"
                  subtitle={`${sales.length} ventas con saldos y fechas compromiso`}
                  disabled={busyExport}
                  onPress={() => handleRunExport('sales_csv', 'Ventas')}
                />
                <ExportRow
                  icon="cash-outline"
                  title="Historial Detallado de Pagos y Abonos (.csv)"
                  subtitle="Todos los cobros recibidos por método y referencia"
                  disabled={busyExport}
                  onPress={() => handleRunExport('payments_csv', 'Pagos')}
                />
                <ExportRow
                  icon="trending-up-outline"
                  title="Inversiones y Compras a Proveedores (.csv)"
                  subtitle={`${investments.length} registros de capital y deudas`}
                  disabled={busyExport}
                  onPress={() => handleRunExport('investments_csv', 'Inversiones')}
                />
                <ExportRow
                  icon="people-outline"
                  title="Directorio de Proveedores (.csv)"
                  subtitle={`${suppliers.length} editoriales y distribuidores`}
                  disabled={busyExport}
                  onPress={() => handleRunExport('suppliers_csv', 'Proveedores')}
                />
                <ExportRow
                  icon="swap-vertical-outline"
                  title="Kardex de Movimientos de Stock (.csv)"
                  subtitle={`${stockMovements.length} entradas, salidas y ajustes`}
                  disabled={busyExport}
                  onPress={() => handleRunExport('movements_csv', 'Kardex')}
                />
              </View>
            </View>

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>💬 Resumen Rápido para WhatsApp</Text>
              <Text style={styles.panelDesc}>
                Copia un informe ejecutivo en texto con totales de caja, cuentas por cobrar,
                inventario e inversiones para compartir con tu parroquia o equipo.
              </Text>
              <PrimaryButton
                label="Copiar Reporte Ejecutivo"
                icon="copy-outline"
                variant="accent"
                onPress={handleCopySummary}
              />
            </View>

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>🛡️ Copia de Seguridad Completa (JSON)</Text>
              <Text style={styles.panelDesc}>
                Guarda una copia íntegra de toda tu base de datos para respaldar tu teléfono o
                migrar a otro dispositivo en cualquier momento.
              </Text>
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label="Exportar Backup"
                    icon="cloud-download-outline"
                    disabled={busyExport}
                    onPress={() => handleRunExport('full_backup_json', 'Backup JSON')}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label="Importar JSON"
                    icon="cloud-upload-outline"
                    variant="outline"
                    onPress={handleImportBackup}
                  />
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {section === 'Opciones' ? (
          <View style={{ gap: 14 }}>
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>⚙️ Datos de la Librería / Tienda Católica</Text>
              <FormField
                label="Nombre de la Tienda o Apostolado"
                value={storeName}
                onChangeText={setStoreName}
              />
              <FormField
                label="Subtítulo / Lema"
                value={storeSubtitle}
                onChangeText={setStoreSubtitle}
              />
              <FormField
                label="Parroquia / Dirección"
                value={parishOrAddress}
                onChangeText={setParishOrAddress}
              />
              <FormField
                label="Teléfono de contacto (para recibos)"
                value={phoneContact}
                onChangeText={setPhoneContact}
              />
              <FormField
                label="Stock mínimo por defecto para nuevos productos"
                keyboardType="number-pad"
                value={defaultMinStock}
                onChangeText={setDefaultMinStock}
              />

              <Text style={styles.currencyLabel}>Símbolo de Moneda</Text>
              <ChipSelector
                options={CURRENCY_OPTIONS}
                selected={settings.currencySymbol}
                onSelect={(c) => updateSettings({ currencySymbol: c })}
              />

              <View style={{ height: 14 }} />
              <PrimaryButton
                label="Guardar Configuración"
                icon="save-outline"
                onPress={handleSaveSettings}
              />
            </View>

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>🗄️ Administración de Datos</Text>
              <Text style={styles.panelDesc}>
                Puedes recargar el catálogo católico de demostración o vaciar los registros para
                comenzar desde cero manteniendo tu configuración.
              </Text>
              <View style={{ gap: 10 }}>
                <PrimaryButton
                  label="Restaurar Catálogo de Demostración"
                  icon="refresh-outline"
                  variant="outline"
                  onPress={() =>
                    confirmAction(
                      'Restaurar datos de ejemplo',
                      '¿Reemplazar los datos actuales con el catálogo inicial de Biblias, camándulas y ejemplos?',
                      () => resetWithDemoData(),
                      Alert
                    )
                  }
                />
                <PrimaryButton
                  label="Vaciar Todos los Registros"
                  icon="trash-outline"
                  variant="danger"
                  onPress={() =>
                    confirmAction(
                      'Vaciar base de datos',
                      'Se eliminarán todos los productos, ventas, pagos, inversiones y proveedores. Te recomendamos exportar un Backup JSON antes.',
                      () => clearAllData(),
                      Alert
                    )
                  }
                />
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ExportRow({
  icon,
  title,
  subtitle,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.exportItem,
        pressed && { opacity: 0.8, backgroundColor: COLORS.surfaceAlt },
      ]}
    >
      <View style={styles.exportIconCircle}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.exportItemTitle}>{title}</Text>
        <Text style={styles.exportItemSub}>{subtitle}</Text>
      </View>
      <Ionicons name="share-outline" size={20} color={COLORS.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabsStrip: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  scrollContent: { padding: 16, paddingBottom: 36 },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rangeLabel: { fontSize: 12.5, fontWeight: '700', color: COLORS.textSecondary },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  panelCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 8,
  },
  panelDesc: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  emptyHint: { fontSize: 12.5, color: COLORS.textMuted, paddingVertical: 6 },
  barItem: { marginBottom: 10 },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  barTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.text },
  barAmount: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  barTrack: {
    height: 8,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 999,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  kvKey: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  kvVal: { fontSize: 13, color: COLORS.primary, fontWeight: '800' },
  exportList: { gap: 8 },
  exportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 11,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exportIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportItemTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  exportItemSub: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },
  row2: { flexDirection: 'row', gap: 10 },
  currencyLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
});
