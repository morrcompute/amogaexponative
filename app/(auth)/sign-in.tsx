import React, { useState, useRef, useEffect } from 'react';
import {
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  RefreshCw,
  Edit3,
  UserPlus,
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

export default function SignInScreen() {
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

  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Flow states
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otp, setOtp] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [banner, setBanner] = useState<AuthBanner | null>(null);
  const [notRegistered, setNotRegistered] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Cooldown countdown timer for resending OTP
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

  const validateTarget = () => {
    setBanner(null);
    setNotRegistered(false);

    if (authMethod === 'email') {
      const trimmedEmail = email.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
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
    return true;
  };

  // Step 1: Send Sign In OTP (with shouldCreateUser: false to detect unregistered users)
  const handleSendOtp = async () => {
    if (!validateTarget()) return;

    setLoading(true);
    setBanner(null);
    setNotRegistered(false);

    try {
      if (authMethod === 'email') {
        const trimmedEmail = email.trim();
        const { error } = await supabase.auth.signInWithOtp({
          email: trimmedEmail,
          options: {
            shouldCreateUser: false, // Prevents auto-signup; errors if user doesn't exist
          },
        });

        if (error) throw error;

        toast.success('Code sent!', `A 6-digit login code was sent to ${trimmedEmail}`);
      } else {
        const formattedPhone = formatPhoneNumber(phone);
        const { error } = await supabase.auth.signInWithOtp({
          phone: formattedPhone,
          options: {
            shouldCreateUser: false, // Prevents auto-signup; errors if user doesn't exist
          },
        });

        if (error) throw error;

        toast.success('SMS code sent!', `A 6-digit login code was sent to ${formattedPhone}`);
      }

      setStep('otp');
      setOtp(Array(CODE_LENGTH).fill(''));
      setCountdown(RESEND_COOLDOWN);
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      const msg = (err.message || '').toLowerCase();
      // Supabase returns "Signups not allowed for otp" or "User not found" when shouldCreateUser: false and user does not exist
      if (
        msg.includes('signup') ||
        msg.includes('not allowed') ||
        msg.includes('user not found') ||
        msg.includes('no user') ||
        msg.includes('invalid')
      ) {
        setNotRegistered(true);
        setBanner({
          type: 'error',
          message: 'No account found with this information. Please sign up first!',
        });
        toast.error('Account not found', 'Please sign up before signing in.');
      } else {
        setBanner({
          type: 'error',
          message: err.message || 'Failed to send OTP. Please check your credentials.',
        });
        toast.error('Sign in failed', err.message || 'Please check your information.');
      }
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

  // Validate OTP & Sign In -> Route to Home Screen
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

      toast.success('Welcome back!', 'Signed in successfully.');

      // Route directly to Home screen (chat)
      router.replace('/(chat)');
    } catch (err: any) {
      const msg = err.message || 'Invalid or expired verification code.';
      setBanner({ type: 'error', message: msg });
      toast.error('Sign in failed', msg);
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
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
        toast.success('Resent!', `New verification code sent to ${email.trim()}`);
      } else {
        const formattedPhone = formatPhoneNumber(phone);
        const { error } = await supabase.auth.signInWithOtp({
          phone: formattedPhone,
          options: { shouldCreateUser: false },
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

  const isFormValid = authMethod === 'email' ? email.trim().length > 3 : phone.trim().length >= 6;

  // Render Step 2: 6-Digit OTP Verification Screen
  if (step === 'otp') {
    return (
      <AuthCardContainer
        icon={ShieldCheck}
        iconBg={isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5'}
        iconColor="#10b981"
        title="Verify Sign In Code"
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
            Verify & Sign In
          </Button>
        </View>
      </AuthCardContainer>
    );
  }

  // Render Step 1: Form Screen
  return (
    <AuthCardContainer
      icon={Lock}
      iconBg={isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff'}
      iconColor={accent}
      title="Welcome Back"
      subtitle="Sign in with instant OTP verification. No password required."
      banner={banner}
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 13, color: muted }}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')} activeOpacity={0.7}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: accent }}>Sign up</Text>
          </TouchableOpacity>
        </View>
      }
    >
      {/* Unregistered User Action Banner */}
      {notRegistered && (
        <View
          style={{
            backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#fecaca',
            borderRadius: 10,
            padding: 12,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#ef4444' }}>
            Account not found
          </Text>
          <Text style={{ fontSize: 12, color: text, lineHeight: 17 }}>
            No Amoga account exists for this {authMethod === 'email' ? 'email' : 'phone number'}. Please create your account first!
          </Text>
          <Button
            onPress={() => router.push('/(auth)/sign-up')}
            style={{ height: 38, borderRadius: 6, marginTop: 2 }}
          >
            Go to Sign Up
          </Button>
        </View>
      )}

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
            setNotRegistered(false);
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
            setNotRegistered(false);
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

      {/* Dynamic Target Field */}
      <View style={{ gap: 14 }}>
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
                onChangeText={(val) => {
                  setEmail(val);
                  if (notRegistered) setNotRegistered(false);
                }}
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
                onChangeText={(val) => {
                  setPhone(val);
                  if (notRegistered) setNotRegistered(false);
                }}
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

        {/* Submit Button */}
        <Button
          loading={loading}
          disabled={loading || !isFormValid}
          onPress={handleSendOtp}
          style={{ height: 44, borderRadius: 8, marginTop: 2 }}
        >
          {authMethod === 'email' ? 'Send Sign In Code' : 'Send Mobile Code'}
        </Button>
      </View>
    </AuthCardContainer>
  );
}
