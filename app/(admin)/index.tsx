import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { signOut } from '@/services/auth';
import type { AppUser } from '@/types';

export default function AdminDashboard() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'user'));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(d => d.data() as AppUser));
    } catch {
      Alert.alert('Error', 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/login');
  }

  function renderUser({ item }: { item: AppUser }) {
    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => router.push(`/(admin)/user/${item.uid}`)}
        activeOpacity={0.75}
      >
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.displayName[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{item.displayName}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sectionLabel}>
        {users.length} Registered User{users.length !== 1 ? 's' : ''}
      </Text>
      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
      ) : users.length === 0 ? (
        <Text style={styles.empty}>No users registered yet.</Text>
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.uid}
          renderItem={renderUser}
          contentContainerStyle={{ padding: 16 }}
          onRefresh={loadUsers}
          refreshing={loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  header: {
    backgroundColor: '#1a1a2e', paddingTop: 60, paddingBottom: 20,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  signOut: { color: '#a5b4fc', fontSize: 14 },
  sectionLabel: { fontSize: 13, color: '#888', paddingHorizontal: 20, paddingTop: 16 },
  userCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  userName: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  userEmail: { fontSize: 12, color: '#888', marginTop: 2 },
  arrow: { fontSize: 22, color: '#c7d2fe' },
  empty: { textAlign: 'center', marginTop: 60, color: '#aaa', fontSize: 15 },
});
