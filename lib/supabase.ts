import { createClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { AppState, Platform } from 'react-native';
import type { Database } from '@/lib/database.types';
import { LargeSecureStore } from '@/lib/large-secure-store';

if (typeof globalThis.crypto !== 'object') {
  (globalThis as any).crypto = {};
}
if (!globalThis.crypto.getRandomValues) {
  globalThis.crypto.getRandomValues = (array: any) => Crypto.getRandomValues(array);
}
if (!globalThis.crypto.subtle) {
  (globalThis.crypto as any).subtle = {
    digest: async (_algorithm: any, data: ArrayBuffer | Uint8Array) => {
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      return Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes as any);
    },
  };
}

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://nvxcqbisyeldjceouggb.supabase.co';
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_f7pb9k7U2jT9GgyO4GC2rg_guymXYhK';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    // Encrypted device storage on native; the browser's own storage on web,
    // where SecureStore and AsyncStorage do not exist.
    storage: Platform.OS === 'web' ? undefined : new LargeSecureStore(),
    persistSession: true,
    autoRefreshToken: true,
    // There is no URL to parse on native. Left on, the client waits for a
    // callback that never arrives and sign-in appears to hang. Deep links are
    // handled explicitly in providers/auth-provider.tsx instead.
    detectSessionInUrl: Platform.OS === 'web',
    // PKCE is what makes the mobile OAuth and magic-link flows safe: the code
    // that comes back through the deep link is worthless without the verifier
    // held on this device.
    flowType: 'pkce',
  },
});

// supabase-js refreshes the access token on a timer, and a timer in a
// backgrounded app is unreliable — iOS suspends it outright. Without this, a
// user who leaves the app for an hour comes back to expired requests.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
