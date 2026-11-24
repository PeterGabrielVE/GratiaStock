import React from 'react';
import {
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
import { COLORS, SERIF_FONT, SHADOWS } from '../../constants/theme';
import {
  Badge,
  BrandLoadingScreen,
  GratiaLogoCard,
  HeaderActionPill,
  KpiCard,
  ProgressBar,
  ScreenHeader,
} from '../../components/UI';
import { formatCurrency, formatDate } from '../../utils/format';

export default function DashboardScreen() {
  const { isLoading, settings, products, sales, investments, suppliers } = useStore();

  if (isLoading) {
    return <BrandLoadingScreen />;
  }

  const sym = settings.currencySymbol;
  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const stockSaleValue = products.reduce((sum, p) => sum + p.stock * p.salePrice, 0);
  const stockCostValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  const potentialMargin = Math.max(0, stockSaleValue - stockCostValue);
  const lowStockProducts = products.filter((p) => p.stock <= p.minStock);

  const totalBilled = sales.reduce((sum, s) => sum + s.total, 0);
  const totalCollected = sales.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalReceivable = sales.reduce((sum, s) => sum + s.balance, 0);
  const collectionRatio = totalBilled > 0 ? totalCollected / totalBilled : 1;

  const pendingSales = sales.filter((s) => s.status !== 'paid');
  const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={settings.storeName}
        subtitle={`${suppliers.length} proveedores · ${totalUnits} unidades en stock`}
        rightAction={
          <HeaderActionPill
            label="Exportar"
            icon="download-outline"
            variant="gold"
            onPress={() =>
              router.push({
                pathname: '/(tabs)/datos',
                params: { tab: `export_${sales.length}_${products.length}` },
              })
            }
          />
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Tarjeta Principal con Logo Oficial de Gratia */}
        <GratiaLogoCard
          storeName={settings.storeName}
          subtitle={`${settings.storeSubtitle}${settings.parishOrAddress ? ` · ${settings.parishOrAddress}` : ''}`}
          rightBadge={`${products.length} ítems`}
        />

        {/* Atajos Directos de 1 Toque */}
        <View style={styles.quickCard}>
          <View style={styles.quickHeaderRow}>
            <Text style={styles.overlineText}>OPERACIONES RÁPIDAS</Text>
            <Text style={styles.overlineHint}>Un toque para abrir</Text>
          </View>
          <View style={styles.quickGrid}>
            <QuickTile
              icon="bag-add-outline"
              label="Nueva Venta"
              tone="primary"
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/pagos',
                  params: { open: `sale_${sales.length + 1}` },
                })
              }
            />
            <QuickTile
              icon="add-circle-outline"
              label="Nuevo Artículo"
              tone="accent"
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/stock',
                  params: { open: `prod_${products.length + 1}` },
                })
              }
            />
            <QuickTile
              icon="Layers-outlineFallback"
              customIcon="cube-outline"
              label="Invertir Lote"
              tone="info"
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/inversiones',
                  params: { open: `inv_${investments.length + 1}` },
                })
              }
            />
            <QuickTile
              icon="share-social-outline"
              label="Excel / Backup"
              tone="success"
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/datos',
                  params: { tab: `export_${Date.length}` },
                })
              }
            />
          </View>
        </View>

        {/* Tarjeta de Salud de Cobranza */}
        <Pressable
          onPress={() => router.push('/(tabs)/pagos')}
          style={styles.healthBanner}
        >
          <View style={styles.healthTopRow}>
            <View>
              <Text style={styles.healthLabel}>FLUJO DE VENTAS Y ABONOS</Text>
              <Text style={styles.healthMainAmount}>
                {formatCurrency(totalCollected, sym)}{' '}
                <Text style={styles.healthSubInline}>
                  cobrados de {formatCurrency(totalBilled, sym)}
                </Text>
              </Text>
            </View>
            <View style={styles.healthPctBadge}>
              <Text style={styles.healthPctText}>{Math.round(collectionRatio * 100)}%</Text>
            </View>
          </View>
          <ProgressBar progress={collectionRatio} tone="accent" height={8} />
          <View style={styles.healthFooterRow}>
            <Text style={styles.healthFootNote}>
              {pendingSales.length > 0
                ? `${pendingSales.length} cuentas con abonos pendientes (${formatCurrency(totalReceivable, sym)})`
                : 'Todas las ventas están 100% liquidadas'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
          </View>
        </Pressable>

        {/* KPIs Principales */}
        <View style={styles.kpiGrid}>
          <KpiCard
            label="Caja Efectiva"
            value={formatCurrency(totalCollected, sym)}
            hint={`${sales.length} ventas acumuladas`}
            icon="wallet-outline"
            tone="success"
            onPress={() => router.push('/(tabs)/pagos')}
          />
          <KpiCard
            label="Por Cobrar"
            value={formatCurrency(totalReceivable, sym)}
            hint={`${pendingSales.length} apartados activos`}
            icon="time-outline"
            tone={totalReceivable > 0 ? 'warning' : 'info'}
            onPress={() => router.push('/(tabs)/pagos')}
          />
          <KpiCard
            label="Valor en Stock"
            value={formatCurrency(stockSaleValue, sym)}
            hint={`Ganancia pot.: ${formatCurrency(potentialMargin, sym)}`}
            icon="book-outline"
            tone="primary"
            onPress={() => router.push('/(tabs)/stock')}
          />
          <KpiCard
            label="Capital Invertido"
            value={formatCurrency(totalInvested, sym)}
            hint={`Costo actual: ${formatCurrency(stockCostValue, sym)}`}
            icon="trending-up-outline"
            tone="accent"
            onPress={() => router.push('/(tabs)/inversiones')}
          />
        </View>

        {/* Alertas de Reposición */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWrap}>
              <Ionicons name="notifications-outline" size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Reposición de Stock</Text>
            </View>
            <Pressable onPress={() => router.push('/(tabs)/stock')}>
              <Text style={styles.linkText}>Ver catálogo →</Text>
            </Pressable>
          </View>

          {lowStockProducts.length === 0 ? (
            <View style={styles.okBanner}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text style={styles.okBannerText}>
                Excelente: todos los productos católicos superan su stock mínimo.
              </Text>
            </View>
          ) : (
            lowStockProducts.slice(0, 5).map((item) => {
              const ratio = item.minStock > 0 ? item.stock / (item.minStock * 2) : 0;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.push('/(tabs)/stock')}
                  style={styles.listCard}
                >
                  <View style={{ flex: 1, gap: 5 }}>
                    <View style={styles.cardTitleLine}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Badge
                        text={item.stock === 0 ? 'AGOTADO' : `${item.stock} / mín ${item.minStock}`}
                        tone={item.stock === 0 ? 'danger' : 'warning'}
                      />
                    </View>
                    <Text style={styles.itemSub}>
                      {item.category} · {item.sku}
                      {item.location ? ` · 📍 ${item.location}` : ''}
                    </Text>
                    <ProgressBar
                      progress={ratio}
                      tone={item.stock === 0 ? 'danger' : 'warning'}
                      height={5}
                    />
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* Cuentas por Cobrar / Apartados */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWrap}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Abonos Pendientes</Text>
            </View>
            <Pressable onPress={() => router.push('/(tabs)/pagos')}>
              <Text style={styles.linkText}>Cobrar abonos →</Text>
            </Pressable>
          </View>

          {pendingSales.length === 0 ? (
            <View style={styles.okBanner}>
              <Ionicons name="checkmark-done-circle" size={20} color={COLORS.success} />
              <Text style={styles.okBannerText}>
                Sin cuentas pendientes: todos los clientes están al día.
              </Text>
            </View>
          ) : (
            pendingSales.slice(0, 5).map((sale) => {
              const pct = sale.total > 0 ? sale.paidAmount / sale.total : 0;
              return (
                <Pressable
                  key={sale.id}
                  onPress={() => router.push('/(tabs)/pagos')}
                  style={styles.listCard}
                >
                  <View style={{ flex: 1, gap: 5 }}>
                    <View style={styles.cardTitleLine}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {sale.customerName}{' '}
                        <Text style={{ color: COLORS.accentDark, fontSize: 12 }}>
                          · {sale.folio}
                        </Text>
                      </Text>
                      <Badge text={`Resta ${formatCurrency(sale.balance, sym)}`} tone="accent" />
                    </View>
                    <Text style={styles.itemSub}>
                      Abonado: {formatCurrency(sale.paidAmount, sym)} de{' '}
                      {formatCurrency(sale.total, sym)}
                      {sale.dueDate ? ` · Vence ${formatDate(sale.dueDate)}` : ''}
                    </Text>
                    <ProgressBar progress={pct} tone="success" height={5} />
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickTile({
  icon,
  customIcon,
  label,
  tone,
  onPress,
}: {
  icon: string;
  customIcon?: keyof typeof Ionicons.glyphMap;
  label: string;
  tone: 'primary' | 'accent' | 'info' | 'success';
  onPress: () => void;
}) {
  const palette = {
    primary: { bg: COLORS.primaryLight, fg: COLORS.primary },
    accent: { bg: COLORS.accentLight, fg: COLORS.accentDark },
    info: { bg: COLORS.infoLight, fg: COLORS.info },
    success: { bg: COLORS.successLight, fg: COLORS.success },
  }[tone];

  const resolvedIcon = (customIcon ?? icon) as keyof typeof Ionicons.glyphMap;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickItem,
        pressed && { opacity: 0.82, transform: [{ scale: 0.97 }] },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: palette.bg }]}>
        <Ionicons name={resolvedIcon} size={21} color={palette.fg} />
      </View>
      <Text style={styles.quickLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 34,
    gap: 15,
  },
  quickCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  quickHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  overlineText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  overlineHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceWarm,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  healthBanner: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 15,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.accent,
    ...SHADOWS.card,
  },
  healthTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  healthLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 0.8,
  },
  healthMainAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ivory,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  healthSubInline: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#C9D8D1',
  },
  healthPctBadge: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  healthPctText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  healthFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthFootNote: {
    fontSize: 12,
    color: '#DAE6E0',
    fontWeight: '600',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionBlock: {
    gap: 9,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 16.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  linkText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.accentDark,
  },
  okBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: COLORS.successLight,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C5E5D6',
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
    backgroundColor: COLORS.surface,
    padding: 13,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  cardTitleLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  itemSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
