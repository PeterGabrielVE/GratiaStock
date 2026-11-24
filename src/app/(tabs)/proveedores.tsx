import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../context/StoreContext';
import { Supplier } from '../../types/models';
import { COLORS, SERIF_FONT, SHADOWS } from '../../constants/theme';
import {
  Badge,
  BottomSheetModal,
  EmptyState,
  FormField,
  HeaderActionPill,
  PrimaryButton,
  ScreenHeader,
  SearchField,
  confirmAction,
  useToast,
} from '../../components/UI';
import { formatCurrency } from '../../utils/format';

export default function ProveedoresScreen() {
  const { showToast } = useToast();
  const {
    settings,
    suppliers,
    products,
    investments,
    saveSupplier,
    deleteSupplier,
  } = useStore();
  const sym = settings.currencySymbol;

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.contactName.toLowerCase().includes(q) ||
        s.specialty.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const openNewModal = () => {
    setEditingId(undefined);
    setName('');
    setContactName('');
    setPhone('');
    setEmail('');
    setCity('');
    setSpecialty('Biblias Católicas y Rosarios');
    setPaymentTerms('Contado');
    setNotes('');
    setModalOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingId(sup.id);
    setName(sup.name);
    setContactName(sup.contactName);
    setPhone(sup.phone);
    setEmail(sup.email);
    setCity(sup.city);
    setSpecialty(sup.specialty);
    setPaymentTerms(sup.paymentTerms);
    setNotes(sup.notes);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Nombre requerido', 'Ingresa el nombre de la editorial o proveedor.');
      return;
    }
    await saveSupplier({
      id: editingId,
      name: name.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      city: city.trim(),
      specialty: specialty.trim(),
      paymentTerms: paymentTerms.trim(),
      notes: notes.trim(),
    });
    setModalOpen(false);
    showToast(editingId ? 'Proveedor actualizado' : 'Proveedor registrado');
  };

  const openWhatsApp = (rawPhone: string) => {
    const digits = rawPhone.replace(/[^0-9]/g, '');
    if (!digits) return;
    Linking.openURL(`https://wa.me/${digits}`).catch(() => {
      Alert.alert('Error', 'No se pudo abrir WhatsApp en este dispositivo.');
    });
  };

  const openCall = (rawPhone: string) => {
    if (!rawPhone.trim()) return;
    Linking.openURL(`tel:${rawPhone.trim()}`).catch(() => {
      Alert.alert('Error', 'No se pudo iniciar la llamada.');
    });
  };

  const openEmail = (addr: string) => {
    if (!addr.trim()) return;
    Linking.openURL(`mailto:${addr.trim()}`).catch(() => {
      Alert.alert('Error', 'No se pudo abrir el correo.');
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Proveedores"
        subtitle={`${suppliers.length} editoriales y talleres aliados`}
        rightAction={
          <HeaderActionPill
            label="Agregar"
            icon="person-add-outline"
            variant="gold"
            onPress={openNewModal}
          />
        }
      />

      <View style={styles.searchWrap}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar editorial, taller de camándulas o ciudad..."
        />
      </View>

      <FlatList
        data={filteredSuppliers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="Sin proveedores en directorio"
            description="Registra editoriales bíblicas, talleres de rosarios y distribuidores religiosos."
            actionLabel="Nuevo Proveedor"
            onAction={openNewModal}
          />
        }
        renderItem={({ item }) => {
          const linkedProducts = products.filter((p) => p.supplierId === item.id).length;
          const supplierInvs = investments.filter((i) => i.supplierId === item.id);
          const totalPurchased = supplierInvs.reduce((s, i) => s + i.amount, 0);
          const debt = supplierInvs.reduce(
            (s, i) => s + Math.max(0, i.amount - i.paidAmount),
            0
          );
          const initials = item.name
            .split(' ')
            .slice(0, 2)
            .map((w) => w[0] ?? '')
            .join('')
            .toUpperCase();

          return (
            <View style={styles.supCard}>
              <View style={styles.cardTop}>
                <View style={styles.avatarMonogram}>
                  <Text style={styles.avatarText}>{initials || 'GR'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.supName}>{item.name}</Text>
                  <Text style={styles.specialtyText}>
                    {item.specialty || 'Artículos religiosos'}
                  </Text>
                </View>
                <Badge text={`${linkedProducts} ítems`} tone="accent" />
              </View>

              <View style={styles.infoBlock}>
                {item.contactName ? (
                  <Text style={styles.infoRow}>👤 {item.contactName}</Text>
                ) : null}
                {item.city ? <Text style={styles.infoRow}>📍 {item.city}</Text> : null}
                {item.paymentTerms ? (
                  <Text style={styles.infoRow}>🤝 {item.paymentTerms}</Text>
                ) : null}
                {item.notes ? <Text style={styles.notesRow}>{item.notes}</Text> : null}
              </View>

              <View style={styles.statsStrip}>
                <Text style={styles.statText}>
                  Compras: <Text style={styles.statStrong}>{formatCurrency(totalPurchased, sym)}</Text>
                </Text>
                <Text
                  style={[
                    styles.statText,
                    { color: debt > 0 ? COLORS.warning : COLORS.success },
                  ]}
                >
                  {debt > 0 ? `Saldo: ${formatCurrency(debt, sym)}` : 'Al día'}
                </Text>
              </View>

              <View style={styles.actionsBar}>
                <View style={styles.contactBtns}>
                  {item.phone ? (
                    <>
                      <Pressable
                        onPress={() => openWhatsApp(item.phone)}
                        style={[styles.iconBtn, { backgroundColor: COLORS.successLight }]}
                      >
                        <Ionicons name="logo-whatsapp" size={15} color={COLORS.success} />
                        <Text style={[styles.iconBtnLabel, { color: COLORS.success }]}>
                          WhatsApp
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => openCall(item.phone)}
                        style={[styles.iconBtn, { backgroundColor: COLORS.infoLight }]}
                      >
                        <Ionicons name="call-outline" size={15} color={COLORS.info} />
                      </Pressable>
                    </>
                  ) : null}
                  {item.email ? (
                    <Pressable
                      onPress={() => openEmail(item.email)}
                      style={[styles.iconBtn, { backgroundColor: COLORS.accentLight }]}
                    >
                      <Ionicons name="mail-outline" size={15} color={COLORS.accentDark} />
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.contactBtns}>
                  <Pressable
                    onPress={() => openEditModal(item)}
                    style={[styles.iconBtn, { backgroundColor: COLORS.surfaceAlt }]}
                  >
                    <Ionicons name="create-outline" size={15} color={COLORS.text} />
                    <Text style={styles.iconBtnLabel}>Editar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      confirmAction(
                        'Eliminar proveedor',
                        `¿Eliminar a "${item.name}"? Sus artículos conservarán el stock.`,
                        async () => {
                          await deleteSupplier(item.id);
                          showToast('Proveedor eliminado', 'info');
                        },
                        Alert
                      )
                    }
                    style={[styles.iconBtn, { backgroundColor: COLORS.dangerLight }]}
                  >
                    <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />

      <BottomSheetModal
        visible={modalOpen}
        title={editingId ? 'Editar Proveedor' : 'Nuevo Proveedor / Editorial'}
        subtitle="Datos de contacto directo y acuerdos comerciales"
        onClose={() => setModalOpen(false)}
      >
        <FormField
          label="Nombre de la Editorial o Taller *"
          placeholder="Ej. Editorial Verbo Divino / San Pablo"
          value={name}
          onChangeText={setName}
        />
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <FormField
              label="Persona de contacto"
              placeholder="Asesor comercial"
              value={contactName}
              onChangeText={setContactName}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label="Ciudad / País"
              placeholder="Ej. Bogotá / CDMX"
              value={city}
              onChangeText={setCity}
            />
          </View>
        </View>
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <FormField
              label="Teléfono / WhatsApp"
              placeholder="+57 310..."
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label="Correo electrónico"
              placeholder="pedidos@editorial.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>
        </View>
        <FormField
          label="Especialidad de productos"
          placeholder="Ej. Biblias Católicas, Camándulas de Olivo"
          value={specialty}
          onChangeText={setSpecialty}
        />
        <FormField
          label="Condiciones de pago / envío"
          placeholder="Ej. Crédito 30 días, descuento por docena"
          value={paymentTerms}
          onChangeText={setPaymentTerms}
        />
        <FormField
          label="Notas"
          placeholder="Cuentas bancarias, catálogo, observaciones..."
          multiline
          value={notes}
          onChangeText={setNotes}
        />
        <PrimaryButton
          label={editingId ? 'Guardar Cambios' : 'Registrar Proveedor'}
          icon="checkmark-circle-outline"
          onPress={handleSave}
        />
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  listContent: { padding: 16, paddingTop: 10, paddingBottom: 34, gap: 12 },
  supCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    ...SHADOWS.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatarMonogram: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: SERIF_FONT,
    color: COLORS.ivory,
    fontSize: 15,
    fontWeight: '700',
  },
  supName: { fontSize: 15.5, fontWeight: '800', color: COLORS.text },
  specialtyText: { fontSize: 12, color: COLORS.accentDark, fontWeight: '700', marginTop: 2 },
  infoBlock: { gap: 3 },
  infoRow: { fontSize: 12.5, color: COLORS.textSecondary },
  notesRow: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 2 },
  statsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceWarm,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
  },
  statText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  statStrong: { color: COLORS.primary, fontWeight: '800', fontVariant: ['tabular-nums'] },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  contactBtns: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6.5,
    borderRadius: 8,
  },
  iconBtnLabel: { fontSize: 11.5, fontWeight: '700', color: COLORS.text },
  row2: { flexDirection: 'row', gap: 10 },
});
