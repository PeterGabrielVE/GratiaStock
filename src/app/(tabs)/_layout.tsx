import React from 'react';
import { Platform } from 'react-native';
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
          backgroundColor: COLORS.ivory,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 82 : 66,
          paddingBottom: Platform.OS === 'ios' ? 22 : 9,
          paddingTop: 7,
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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={22}
              color={String(color ?? COLORS.textMuted)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: 'Stock',
          tabBarBadge: lowStockCount > 0 ? lowStockCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: COLORS.danger,
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '800',
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'book' : 'book-outline'}
              size={22}
              color={String(color ?? COLORS.textMuted)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="pagos"
        options={{
          title: 'Pagos',
          tabBarBadge: pendingPaymentsCount > 0 ? pendingPaymentsCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: COLORS.accent,
            color: COLORS.primaryDark,
            fontSize: 10,
            fontWeight: '800',
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'wallet' : 'wallet-outline'}
              size={22}
              color={String(color ?? COLORS.textMuted)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inversiones"
        options={{
          title: 'Inversión',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'trending-up' : 'trending-up-outline'}
              size={22}
              color={String(color ?? COLORS.textMuted)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="proveedores"
        options={{
          title: 'Proveed.',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={22}
              color={String(color ?? COLORS.textMuted)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="datos"
        options={{
          title: 'Datos/Exp',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'bar-chart' : 'bar-chart-outline'}
              size={22}
              color={String(color ?? COLORS.textMuted)}
            />
          ),
        }}
      />
    </Tabs>
  );
}
