import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import { useAuth } from '@/hooks/useAuth';
import { useBackupPoller } from '@/hooks/useBackupPoller';
import { signOut } from '@/services/auth';
import { registerForPushNotifications } from '@/services/notifications';
import { startKeepAlive } from '@/services/backgroundKeepAlive';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useBackupPoller(user?.uid);

  useEffect(() => {
    if (user?.role === 'admin') router.replace('/(admin)');
  }, [user?.role]);

  useEffect(() => {
    MediaLibrary.requestPermissionsAsync();
    registerForPushNotifications().catch(() => {});
    startKeepAlive().catch(() => {});

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start();
  }, [user?.uid]);

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/login');
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.appName}>talktou</Text>
            <Text style={styles.greeting}>hey, {user?.displayName?.split(' ')[0] ?? 'you'} 👋</Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>sign out</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.heroQuote}>"I want to be</Text>
          <Text style={styles.heroQuote}>connected</Text>
          <Text style={styles.heroQuoteSub}>anytime, anywhere."</Text>
        </Animated.View>

        <Animated.View style={[styles.taglineWrap, { opacity: fadeAnim }]}>
          <Text style={styles.tagline}>آفتوں کے دور میں چین کی گھڑی ہے تو،</Text>
          <Text style={styles.tagline}>میری زندگی ہے تو — سومی ❤️</Text>
        </Animated.View>
      </SafeAreaView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D14' },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  appName: { fontSize: 13, fontWeight: '700', color: '#6C63FF', letterSpacing: 2, textTransform: 'uppercase' },
  greeting: { fontSize: 22, fontWeight: '700', color: '#F7F6F2', marginTop: 4 },
  signOutBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  signOutText: { color: '#64748B', fontSize: 12, fontWeight: '500' },
  hero: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  heroQuote: {
    fontSize: 42,
    fontWeight: '800',
    color: '#F7F6F2',
    lineHeight: 50,
    letterSpacing: -1,
  },
  heroQuoteSub: {
    fontSize: 38,
    fontWeight: '300',
    color: '#6C63FF',
    lineHeight: 48,
    letterSpacing: -0.5,
    fontStyle: 'italic',
  },
  taglineWrap: {
    paddingHorizontal: 28,
    paddingBottom: 32,
  },
  tagline: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#141420',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#F7F6F2', marginBottom: 20 },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  sheetLabel: { fontSize: 13, color: '#64748B' },
  sheetValue: { fontSize: 13, color: '#F7F6F2', fontWeight: '600' },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeActive: { backgroundColor: 'rgba(76,175,125,0.15)' },
  badgeText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  badgeTextActive: { color: '#4CAF7D' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 8 },
});
