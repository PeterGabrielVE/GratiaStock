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
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../context/StoreContext';
import {
  INVESTMENT_CATEGORIES,
  Investment,
  InvestmentCategory,
  PAYMENT_METHODS,
  PaymentMethod,
} from '../../types/models';
import { COLORS, SHADOWS } from '../../constants/theme';
import {
  Badge,
  BottomSheetModal,
  ChipSelector,
  EmptyState,
  FormField,
  KpiCard,
  PrimaryButton,
  ScreenHeader,
  confirmAction,
} from '../../components/UI';
import { formatCurrency, formatDate, parseNumericInput } from '../../utils/format';

type InvFilter = 'Todas' | 'Por Pagar' | InvestmentCategory;

export default function InversionesScreen() {
  const {
    settings,
    investments,
    suppliers,
    products,
    sales,
    saveInvestment,
    payInvestmentBalance,
    deleteInvestment,
  } = useStore();

  const sym = settings.currencySymbol;
  const [filter, setFilter] = useState<InvFilter>('Todas');

  // Modal Nueva / Editar Inversión
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<InvestmentCategory>('Compra de Stock');
  const [amountInput, setAmountInput] = useState('');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Transferencia');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [quantityAddedInput, setQuantityAddedInput] = useState('0');
  const [newUnitCostInput, setNewUnitCostInput] = useState('');
  const [notes, setNotes] = useState('');

  // Modal Abonar a Proveedor
  const [payTarget, setPayTarget] = useState<Investment | null>(null);
  const [supplierAbono, setSupplierAbono] = useState('');

  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.name])),
    [suppliers]
  );
  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p.name])),
    [products]
  );

  const filterOptions: InvFilter[] = useMemo(
    () => ['Todas', 'Por Pagar', ...INVESTMENT_CATEGORIES],
    []
  );

  const filteredInvestments = useMemo(() => {
    return investments.filter((inv) => {
      const debt = inv.amount - inv.paidAmount;
      if (filter === 'Por Pagar') return debt > 0.009;
      if (filter !== 'Todas' && inv.category !== filter) return false;
      return true;
    });
  }, [investments, filter]);

  const totalInvested = useMemo(
    () => investments.reduce((acc, i) => acc + i.amount, 0),
    [investments]
  );
  const totalSupplierDebt = useMemo(
    () => investments.reduce((acc, i) => acc + Math.max(0, i.amount - i.paidAmount), 0),
    [investments]
  );
  const totalSalesRevenue = useMemo(
    () => sales.reduce((acc, s) => acc + s.paidAmount, 0),
    [sales]
  );
  const recoveryPct =
    totalInvested > 0 ? Math.round((totalSalesRevenue / totalInvested) * 100) : 0;

  const openNewModal = () => {
    setEditingId(undefined);
    setTitle('');
    setCategory('Compra de Stock');
    setAmountInput('');
    setPaidAmountInput('');
    setPaymentMethod('Transferencia');
    setSupplierId(suppliers[0]?.id ?? null);
    setProductId(null);
    setQuantityAddedInput('0');
    setNewUnitCostInput('');
    setNotes('');
    setModalOpen(true);
  };

  const openEditModal = (inv: Investment) => {
    setEditingId(inv.id);
    setTitle(inv.title);
    setCategory(inv.category);
    setAmountInput(String(inv.amount));
    setPaidAmountInput(String(inv.paidAmount));
    setPaymentMethod(inv.paymentMethod);
    setSupplierId(inv.supplierId);
    setProductId(inv.productId);
    setQuantityAddedInput(String(inv.quantityAdded));
    setNewUnitCostInput('');
    setNotes(inv.notes);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Concepto requerido', 'Describe la inversión o compra realizada.');
      return;
    }
    const amount = Math.max(0, parseNumericInput(amountInput));
    if (amount <= 0) {
      Alert.alert('Monto inválido', 'El monto total de la inversión debe ser mayor a cero.');
      return;
    }
    const paidRaw =
      paidAmountInput.trim() === '' ? amount : Math.max(0, parseNumericInput(paidAmountInput));
    const paidAmount = Math.min(amount, paidRaw);
    const qtyAdded = Math.max(0, Math.round(parseNumericInput(quantityAddedInput)));
    const newUnitCost = parseNumericInput(newUnitCostInput);

    await saveInvestment({
      id: editingId,
      title,
      category,
      amount,
      paidAmount,
      supplierId,
      productId: category === 'Compra de Stock' ? productId : null,
      quantityAdded: category === 'Compra de Stock' ? qtyAdded : 0,
      newUnitCost: newUnitCost > 0 ? newUnitCost : undefined,
      paymentMethod,
      date: new Date().toISOString(),
      notes,
    });
    setModalOpen(false);
  };

  const handlePaySupplier = async () => {
    if (!payTarget) return;
    const amt = parseNumericInput(supplierAbono);
    if (amt <= 0) return;
    await payInvestmentBalance(payTarget.id, amt);
    setPayTarget(null);
    setSupplierAbono('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Inversiones y Compras"
        subtitle="Control de capital, surtido de stock y pagos a editoriales"
        rightAction={
          <Pressable onPress={openNewModal} style={styles.headerBtn}>
            <Ionicons name="add" size={18} color={COLORS.primary} />
            <Text style={styles.headerBtnText}>Invertir</Text>
          </Pressable>
        }
      />

      <FlatList
        data={filteredInvestments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <View style={styles.kpiRow}>
              <KpiCard
                label="Total Invertido"
                value={formatCurrency(totalInvested, sym)}
                hint={`Recuperado: ${recoveryPct}% en caja`}
                icon="wallet-outline"
                tone="primary"
              />
              <KpiCard
                label="Deuda a Proveedores"
                value={formatCurrency(totalSupplierDebt, sym)}
                hint={totalSupplierDebt > 0 ? 'Saldos por liquidar' : 'Al día con proveedores'}
                icon="alert-circle-outline"
                tone={totalSupplierDebt > 0 ? 'warning' : 'success'}
              />
            </View>
            <ChipSelector
              options={filterOptions}
              selected={filter}
              onSelect={setFilter}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="trending-up-outline"
            title="Sin inversiones registradas"
            description="Registra compras de lotes de Biblias, rosarios, vitrinas o gastos de envío."
            actionLabel="Registrar Inversión"
            onAction={openNewModal}
          />
        }
        renderItem={({ item }) => {
          const debt = Math.max(0, item.amount - item.paidAmount);
          return (
            <View style={styles.invCard}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <View style={styles.badgeRow}>
                    <Badge text={item.category} tone="info" />
                    <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                  </View>
                  <Text style={styles.invTitle}>{item.title}</Text>
                  {item.supplierId && supplierMap.get(item.supplierId) ? (
                    <Text style={styles.subMeta}>
                      🏢 Proveedor: {supplierMap.get(item.supplierId)}
                    </Text>
                  ) : null}
                  {item.productId && item.quantityAdded > 0 ? (
                    <Text style={styles.stockAddedTag}>
                      📦 +{item.quantityAdded} uds. sumadas a{' '}
                      {productMap.get(item.productId) ?? 'Stock'}
                    </Text>
                  ) : null}
                  {item.notes ? <Text style={styles.notesText}>{item.notes}</Text> : null}
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.amountText}>{formatCurrency(item.amount, sym)}</Text>
                  <Badge
                    text={debt > 0.009 ? `Por pagar: ${formatCurrency(debt, sym)}` : 'Pagado'}
                    tone={debt > 0.009 ? 'warning' : 'success'}
                  />
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.methodLabel}>Vía {item.paymentMethod}</Text>
                <View style={styles.actionsRow}>
                  {debt > 0.009 ? (
                    <Pressable
                      onPress={() => {
                        setPayTarget(item);
                        setSupplierAbono(debt.toFixed(2));
                      }}
                      style={[styles.smallBtn, { backgroundColor: COLORS.warningLight }]}
                    >
                      <Ionicons name="cash-outline" size={14} color={COLORS.warning} />
                      <Text style={[styles.smallBtnText, { color: COLORS.warning }]}>
                        Abonar
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => openEditModal(item)}
                    style={[styles.smallBtn, { backgroundColor: COLORS.surfaceAlt }]}
                  >
                    <Ionicons name="create-outline" size={14} color={COLORS.text} />
                    <Text style={styles.smallBtnText}>Editar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      confirmAction(
                        'Eliminar inversión',
                        `¿Eliminar "${item.title}" del registro financiero?`,
                        () => deleteInvestment(item.id),
                        Alert
                      )
                    }
                    style={[styles.smallBtn, { backgroundColor: COLORS.dangerLight }]}
                  >
                    <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Modal Crear / Editar Inversión */}
      <BottomSheetModal
        visible={modalOpen}
        title={editingId ? 'Editar Inversión' : 'Registrar Nueva Inversión'}
        onClose={() => setModalOpen(false)}
      >
        <FormField
          label="Concepto de la inversión *"
          placeholder="Ej. Pedido 25 Biblias Latinoamericanas / Vitrina nueva"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Categoría</Text>
        <ChipSelector
          options={INVESTMENT_CATEGORIES}
          selected={category}
          onSelect={setCategory}
        />

        <View style={{ height: 12 }} />
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <FormField
              label={`Monto Total (${sym}) *`}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={amountInput}
              onChangeText={setAmountInput}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label={`Pagado Hoy (${sym})`}
              placeholder="Vacío = 100% pagado"
              keyboardType="decimal-pad"
              value={paidAmountInput}
              onChangeText={setPaidAmountInput}
            />
          </View>
        </View>

        <Text style={styles.label}>Método de pago</Text>
        <ChipSelector
          options={PAYMENT_METHODS}
          selected={paymentMethod}
          onSelect={setPaymentMethod}
        />

        <View style={{ height: 12 }} />
        <Text style={styles.label}>Proveedor vinculado (opcional)</Text>
        <View style={styles.chipsWrap}>
          <Pressable
            onPress={() => setSupplierId(null)}
            style={[styles.optChip, supplierId === null && styles.optChipActive]}
          >
            <Text style={[styles.optChipText, supplierId === null && styles.optChipTextActive]}>
              Ninguno
            </Text>
          </Pressable>
          {suppliers.map((sup) => (
            <Pressable
              key={sup.id}
              onPress={() => setSupplierId(sup.id)}
              style={[styles.optChip, supplierId === sup.id && styles.optChipActive]}
            >
              <Text style={[styles.optChipText, supplierId === sup.id && styles.optChipTextActive]}>
                {sup.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {!editingId && category === 'Compra de Stock' ? (
          <View style={styles.restockPanel}>
            <Text style={styles.restockTitle}>
              📦 ¿Sumar unidades automáticamente a un producto del catálogo?
            </Text>
            <View style={styles.chipsWrap}>
              <Pressable
                onPress={() => setProductId(null)}
                style={[styles.optChip, productId === null && styles.optChipActive]}
              >
                <Text
                  style={[styles.optChipText, productId === null && styles.optChipTextActive]}
                >
                  No vincular
                </Text>
              </Pressable>
              {products.map((prod) => (
                <Pressable
                  key={prod.id}
                  onPress={() => setProductId(prod.id)}
                  style={[styles.optChip, productId === prod.id && styles.optChipActive]}
                >
                  <Text
                    style={[styles.optChipText, productId === prod.id && styles.optChipTextActive]}
                  >
                    {prod.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            {productId ? (
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <FormField
                    label="Unidades que ingresan"
                    keyboardType="number-pad"
                    value={quantityAddedInput}
                    onChangeText={setQuantityAddedInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField
                    label={`Nuevo costo unit. (${sym})`}
                    placeholder="Opcional"
                    keyboardType="decimal-pad"
                    value={newUnitCostInput}
                    onChangeText={setNewUnitCostInput}
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <FormField
          label="Notas / Factura"
          placeholder="Número de factura, guía de envío o detalles..."
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        <PrimaryButton
          label={editingId ? 'Actualizar Inversión' : 'Guardar Inversión'}
          icon="checkmark-circle-outline"
          onPress={handleSave}
        />
      </BottomSheetModal>

      {/* Modal Abono a Proveedor */}
      <BottomSheetModal
        visible={Boolean(payTarget)}
        title={`Pagar a Proveedor · ${payTarget?.title ?? ''}`}
        onClose={() => setPayTarget(null)}
      >
        <FormField
          label={`Monto a abonar (${sym})`}
          keyboardType="decimal-pad"
          value={supplierAbono}
          onChangeText={setSupplierAbono}
        />
        <PrimaryButton
          label="Registrar Pago al Proveedor"
          icon="checkmark-done-outline"
          variant="success"
          onPress={handlePaySupplier}
        />
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  headerBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  listContent: { padding: 16, paddingBottom: 32, gap: 12 },
  kpiRow: { flexDirection: 'row', gap: 10 },
  invCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    ...SHADOWS.card,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dateText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  invTitle: { fontSize: 14.5, fontWeight: '800', color: COLORS.text },
  subMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  stockAddedTag: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '700',
    marginTop: 3,
  },
  notesText: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  amountText: { fontSize: 17, fontWeight: '900', color: COLORS.primary, marginBottom: 4 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  methodLabel: { fontSize: 11.5, color: COLORS.textMuted, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  smallBtnText: { fontSize: 11.5, fontWeight: '700', color: COLORS.text },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 5 },
  row2: { flexDirection: 'row', gap: 10 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  optChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  optChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  optChipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  optChipTextActive: { color: COLORS.primary, fontWeight: '800' },
  restockPanel: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  restockTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 8,
  },
});
