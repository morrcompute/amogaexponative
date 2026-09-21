import React, { useState, useEffect } from 'react';
import {
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Lock, Eye, EyeOff } from 'lucide-react-native';
import { router } from 'expo-router';
import { Button, Spinner, useColorScheme, useColorTheme, useToast } from 'amogamobileds-v1';
import { supabase } from '@/lib/supabase';
import {
  AuthCardContainer,
  AuthBanner,
} from '@/components/auth/auth-card-container';

export default function ResetPasswordScreen() {
  const isDark = useColorScheme() === 'dark';
  const { currentTheme } = useColorTheme();
  const toast = useToast();

  const accent = isDark
    ? currentTheme?.name && currentTheme.name !== 'zinc' && currentTheme.preview
      ? currentTheme.preview
      : '#818cf8'
    : currentTheme?.name && currentTheme.name !== 'zinc'
    ? currentTheme.preview
    : '#18181b';

  const border = isDark ? '#232734' : '#e2e8f0';
  const text = isDark ? '#f8fafc' : '#0f172a';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#0c0f17' : '#f8fafc';

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<AuthBanner | null>(null);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    // Safety timeout in case session resolution is quick or already present
    const timer = setTimeout(() => setReady(true), 1200);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleUpdatePassword = async () => {
    if (password.length < 6) {
      setBanner({
        type: 'error',
        message: 'Password must be at least 6 characters long.',
      });
      return;
    }
    if (password !== confirmPassword) {
      setBanner({
        type: 'error',
        message: 'Passwords do not match.',
      });
      return;
    }

    setLoading(true);
    setBanner(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setBanner({
        type: 'success',
        message: 'Password updated successfully! Redirecting...',
      });
      toast.success('Password updated', 'You are now signed in.');

      setTimeout(() => {
        router.replace('/(chat)');
      }, 1200);
    } catch (err: any) {
      const msg = err.message || 'Could not update your password.';
      setBanner({ type: 'error', message: msg });
      toast.error('Update failed', msg);
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <AuthCardContainer
        icon={Lock}
        title="Opening recovery link"
        subtitle="Verifying session..."
      >
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 16 }}>
          <Spinner size="lg" variant="circle" />
          <Text style={{ fontSize: 13, color: muted, textAlign: 'center' }}>
            One moment while we confirm your recovery authorization.
          </Text>
        </View>
      </AuthCardContainer>
    );
  }

  const canSubmit =
    password.length >= 6 && confirmPassword.length >= 6 && password === confirmPassword;

  return (
    <AuthCardContainer
      icon={Lock}
      iconBg={accent + '20'}
      iconColor={accent}
      title="Choose a new password"
      subtitle="Enter your new password below to regain account access."
      banner={banner}
      footer={
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.replace('/sign-in')}
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: 8,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: accent }}>
            ← Back to sign in
          </Text>
        </TouchableOpacity>
      }
    >
      <View style={{ gap: 12 }}>
        {/* New Password Field */}
        <View style={{ gap: 5 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: text }}>
            New Password
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              height: 44,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: border,
              backgroundColor: inputBg,
              paddingHorizontal: 12,
              gap: 8,
            }}
          >
            <Lock size={16} color="#94a3b8" />
            <TextInput
              style={{
                flex: 1,
                fontSize: 13.5,
                color: text,
                padding: 0,
                ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
              }}
              value={password}
              onChangeText={(val) => {
                setPassword(val);
                if (banner) setBanner(null);
              }}
              secureTextEntry={!showPassword}
              placeholder="At least 6 characters"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoComplete="new-password"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={{ padding: 4 }}
              activeOpacity={0.7}
            >
              {showPassword ? (
                <EyeOff size={16} color="#94a3b8" />
              ) : (
                <Eye size={16} color="#94a3b8" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirm Password Field */}
        <View style={{ gap: 5 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: text }}>
            Confirm Password
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              height: 44,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: border,
              backgroundColor: inputBg,
              paddingHorizontal: 12,
              gap: 8,
            }}
          >
            <Lock size={16} color="#94a3b8" />
            <TextInput
              style={{
                flex: 1,
                fontSize: 13.5,
                color: text,
                padding: 0,
                ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
              }}
              value={confirmPassword}
              onChangeText={(val) => {
                setConfirmPassword(val);
                if (banner) setBanner(null);
              }}
              secureTextEntry={!showPassword}
              placeholder="Re-enter password"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoComplete="new-password"
            />
          </View>
        </View>

        {/* Submit Button */}
        <Button
          loading={loading}
          disabled={!canSubmit || loading}
          onPress={handleUpdatePassword}
          style={{ height: 44, borderRadius: 8, marginTop: 4 }}
        >
          Update password
        </Button>
      </View>
    </AuthCardContainer>
  );
}
