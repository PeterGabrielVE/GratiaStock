import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../context/StoreContext';
import {
  PRODUCT_CATEGORIES,
  Product,
  ProductCategory,
} from '../../types/models';
import { COLORS, SHADOWS } from '../../constants/theme';
import {
  Badge,
  BottomSheetModal,
  ChipSelector,
  EmptyState,
  FormField,
  HeaderActionPill,
  PrimaryButton,
  ProgressBar,
  ScreenHeader,
  SearchField,
  confirmAction,
  useToast,
} from '../../components/UI';
import { formatCurrency, formatDateTime, parseNumericInput } from '../../utils/format';

type FilterTab = 'Todas' | 'Bajo Stock' | ProductCategory;

export default function StockScreen() {
  const params = useLocalSearchParams<{ open?: string }>();
  const { showToast } = useToast();
  const {
    settings,
    products,
    suppliers,
    stockMovements,
    saveProduct,
    deleteProduct,
    adjustStock,
  } = useStore();

  const sym = settings.currencySymbol;
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>('Todas');
  const [showKardexModal, setShowKardexModal] = useState(false);

  // Modal Crear / Editar Producto
  const [formOpen, setFormOpen] = useState(false);
  const [dismissedOpenParam, setDismissedOpenParam] = useState<string | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Biblias Católicas');
  const [editionOrDetail, setEditionOrDetail] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stock, setStock] = useState('0');
  const [minStock, setMinStock] = useState(String(settings.defaultMinStock));
  const [location, setLocation] = useState('');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Modal Ajuste por Lote
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [adjustMode, setAdjustMode] = useState<'in' | 'out'>('in');
  const [adjustQty, setAdjustQty] = useState('5');
  const [adjustReason, setAdjustReason] = useState('');

  const isModalVisible =
    formOpen || Boolean(params.open && params.open !== dismissedOpenParam);

  const closeProductModal = () => {
    setFormOpen(false);
    if (params.open) setDismissedOpenParam(params.open);
  };

  const filterOptions: FilterTab[] = useMemo(
    () => ['Todas', 'Bajo Stock', ...PRODUCT_CATEGORIES],
    []
  );

  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.name])),
    [suppliers]
  );

  const summary = useMemo(() => {
    const units = products.reduce((s, p) => s + p.stock, 0);
    const retailValue = products.reduce((s, p) => s + p.stock * p.salePrice, 0);
    const lowCount = products.filter((p) => p.stock <= p.minStock).length;
    return { units, retailValue, lowCount };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedFilter === 'Bajo Stock' && p.stock > p.minStock) return false;
      if (
        selectedFilter !== 'Todas' &&
        selectedFilter !== 'Bajo Stock' &&
        p.category !== selectedFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.editionOrDetail.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, search, selectedFilter]);

  const openNewModal = () => {
    setEditingId(undefined);
    setSku(`GRA-${String(products.length + 1).padStart(3, '0')}`);
    setName('');
    setCategory('Biblias Católicas');
    setEditionOrDetail('');
    setCostPrice('');
    setSalePrice('');
    setStock('0');
    setMinStock(String(settings.defaultMinStock));
    setLocation('');
    setSupplierId(suppliers[0]?.id ?? null);
    setNotes('');
    setFormOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingId(prod.id);
    setSku(prod.sku);
    setName(prod.name);
    setCategory(prod.category);
    setEditionOrDetail(prod.editionOrDetail);
    setCostPrice(String(prod.costPrice));
    setSalePrice(String(prod.salePrice));
    setStock(String(prod.stock));
    setMinStock(String(prod.minStock));
    setLocation(prod.location);
    setSupplierId(prod.supplierId);
    setNotes(prod.notes);
    setFormOpen(true);
  };

  // Vista previa en vivo de ganancia y margen dentro del modal
  const liveCost = Math.max(0, parseNumericInput(costPrice));
  const liveSale = Math.max(0, parseNumericInput(salePrice));
  const liveProfit = liveSale - liveCost;
  const liveMarginPct = liveSale > 0 ? Math.round((liveProfit / liveSale) * 100) : 0;

  const handleSaveProduct = async () => {
    if (!name.trim()) {
      Alert.alert('Campo requerido', 'Ingresa el nombre del artículo católico.');
      return;
    }
    const currentStock = Math.max(0, Math.round(parseNumericInput(stock)));
    const minimum = Math.max(0, Math.round(parseNumericInput(minStock)));

    await saveProduct({
      id: editingId,
      sku: sku.trim() || `GRA-${String(products.length + 1).padStart(3, '0')}`,
      name: name.trim(),
      category,
      editionOrDetail: editionOrDetail.trim(),
      costPrice: liveCost,
      salePrice: liveSale,
      stock: currentStock,
      minStock: minimum,
      location: location.trim(),
      supplierId,
      notes: notes.trim(),
    });
    closeProductModal();
    showToast(editingId ? 'Producto actualizado' : 'Producto agregado al catálogo');
  };

  const handleQuickStep = async (prod: Product, delta: 1 | -1) => {
    if (delta < 0 && prod.stock <= 0) return;
    await adjustStock(
      prod.id,
      delta,
      delta > 0 ? 'in' : 'out',
      delta > 0 ? 'Ajuste rápido (+1)' : 'Ajuste rápido (-1)'
    );
    showToast(
      `${prod.name}: ${delta > 0 ? '+1 unidad' : '-1 unidad'} (Stock: ${prod.stock + delta})`,
      delta > 0 ? 'success' : 'info'
    );
  };

  const handleConfirmAdjustment = async () => {
    if (!adjustTarget) return;
    const qty = Math.max(1, Math.round(parseNumericInput(adjustQty)));
    const delta = adjustMode === 'in' ? qty : -qty;
    await adjustStock(
      adjustTarget.id,
      delta,
      adjustMode,
      adjustReason.trim() ||
        (adjustMode === 'in' ? 'Reposición de inventario' : 'Salida / Merma / Donación')
    );
    showToast(
      `Kardex actualizado (${adjustMode === 'in' ? `+${qty}` : `-${qty}`} uds.)`,
      'success'
    );
    setAdjustTarget(null);
    setAdjustQty('5');
    setAdjustReason('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Catálogo y Stock"
        subtitle="Biblias Católicas, Camándulas y Artículos Sagrados"
        rightAction={
          <View style={styles.headerActions}>
            <HeaderActionPill
              label="Kardex"
              icon="swap-vertical-outline"
              variant="glass"
              onPress={() => setShowKardexModal(true)}
            />
            <HeaderActionPill
              label="Nuevo"
              icon="add"
              variant="gold"
              onPress={openNewModal}
            />
          </View>
        }
      />

      {/* Cinta Resumen Rápida */}
      <View style={styles.summaryRibbon}>
        <View style={styles.ribbonCell}>
          <Text style={styles.ribbonVal}>{summary.units}</Text>
          <Text style={styles.ribbonLbl}>Unidades</Text>
        </View>
        <View style={styles.ribbonDivider} />
        <View style={styles.ribbonCell}>
          <Text style={styles.ribbonVal}>{formatCurrency(summary.retailValue, sym)}</Text>
          <Text style={styles.ribbonLbl}>Valor Venta</Text>
        </View>
        <View style={styles.ribbonDivider} />
        <Pressable
          onPress={() =>
            setSelectedFilter(selectedFilter === 'Bajo Stock' ? 'Todas' : 'Bajo Stock')
          }
          style={styles.ribbonCell}
        >
          <Text
            style={[
              styles.ribbonVal,
              { color: summary.lowCount > 0 ? COLORS.danger : COLORS.success },
            ]}
          >
            {summary.lowCount}
          </Text>
          <Text style={styles.ribbonLbl}>Stock Bajo ▾</Text>
        </Pressable>
      </View>

      {/* Buscador y Categorías */}
      <View style={styles.topFilters}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar Biblia, camándula, SKU o edición..."
        />
        <ChipSelector
          options={filterOptions}
          selected={selectedFilter}
          onSelect={setSelectedFilter}
        />
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="book-outline"
            title="Sin artículos en esta vista"
            description="Agrega Biblias Católicas, camándulas, rosarios o devocionarios a tu catálogo."
            actionLabel="Agregar Producto"
            onAction={openNewModal}
          />
        }
        renderItem={({ item }) => {
          const isLow = item.stock <= item.minStock;
          const margin =
            item.salePrice > 0
              ? Math.round(((item.salePrice - item.costPrice) / item.salePrice) * 100)
              : 0;
          const stockHealth =
            item.minStock > 0 ? Math.min(1, item.stock / (item.minStock * 2.5)) : 1;

          return (
            <View style={styles.productCard}>
              <View style={styles.cardTopRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.skuRow}>
                    <Badge text={item.category} tone="primary" />
                    <Text style={styles.skuText}>{item.sku}</Text>
                  </View>
                  <Text style={styles.productName}>{item.name}</Text>
                  {item.editionOrDetail ? (
                    <Text style={styles.editionText}>{item.editionOrDetail}</Text>
                  ) : null}
                </View>

                {/* Control directo +/-1 de stock */}
                <View style={styles.quickStockBox}>
                  <View style={styles.stepperRow}>
                    <Pressable
                      disabled={item.stock <= 0}
                      onPress={() => handleQuickStep(item, -1)}
                      style={[
                        styles.stepMiniBtn,
                        item.stock <= 0 && { opacity: 0.35 },
                      ]}
                    >
                      <Ionicons name="remove" size={14} color={COLORS.primary} />
                    </Pressable>
                    <Text
                      style={[
                        styles.stockCount,
                        { color: isLow ? COLORS.danger : COLORS.primary },
                      ]}
                    >
                      {item.stock}
                    </Text>
                    <Pressable
                      onPress={() => handleQuickStep(item, 1)}
                      style={styles.stepMiniBtn}
                    >
                      <Ionicons name="add" size={14} color={COLORS.primary} />
                    </Pressable>
                  </View>
                  <Text style={styles.stockLabel}>
                    {item.stock === 0
                      ? 'AGOTADO'
                      : isLow
                        ? `Mín ${item.minStock}`
                        : 'unidades'}
                  </Text>
                </View>
              </View>

              <ProgressBar
                progress={stockHealth}
                tone={item.stock === 0 ? 'danger' : isLow ? 'warning' : 'success'}
                height={5}
              />

              <View style={styles.priceRow}>
                <Text style={styles.priceItem}>
                  Costo: <Text style={styles.priceStrong}>{formatCurrency(item.costPrice, sym)}</Text>
                </Text>
                <Text style={styles.priceItem}>
                  Venta:{' '}
                  <Text style={[styles.priceStrong, { color: COLORS.primary }]}>
                    {formatCurrency(item.salePrice, sym)}
                  </Text>
                </Text>
                <Badge text={`Margen ${margin}%`} tone="accent" />
              </View>

              <View style={styles.metaFooter}>
                <Text style={styles.metaText} numberOfLines={1}>
                  {item.location ? `📍 ${item.location}` : '📍 General'}
                  {item.supplierId && supplierMap.get(item.supplierId)
                    ? ` · ${supplierMap.get(item.supplierId)}`
                    : ''}
                </Text>

                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => {
                      setAdjustTarget(item);
                      setAdjustMode('in');
                      setAdjustQty('5');
                      setAdjustReason('');
                    }}
                    style={[styles.miniBtn, { backgroundColor: COLORS.primaryLight }]}
                  >
                    <Ionicons name="layers-outline" size={14} color={COLORS.primary} />
                    <Text style={[styles.miniBtnText, { color: COLORS.primary }]}>Lote</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => openEditModal(item)}
                    style={[styles.miniBtn, { backgroundColor: COLORS.surfaceAlt }]}
                  >
                    <Ionicons name="create-outline" size={14} color={COLORS.text} />
                    <Text style={styles.miniBtnText}>Editar</Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      confirmAction(
                        'Eliminar producto',
                        `¿Seguro que deseas eliminar "${item.name}" del catálogo?`,
                        async () => {
                          await deleteProduct(item.id);
                          showToast('Producto eliminado', 'info');
                        },
                        Alert
                      )
                    }
                    style={[styles.miniBtn, { backgroundColor: COLORS.dangerLight }]}
                  >
                    <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Modal Crear / Editar Producto */}
      <BottomSheetModal
        visible={isModalVisible}
        title={editingId ? 'Editar Artículo Católico' : 'Nuevo Artículo Católico'}
        subtitle="Completa los detalles de catálogo, costos y alerta de stock"
        onClose={closeProductModal}
      >
        <FormField
          label="Nombre del producto *"
          placeholder="Ej. Biblia Católica Latinoamericana / Camándula Olivo"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.modalSectionLabel}>Categoría</Text>
        <ChipSelector
          options={PRODUCT_CATEGORIES}
          selected={category}
          onSelect={setCategory}
        />

        <View style={{ height: 11 }} />
        <FormField
          label="Edición / Material / Presentación"
          placeholder="Ej. Letra Grande Tapa Dura / Madera de Olivo 8mm"
          value={editionOrDetail}
          onChangeText={setEditionOrDetail}
        />

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <FormField
              label="Código / SKU"
              placeholder="GRA-001"
              value={sku}
              onChangeText={setSku}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label="Ubicación / Vitrina"
              placeholder="Estante A1"
              value={location}
              onChangeText={setLocation}
            />
          </View>
        </View>

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <FormField
              label={`Precio Costo (${sym})`}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={costPrice}
              onChangeText={setCostPrice}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label={`Precio Venta (${sym})`}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={salePrice}
              onChangeText={setSalePrice}
            />
          </View>
        </View>

        {/* Vista previa instantánea de ganancia */}
        {liveSale > 0 ? (
          <View style={styles.marginPreviewBox}>
            <Text style={styles.marginPreviewText}>
              Ganancia por unidad:{' '}
              <Text style={{ fontWeight: '800', color: COLORS.primary }}>
                {formatCurrency(liveProfit, sym)} ({liveMarginPct}% margen)
              </Text>
            </Text>
          </View>
        ) : null}

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <FormField
              label="Stock Actual"
              placeholder="0"
              keyboardType="number-pad"
              value={stock}
              onChangeText={setStock}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label="Stock Mínimo (Alerta)"
              placeholder="5"
              keyboardType="number-pad"
              value={minStock}
              onChangeText={setMinStock}
            />
          </View>
        </View>

        <Text style={styles.modalSectionLabel}>Proveedor / Editorial</Text>
        <View style={styles.supplierWrap}>
          <Pressable
            onPress={() => setSupplierId(null)}
            style={[styles.supChip, supplierId === null && styles.supChipActive]}
          >
            <Text style={[styles.supChipText, supplierId === null && styles.supChipTextActive]}>
              Sin asignar
            </Text>
          </Pressable>
          {suppliers.map((sup) => (
            <Pressable
              key={sup.id}
              onPress={() => setSupplierId(sup.id)}
              style={[styles.supChip, supplierId === sup.id && styles.supChipActive]}
            >
              <Text
                style={[styles.supChipText, supplierId === sup.id && styles.supChipTextActive]}
              >
                {sup.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <FormField
          label="Notas internas"
          placeholder="Observaciones pastorales, ISBN o detalles..."
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        <PrimaryButton
          label={editingId ? 'Guardar Cambios' : 'Registrar en Catálogo'}
          icon="checkmark-circle-outline"
          onPress={handleSaveProduct}
        />
      </BottomSheetModal>

      {/* Modal Ajuste por Lote */}
      <BottomSheetModal
        visible={Boolean(adjustTarget)}
        title={`Movimiento de Lote`}
        subtitle={adjustTarget?.name ?? ''}
        onClose={() => setAdjustTarget(null)}
      >
        <Text style={styles.currentStockBanner}>
          Existencia actual:{' '}
          <Text style={{ fontWeight: '800', color: COLORS.primary }}>
            {adjustTarget?.stock ?? 0} unidades
          </Text>
        </Text>

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Entrada (+)"
              icon="arrow-down-circle-outline"
              variant={adjustMode === 'in' ? 'success' : 'outline'}
              onPress={() => setAdjustMode('in')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Salida (-)"
              icon="arrow-up-circle-outline"
              variant={adjustMode === 'out' ? 'danger' : 'outline'}
              onPress={() => setAdjustMode('out')}
            />
          </View>
        </View>

        <View style={{ height: 12 }} />
        <FormField
          label="Cantidad de unidades"
          keyboardType="number-pad"
          value={adjustQty}
          onChangeText={setAdjustQty}
        />
        <FormField
          label="Motivo para el Kardex"
          placeholder="Ej. Recepción de editorial / Donación parroquial"
          value={adjustReason}
          onChangeText={setAdjustReason}
        />
        <PrimaryButton
          label="Registrar Movimiento"
          icon="save-outline"
          onPress={handleConfirmAdjustment}
        />
      </BottomSheetModal>

      {/* Modal Historial Kardex */}
      <BottomSheetModal
        visible={showKardexModal}
        title="Historial Kardex"
        subtitle="Últimos movimientos de entradas, ventas y ajustes"
        onClose={() => setShowKardexModal(false)}
      >
        {stockMovements.length === 0 ? (
          <Text style={{ color: COLORS.textSecondary, textAlign: 'center', padding: 16 }}>
            Aún no hay movimientos registrados.
          </Text>
        ) : (
          stockMovements.slice(0, 50).map((mov) => (
            <View key={mov.id} style={styles.kardexRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kardexTitle}>{mov.productName}</Text>
                <Text style={styles.kardexReason}>{mov.reason}</Text>
                <Text style={styles.kardexDate}>{formatDateTime(mov.createdAt)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Badge
                  text={mov.quantity > 0 ? `+${mov.quantity}` : `${mov.quantity}`}
                  tone={mov.quantity > 0 ? 'success' : 'danger'}
                />
                <Text style={styles.kardexStockTransition}>
                  {mov.previousStock} → {mov.newStock}
                </Text>
              </View>
            </View>
          ))
        )}
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  summaryRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ivory,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  ribbonCell: { flex: 1, alignItems: 'center' },
  ribbonDivider: { width: 1, height: 26, backgroundColor: COLORS.border },
  ribbonVal: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  ribbonLbl: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginTop: 1 },
  topFilters: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 9,
  },
  listContent: { padding: 16, paddingTop: 8, paddingBottom: 34, gap: 12 },
  productCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    ...SHADOWS.card,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  skuRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  skuText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  productName: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  editionText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  quickStockBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceWarm,
    borderRadius: 13,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  stepMiniBtn: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockCount: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  stockLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginTop: 2 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  priceItem: { fontSize: 12.5, color: COLORS.textSecondary },
  priceStrong: { fontWeight: '800', color: COLORS.text, fontVariant: ['tabular-nums'] },
  metaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  metaText: { flex: 1, fontSize: 11.5, color: COLORS.textMuted },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  miniBtnText: { fontSize: 11.5, fontWeight: '700', color: COLORS.text },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },
  row2: { flexDirection: 'row', gap: 10 },
  marginPreviewBox: {
    backgroundColor: COLORS.accentLight,
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    marginBottom: 12,
  },
  marginPreviewText: {
    fontSize: 12.5,
    color: COLORS.text,
  },
  supplierWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  supChip: {
    paddingHorizontal: 11,
    paddingVertical: 6.5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceWarm,
  },
  supChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  supChipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  supChipTextActive: { color: COLORS.primary, fontWeight: '800' },
  currentStockBanner: {
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceWarm,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 11,
    borderRadius: 11,
    marginBottom: 12,
    textAlign: 'center',
  },
  kardexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    gap: 10,
  },
  kardexTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  kardexReason: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  kardexDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  kardexStockTransition: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
});
