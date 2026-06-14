import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function HomeIcon({ focused }: { focused: boolean }) {
  const c = focused ? '#6C63FF' : '#334155';
  return (
    <View style={styles.iconWrap}>
      <View style={[styles.homeRoof, { borderBottomColor: c }]} />
      <View style={[styles.homeBase, { borderColor: c }]} />
      <Text style={[styles.label, { color: c }]}>home</Text>
    </View>
  );
}

function MessageIcon({ focused }: { focused: boolean }) {
  const c = focused ? '#6C63FF' : '#334155';
  return (
    <View style={styles.iconWrap}>
      <View style={[styles.msgBubble, { borderColor: c }]}>
        <View style={[styles.msgDot, { backgroundColor: c }]} />
        <View style={[styles.msgDot, { backgroundColor: c }]} />
        <View style={[styles.msgDot, { backgroundColor: c }]} />
      </View>
      <Text style={[styles.label, { color: c }]}>pookie</Text>
    </View>
  );
}

function CameraIcon({ focused }: { focused: boolean }) {
  const c = focused ? '#6C63FF' : '#334155';
  return (
    <View style={styles.iconWrap}>
      <View style={[styles.cameraSnapWrap, { borderColor: c, backgroundColor: focused ? '#6C63FF' : 'transparent' }]}>
        <Ionicons name="camera" size={18} color={focused ? '#fff' : c} />
      </View>
      <Text style={[styles.label, { color: c }]}>snap</Text>
    </View>
  );
}

function HeartIcon({ focused }: { focused: boolean }) {
  const c = focused ? '#6C63FF' : '#334155';
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={focused ? 'heart' : 'heart-outline'} size={20} color={c} />
      <Text style={[styles.label, { color: c }]}>us</Text>
    </View>
  );
}

export default function UserLayout() {
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ tabBarIcon: ({ focused }) => <HomeIcon focused={focused} /> }}
      />
      <Tabs.Screen
        name="camera"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="partner"
        options={{ tabBarIcon: ({ focused }) => <MessageIcon focused={focused} /> }}
      />
      <Tabs.Screen
        name="memories"
        options={{ tabBarIcon: ({ focused }) => <HeartIcon focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0D0D14',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    height: 82,
    paddingBottom: 12,
  },
  iconWrap: { alignItems: 'center', gap: 5, paddingTop: 4 },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  homeRoof: {
    width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  homeBase: { width: 13, height: 9, borderWidth: 1.5, borderTopWidth: 0, borderRadius: 1, marginTop: 1 },
  msgBubble: {
    width: 22, height: 16, borderRadius: 6, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  msgDot: { width: 3, height: 3, borderRadius: 1.5 },
  cameraSnapWrap: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
});
