import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { login, fetchUserProfile } from '@/services/auth';
import { auth } from '@/config/firebase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pressAnim = useRef(new Animated.Value(1)).current;

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('oops', 'please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password.trim());
      const uid = auth.currentUser!.uid;
      const profile = await fetchUserProfile(uid);
      if (!profile) {
        Alert.alert('profile not found', `no account found for uid: ${uid}`);
        return;
      }
      if (profile.role === 'admin') {
        router.replace('/(admin)');
      } else {
        router.replace('/(user)/home');
      }
    } catch (e: any) {
      Alert.alert('login failed', e.message ?? 'invalid credentials.');
    } finally {
      setLoading(false);
    }
  }

  function onPressIn() {
    Animated.spring(pressAnim, { toValue: 0.96, useNativeDriver: true, speed: 30 }).start();
  }
  function onPressOut() {
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.brandWrap}>
          <Text style={styles.brandName}>Talktou <Text style={styles.heart}>♥</Text></Text>
          <Text style={styles.brandSub}>stay close, wherever you are</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="email"
            placeholderTextColor="#334155"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="password"
            placeholderTextColor="#334155"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Animated.View style={{ transform: [{ scale: pressAnim }] }}>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              disabled={loading}
              activeOpacity={1}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>sign in</Text>
              }
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.registerWrap}>
            <Text style={styles.registerText}>no account? </Text>
            <Text style={styles.registerLink}>register</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.coupleWrap}>
          <Text style={styles.coupleName}>Sarib</Text>
          <View style={styles.coupleMiddle}>
            <Text style={styles.coupleHeart}>♥</Text>
            <Text style={styles.coupleWave}>~·~·~·~·~</Text>
            <Text style={styles.coupleHeart}>♥</Text>
          </View>
          <Text style={styles.coupleName}>Sumi</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D14',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 60,
  },
  brandWrap: {
    marginBottom: 52,
  },
  brandName: {
    fontSize: 48,
    fontWeight: '800',
    color: '#F7F6F2',
    letterSpacing: -1.5,
  },
  brandSub: {
    fontSize: 15,
    color: '#334155',
    marginTop: 6,
    fontWeight: '400',
  },
  heart: {
    color: '#FF6B8A',
    fontSize: 42,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 15,
    color: '#F7F6F2',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  registerWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  registerText: { color: '#334155', fontSize: 14 },
  registerLink: { color: '#6C63FF', fontSize: 14, fontWeight: '600' },
  coupleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
    gap: 8,
  },
  coupleName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  coupleMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coupleHeart: {
    fontSize: 14,
    color: '#FF6B8A',
  },
  coupleWave: {
    fontSize: 13,
    color: '#334155',
    letterSpacing: 2,
  },
});
