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
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../context/StoreContext';
import { COLORS, CURRENCY_OPTIONS, SERIF_FONT, SHADOWS } from '../../constants/theme';
import {
  ChipSelector,
  FormField,
  GratiaLogoCard,
  KpiCard,
  PrimaryButton,
  ProgressBar,
  ScreenHeader,
  SegmentedTabs,
  confirmAction,
  useToast,
} from '../../components/UI';
import { formatCurrency, parseNumericInput } from '../../utils/format';
import {
  ExportDatasetKind,
  buildExecutiveSummaryText,
  copyTextToClipboard,
  exportDataset,
  pickAndParseBackupJson,
} from '../../utils/exporter';

type SectionTab = 'Analítica' | 'Exportar' | 'Ajustes';
type TimeRange = '7 días' | '30 días' | 'Todo';

export default function DatosExportarOpcionesScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { showToast } = useToast();
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
  const [manualSection, setManualSection] = useState<SectionTab>('Analítica');
  const [handledTabParam, setHandledTabParam] = useState<string | undefined>(undefined);
  const [range, setRange] = useState<TimeRange>('Todo');
  const [referenceNow, setReferenceNow] = useState(() => Date.now());
  const [busyExport, setBusyExport] = useState(false);

  const section: SectionTab =
    params.tab && params.tab !== handledTabParam ? 'Exportar' : manualSection;

  const handleSelectSection = (next: SectionTab) => {
    if (params.tab) setHandledTabParam(params.tab);
    setManualSection(next);
  };

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
      showToast(`Archivo "${label}" generado`);
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
    showToast('Reporte ejecutivo copiado al portapapeles');
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
          showToast('Respaldo restaurado exitosamente');
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
      storeName: storeName.trim() || 'Gratia',
      storeSubtitle: storeSubtitle.trim() || 'Librería y Artículos Católicos',
      parishOrAddress: parishOrAddress.trim(),
      phoneContact: phoneContact.trim(),
      defaultMinStock: Math.max(1, Math.round(parseNumericInput(defaultMinStock) || 5)),
    });
    showToast('Configuración de Gratia actualizada');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Datos y Exportación"
        subtitle="Analítica financiera, Excel CSV, respaldos y opciones"
      />

      <View style={styles.tabsStrip}>
        <SegmentedTabs
          options={['Analítica', 'Exportar', 'Ajustes'] as const}
          selected={section}
          onSelect={handleSelectSection}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {section === 'Analítica' ? (
          <View style={{ gap: 14 }}>
            <View style={styles.rangeRow}>
              <Text style={styles.rangeLabel}>Período:</Text>
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
                icon="wallet-outline"
                tone="info"
              />
              <KpiCard
                label="Patrimonio Stock"
                value={formatCurrency(analytics.inventoryRetail, sym)}
                hint={`Costo: ${formatCurrency(analytics.inventoryCost, sym)}`}
                icon="layers-outline"
                tone="accent"
              />
            </View>

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Artículos Más Vendidos</Text>
              {analytics.topProducts.length === 0 ? (
                <Text style={styles.emptyHint}>Sin ventas registradas en este período.</Text>
              ) : (
                analytics.topProducts.map((prod, idx) => {
                  const maxRev = analytics.topProducts[0]?.revenue || 1;
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
                      <ProgressBar progress={prod.revenue / maxRev} tone="accent" height={7} />
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Ventas por Categoría Católica</Text>
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

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Cobros por Método de Pago</Text>
              {analytics.byMethod.length === 0 ? (
                <Text style={styles.emptyHint}>Sin cobros registrados en el período.</Text>
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

        {section === 'Exportar' ? (
          <View style={{ gap: 14 }}>
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>📊 Exportar Hojas para Excel (.CSV)</Text>
              <Text style={styles.panelDesc}>
                Archivos con formato UTF-8 listos para abrir en Excel, Google Sheets o compartir
                directamente por WhatsApp y correo.
              </Text>

              <View style={styles.exportList}>
                <ExportRow
                  icon="book-outline"
                  title="Catálogo e Inventario Valorizado"
                  subtitle={`${products.length} artículos con costos, precios y márgenes`}
                  disabled={busyExport}
                  onPress={() => handleRunExport('inventory_csv', 'Inventario CSV')}
                />
                <ExportRow
                  icon="receipt-outline"
                  title="Ventas y Cuentas por Cobrar"
                  subtitle={`${sales.length} operaciones con saldos pendientes`}
                  disabled={busyExport}
                  onPress={() => handleRunExport('sales_csv', 'Ventas CSV')}
                />
                <ExportRow
                  icon="cash-outline"
                  title="Historial de Pagos y Abonos"
                  subtitle="Detalle de cada pago recibido por método y referencia"
                  disabled={busyExport}
                  onPress={() => handleRunExport('payments_csv', 'Pagos CSV')}
                />
                <ExportRow
                  icon="trending-up-outline"
                  title="Inversiones y Compras"
                  subtitle={`${investments.length} registros de capital y proveedores`}
                  disabled={busyExport}
                  onPress={() => handleRunExport('investments_csv', 'Inversiones CSV')}
                />
                <ExportRow
                  icon="people-outline"
                  title="Directorio de Proveedores"
                  subtitle={`${suppliers.length} editoriales y talleres`}
                  disabled={busyExport}
                  onPress={() => handleRunExport('suppliers_csv', 'Proveedores CSV')}
                />
                <ExportRow
                  icon="swap-vertical-outline"
                  title="Kardex de Movimientos"
                  subtitle={`${stockMovements.length} entradas, salidas y ajustes`}
                  disabled={busyExport}
                  onPress={() => handleRunExport('movements_csv', 'Kardex CSV')}
                />
              </View>
            </View>

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>💬 Informe Ejecutivo para WhatsApp</Text>
              <Text style={styles.panelDesc}>
                Copia un resumen consolidado con caja, cuentas por cobrar, inventario e
                inversiones listo para pegar en cualquier chat.
              </Text>
              <PrimaryButton
                label="Copiar Resumen Ejecutivo"
                icon="copy-outline"
                variant="accent"
                onPress={handleCopySummary}
              />
            </View>

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>🛡️ Copia de Seguridad Completa (.JSON)</Text>
              <Text style={styles.panelDesc}>
                Guarda una copia íntegra de toda tu información o restaura un respaldo previo al
                cambiar de teléfono.
              </Text>
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label="Guardar Backup"
                    icon="cloud-download-outline"
                    disabled={busyExport}
                    onPress={() => handleRunExport('full_backup_json', 'Respaldo JSON')}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label="Restaurar JSON"
                    icon="cloud-upload-outline"
                    variant="outline"
                    onPress={handleImportBackup}
                  />
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {section === 'Ajustes' ? (
          <View style={{ gap: 14 }}>
            <GratiaLogoCard
              storeName={storeName || 'Gratia'}
              subtitle={storeSubtitle || 'Librería y Artículos Católicos'}
              rightBadge={sym}
            />

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Identidad y Preferencias</Text>
              <FormField
                label="Nombre de la Librería o Apostolado"
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
                label="Teléfono de contacto"
                value={phoneContact}
                onChangeText={setPhoneContact}
              />
              <FormField
                label="Stock mínimo por defecto"
                keyboardType="number-pad"
                value={defaultMinStock}
                onChangeText={setDefaultMinStock}
              />

              <Text style={styles.currencyLabel}>Símbolo de Moneda</Text>
              <ChipSelector
                options={CURRENCY_OPTIONS}
                selected={settings.currencySymbol}
                onSelect={(c) => {
                  updateSettings({ currencySymbol: c });
                  showToast(`Moneda cambiada a ${c}`);
                }}
              />

              <View style={{ height: 14 }} />
              <PrimaryButton
                label="Guardar Preferencias"
                icon="save-outline"
                onPress={handleSaveSettings}
              />
            </View>

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Mantenimiento de Base de Datos</Text>
              <Text style={styles.panelDesc}>
                Recarga el catálogo católico de ejemplo o limpia los registros actuales.
              </Text>
              <View style={{ gap: 10 }}>
                <PrimaryButton
                  label="Restaurar Datos de Ejemplo"
                  icon="refresh-outline"
                  variant="outline"
                  onPress={() =>
                    confirmAction(
                      'Restaurar catálogo de ejemplo',
                      '¿Cargar nuevamente las Biblias, camándulas y registros de demostración?',
                      async () => {
                        await resetWithDemoData();
                        showToast('Catálogo de ejemplo restaurado');
                      },
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
                      'Se eliminarán todos los productos, ventas, pagos, inversiones y proveedores.',
                      async () => {
                        await clearAllData();
                        showToast('Base de datos vaciada', 'warning');
                      },
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
        pressed && { opacity: 0.85, backgroundColor: COLORS.surfaceAlt },
      ]}
    >
      <View style={styles.exportIconCircle}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.exportItemTitle}>{title}</Text>
        <Text style={styles.exportItemSub}>{subtitle}</Text>
      </View>
      <View style={styles.exportArrowCircle}>
        <Ionicons name="share-outline" size={17} color={COLORS.primaryDark} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabsStrip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.ivory,
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
  rangeLabel: { fontSize: 12.5, fontWeight: '800', color: COLORS.primary },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  panelCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 17,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  panelTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 16,
    fontWeight: '700',
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
  barItem: { marginBottom: 11, gap: 5 },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  barTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.text },
  barAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  kvKey: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  kvVal: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  exportList: { gap: 9 },
  exportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceWarm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exportIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportArrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportItemTitle: { fontSize: 13.5, fontWeight: '800', color: COLORS.text },
  exportItemSub: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },
  row2: { flexDirection: 'row', gap: 10 },
  currencyLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },
});
