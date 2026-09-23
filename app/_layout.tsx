import 'react-native-gesture-handler';
import 'react-native-reanimated';
import '@/lib/polyfills';
import { Spinner, ToastProvider, View } from 'amogamobileds-v1';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { ThemeProvider, useTheme } from '@/providers/theme-provider';
import { ColorThemeProvider } from '@/providers/color-theme-provider';
import { CallProvider } from '@/providers/call-provider';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import {
  OpenSans_300Light,
  OpenSans_400Regular,
  OpenSans_500Medium,
  OpenSans_600SemiBold,
  OpenSans_700Bold,
  OpenSans_800ExtraBold,
} from '@expo-google-fonts/open-sans';

// Web font injection identical to amogawebexpods
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const fontLinkId = 'amoga-open-sans-webfont';
  if (!document.getElementById(fontLinkId)) {
    const fontStyle = document.createElement('style');
    fontStyle.id = fontLinkId;
    fontStyle.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap');
      body, button, input, textarea, select {
        font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
    `;
    document.head.appendChild(fontStyle);
  }
}

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(chat)');
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size='lg' variant='circle' />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name='index' options={{ headerShown: false }} />
      <Stack.Screen name='(auth)' options={{ headerShown: false }} />
      <Stack.Screen name='(chat)' options={{ headerShown: false }} />
      <Stack.Screen name='+not-found' options={{ title: 'Oops!' }} />
    </Stack>
  );
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    OpenSans_300Light,
    OpenSans_400Regular,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
    OpenSans_800ExtraBold,
    'Open Sans': OpenSans_400Regular,
    'OpenSans-Regular': OpenSans_400Regular,
    'OpenSans-Medium': OpenSans_500Medium,
    'OpenSans-SemiBold': OpenSans_600SemiBold,
    'OpenSans-Bold': OpenSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Safety fallback: ensure splash screen hides even if font loading is delayed
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Keep native splash screen visible until fonts have loaded or errored
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ColorThemeProvider>
          <AuthProvider>
            <CallProvider>
              <ToastProvider>
                <ThemedStatusBar />
                <RootNavigator />
              </ToastProvider>
            </CallProvider>
          </AuthProvider>
        </ColorThemeProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

