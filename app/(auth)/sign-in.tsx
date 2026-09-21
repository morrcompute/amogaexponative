import React from 'react';
import { SigninPageView } from 'amogamobileds-v1';
import { router } from 'expo-router';

export default function SignInScreen() {
  return (
    <SigninPageView
      onSignUpPress={() => router.push('/(auth)/sign-up')}
      onSuccess={() => {
        router.replace('/(chat)');
      }}
    />
  );
}
