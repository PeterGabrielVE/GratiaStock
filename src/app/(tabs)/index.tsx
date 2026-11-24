import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../context/StoreContext';
import { COLORS, SHADOWS } from '../../constants/theme';
import { Badge, KpiCard, ScreenHeader } from '../../components/UI';
import { formatCurrency, formatDate } from '../../utils/format';

export default function DashboardScreen() {
  const { isLoading, settings, products, sales, investments, suppliers } = useStore();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando inventario católico...</Text>
      </SafeAreaView>
    );
  }

  const sym = settings.currencySymbol;
  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const stockSaleValue = products.reduce((sum, p) => sum + p.stock * p.salePrice, 0);
  const stockCostValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  const lowStockProducts = products.filter((p) => p.stock <= p.minStock);

  const totalCollected = sales.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalReceivable = sales.reduce((sum, s) => sum + s.balance, 0);
  const pendingSales = sales.filter((s) => s.status !== 'paid');
  const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={`✝ ${settings.storeName}`}
        subtitle={`${settings.storeSubtitle} · ${suppliers.length} proveedores`}
        rightAction={
          <Pressable
            onPress={() => router.push('/(tabs)/datos')}
            style={styles.exportHeaderBtn}
          >
            <Ionicons name="download-outline" size={16} color="#FFFFFF" />
            <Text style={styles.exportHeaderText}>Exportar</Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Acciones rápidas */}
        <View style={styles.quickActionsCard}>
          <Text style={styles.sectionSmallTitle}>ACCIONES RÁPIDAS</Text>
          <View style={styles.quickGrid}>
            <Pressable
              style={styles.quickItem}
              onPress={() => router.push('/(tabs)/pagos')}
            >
              <View style={[styles.quickIcon, { backgroundColor: COLORS.primaryLight }]}>
                <Ionicons name="cart-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.quickLabel}>Venta / Abono</Text>
            </Pressable>

            <Pressable
              style={styles.quickItem}
              onPress={() => router.push('/(tabs)/stock')}
            >
              <View style={[styles.quickIcon, { backgroundColor: COLORS.accentLight }]}>
                <Ionicons name="book-outline" size={20} color={COLORS.accent} />
              </View>
              <Text style={styles.quickLabel}>Biblias y Stock</Text>
            </Pressable>

            <Pressable
              style={styles.quickItem}
              onPress={() => router.push('/(tabs)/inversiones')}
            >
              <View style={[styles.quickIcon, { backgroundColor: COLORS.infoLight }]}>
                <Ionicons name="wallet-outline" size={20} color={COLORS.info} />
              </View>
              <Text style={styles.quickLabel}>Inversiones</Text>
            </Pressable>

            <Pressable
              style={styles.quickItem}
              onPress={() => router.push('/(tabs)/datos')}
            >
              <View style={[styles.quickIcon, { backgroundColor: COLORS.successLight }]}>
                <Ionicons name="share-social-outline" size={20} color={COLORS.success} />
              </View>
              <Text style={styles.quickLabel}>CSV / Backup</Text>
            </Pressable>
          </View>
        </View>

        {/* KPIs principales */}
        <View style={styles.kpiGrid}>
          <KpiCard
            label="Cobrado en Caja"
            value={formatCurrency(totalCollected, sym)}
            hint={`${sales.length} ventas registradas`}
            icon="cash-outline"
            tone="success"
          />
          <KpiCard
            label="Por Cobrar (Abonos)"
            value={formatCurrency(totalReceivable, sym)}
            hint={`${pendingSales.length} cuentas activas`}
            icon="time-outline"
            tone={totalReceivable > 0 ? 'warning' : 'info'}
          />
          <KpiCard
            label="Valor Inventario"
            value={formatCurrency(stockSaleValue, sym)}
            hint={`Costo: ${formatCurrency(stockCostValue, sym)} · ${totalUnits} uds.`}
            icon="cube-outline"
            tone="primary"
          />
          <KpiCard
            label="Capital Invertido"
            value={formatCurrency(totalInvested, sym)}
            hint={`${investments.length} compras/inversiones`}
            icon="trending-up-outline"
            tone="accent"
          />
        </View>

        {/* Alertas de Stock Bajo */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Alertas de Reposición</Text>
            <Pressable onPress={() => router.push('/(tabs)/stock')}>
              <Text style={styles.linkText}>Ver catálogo →</Text>
            </Pressable>
          </View>

          {lowStockProducts.length === 0 ? (
            <View style={styles.okBanner}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text style={styles.okBannerText}>
                Todo el inventario católico supera el stock mínimo configurado.
              </Text>
            </View>
          ) : (
            lowStockProducts.slice(0, 5).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push('/(tabs)/stock')}
                style={styles.listCard}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  <Text style={styles.itemSub}>
                    {item.category} · {item.sku} · Ubicación: {item.location || 'General'}
                  </Text>
                </View>
                <Badge
                  text={item.stock === 0 ? 'AGOTADO' : `${item.stock} / mín ${item.minStock}`}
                  tone="danger"
                />
              </Pressable>
            ))
          )}
        </View>

        {/* Pagos y Abonos Pendientes */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Pagos / Apartados por Cobrar</Text>
            <Pressable onPress={() => router.push('/(tabs)/pagos')}>
              <Text style={styles.linkText}>Gestionar pagos →</Text>
            </Pressable>
          </View>

          {pendingSales.length === 0 ? (
            <View style={styles.okBanner}>
              <Ionicons name="checkmark-done-circle" size={20} color={COLORS.success} />
              <Text style={styles.okBannerText}>
                No hay saldos ni abonos pendientes de clientes.
              </Text>
            </View>
          ) : (
            pendingSales.slice(0, 5).map((sale) => (
              <Pressable
                key={sale.id}
                onPress={() => router.push('/(tabs)/pagos')}
                style={styles.listCard}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>
                    {sale.customerName} · <Text style={{ color: COLORS.primary }}>{sale.folio}</Text>
                  </Text>
                  <Text style={styles.itemSub}>
                    Pagado: {formatCurrency(sale.paidAmount, sym)} de {formatCurrency(sale.total, sym)}
                    {sale.dueDate ? ` · Vence ${formatDate(sale.dueDate)}` : ''}
                  </Text>
                </View>
                <Badge text={`Debe ${formatCurrency(sale.balance, sym)}`} tone="warning" />
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  exportHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  exportHeaderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  quickActionsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  sectionSmallTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  okBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.successLight,
    padding: 12,
    borderRadius: 12,
  },
  okBannerText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.success,
    fontWeight: '600',
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    padding: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
});
