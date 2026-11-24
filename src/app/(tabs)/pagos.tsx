import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
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
  HeaderActionPill,
  PrimaryButton,
  ProgressBar,
  ScreenHeader,
  SearchField,
  SegmentedTabs,
  confirmAction,
  useToast,
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
  const params = useLocalSearchParams<{ open?: string }>();
  const { showToast } = useToast();
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
  const [dismissedOpenParam, setDismissedOpenParam] = useState<string | undefined>(undefined);
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

  // Modal Registrar Abono / Detalle
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoMethod, setAbonoMethod] = useState<PaymentMethod>('Efectivo');
  const [abonoRef, setAbonoRef] = useState('');
  const [abonoNotes, setAbonoNotes] = useState('');

  const isNewSaleVisible =
    newSaleOpen || Boolean(params.open && params.open !== dismissedOpenParam);

  const closeNewSaleModal = () => {
    setNewSaleOpen(false);
    if (params.open) setDismissedOpenParam(params.open);
  };

  const pendingCount = useMemo(
    () => sales.filter((s) => s.status !== 'paid').length,
    [sales]
  );

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

  // Carrito
  const cartSubtotal = useMemo(() => {
    let sum = 0;
    for (const prod of products) {
      const qty = cart[prod.id] ?? 0;
      if (qty > 0) sum += qty * prod.salePrice;
    }
    return Number(sum.toFixed(2));
  }, [cart, products]);

  const cartItemCount = useMemo(
    () => Object.values(cart).reduce((a, b) => a + b, 0),
    [cart]
  );

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
      Alert.alert('Carrito vacío', 'Selecciona al menos una Biblia, camándula o artículo.');
      return;
    }

    if (paymentMode === 'installment' && !customerName.trim()) {
      Alert.alert(
        'Cliente requerido',
        'Para ventas por abonos o apartado indica el nombre del comprador.'
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

    const created = await createSale({
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

    closeNewSaleModal();
    setCart({});
    showToast(`Venta ${created.folio} registrada (${formatCurrency(created.total, sym)})`);
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
    showToast(`Abono de ${formatCurrency(amount, sym)} registrado con éxito`);
    setAbonoAmount('');
    setAbonoRef('');
    setAbonoNotes('');
  };

  const buildReceiptText = (sale: Sale) => {
    return [
      `✝️ *${settings.storeName}* — Comprobante ${sale.folio}`,
      `Cliente: ${sale.customerName}`,
      sale.parishOrGroup ? `Comunidad: ${sale.parishOrGroup}` : '',
      `Fecha: ${formatDateTime(sale.createdAt)}`,
      `────────────────────────`,
      ...sale.items.map(
        (i) => `• ${i.quantity}x ${i.productName} (${formatCurrency(i.subtotal, sym)})`
      ),
      sale.discount > 0 ? `Descuento: -${formatCurrency(sale.discount, sym)}` : '',
      `*TOTAL:* ${formatCurrency(sale.total, sym)}`,
      `*PAGADO:* ${formatCurrency(sale.paidAmount, sym)}`,
      sale.balance > 0
        ? `*SALDO PENDIENTE:* ${formatCurrency(sale.balance, sym)}`
        : `✅ *ESTADO: PAGADO TOTALMENTE*`,
      `¡Gracias por su compra, Dios le bendiga!`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleCopyReceipt = async (sale: Sale) => {
    await copyTextToClipboard(buildReceiptText(sale));
    showToast('Comprobante copiado al portapapeles');
  };

  const handleSendWhatsApp = (sale: Sale) => {
    const digits = sale.customerPhone.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(buildReceiptText(sale));
    const url = digits ? `https://wa.me/${digits}?text=${msg}` : `https://wa.me/?text=${msg}`;
    Linking.openURL(url).catch(() => {
      handleCopyReceipt(sale);
    });
  };

  const activeSaleDetail = useMemo(
    () => (selectedSale ? sales.find((s) => s.id === selectedSale.id) ?? null : null),
    [sales, selectedSale]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Pagos y Ventas"
        subtitle={`Caja: ${formatCurrency(totalCollected, sym)} · Pendiente: ${formatCurrency(totalReceivable, sym)}`}
        rightAction={
          <HeaderActionPill
            label="Nueva Venta"
            icon="add"
            variant="gold"
            onPress={openNewSaleModal}
          />
        }
      />

      <View style={styles.topControls}>
        <SegmentedTabs
          options={['Todas', 'Por Cobrar', 'Pagadas'] as const}
          selected={filter}
          onSelect={setFilter}
          badges={{ 'Por Cobrar': pendingCount }}
        />
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar cliente, folio GS-0001 o parroquia..."
        />
      </View>

      <FlatList
        data={filteredSales}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="wallet-outline"
            title="Sin ventas en esta sección"
            description="Registra ventas al contado o apartados por abonos de Biblias, camándulas y artículos religiosos."
            actionLabel="Registrar Venta"
            onAction={openNewSaleModal}
          />
        }
        renderItem={({ item }) => {
          const pct = item.total > 0 ? item.paidAmount / item.total : 1;
          const statusBadge =
            item.status === 'paid'
              ? { text: 'LIQUIDADO', tone: 'success' as const }
              : item.status === 'partial'
                ? { text: `DEBE ${formatCurrency(item.balance, sym)}`, tone: 'warning' as const }
                : { text: `CRÉDITO ${formatCurrency(item.balance, sym)}`, tone: 'danger' as const };

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

              {/* Barra visual de avance de pago */}
              <View style={{ gap: 4 }}>
                <ProgressBar
                  progress={pct}
                  tone={item.status === 'paid' ? 'success' : 'accent'}
                  height={6}
                />
                <View style={styles.saleFooter}>
                  <View>
                    <Text style={styles.totalText}>
                      Total: {formatCurrency(item.total, sym)}
                    </Text>
                    <Text style={styles.paidSubText}>
                      Abonado: {formatCurrency(item.paidAmount, sym)} ({Math.round(pct * 100)}%)
                      {item.dueDate && item.balance > 0
                        ? ` · Vence ${formatDate(item.dueDate)}`
                        : ''}
                    </Text>
                  </View>

                  <View style={styles.cardActionRow}>
                    {item.balance > 0 ? (
                      <View style={styles.payNowPill}>
                        <Ionicons name="add-circle-outline" size={14} color={COLORS.primaryDark} />
                        <Text style={styles.payNowText}>Abonar</Text>
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() => handleSendWhatsApp(item)}
                      style={[styles.iconCircleBtn, { backgroundColor: COLORS.successLight }]}
                    >
                      <Ionicons name="logo-whatsapp" size={15} color={COLORS.success} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleCopyReceipt(item)}
                      style={[styles.iconCircleBtn, { backgroundColor: COLORS.primaryLight }]}
                    >
                      <Ionicons name="copy-outline" size={15} color={COLORS.primary} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Modal Nueva Venta / POS */}
      <BottomSheetModal
        visible={isNewSaleVisible}
        title="Nueva Venta o Apartado"
        subtitle={
          cartItemCount > 0
            ? `${cartItemCount} uds. en carrito · Total ${formatCurrency(cartTotal, sym)}`
            : 'Selecciona los artículos del inventario'
        }
        onClose={closeNewSaleModal}
      >
        <Text style={styles.sectionSubtitle}>1. Catálogo disponible</Text>
        <TextInput
          value={productQuery}
          onChangeText={setProductQuery}
          placeholder="Filtrar Biblias, camándulas, medallas..."
          placeholderTextColor={COLORS.textMuted}
          style={styles.inlineSearch}
        />

        <View style={styles.catalogPickerBox}>
          {selectableProducts.map((prod) => {
            const qty = cart[prod.id] ?? 0;
            const disabled = prod.stock <= 0;
            return (
              <View
                key={prod.id}
                style={[styles.pickerRow, qty > 0 && styles.pickerRowSelected]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerName} numberOfLines={1}>
                    {prod.name}
                  </Text>
                  <Text style={styles.pickerMeta}>
                    {formatCurrency(prod.salePrice, sym)} · Stock: {prod.stock}
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
          <View>
            <Text style={styles.cartSummaryLabel}>
              Subtotal ({cartItemCount} uds.): {formatCurrency(cartSubtotal, sym)}
            </Text>
            {cartDiscount > 0 ? (
              <Text style={styles.discountNote}>
                Descuento aplicado: -{formatCurrency(cartDiscount, sym)}
              </Text>
            ) : null}
          </View>
          <Text style={styles.cartSummaryTotal}>{formatCurrency(cartTotal, sym)}</Text>
        </View>

        <FormField
          label={`Descuento especial (${sym})`}
          keyboardType="decimal-pad"
          value={discountInput}
          onChangeText={setDiscountInput}
        />

        <Text style={styles.sectionSubtitle}>2. Comprador / Comunidad</Text>
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
              placeholder="Ej. Catequesis"
              value={parishOrGroup}
              onChangeText={setParishOrGroup}
            />
          </View>
        </View>

        <Text style={styles.sectionSubtitle}>3. Modalidad de Cobro</Text>
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Contado (100%)"
              icon="checkmark-circle-outline"
              variant={paymentMode === 'full' ? 'primary' : 'outline'}
              onPress={() => setPaymentMode('full')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Por Abonos"
              icon="calendar-outline"
              variant={paymentMode === 'installment' ? 'accent' : 'outline'}
              onPress={() => setPaymentMode('installment')}
            />
          </View>
        </View>

        <View style={{ height: 12 }} />
        {paymentMode === 'installment' ? (
          <View>
            {cartTotal > 0 ? (
              <View style={styles.presetRow}>
                <Text style={styles.presetHint}>Abono rápido:</Text>
                {[0.25, 0.5, 0.75].map((ratio) => (
                  <Pressable
                    key={ratio}
                    onPress={() => setInitialPaymentInput((cartTotal * ratio).toFixed(2))}
                    style={styles.presetChip}
                  >
                    <Text style={styles.presetChipText}>{Math.round(ratio * 100)}%</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
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
          label="Referencia (opcional)"
          placeholder="Nº transferencia o comprobante"
          value={paymentRef}
          onChangeText={setPaymentRef}
        />
        <FormField
          label="Notas"
          placeholder="Observaciones del apartado o entrega..."
          value={saleNotes}
          onChangeText={setSaleNotes}
        />

        <PrimaryButton
          label={`Confirmar Venta (${formatCurrency(cartTotal, sym)})`}
          icon="bag-check-outline"
          onPress={handleCreateSale}
        />
      </BottomSheetModal>

      {/* Modal Detalle y Abonos */}
      <BottomSheetModal
        visible={Boolean(activeSaleDetail)}
        title={activeSaleDetail ? `${activeSaleDetail.folio} · ${activeSaleDetail.customerName}` : ''}
        subtitle={activeSaleDetail?.parishOrGroup || 'Estado de cuenta e historial de pagos'}
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
                <Text style={styles.detailMuted}>Total Abonado:</Text>
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
              <ProgressBar
                progress={
                  activeSaleDetail.total > 0
                    ? activeSaleDetail.paidAmount / activeSaleDetail.total
                    : 1
                }
                tone={activeSaleDetail.balance === 0 ? 'success' : 'accent'}
                height={7}
              />
            </View>

            <Text style={styles.sectionSubtitle}>Artículos</Text>
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
              Pagos Registrados ({activeSaleDetail.payments.length})
            </Text>
            {activeSaleDetail.payments.length === 0 ? (
              <Text style={{ fontSize: 12.5, color: COLORS.textMuted }}>
                Venta entregada a crédito sin abono inicial.
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
                <View style={styles.presetRow}>
                  <Text style={styles.sectionSubtitle}>Registrar Abono</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable
                      onPress={() =>
                        setAbonoAmount((activeSaleDetail.balance * 0.5).toFixed(2))
                      }
                      style={styles.presetChip}
                    >
                      <Text style={styles.presetChipText}>50%</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setAbonoAmount(activeSaleDetail.balance.toFixed(2))}
                      style={styles.presetChip}
                    >
                      <Text style={styles.presetChipText}>Liquidar 100%</Text>
                    </Pressable>
                  </View>
                </View>

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
                  label="Aplicar Abono"
                  icon="checkmark-circle-outline"
                  variant="success"
                  onPress={handleRegisterAbono}
                />
              </View>
            ) : null}

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="WhatsApp"
                  icon="logo-whatsapp"
                  variant="success"
                  small
                  onPress={() => handleSendWhatsApp(activeSaleDetail)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Copiar Recibo"
                  icon="copy-outline"
                  variant="outline"
                  small
                  onPress={() => handleCopyReceipt(activeSaleDetail)}
                />
              </View>
            </View>

            <PrimaryButton
              label="Anular Venta y Reintegrar Stock"
              icon="trash-outline"
              variant="danger"
              small
              onPress={() =>
                confirmAction(
                  'Anular venta',
                  `¿Anular ${activeSaleDetail.folio} y devolver las unidades al stock?`,
                  async () => {
                    await deleteSale(activeSaleDetail.id, true);
                    setSelectedSale(null);
                    showToast('Venta anulada y stock restaurado', 'info');
                  },
                  Alert
                )
              }
            />
          </View>
        ) : null}
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topControls: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 9 },
  listContent: { padding: 16, paddingTop: 8, paddingBottom: 34, gap: 12 },
  saleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    ...SHADOWS.card,
  },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  folioText: { fontSize: 13, fontWeight: '800', color: COLORS.accentDark },
  customerText: { color: COLORS.text, fontSize: 14.5 },
  dateText: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 2 },
  itemsSummary: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.surfaceWarm,
    padding: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  saleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  totalText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  paidSubText: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 1 },
  cardActionRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  payNowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  payNowText: { color: COLORS.primaryDark, fontSize: 11.5, fontWeight: '800' },
  iconCircleBtn: {
    width: 31,
    height: 31,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionSubtitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 2,
    marginBottom: 6,
  },
  inlineSearch: {
    backgroundColor: COLORS.surfaceWarm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: COLORS.text,
    marginBottom: 8,
  },
  catalogPickerBox: {
    maxHeight: 210,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceWarm,
    padding: 8,
    marginBottom: 10,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    borderRadius: 8,
    gap: 8,
  },
  pickerRowSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  pickerName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  pickerMeta: { fontSize: 11.5, color: COLORS.textSecondary },
  qtyStepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: { minWidth: 20, textAlign: 'center', fontWeight: '800', fontSize: 14 },
  cartSummaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    padding: 13,
    borderRadius: 12,
    marginBottom: 12,
  },
  cartSummaryLabel: { fontSize: 12.5, color: '#D3E1DA', fontWeight: '600' },
  discountNote: { fontSize: 11, color: COLORS.accent, fontWeight: '700', marginTop: 2 },
  cartSummaryTotal: {
    fontSize: 18,
    color: COLORS.ivory,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  row2: { flexDirection: 'row', gap: 10 },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 6,
  },
  presetHint: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  presetChip: {
    backgroundColor: COLORS.accentLight,
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  presetChipText: { fontSize: 11.5, fontWeight: '800', color: COLORS.accentDark },
  fieldMiniLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  detailBalanceCard: {
    backgroundColor: COLORS.ivory,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 7,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailMuted: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  detailBold: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  itemLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
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
    backgroundColor: COLORS.surfaceWarm,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
