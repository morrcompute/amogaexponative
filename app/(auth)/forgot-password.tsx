import React, { useState } from 'react';
import {
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyRound, Mail } from 'lucide-react-native';
import { router } from 'expo-router';
import { Button, useColorScheme, useColorTheme, useToast } from 'amogamobileds-v1';
import { supabase } from '@/lib/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import {
  AuthCardContainer,
  AuthBanner,
} from '@/components/auth/auth-card-container';

const redirectTo = makeRedirectUri({ path: 'reset-password' });

export default function ForgotPasswordScreen() {
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

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<AuthBanner | null>(null);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setBanner({ type: 'error', message: 'Please enter your email address.' });
      return;
    }

    setLoading(true);
    setBanner(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });

      if (error) throw error;

      setBanner({
        type: 'success',
        message: 'Reset instructions sent to your email! Please check your inbox.',
      });
      toast.success('Email sent', 'Check your inbox for the reset link.');
    } catch (err: any) {
      const msg = err.message || 'Could not send reset instructions.';
      setBanner({ type: 'error', message: msg });
      toast.error('Request failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCardContainer
      icon={KeyRound}
      iconBg="#f59e0b20"
      iconColor="#f59e0b"
      title="Forgot password?"
      subtitle="No worries, we'll send you reset instructions."
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
      <View style={{ gap: 14 }}>
        {/* Email Field */}
        <View style={{ gap: 5 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: text }}>
            Email address
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
            <Mail size={16} color="#94a3b8" />
            <TextInput
              style={{
                flex: 1,
                fontSize: 13.5,
                color: text,
                padding: 0,
                ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
              }}
              value={email}
              onChangeText={(val) => {
                setEmail(val);
                if (banner) setBanner(null);
              }}
              placeholder="you@example.com"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              onSubmitEditing={() => email.trim() && handleSend()}
            />
          </View>
        </View>

        {/* Submit Button */}
        <Button
          loading={loading}
          disabled={!email.trim() || loading}
          onPress={handleSend}
          style={{ height: 44, borderRadius: 8, marginTop: 4 }}
        >
          Send reset instructions
        </Button>
      </View>
    </AuthCardContainer>
  );
}
