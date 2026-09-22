import React from 'react';
import { SignupPageView } from 'amogamobileds-v1';
import { router, useLocalSearchParams } from 'expo-router';
import { saveLocalProfile } from '@/lib/local-db';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const params = useLocalSearchParams<{ phone?: string; method?: 'email' | 'phone' }>();

  return (
    <SignupPageView
      supabaseClient={supabase}
      initialMethod={params.method || (params.phone ? 'phone' : 'email')}
      initialPhone={params.phone}
      onSignInPress={(phone) => {
        if (phone) {
          router.push({
            pathname: '/(auth)/sign-in',
            params: { phone, method: 'phone' },
          });
        } else {
          router.push('/(auth)/sign-in');
        }
      }}
      onSuccess={async (user, session) => {
        if (session) {
          await supabase.auth.setSession(session).catch(() => {});
        }
        if (user) {
          await saveLocalProfile(
            {
              id: user.id,
              email: user.email,
              name: user.user_metadata?.name || user.user_metadata?.display_name || user.user_metadata?.full_name,
              display_name: user.user_metadata?.display_name || user.user_metadata?.name,
              mobile: user.phone || user.user_metadata?.mobile,
            },
            user.user_metadata,
            user.app_metadata
          );
        }
        router.replace('/(chat)');
      }}
    />
  );
}
