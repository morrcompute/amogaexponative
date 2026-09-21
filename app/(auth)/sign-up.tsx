import React from 'react';
import { SignupPageView } from 'amogamobileds-v1';
import { router } from 'expo-router';
import { saveLocalProfile } from '@/lib/local-db';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  return (
    <SignupPageView
      supabaseClient={supabase}
      onSignInPress={() => router.push('/(auth)/sign-in')}
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
