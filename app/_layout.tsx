import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '@/hooks/useAuth';
import { registerForPushNotifications } from '@/services/notifications';
import { startKeepAlive, stopKeepAlive } from '@/services/backgroundKeepAlive';
import SosManager from '@/components/SosManager';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    SplashScreen.hideAsync();

    const inAuth = segments[0] === '(auth)';

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      if (user.role === 'admin') {
        router.replace('/(admin)');
      } else {
        router.replace('/(user)/home');
      }
    } else if (user && !inAuth) {
      if (user.role === 'user') {
        registerForPushNotifications().catch(() => {});
        startKeepAlive().catch(() => {});
      }
    } else if (!user) {
      stopKeepAlive().catch(() => {});
    }
  }, [user, loading, segments]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      {user?.role === 'user' && <SosManager uid={user.uid} />}
    </GestureHandlerRootView>
  );
}
