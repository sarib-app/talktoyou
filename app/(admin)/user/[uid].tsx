import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/config/firebase';
import type { AppUser } from '@/types';

export default function UserDetail() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();

  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [sending, setSending] = useState(false);
  const [alarmActive, setAlarmActive] = useState(false);

  useEffect(() => {
    if (!uid) return;
    loadUser();
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      if (!snap.exists()) return;
      setAlarmActive(!!snap.data()?.alarmActive);
    });
    return unsub;
  }, [uid]);

  async function loadUser() {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) setUser(snap.data() as AppUser);
    } catch {
      Alert.alert('Error', 'Failed to load user.');
    } finally {
      setLoading(false);
    }
  }

  async function sendNotification() {
    if (!notifBody.trim()) {
      Alert.alert('Required', 'Please enter a message.');
      return;
    }
    setSending(true);
    try {
      const functions = getFunctions(undefined, 'us-central1');
      const fn = httpsCallable(functions, 'sendAdminNotification');
      await fn({
        targetUid: uid,
        title: notifTitle.trim() || undefined,
        body: notifBody.trim(),
      });
      setNotifTitle('');
      setNotifBody('');
      Alert.alert('Sent!', `Notification sent to ${user?.displayName}.`);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to send notification.');
    } finally {
      setSending(false);
    }
  }

  async function toggleAlarm() {
    try {
      await updateDoc(doc(db, 'users', uid), { alarmActive: !alarmActive });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to toggle alarm.');
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>User not found.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.avatarLg}>
            <Text style={styles.avatarText}>{user.displayName[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.profileName}>{user.displayName}</Text>
          <Text style={styles.profileEmail}>{user.email}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Send Notification</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Hey!"
              placeholderTextColor="#bbb"
              value={notifTitle}
              onChangeText={setNotifTitle}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Message</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="Type your message..."
              placeholderTextColor="#bbb"
              value={notifBody}
              onChangeText={setNotifBody}
              multiline
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, sending && { opacity: 0.6 }]}
            onPress={sendNotification}
            disabled={sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Send Notification</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🚨 Emergency Alarm</Text>
          <Text style={styles.desc}>
            Triggers a loud alarm on this device even when on silent.
          </Text>
          <TouchableOpacity
            style={[styles.alarmBtn, alarmActive && styles.alarmBtnStop]}
            onPress={toggleAlarm}
          >
            <Text style={styles.btnText}>
              {alarmActive ? '🔕  Stop Alarm' : '🔊  Start Alarm'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#888', fontSize: 16 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 12 },
  backText: { color: '#a5b4fc', fontSize: 14 },
  profileCard: {
    backgroundColor: '#1a1a2e', borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 16,
  },
  avatarLg: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#4f46e5',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  profileName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  profileEmail: { color: '#a5b4fc', fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },
  desc: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 18 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#f7f7f9', borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, color: '#1a1a2e',
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  sendBtn: {
    backgroundColor: '#4f46e5', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  alarmBtn: {
    backgroundColor: '#dc2626', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  alarmBtnStop: { backgroundColor: '#16a34a' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
