import React, { ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react-native';
import { useColor, useColorScheme, useColorTheme, AvoidKeyboard } from 'amogamobileds-v1';

export interface AuthBanner {
  type: 'success' | 'error';
  message: string;
}

export interface AuthCardContainerProps {
  icon?: React.ComponentType<{ size: number; color: string }>;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  banner?: AuthBanner | null;
  children: ReactNode;
  footer?: ReactNode;
  backAction?: {
    label: string;
    onPress: () => void;
  };
}

export function AuthCardContainer({
  icon: IconComponent,
  iconBg,
  iconColor,
  title,
  subtitle,
  banner,
  children,
  footer,
  backAction,
}: AuthCardContainerProps) {
  const { width } = useWindowDimensions();
  const isDark = useColorScheme() === 'dark';
  const { currentTheme } = useColorTheme();

  // Screen layout mode: mobile view on native or narrow screens (< 520px)
  const isMobile = Platform.OS !== 'web' || width < 520;

  const accent = isDark
    ? currentTheme?.name && currentTheme.name !== 'zinc' && currentTheme.preview
      ? currentTheme.preview
      : '#818cf8'
    : currentTheme?.name && currentTheme.name !== 'zinc'
    ? currentTheme.preview
    : '#18181b';

  const bg = useColor('background');
  const cardBg = isDark ? '#141721' : '#ffffff';
  const border = isDark ? '#232734' : '#e2e8f0';
  const text = isDark ? '#f8fafc' : '#0f172a';
  const muted = isDark ? '#94a3b8' : '#64748b';

  const defaultIconBg = isDark ? '#1e2433' : '#f1f5f9';
  const effectiveIconBg = iconBg || defaultIconBg;
  const effectiveIconColor = iconColor || (currentTheme?.preview && currentTheme.name !== 'zinc' ? accent : text);

  const content = (
    <View style={{ width: '100%', gap: 16 }}>
      {/* Back button link if provided */}
      {backAction && (
        <TouchableOpacity
          onPress={backAction.onPress}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'flex-start',
            marginBottom: 4,
          }}
        >
          <ArrowLeft size={16} color={muted} />
          <Text style={{ fontSize: 13, color: muted, fontWeight: '500' }}>
            {backAction.label}
          </Text>
        </TouchableOpacity>
      )}

      {/* Header with Icon Badge */}
      <View style={{ gap: 6, alignItems: 'center' }}>
        {IconComponent && (
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: effectiveIconBg,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            <IconComponent size={22} color={effectiveIconColor} />
          </View>
        )}
        <Text
          style={{
            fontSize: 22,
            fontWeight: '700',
            color: text,
            letterSpacing: -0.3,
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              fontSize: 13,
              color: muted,
              textAlign: 'center',
              lineHeight: 18,
              paddingHorizontal: 8,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {/* Success or Error Banner */}
      {banner && banner.message && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            borderRadius: 10,
            backgroundColor:
              banner.type === 'success' ? '#10b98118' : '#ef444418',
            borderWidth: 1,
            borderColor:
              banner.type === 'success' ? '#10b98140' : '#ef444440',
          }}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 size={18} color="#10b981" />
          ) : (
            <AlertCircle size={18} color="#ef4444" />
          )}
          <Text
            style={{
              flex: 1,
              fontSize: 12.5,
              fontWeight: '500',
              color: banner.type === 'success' ? '#10b981' : '#ef4444',
              lineHeight: 17,
            }}
          >
            {banner.message}
          </Text>
        </View>
      )}

      {/* Form Content */}
      <View style={{ gap: 14 }}>{children}</View>

      {/* Footer */}
      {footer && <View style={{ marginTop: 2 }}>{footer}</View>}
    </View>
  );

  // Desktop Web (Screen width >= 520px): Centered card with brand header (1st SS)
  if (Platform.OS === 'web' && !isMobile) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh' as any,
          paddingHorizontal: 16,
          paddingVertical: 32,
        }}
      >
        <ScrollView
          style={{ width: '100%', maxWidth: 440 }}
          contentContainerStyle={{
            paddingVertical: 24,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Logo & Header */}
          <View
            style={{
              alignItems: 'center',
              marginBottom: 20,
              gap: 8,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#059669',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
              } as any}
            >
              <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '700' }}>
                ⌘
              </Text>
            </View>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: muted,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              Amoga
            </Text>
          </View>

          {/* Elevated Centered Card */}
          <View
            style={{
              width: '100%',
              backgroundColor: cardBg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: border,
              padding: 28,
              boxShadow: isDark
                ? '0 20px 40px rgba(0,0,0,0.55)'
                : '0 12px 32px rgba(0,0,0,0.06)',
            } as any}
          >
            {content}
          </View>
        </ScrollView>
      </View>
    );
  }

  // Mobile APK (Android / iOS) & Mobile Web (Screen width < 520px):
  // Clean, borderless, edge-to-edge layout without AMOGA logo or card box (2nd SS)
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingVertical: 28,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: 'transparent',
          }}
        >
          {content}
        </View>
      </ScrollView>
      <AvoidKeyboard />
    </SafeAreaView>
  );
}
