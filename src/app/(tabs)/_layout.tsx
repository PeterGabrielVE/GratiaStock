import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { useStore } from '../../context/StoreContext';

export default function TabsLayout() {
  const { products, sales } = useStore();
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const pendingPaymentsCount = sales.filter((s) => s.status !== 'paid').length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={String(color ?? COLORS.textMuted)} />
          ),
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: 'Stock',
          tabBarBadge: lowStockCount > 0 ? lowStockCount : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.danger, fontSize: 10 },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={String(color ?? COLORS.textMuted)} />
          ),
        }}
      />
      <Tabs.Screen
        name="pagos"
        options={{
          title: 'Pagos',
          tabBarBadge: pendingPaymentsCount > 0 ? pendingPaymentsCount : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.warning, fontSize: 10 },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cash-outline" size={size} color={String(color ?? COLORS.textMuted)} />
          ),
        }}
      />
      <Tabs.Screen
        name="inversiones"
        options={{
          title: 'Inversión',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up-outline" size={size} color={String(color ?? COLORS.textMuted)} />
          ),
        }}
      />
      <Tabs.Screen
        name="proveedores"
        options={{
          title: 'Proveed.',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={String(color ?? COLORS.textMuted)} />
          ),
        }}
      />
      <Tabs.Screen
        name="datos"
        options={{
          title: 'Datos/Exp',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={String(color ?? COLORS.textMuted)} />
          ),
        }}
      />
    </Tabs>
  );
}
