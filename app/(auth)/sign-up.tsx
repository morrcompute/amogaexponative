import React from 'react';
import { SignupPageView } from 'amogamobileds-v1';
import { router } from 'expo-router';
import { saveLocalProfile } from '@/lib/local-db';

export default function SignUpScreen() {
  return (
    <SignupPageView
      onSignInPress={() => router.push('/(auth)/sign-in')}
      onSuccess={async (user) => {
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
