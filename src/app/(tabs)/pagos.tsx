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
import { PAYMENT_METHODS, PaymentMethod, Sale } from '../../types/models';
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
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  parseNumericInput,
} from '../../utils/format';
import { copyTextToClipboard } from '../../utils/exporter';

type SaleFilter = 'Todas' | 'Por Cobrar' | 'Pagadas';

export default function PagosVentasScreen() {
  const {
    settings,
    products,
    sales,
    createSale,
    registerSalePayment,
    deleteSale,
  } = useStore();
  const sym = settings.currencySymbol;

  const [filter, setFilter] = useState<SaleFilter>('Todas');
  const [search, setSearch] = useState('');

  // Modal Nueva Venta / Apartado
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [parishOrGroup, setParishOrGroup] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [productQuery, setProductQuery] = useState('');
  const [discountInput, setDiscountInput] = useState('0');
  const [paymentMode, setPaymentMode] = useState<'full' | 'installment'>('full');
  const [initialPaymentInput, setInitialPaymentInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [paymentRef, setPaymentRef] = useState('');
  const [dueDays, setDueDays] = useState('15');
  const [saleNotes, setSaleNotes] = useState('');

  // Modal Registrar Abono / Ver Historial
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoMethod, setAbonoMethod] = useState<PaymentMethod>('Efectivo');
  const [abonoRef, setAbonoRef] = useState('');
  const [abonoNotes, setAbonoNotes] = useState('');

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (filter === 'Por Cobrar' && s.status === 'paid') return false;
      if (filter === 'Pagadas' && s.status !== 'paid') return false;
      if (!q) return true;
      return (
        s.customerName.toLowerCase().includes(q) ||
        s.folio.toLowerCase().includes(q) ||
        s.parishOrGroup.toLowerCase().includes(q) ||
        s.items.some((i) => i.productName.toLowerCase().includes(q))
      );
    });
  }, [sales, filter, search]);

  const totalReceivable = useMemo(
    () => sales.reduce((acc, s) => acc + s.balance, 0),
    [sales]
  );
  const totalCollected = useMemo(
    () => sales.reduce((acc, s) => acc + s.paidAmount, 0),
    [sales]
  );

  // Cálculos del carrito
  const cartSubtotal = useMemo(() => {
    let sum = 0;
    for (const prod of products) {
      const qty = cart[prod.id] ?? 0;
      if (qty > 0) sum += qty * prod.salePrice;
    }
    return Number(sum.toFixed(2));
  }, [cart, products]);

  const cartDiscount = Math.min(cartSubtotal, Math.max(0, parseNumericInput(discountInput)));
  const cartTotal = Number(Math.max(0, cartSubtotal - cartDiscount).toFixed(2));

  const selectableProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return products.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, productQuery]);

  const openNewSaleModal = () => {
    setCustomerName('');
    setCustomerPhone('');
    setParishOrGroup('');
    setCart({});
    setProductQuery('');
    setDiscountInput('0');
    setPaymentMode('full');
    setInitialPaymentInput('');
    setPaymentMethod('Efectivo');
    setPaymentRef('');
    setDueDays('15');
    setSaleNotes('');
    setNewSaleOpen(true);
  };

  const changeCartQty = (productId: string, delta: number, maxStock: number) => {
    setCart((prev) => {
      const current = prev[productId] ?? 0;
      const next = Math.max(0, Math.min(maxStock, current + delta));
      const copy = { ...prev };
      if (next === 0) delete copy[productId];
      else copy[productId] = next;
      return copy;
    });
  };

  const handleCreateSale = async () => {
    const cartEntries = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));

    if (cartEntries.length === 0) {
      Alert.alert('Carrito vacío', 'Selecciona al menos una Biblia, camándula o producto.');
      return;
    }

    if (paymentMode === 'installment' && !customerName.trim()) {
      Alert.alert(
        'Nombre del cliente requerido',
        'Para ventas por abonos o crédito debes indicar el nombre del comprador.'
      );
      return;
    }

    const paidNow =
      paymentMode === 'full'
        ? cartTotal
        : Math.min(cartTotal, Math.max(0, parseNumericInput(initialPaymentInput)));

    const days = Math.max(1, Math.round(parseNumericInput(dueDays) || 15));
    const dueIso =
      paidNow < cartTotal
        ? new Date(Date.now() + days * 86400000).toISOString()
        : '';

    await createSale({
      customerName,
      customerPhone,
      parishOrGroup,
      discount: cartDiscount,
      initialPayment: paidNow,
      paymentMethod,
      paymentReference: paymentRef,
      dueDate: dueIso,
      notes: saleNotes,
      cart: cartEntries,
    });

    setNewSaleOpen(false);
  };

  const handleRegisterAbono = async () => {
    if (!selectedSale) return;
    const amount = parseNumericInput(abonoAmount);
    if (amount <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto de abono mayor a cero.');
      return;
    }
    await registerSalePayment({
      saleId: selectedSale.id,
      amount,
      method: abonoMethod,
      reference: abonoRef,
      notes: abonoNotes,
    });
    setSelectedSale(null);
    setAbonoAmount('');
    setAbonoRef('');
    setAbonoNotes('');
  };

  const handleCopyReceipt = async (sale: Sale) => {
    const lines = [
      `✝️ ${settings.storeName} — Comprobante ${sale.folio}`,
      `Cliente: ${sale.customerName}`,
      sale.parishOrGroup ? `Comunidad/Parroquia: ${sale.parishOrGroup}` : '',
      `Fecha: ${formatDateTime(sale.createdAt)}`,
      `────────────────────────`,
      ...sale.items.map(
        (i) => `• ${i.quantity}x ${i.productName} (${formatCurrency(i.subtotal, sym)})`
      ),
      sale.discount > 0 ? `Descuento: -${formatCurrency(sale.discount, sym)}` : '',
      `TOTAL: ${formatCurrency(sale.total, sym)}`,
      `PAGADO: ${formatCurrency(sale.paidAmount, sym)}`,
      `SALDO PENDIENTE: ${formatCurrency(sale.balance, sym)}`,
      `¡Dios le bendiga!`,
    ].filter(Boolean);

    await copyTextToClipboard(lines.join('\n'));
    Alert.alert(
      'Comprobante copiado',
      'El estado de cuenta se copió al portapapeles listo para pegar en WhatsApp o SMS.'
    );
  };

  // Mantener sincronizada la venta abierta en el modal con el store actualizado
  const activeSaleDetail = useMemo(
    () => (selectedSale ? sales.find((s) => s.id === selectedSale.id) ?? null : null),
    [sales, selectedSale]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Pagos y Ventas"
        subtitle={`Cobrado: ${formatCurrency(totalCollected, sym)} · Por cobrar: ${formatCurrency(totalReceivable, sym)}`}
        rightAction={
          <Pressable onPress={openNewSaleModal} style={styles.newSaleBtn}>
            <Ionicons name="add-circle" size={18} color={COLORS.primary} />
            <Text style={styles.newSaleBtnText}>Nueva Venta</Text>
          </Pressable>
        }
      />

      <View style={styles.topControls}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar cliente, folio GS-0001, parroquia o producto..."
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
          />
        </View>
        <ChipSelector
          options={['Todas', 'Por Cobrar', 'Pagadas'] as const}
          selected={filter}
          onSelect={setFilter}
        />
      </View>

      <FlatList
        data={filteredSales}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="Sin ventas en esta vista"
            description="Registra ventas al contado o apartados por abonos de Biblias, camándulas y artículos religiosos."
            actionLabel="Registrar Venta"
            onAction={openNewSaleModal}
          />
        }
        renderItem={({ item }) => {
          const statusBadge =
            item.status === 'paid'
              ? { text: 'PAGADO', tone: 'success' as const }
              : item.status === 'partial'
                ? { text: `ABONADO · DEBE ${formatCurrency(item.balance, sym)}`, tone: 'warning' as const }
                : { text: `PENDIENTE · ${formatCurrency(item.balance, sym)}`, tone: 'danger' as const };

          return (
            <Pressable
              onPress={() => {
                setSelectedSale(item);
                setAbonoAmount(item.balance > 0 ? item.balance.toFixed(2) : '');
              }}
              style={styles.saleCard}
            >
              <View style={styles.saleHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.folioText}>
                    {item.folio} · <Text style={styles.customerText}>{item.customerName}</Text>
                  </Text>
                  <Text style={styles.dateText}>
                    {formatDateTime(item.createdAt)}
                    {item.parishOrGroup ? ` · ${item.parishOrGroup}` : ''}
                  </Text>
                </View>
                <Badge text={statusBadge.text} tone={statusBadge.tone} />
              </View>

              <Text style={styles.itemsSummary} numberOfLines={2}>
                {item.items.map((i) => `${i.quantity}x ${i.productName}`).join(' · ')}
              </Text>

              <View style={styles.saleFooter}>
                <View>
                  <Text style={styles.totalText}>
                    Total: {formatCurrency(item.total, sym)}
                  </Text>
                  <Text style={styles.paidSubText}>
                    Pagado: {formatCurrency(item.paidAmount, sym)} ({item.payments.length}{' '}
                    {item.payments.length === 1 ? 'pago' : 'pagos'})
                    {item.dueDate && item.balance > 0 ? ` · Vence ${formatDate(item.dueDate)}` : ''}
                  </Text>
                </View>

                <View style={styles.cardActionRow}>
                  {item.balance > 0 ? (
                    <View style={styles.payNowPill}>
                      <Ionicons name="cash-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.payNowText}>Abonar</Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => handleCopyReceipt(item)}
                    style={styles.copyIconBtn}
                  >
                    <Ionicons name="copy-outline" size={16} color={COLORS.primary} />
                  </Pressable>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Modal Nueva Venta */}
      <BottomSheetModal
        visible={newSaleOpen}
        title="Registrar Venta o Apartado"
        onClose={() => setNewSaleOpen(false)}
      >
        <Text style={styles.sectionSubtitle}>1. Selecciona productos del stock</Text>
        <TextInput
          value={productQuery}
          onChangeText={setProductQuery}
          placeholder="Filtrar Biblias, camándulas..."
          placeholderTextColor={COLORS.textMuted}
          style={styles.inlineSearch}
        />

        <View style={styles.catalogPickerBox}>
          {selectableProducts.map((prod) => {
            const qty = cart[prod.id] ?? 0;
            const disabled = prod.stock <= 0;
            return (
              <View key={prod.id} style={styles.pickerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerName} numberOfLines={1}>
                    {prod.name}
                  </Text>
                  <Text style={styles.pickerMeta}>
                    {formatCurrency(prod.salePrice, sym)} · Disp: {prod.stock}
                  </Text>
                </View>
                <View style={styles.qtyStepper}>
                  <Pressable
                    onPress={() => changeCartQty(prod.id, -1, prod.stock)}
                    style={styles.stepBtn}
                  >
                    <Ionicons name="remove" size={16} color={COLORS.primary} />
                  </Pressable>
                  <Text style={styles.qtyText}>{qty}</Text>
                  <Pressable
                    disabled={disabled || qty >= prod.stock}
                    onPress={() => changeCartQty(prod.id, 1, prod.stock)}
                    style={[
                      styles.stepBtn,
                      (disabled || qty >= prod.stock) && { opacity: 0.35 },
                    ]}
                  >
                    <Ionicons name="add" size={16} color={COLORS.primary} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.cartSummaryBar}>
          <Text style={styles.cartSummaryLabel}>Subtotal: {formatCurrency(cartSubtotal, sym)}</Text>
          <Text style={styles.cartSummaryTotal}>Total: {formatCurrency(cartTotal, sym)}</Text>
        </View>

        <FormField
          label={`Descuento especial (${sym})`}
          keyboardType="decimal-pad"
          value={discountInput}
          onChangeText={setDiscountInput}
        />

        <Text style={styles.sectionSubtitle}>2. Datos del comprador / comunidad</Text>
        <FormField
          label="Nombre del cliente"
          placeholder="Ej. Hna. Lucía / Juan Pérez / Mostrador"
          value={customerName}
          onChangeText={setCustomerName}
        />
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <FormField
              label="Teléfono / WhatsApp"
              placeholder="+58 412..."
              keyboardType="phone-pad"
              value={customerPhone}
              onChangeText={setCustomerPhone}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label="Parroquia / Grupo"
              placeholder="Ej. Legión de María"
              value={parishOrGroup}
              onChangeText={setParishOrGroup}
            />
          </View>
        </View>

        <Text style={styles.sectionSubtitle}>3. Modalidad de Pago</Text>
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Contado (100%)"
              icon="checkmark-circle-outline"
              variant={paymentMode === 'full' ? 'success' : 'outline'}
              onPress={() => setPaymentMode('full')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Abono / Crédito"
              icon="calendar-outline"
              variant={paymentMode === 'installment' ? 'accent' : 'outline'}
              onPress={() => setPaymentMode('installment')}
            />
          </View>
        </View>

        <View style={{ height: 12 }} />
        {paymentMode === 'installment' ? (
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <FormField
                label={`Abono Inicial (${sym})`}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={initialPaymentInput}
                onChangeText={setInitialPaymentInput}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FormField
                label="Plazo (días)"
                placeholder="15"
                keyboardType="number-pad"
                value={dueDays}
                onChangeText={setDueDays}
              />
            </View>
          </View>
        ) : null}

        <Text style={styles.fieldMiniLabel}>Método de pago</Text>
        <ChipSelector
          options={PAYMENT_METHODS}
          selected={paymentMethod}
          onSelect={setPaymentMethod}
        />

        <View style={{ height: 10 }} />
        <FormField
          label="Referencia de pago (opcional)"
          placeholder="Nº transferencia, recibo o comprobante"
          value={paymentRef}
          onChangeText={setPaymentRef}
        />
        <FormField
          label="Notas de la venta"
          placeholder="Ej. Apartado para Confirmación..."
          value={saleNotes}
          onChangeText={setSaleNotes}
        />

        <PrimaryButton
          label={`Confirmar Venta (${formatCurrency(cartTotal, sym)})`}
          icon="bag-check-outline"
          onPress={handleCreateSale}
        />
      </BottomSheetModal>

      {/* Modal Detalle de Venta y Registro de Abonos */}
      <BottomSheetModal
        visible={Boolean(activeSaleDetail)}
        title={
          activeSaleDetail
            ? `${activeSaleDetail.folio} · ${activeSaleDetail.customerName}`
            : 'Detalle de Venta'
        }
        onClose={() => setSelectedSale(null)}
      >
        {activeSaleDetail ? (
          <View style={{ gap: 12 }}>
            <View style={styles.detailBalanceCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailMuted}>Total Venta:</Text>
                <Text style={styles.detailBold}>
                  {formatCurrency(activeSaleDetail.total, sym)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailMuted}>Total Pagado:</Text>
                <Text style={[styles.detailBold, { color: COLORS.success }]}>
                  {formatCurrency(activeSaleDetail.paidAmount, sym)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailMuted}>Saldo Pendiente:</Text>
                <Text
                  style={[
                    styles.detailBold,
                    {
                      color:
                        activeSaleDetail.balance > 0 ? COLORS.danger : COLORS.success,
                    },
                  ]}
                >
                  {formatCurrency(activeSaleDetail.balance, sym)}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionSubtitle}>Artículos incluidos</Text>
            {activeSaleDetail.items.map((it) => (
              <View key={it.id} style={styles.itemLine}>
                <Text style={styles.itemLineText}>
                  {it.quantity}x {it.productName}
                </Text>
                <Text style={styles.itemLineAmount}>
                  {formatCurrency(it.subtotal, sym)}
                </Text>
              </View>
            ))}

            <Text style={styles.sectionSubtitle}>
              Historial de Pagos ({activeSaleDetail.payments.length})
            </Text>
            {activeSaleDetail.payments.length === 0 ? (
              <Text style={{ fontSize: 12.5, color: COLORS.textMuted }}>
                Sin pagos registrados todavía (venta a crédito).
              </Text>
            ) : (
              activeSaleDetail.payments.map((pay) => (
                <View key={pay.id} style={styles.paymentItemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payMethodTitle}>
                      {pay.method} {pay.reference ? `· Ref: ${pay.reference}` : ''}
                    </Text>
                    <Text style={styles.payMetaText}>
                      {formatDateTime(pay.paidAt)} {pay.notes ? `· ${pay.notes}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.payAmountText}>
                    +{formatCurrency(pay.amount, sym)}
                  </Text>
                </View>
              ))
            )}

            {activeSaleDetail.balance > 0 ? (
              <View style={styles.abonoBox}>
                <Text style={styles.sectionSubtitle}>Registrar Nuevo Abono</Text>
                <FormField
                  label={`Monto a abonar (${sym})`}
                  keyboardType="decimal-pad"
                  value={abonoAmount}
                  onChangeText={setAbonoAmount}
                />
                <Text style={styles.fieldMiniLabel}>Método de pago</Text>
                <ChipSelector
                  options={PAYMENT_METHODS}
                  selected={abonoMethod}
                  onSelect={setAbonoMethod}
                />
                <View style={{ height: 8 }} />
                <FormField
                  label="Referencia"
                  placeholder="Comprobante / Recibo"
                  value={abonoRef}
                  onChangeText={setAbonoRef}
                />
                <FormField
                  label="Nota"
                  placeholder="Ej. Segunda cuota"
                  value={abonoNotes}
                  onChangeText={setAbonoNotes}
                />
                <PrimaryButton
                  label="Guardar Abono"
                  icon="cash-outline"
                  variant="success"
                  onPress={handleRegisterAbono}
                />
              </View>
            ) : null}

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Copiar Recibo"
                  icon="copy-outline"
                  variant="outline"
                  small
                  onPress={() => handleCopyReceipt(activeSaleDetail)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Anular y Devolver Stock"
                  icon="trash-outline"
                  variant="danger"
                  small
                  onPress={() =>
                    confirmAction(
                      'Anular venta',
                      `¿Anular ${activeSaleDetail.folio} y reintegrar las unidades al stock?`,
                      async () => {
                        await deleteSale(activeSaleDetail.id, true);
                        setSelectedSale(null);
                      },
                      Alert
                    )
                  }
                />
              </View>
            </View>
          </View>
        ) : null}
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  newSaleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  newSaleBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  topControls: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 8 },
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
  saleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
    ...SHADOWS.card,
  },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  folioText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  customerText: { color: COLORS.text, fontSize: 14.5 },
  dateText: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 2 },
  itemsSummary: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.background,
    padding: 8,
    borderRadius: 8,
  },
  saleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  totalText: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  paidSubText: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 1 },
  cardActionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payNowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.warning,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  payNowText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  copyIconBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
  },
  sectionSubtitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 4,
    marginBottom: 6,
  },
  inlineSearch: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 8,
  },
  catalogPickerBox: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    padding: 8,
    marginBottom: 10,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  pickerName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  pickerMeta: { fontSize: 11.5, color: COLORS.textSecondary },
  qtyStepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: { minWidth: 20, textAlign: 'center', fontWeight: '800', fontSize: 14 },
  cartSummaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.accentLight,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  cartSummaryLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  cartSummaryTotal: { fontSize: 16, color: COLORS.primary, fontWeight: '900' },
  row2: { flexDirection: 'row', gap: 10 },
  fieldMiniLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  detailBalanceCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailMuted: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  detailBold: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  itemLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemLineText: { fontSize: 13, color: COLORS.text },
  itemLineAmount: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  paymentItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.successLight,
    padding: 10,
    borderRadius: 10,
  },
  payMethodTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  payMetaText: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  payAmountText: { fontSize: 14, fontWeight: '800', color: COLORS.success },
  abonoBox: {
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
