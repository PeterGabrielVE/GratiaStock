import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SERIF_FONT, SHADOWS } from '../constants/theme';

const GRATIA_LOGO = require('../../assets/gratia-logo.png');
const GRATIA_MARK = require('../../assets/gratia-mark.png');

/* ───────────────────────── Toast Feedback System ───────────────────────── */

type ToastTone = 'success' | 'info' | 'warning' | 'danger';

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ message, tone });
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 70,
      }).start();

      timerRef.current = setTimeout(() => {
        Animated.timing(anim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 2800);
    },
    [anim]
  );

  const toneMeta = toast
    ? {
        success: { bg: COLORS.primary, border: COLORS.accent, icon: 'checkmark-circle' as const },
        info: { bg: COLORS.info, border: '#7CB5D6', icon: 'information-circle' as const },
        warning: { bg: COLORS.warning, border: '#F3C683', icon: 'alert-circle' as const },
        danger: { bg: COLORS.danger, border: '#F19993', icon: 'warning' as const },
      }[toast.tone]
    : null;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && toneMeta ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toastContainer,
            {
              backgroundColor: toneMeta.bg,
              borderColor: toneMeta.border,
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name={toneMeta.icon} size={19} color={COLORS.ivory} />
          <Text style={styles.toastText} numberOfLines={2}>
            {toast.message}
          </Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

/* ───────────────────────── Brand Components ───────────────────────── */

export function GratiaLogoCard({
  storeName,
  subtitle,
  rightBadge,
}: {
  storeName: string;
  subtitle: string;
  rightBadge?: string;
}) {
  return (
    <View style={styles.logoHeroCard}>
      <Image source={GRATIA_LOGO} style={styles.heroLogoImage} resizeMode="contain" />
      <View style={styles.heroDivider} />
      <View style={{ flex: 1 }}>
        <View style={styles.heroTitleRow}>
          <Text style={styles.heroBrandTitle} numberOfLines={1}>
            {storeName}
          </Text>
          {rightBadge ? (
            <View style={styles.goldPill}>
              <Text style={styles.goldPillText}>{rightBadge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.heroBrandSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerBrandLeft}>
        <View style={styles.headerMarkFrame}>
          <Image source={GRATIA_MARK} style={styles.headerMarkImg} resizeMode="contain" />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {rightAction ? <View>{rightAction}</View> : null}
    </View>
  );
}

export function HeaderActionPill({
  label,
  icon,
  onPress,
  variant = 'gold',
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: 'gold' | 'glass';
}) {
  const isGold = variant === 'gold';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerActionPill,
        isGold ? styles.headerPillGold : styles.headerPillGlass,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Ionicons
        name={icon}
        size={15}
        color={isGold ? COLORS.primaryDark : COLORS.ivory}
      />
      <Text
        style={[
          styles.headerPillText,
          { color: isGold ? COLORS.primaryDark : COLORS.ivory },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SegmentedTabs<T extends string>({
  options,
  selected,
  onSelect,
  badges,
}: {
  options: readonly T[];
  selected: T;
  onSelect: (val: T) => void;
  badges?: Partial<Record<T, number>>;
}) {
  return (
    <View style={styles.segmentedWrap}>
      {options.map((opt) => {
        const active = opt === selected;
        const count = badges?.[opt];
        return (
          <Pressable
            key={opt}
            onPress={() => onSelect(opt)}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
          >
            <Text
              style={[styles.segmentText, active && styles.segmentTextActive]}
              numberOfLines={1}
            >
              {opt}
            </Text>
            {count !== undefined && count > 0 ? (
              <View
                style={[
                  styles.segmentBadge,
                  active ? styles.segmentBadgeActive : styles.segmentBadgeIdle,
                ]}
              >
                <Text
                  style={[
                    styles.segmentBadgeText,
                    { color: active ? COLORS.primaryDark : COLORS.textSecondary },
                  ]}
                >
                  {count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({
  progress,
  tone = 'primary',
  height = 7,
}: {
  progress: number; // 0..1
  tone?: 'primary' | 'accent' | 'success' | 'warning' | 'danger';
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const fill = {
    primary: COLORS.primary,
    accent: COLORS.accent,
    success: COLORS.success,
    warning: COLORS.warning,
    danger: COLORS.danger,
  }[tone];

  return (
    <View style={[styles.progressTrack, { height }]}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${Math.round(clamped * 100)}%`,
            backgroundColor: fill,
          },
        ]}
      />
    </View>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = 'primary',
  onPress,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  onPress?: () => void;
}) {
  const palette = {
    primary: { bg: COLORS.primaryLight, fg: COLORS.primary, bar: COLORS.primary },
    accent: { bg: COLORS.accentLight, fg: COLORS.accentDark, bar: COLORS.accent },
    success: { bg: COLORS.successLight, fg: COLORS.success, bar: COLORS.success },
    warning: { bg: COLORS.warningLight, fg: COLORS.warning, bar: COLORS.warning },
    danger: { bg: COLORS.dangerLight, fg: COLORS.danger, bar: COLORS.danger },
    info: { bg: COLORS.infoLight, fg: COLORS.info, bar: COLORS.info },
  }[tone];

  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      style={[styles.kpiCard, { borderTopColor: palette.bar, borderTopWidth: 3 }]}
    >
      <View style={styles.kpiTop}>
        <View style={[styles.kpiIconWrap, { backgroundColor: palette.bg }]}>
          <Ionicons name={icon} size={17} color={palette.fg} />
        </View>
        <Text style={styles.kpiLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? (
        <Text style={styles.kpiHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </Container>
  );
}

export function Badge({
  text,
  tone = 'neutral',
}: {
  text: string;
  tone?: 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const palette = {
    neutral: { bg: COLORS.surfaceAlt, fg: COLORS.textSecondary },
    primary: { bg: COLORS.primaryLight, fg: COLORS.primary },
    accent: { bg: COLORS.accentLight, fg: COLORS.accentDark },
    success: { bg: COLORS.successLight, fg: COLORS.success },
    warning: { bg: COLORS.warningLight, fg: COLORS.warning },
    danger: { bg: COLORS.dangerLight, fg: COLORS.danger },
    info: { bg: COLORS.infoLight, fg: COLORS.info },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{text}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  variant = 'primary',
  small = false,
  disabled = false,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'outline' | 'danger' | 'success';
  small?: boolean;
  disabled?: boolean;
}) {
  const isOutline = variant === 'outline';
  const isAccent = variant === 'accent';
  const bg = isOutline
    ? COLORS.surfaceWarm
    : isAccent
      ? COLORS.accent
      : variant === 'danger'
        ? COLORS.danger
        : variant === 'success'
          ? COLORS.success
          : COLORS.primary;
  const fg = isOutline ? COLORS.primary : isAccent ? COLORS.primaryDark : '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        {
          backgroundColor: bg,
          borderColor: isOutline ? COLORS.border : bg,
          borderWidth: 1,
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed && !disabled ? 0.99 : 1 }],
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={small ? 15 : 18} color={fg} /> : null}
      <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: fg }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchBox}>
      <Ionicons name="search-outline" size={18} color={COLORS.primary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        style={styles.searchInput}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10}>
          <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function FormField({
  label,
  helperText,
  ...props
}: { label: string; helperText?: string } & TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={COLORS.textMuted}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          props.multiline && styles.inputMultiline,
        ]}
        {...props}
      />
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

export function ChipSelector<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly T[];
  selected: T;
  onSelect: (val: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {options.map((opt) => {
        const active = opt === selected;
        return (
          <Pressable
            key={opt}
            onPress={() => onSelect(opt)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyBox}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name={icon} size={30} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{description}</Text>
      {actionLabel && onAction ? (
        <View style={{ marginTop: 16 }}>
          <PrimaryButton label={actionLabel} icon="add-circle-outline" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

export function BottomSheetModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.modalBackdropTap} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.modalTitle}>{title}</Text>
              {subtitle ? <Text style={styles.modalSubtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.primary} />
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalBody}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function BrandLoadingScreen() {
  return (
    <View style={styles.splashWrap}>
      <Image source={GRATIA_LOGO} style={styles.splashLogo} resizeMode="contain" />
      <Text style={styles.splashHint}>Preparando inventario y registros...</Text>
    </View>
  );
}

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  AlertModule: typeof import('react-native').Alert
) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  AlertModule.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Confirmar', style: 'destructive', onPress: onConfirm },
  ]);
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 18 : 54,
    alignSelf: 'center',
    maxWidth: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1.5,
    zIndex: 9999,
    ...SHADOWS.floating,
  },
  toastText: {
    color: COLORS.ivory,
    fontSize: 13,
    fontWeight: '700',
  },
  logoHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ivory,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
    ...SHADOWS.card,
  },
  heroLogoImage: {
    width: 84,
    height: 62,
  },
  heroDivider: {
    width: 1,
    height: 44,
    backgroundColor: COLORS.border,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroBrandTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 21,
    fontWeight: '700',
    color: COLORS.primary,
    flex: 1,
  },
  heroBrandSubtitle: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },
  goldPill: {
    backgroundColor: COLORS.accentLight,
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  goldPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.accentDark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 12,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
  },
  headerBrandLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingRight: 10,
  },
  headerMarkFrame: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: COLORS.ivory,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerMarkImg: {
    width: 32,
    height: 32,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.ivory,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#CBDAD3',
    marginTop: 1,
  },
  headerActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  headerPillGold: {
    backgroundColor: COLORS.accent,
  },
  headerPillGlass: {
    backgroundColor: 'rgba(253, 249, 241, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(192, 151, 82, 0.45)',
  },
  headerPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  segmentedWrap: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.soft,
  },
  segmentText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  segmentTextActive: {
    color: COLORS.ivory,
  },
  segmentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  segmentBadgeActive: {
    backgroundColor: COLORS.accent,
  },
  segmentBadgeIdle: {
    backgroundColor: COLORS.surface,
  },
  segmentBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  progressTrack: {
    width: '100%',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  kpiCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  kpiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  kpiIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  kpiHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonSmall: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  buttonTextSmall: {
    fontSize: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: COLORS.surface,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 0,
  },
  fieldWrap: {
    marginBottom: 13,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 5,
  },
  input: {
    backgroundColor: COLORS.surfaceWarm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 10.5,
    fontSize: 14,
    color: COLORS.text,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  inputMultiline: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 3,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7.5,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: COLORS.ivory,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: COLORS.ivory,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 19,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 35, 29, 0.56)',
    justifyContent: 'flex-end',
  },
  modalBackdropTap: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '91%',
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: COLORS.accent,
  },
  modalHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  modalTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 18,
    paddingBottom: 36,
  },
  splashWrap: {
    flex: 1,
    backgroundColor: COLORS.ivory,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  splashLogo: {
    width: 190,
    height: 142,
  },
  splashHint: {
    marginTop: 14,
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
