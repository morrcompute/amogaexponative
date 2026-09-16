import { useColor } from 'amogamobileds-v1';
import { Stack } from 'expo-router';

/**
 * Web-specific Auth Layout for Expo Router.
 * Configures the stack for desktop web presentation.
 */
export const unstable_settings = {
  initialRouteName: 'sign-in',
};

export default function AuthLayout() {
  const text = useColor('text');
  const background = useColor('background');

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerTintColor: text,
        contentStyle: {
          backgroundColor: background,
          minHeight: '100vh' as any,
        },
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign_in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="sign_up" />
      <Stack.Screen name="magic-link" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
