import React, { useState, useRef, useEffect } from 'react';
import {
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ShieldCheck, RefreshCw } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, useColorScheme, useColorTheme, useToast } from 'amogamobileds-v1';
import { supabase } from '@/lib/supabase';
import {
  AuthCardContainer,
  AuthBanner,
} from '@/components/auth/auth-card-container';

const CODE_LENGTH = 6;

export default function VerifyOtpScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
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

  const [otp, setOtp] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [banner, setBanner] = useState<AuthBanner | null>(null);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  const handleDigitChange = (value: string, index: number) => {
    // Handle paste of complete 6-digit code
    if (value.length > 1) {
      const cleanDigits = value.replace(/\D/g, '').slice(0, CODE_LENGTH).split('');
      const newOtp = [...otp];
      cleanDigits.forEach((digit, i) => {
        newOtp[i] = digit;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(cleanDigits.length, CODE_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      if (cleanDigits.length === CODE_LENGTH) {
        verifyCode(newOtp.join(''));
      }
      return;
    }

    const digit = value.replace(/\D/g, '');
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (banner) setBanner(null);

    // Auto-advance to next box
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all digits filled
    const fullCode = newOtp.join('');
    if (fullCode.length === CODE_LENGTH && !newOtp.includes('')) {
      verifyCode(fullCode);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const verifyCode = async (codeToVerify?: string) => {
    const fullCode = codeToVerify || otp.join('');
    if (fullCode.length !== CODE_LENGTH) {
      setBanner({
        type: 'error',
        message: 'Please enter all 6 digits of your verification code.',
      });
      return;
    }

    setLoading(true);
    setBanner(null);

    try {
      const targetEmail = email ? email.trim() : '';

      if (targetEmail) {
        const { error } = await supabase.auth.verifyOtp({
          email: targetEmail,
          token: fullCode,
          type: 'email',
        });
        if (error) throw error;
      } else {
        // Recovery / 2FA check
        const { error } = await supabase.auth.verifyOtp({
          token_hash: fullCode,
          type: 'recovery',
        });
        if (error) throw error;
      }

      setBanner({
        type: 'success',
        message: 'Code verified successfully! Signing you in...',
      });
      toast.success('Verified', 'You are now authenticated.');
    } catch (err: any) {
      const msg = err.message || 'Invalid or expired verification code.';
      setBanner({ type: 'error', message: msg });
      toast.error('Verification failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;

    if (!email) {
      setBanner({
        type: 'error',
        message: 'No email address available to resend code.',
      });
      return;
    }

    setResending(true);
    setBanner(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });

      if (error) throw error;

      setCountdown(30);
      setBanner({
        type: 'success',
        message: `New 6-digit code sent to ${email.trim()}`,
      });
      toast.success('Code sent', 'A new verification code has been dispatched.');
    } catch (err: any) {
      const msg = err.message || 'Failed to resend verification code.';
      setBanner({ type: 'error', message: msg });
      toast.error('Resend failed', msg);
    } finally {
      setResending(false);
    }
  };

  const isComplete = otp.every((digit) => digit.length === 1);

  return (
    <AuthCardContainer
      icon={ShieldCheck}
      iconBg={accent + '20'}
      iconColor={accent}
      title="Two-factor auth"
      subtitle={
        email
          ? `Enter the 6-digit code sent to ${email}`
          : 'Enter the 6-digit verification code to continue'
      }
      banner={banner}
      backAction={{
        label: 'Back to sign in',
        onPress: () => router.replace('/sign-in'),
      }}
    >
      <View style={{ gap: 18, alignItems: 'center' }}>
        {/* 6 OTP Input Digit Boxes */}
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            width: '100%',
          }}
        >
          {otp.map((digit, idx) => {
            const isFocused = inputRefs.current[idx]?.isFocused?.();
            return (
              <View
                key={idx}
                style={{
                  width: 44,
                  height: 48,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: digit ? accent : border,
                  backgroundColor: inputBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TextInput
                  ref={(ref) => {
                    inputRefs.current[idx] = ref;
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    textAlign: 'center',
                    fontSize: 19,
                    fontWeight: '700',
                    color: text,
                    padding: 0,
                    ...(Platform.OS === 'web'
                      ? ({ outlineStyle: 'none' } as any)
                      : {}),
                  }}
                  value={digit}
                  onChangeText={(val) => handleDigitChange(val, idx)}
                  onKeyPress={(e) => handleKeyPress(e, idx)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  autoFocus={idx === 0}
                />
              </View>
            );
          })}
        </View>

        {/* Verify Button */}
        <Button
          loading={loading}
          disabled={!isComplete || loading}
          onPress={() => verifyCode()}
          style={{ width: '100%', height: 42, borderRadius: 8 }}
        >
          Verify Code
        </Button>

        {/* Resend Section */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 12, color: muted }}>
            Didn't receive code?
          </Text>
          {countdown > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <RefreshCw size={12} color={accent} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: accent }}>
                Resend in {countdown}s
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleResend}
              disabled={resending}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={12} color={accent} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: accent,
                  textDecorationLine: 'underline',
                }}
              >
                {resending ? 'Sending...' : 'Resend code'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </AuthCardContainer>
  );
}
