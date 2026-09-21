import React from 'react';
import { SignupPageView } from 'amogamobileds-v1';
import { router } from 'expo-router';

export default function SignUpScreen() {
  return (
    <SignupPageView
      onSignInPress={() => router.push('/(auth)/sign-in')}
      onSuccess={() => {
        router.replace('/(chat)');
      }}
    />
  );
}
