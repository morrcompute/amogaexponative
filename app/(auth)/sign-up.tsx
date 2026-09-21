import React, { useState, useRef, useEffect } from 'react';
import {
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Sparkles,
  User,
  Mail,
  Phone,
  ShieldCheck,
  RefreshCw,
  Edit3,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { Button, useColorScheme, useColorTheme, useToast } from 'amogamobileds-v1';
import { supabase } from '@/lib/supabase';
import {
  AuthCardContainer,
  AuthBanner,
} from '@/components/auth/auth-card-container';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function SignUpScreen() {
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
  const cardBg = isDark ? '#141721' : '#f8fafc';
  const successColor = '#10b981';

  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(false);

  // OTP flow states
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');
  const [otp, setOtp] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [banner, setBanner] = useState<AuthBanner | null>(null);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Countdown timer for resending OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatPhoneNumber = (val: string) => {
    let cleaned = val.trim();
    if (cleaned && !cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  };

  const currentTarget = authMethod === 'email' ? email.trim() : formatPhoneNumber(phone);

  const validateForm = () => {
    setBanner(null);
    if (!displayName.trim()) {
      setBanner({ type: 'error', message: 'Please enter your full name.' });
      return false;
    }
    if (authMethod === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim() || !emailRegex.test(email.trim())) {
        setBanner({ type: 'error', message: 'Please enter a valid work email address.' });
        return false;
      }
    } else {
      const formatted = formatPhoneNumber(phone);
      if (formatted.length < 8) {
        setBanner({
          type: 'error',
          message: 'Please enter a valid phone number with country code (e.g. +1234567890).',
        });
        return false;
      }
    }
    if (!agree) {
      setBanner({ type: 'error', message: 'Please accept the terms of service and privacy policy.' });
      return false;
    }
    return true;
  };

  // Step 2: Supabase Email OTP Send
  const handleSendEmailOtp = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setBanner(null);
    const trimmedEmail = email.trim();
    const cleanName = displayName.trim();

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true,
          data: {
            display_name: cleanName,
            full_name: cleanName,
            name: cleanName,
          },
        },
      });
      if (error) throw error;

      toast.success('OTP sent!', `A 6-digit verification code was sent to ${trimmedEmail}`);
      setStep('otp');
      setOtp(Array(CODE_LENGTH).fill(''));
      setCountdown(RESEND_COOLDOWN);
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      setBanner({
        type: 'error',
        message: err.message || 'Failed to send OTP code. Please check your email.',
      });
      toast.error('Failed to send OTP', err.message || 'Please check your email address.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Supabase Mobile OTP Send
  const handleSendMobileOtp = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setBanner(null);
    const formattedPhone = formatPhoneNumber(phone);
    const cleanName = displayName.trim();

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          shouldCreateUser: true,
          data: {
            display_name: cleanName,
            full_name: cleanName,
            name: cleanName,
            mobile: formattedPhone,
          },
        },
      });
      if (error) throw error;

      toast.success('SMS OTP sent!', `A 6-digit code was sent to ${formattedPhone}`);
      setStep('otp');
      setOtp(Array(CODE_LENGTH).fill(''));
      setCountdown(RESEND_COOLDOWN);
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      setBanner({
        type: 'error',
        message: err.message || 'Failed to send SMS OTP code. Please check your phone number.',
      });
      toast.error('Failed to send SMS OTP', err.message || 'Please verify your phone number.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit inputs
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

  // Validate OTP & Save User to Supabase & Route to Home Screen
  const verifyCode = async (codeToVerify?: string) => {
    const fullCode = (codeToVerify || otp.join('')).trim();
    if (fullCode.length !== CODE_LENGTH) {
      setBanner({
        type: 'error',
        message: 'Please enter all 6 digits of your verification code.',
      });
      return;
    }

    setVerifying(true);
    setBanner(null);

    try {
      let verifyResult: any;
      if (authMethod === 'email') {
        verifyResult = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: fullCode,
          type: 'email',
        });
      } else {
        const formattedPhone = formatPhoneNumber(phone);
        verifyResult = await supabase.auth.verifyOtp({
          phone: formattedPhone,
          token: fullCode,
          type: 'sms',
        });
      }

      if (verifyResult.error) throw verifyResult.error;

      const user = verifyResult.data?.user;
      const cleanName = displayName.trim() || user?.user_metadata?.display_name || 'Amoga User';

      // 1. Save user metadata to Supabase Auth
      await supabase.auth.updateUser({
        data: {
          display_name: cleanName,
          full_name: cleanName,
          name: cleanName,
          ...(authMethod === 'phone'
            ? { mobile: formatPhoneNumber(phone), phone: formatPhoneNumber(phone) }
            : { email: email.trim() }),
        },
      });

      // 2. Persist / Upsert profile in Supabase public.profiles table
      if (user?.id) {
        const profilePayload: Record<string, any> = {
          id: user.id,
          name: cleanName,
          display_name: cleanName,
          updated_at: new Date().toISOString(),
        };
        if (authMethod === 'email') {
          profilePayload.email = email.trim();
        } else {
          const formattedPhone = formatPhoneNumber(phone);
          profilePayload.mobile = formattedPhone;
          profilePayload.phone = formattedPhone;
        }

        await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' });
      }

      toast.success('Account created!', 'Welcome to Amoga.');

      // Route directly to Home screen (chat)
      router.replace('/(chat)');
    } catch (err: any) {
      const msg = err.message || 'Invalid or expired verification code.';
      setBanner({ type: 'error', message: msg });
      toast.error('Verification failed', msg);
    } finally {
      setVerifying(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setBanner(null);
    try {
      if (authMethod === 'email') {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        toast.success('Resent!', `New verification code sent to ${email.trim()}`);
      } else {
        const formattedPhone = formatPhoneNumber(phone);
        const { error } = await supabase.auth.signInWithOtp({
          phone: formattedPhone,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        toast.success('Resent!', `New SMS OTP sent to ${formattedPhone}`);
      }
      setCountdown(RESEND_COOLDOWN);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Could not resend OTP code.' });
      toast.error('Resend failed', err.message || 'Could not resend OTP code.');
    } finally {
      setResending(false);
    }
  };

  const isFormValid =
    displayName.trim().length > 0 &&
    (authMethod === 'email' ? email.trim().length > 3 : phone.trim().length >= 6) &&
    agree;

  // Render Step 2: 6-Digit OTP Verification Screen
  if (step === 'otp') {
    return (
      <AuthCardContainer
        icon={ShieldCheck}
        iconBg={isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5'}
        iconColor="#10b981"
        title="Verify OTP Code"
        subtitle={`Enter the 6-digit code sent to ${currentTarget}`}
        banner={banner}
        backAction={{
          label: `Change ${authMethod === 'email' ? 'Email' : 'Number'}`,
          onPress: () => {
            setStep('form');
            setBanner(null);
          },
        }}
      >
        <View style={{ gap: 16 }}>
          {/* Target Info Bar */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: isDark ? '#0c0f17' : '#f8fafc',
              borderRadius: 8,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              {authMethod === 'email' ? <Mail size={15} color={accent} /> : <Phone size={15} color={accent} />}
              <Text style={{ fontSize: 13, fontWeight: '600', color: text }} numberOfLines={1}>
                {currentTarget}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setStep('form');
                setBanner(null);
              }}
              activeOpacity={0.7}
            >
              <Edit3 size={15} color={muted} />
            </TouchableOpacity>
          </View>

          {/* 6 Digit Input Boxes */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              marginVertical: 4,
            }}
          >
            {otp.map((digit, index) => {
              const isFilled = Boolean(digit);
              return (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  value={digit}
                  onChangeText={(val) => handleDigitChange(val, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  autoFocus={index === 0}
                  editable={!verifying}
                  style={{
                    width: 44,
                    height: 52,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: isFilled ? accent : border,
                    backgroundColor: isDark ? '#0c0f17' : '#f8fafc',
                    textAlign: 'center',
                    fontSize: 22,
                    fontWeight: '700',
                    color: text,
                  }}
                />
              );
            })}
          </View>

          {/* Resend OTP Bar */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
            {countdown > 0 ? (
              <Text style={{ fontSize: 12.5, color: muted }}>
                Resend code in <Text style={{ fontWeight: '600', color: text }}>{countdown}s</Text>
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={resending}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={13} color={accent} />
                <Text style={{ fontSize: 13, color: accent, fontWeight: '600' }}>
                  {resending ? 'Sending...' : 'Resend code'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Verify Button */}
          <Button
            loading={verifying}
            disabled={otp.join('').length < CODE_LENGTH || verifying}
            onPress={() => verifyCode()}
            style={{ height: 44, borderRadius: 8, marginTop: 4 }}
          >
            Verify & Create Account
          </Button>
        </View>
      </AuthCardContainer>
    );
  }

  // Render Step 1: Form Screen
  return (
    <AuthCardContainer
      icon={Sparkles}
      iconBg={isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5'}
      iconColor="#10b981"
      title="Create an account"
      subtitle="Instant signup with Supabase OTP verification."
      banner={banner}
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 13, color: muted }}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')} activeOpacity={0.7}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: accent }}>Sign in</Text>
          </TouchableOpacity>
        </View>
      }
    >
      {/* Auth Method Selector Toggle (Email OTP vs Mobile OTP) */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: cardBg,
          borderRadius: 10,
          padding: 3,
          borderWidth: 1,
          borderColor: border,
          gap: 4,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            setAuthMethod('email');
            setBanner(null);
          }}
          activeOpacity={0.8}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 9,
            borderRadius: 7,
            backgroundColor: authMethod === 'email' ? accent : 'transparent',
            gap: 6,
          }}
        >
          <Mail size={15} color={authMethod === 'email' ? '#FFFFFF' : muted} />
          <Text
            style={{
              fontWeight: '600',
              fontSize: 13,
              color: authMethod === 'email' ? '#FFFFFF' : muted,
            }}
          >
            Email OTP
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setAuthMethod('phone');
            setBanner(null);
          }}
          activeOpacity={0.8}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 9,
            borderRadius: 7,
            backgroundColor: authMethod === 'phone' ? accent : 'transparent',
            gap: 6,
          }}
        >
          <Phone size={15} color={authMethod === 'phone' ? '#FFFFFF' : muted} />
          <Text
            style={{
              fontWeight: '600',
              fontSize: 13,
              color: authMethod === 'phone' ? '#FFFFFF' : muted,
            }}
          >
            Mobile OTP
          </Text>
        </TouchableOpacity>
      </View>

      {/* Form Fields */}
      <View style={{ gap: 12 }}>
        {/* Full Name */}
        <View style={{ gap: 5 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: text }}>Full Name</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              height: 42,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: border,
              backgroundColor: isDark ? '#0c0f17' : '#f8fafc',
              paddingHorizontal: 12,
              gap: 8,
            }}
          >
            <User size={16} color="#94a3b8" />
            <TextInput
              style={{ flex: 1, fontSize: 13.5, color: text, padding: 0 }}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Ada Lovelace"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        {/* Dynamic Target: Email vs Mobile */}
        {authMethod === 'email' ? (
          <View style={{ gap: 5 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: text }}>Work Email</Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                height: 42,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: border,
                backgroundColor: isDark ? '#0c0f17' : '#f8fafc',
                paddingHorizontal: 12,
                gap: 8,
              }}
            >
              <Mail size={16} color="#94a3b8" />
              <TextInput
                style={{ flex: 1, fontSize: 13.5, color: text, padding: 0 }}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="you@company.com"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: 5 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: text }}>Mobile Number</Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                height: 42,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: border,
                backgroundColor: isDark ? '#0c0f17' : '#f8fafc',
                paddingHorizontal: 12,
                gap: 8,
              }}
            >
              <Phone size={16} color="#94a3b8" />
              <TextInput
                style={{ flex: 1, fontSize: 13.5, color: text, padding: 0 }}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
                placeholder="+1 234 567 8900"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <Text style={{ fontSize: 11, color: muted }}>
              Include country code prefix (e.g. +1, +44, +91)
            </Text>
          </View>
        )}

        {/* Terms agreement checkbox */}
        <TouchableOpacity
          onPress={() => setAgree(!agree)}
          activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              borderWidth: 1.5,
              borderColor: agree ? accent : border,
              backgroundColor: agree ? accent : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {agree && <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>✓</Text>}
          </View>
          <Text style={{ fontSize: 12, color: muted, flex: 1 }}>
            I agree to the <Text style={{ color: accent }}>Terms of Service</Text> and{' '}
            <Text style={{ color: accent }}>Privacy Policy</Text>.
          </Text>
        </TouchableOpacity>

        {/* Submit Button */}
        <Button
          loading={loading}
          disabled={loading || !isFormValid}
          onPress={authMethod === 'email' ? handleSendEmailOtp : handleSendMobileOtp}
          style={{ height: 44, borderRadius: 8, marginTop: 4 }}
        >
          {authMethod === 'email' ? 'Send Email OTP' : 'Send Mobile OTP'}
        </Button>
      </View>
    </AuthCardContainer>
  );
}
