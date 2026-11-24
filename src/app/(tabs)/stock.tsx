import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  PrimaryButton,
  ScreenHeader,
  confirmAction,
} from '../../components/UI';
import { formatCurrency, formatDateTime, parseNumericInput } from '../../utils/format';

type FilterTab = 'Todas' | 'Bajo Stock' | ProductCategory;

export default function StockScreen() {
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
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Biblias Católicas');
  const [editionOrDetail, setEditionOrDetail] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [location, setLocation] = useState('');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Modal Ajuste Rápido de Stock
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [adjustMode, setAdjustMode] = useState<'in' | 'out'>('in');
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustReason, setAdjustReason] = useState('');

  const filterOptions: FilterTab[] = useMemo(
    () => ['Todas', 'Bajo Stock', ...PRODUCT_CATEGORIES],
    []
  );

  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.name])),
    [suppliers]
  );

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
    setSku(`CAT-${String(products.length + 1).padStart(3, '0')}`);
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

  const handleSaveProduct = async () => {
    if (!name.trim()) {
      Alert.alert('Campo requerido', 'Ingresa el nombre del artículo católico.');
      return;
    }
    const cost = Math.max(0, parseNumericInput(costPrice));
    const sale = Math.max(0, parseNumericInput(salePrice));
    const currentStock = Math.max(0, Math.round(parseNumericInput(stock)));
    const minimum = Math.max(0, Math.round(parseNumericInput(minStock)));

    await saveProduct({
      id: editingId,
      sku: sku.trim() || `CAT-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      category,
      editionOrDetail: editionOrDetail.trim(),
      costPrice: cost,
      salePrice: sale,
      stock: currentStock,
      minStock: minimum,
      location: location.trim(),
      supplierId,
      notes: notes.trim(),
    });
    setFormOpen(false);
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
    setAdjustTarget(null);
    setAdjustQty('1');
    setAdjustReason('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Control de Stock"
        subtitle={`${products.length} productos · Biblias, Camándulas y Liturgia`}
        rightAction={
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setShowKardexModal(true)}
              style={styles.iconPill}
            >
              <Ionicons name="swap-vertical-outline" size={16} color="#FFFFFF" />
              <Text style={styles.iconPillText}>Kardex</Text>
            </Pressable>
            <Pressable onPress={openNewModal} style={styles.addHeaderBtn}>
              <Ionicons name="add" size={18} color={COLORS.primary} />
              <Text style={styles.addHeaderText}>Nuevo</Text>
            </Pressable>
          </View>
        }
      />

      {/* Buscador y Filtros */}
      <View style={styles.topFilters}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar Biblia, camándula, SKU o edición..."
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </Pressable>
          ) : null}
        </View>
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
            title="No se encontraron productos"
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

                <View style={styles.stockBox}>
                  <Text
                    style={[
                      styles.stockCount,
                      { color: isLow ? COLORS.danger : COLORS.success },
                    ]}
                  >
                    {item.stock}
                  </Text>
                  <Text style={styles.stockLabel}>
                    {isLow ? `Mín ${item.minStock}` : 'en stock'}
                  </Text>
                </View>
              </View>

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
                <Badge text={`Margen ${margin}%`} tone="info" />
              </View>

              <View style={styles.metaFooter}>
                <Text style={styles.metaText} numberOfLines={1}>
                  {item.location ? `📍 ${item.location}` : '📍 Sin estante'}
                  {item.supplierId && supplierMap.get(item.supplierId)
                    ? ` · 🏢 ${supplierMap.get(item.supplierId)}`
                    : ''}
                </Text>

                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => {
                      setAdjustTarget(item);
                      setAdjustMode('in');
                      setAdjustQty('1');
                      setAdjustReason('');
                    }}
                    style={[styles.miniBtn, { backgroundColor: COLORS.successLight }]}
                  >
                    <Ionicons name="add" size={15} color={COLORS.success} />
                    <Text style={[styles.miniBtnText, { color: COLORS.success }]}>Stock</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => openEditModal(item)}
                    style={[styles.miniBtn, { backgroundColor: COLORS.surfaceAlt }]}
                  >
                    <Ionicons name="create-outline" size={15} color={COLORS.text} />
                    <Text style={styles.miniBtnText}>Editar</Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      confirmAction(
                        'Eliminar producto',
                        `¿Seguro que deseas eliminar "${item.name}" del catálogo?`,
                        () => deleteProduct(item.id),
                        Alert
                      )
                    }
                    style={[styles.miniBtn, { backgroundColor: COLORS.dangerLight }]}
                  >
                    <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Modal Crear / Editar Producto */}
      <BottomSheetModal
        visible={formOpen}
        title={editingId ? 'Editar Producto Católico' : 'Nuevo Producto Católico'}
        onClose={() => setFormOpen(false)}
      >
        <FormField
          label="Nombre del producto *"
          placeholder="Ej. Biblia Católica Latinoamericana / Camándula San Benito"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.modalSectionLabel}>Categoría</Text>
        <ChipSelector
          options={PRODUCT_CATEGORIES}
          selected={category}
          onSelect={setCategory}
        />

        <View style={{ height: 10 }} />
        <FormField
          label="Edición / Material / Detalle"
          placeholder="Ej. Letra Grande Tapa Dura / Madera de Olivo 8mm"
          value={editionOrDetail}
          onChangeText={setEditionOrDetail}
        />

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <FormField
              label="Código / SKU"
              placeholder="BIB-001"
              value={sku}
              onChangeText={setSku}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label="Ubicación / Estante"
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
          placeholder="Observaciones pastorales, ISBN o detalles del artículo..."
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        <PrimaryButton
          label={editingId ? 'Guardar Cambios' : 'Registrar Producto'}
          icon="checkmark-circle-outline"
          onPress={handleSaveProduct}
        />
      </BottomSheetModal>

      {/* Modal Ajuste Rápido de Stock */}
      <BottomSheetModal
        visible={Boolean(adjustTarget)}
        title={`Ajustar Stock · ${adjustTarget?.name ?? ''}`}
        onClose={() => setAdjustTarget(null)}
      >
        <Text style={styles.currentStockBanner}>
          Stock actual: <Text style={{ fontWeight: '800' }}>{adjustTarget?.stock ?? 0} unidades</Text>
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
          label="Motivo del movimiento"
          placeholder="Ej. Llegada de pedido / Donación a catequesis / Conteo físico"
          value={adjustReason}
          onChangeText={setAdjustReason}
        />
        <PrimaryButton
          label="Aplicar Movimiento al Kardex"
          icon="save-outline"
          onPress={handleConfirmAdjustment}
        />
      </BottomSheetModal>

      {/* Modal Historial Kardex */}
      <BottomSheetModal
        visible={showKardexModal}
        title="Historial Kardex de Inventario"
        onClose={() => setShowKardexModal(false)}
      >
        {stockMovements.length === 0 ? (
          <Text style={{ color: COLORS.textSecondary, textAlign: 'center', padding: 16 }}>
            Aún no hay movimientos registrados.
          </Text>
        ) : (
          stockMovements.slice(0, 40).map((mov) => (
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  iconPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  addHeaderText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  topFilters: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 0 },
  listContent: { padding: 16, paddingTop: 8, paddingBottom: 32, gap: 12 },
  productCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
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
  stockBox: {
    minWidth: 62,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stockCount: { fontSize: 20, fontWeight: '900' },
  stockLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  priceItem: { fontSize: 12.5, color: COLORS.textSecondary },
  priceStrong: { fontWeight: '800', color: COLORS.text },
  metaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaText: { flex: 1, fontSize: 11.5, color: COLORS.textMuted },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  miniBtnText: { fontSize: 11.5, fontWeight: '700', color: COLORS.text },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  row2: { flexDirection: 'row', gap: 10 },
  supplierWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  supChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.surfaceAlt,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    textAlign: 'center',
  },
  kardexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  kardexTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  kardexReason: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  kardexDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  kardexStockTransition: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
});
