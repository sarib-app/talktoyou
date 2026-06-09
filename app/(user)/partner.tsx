import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  NativeModules,
  Image,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { doc, onSnapshot, getDoc, updateDoc, collection, query, orderBy, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/config/firebase';
import { useAuth } from '@/hooks/useAuth';
import { sendPartnerMessage, sendImageMessage, linkPartner, unlinkPartner } from '@/services/partner';
import { uploadChatImage } from '@/services/uploadImage';
import type { AppUser, Message, NotificationItem } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_WIDTH = SCREEN_WIDTH / 3;
const { PookieModule } = NativeModules;

type Tab = 'chat' | 'notifs' | 'connect';

interface ChatMessage extends Message {
  isMine: boolean;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function PartnerScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('chat');
  const [partnerProfile, setPartnerProfile] = useState<AppUser | null>(null);
  const [sent, setSent] = useState<Message[]>([]);
  const [received, setReceived] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifInput, setNotifInput] = useState('');
  const [partnerIdInput, setPartnerIdInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const [sendingNotif, setSendingNotif] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [linking, setLinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [partnerLastSeen, setPartnerLastSeen] = useState(0);
  const underlineAnim = useRef(new Animated.Value(0)).current;
  const chatListRef = useRef<FlatList>(null);
  const isChatTabRef = useRef(true);
  const receivedInitialRef = useRef(true);
  const prevReceivedCountRef = useRef(0);

  const TABS: Tab[] = ['chat', 'notifs', 'connect'];

  function animateTab(t: Tab) {
    const idx = TABS.indexOf(t);
    isChatTabRef.current = t === 'chat';
    if (t === 'chat' && user?.uid) {
      updateDoc(doc(db, 'users', user.uid), { lastSeenChat: Date.now() }).catch(() => {});
    }
    Animated.spring(underlineAnim, { toValue: idx, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
    setTab(t);
  }

  useEffect(() => {
    if (!user?.uid) return;

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as AppUser;
      if (data.partnerId) {
        const ps = await getDoc(doc(db, 'users', data.partnerId));
        if (ps.exists()) setPartnerProfile(ps.data() as AppUser);
      } else {
        setPartnerProfile(null);
      }
    });

    const unsubSent = onSnapshot(
      query(collection(db, 'userMessages', user.uid, 'sent'), orderBy('sentAt', 'desc'), limit(50)),
      (snap) => setSent(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)))
    );

    const unsubReceived = onSnapshot(
      query(collection(db, 'userMessages', user.uid, 'received'), orderBy('sentAt', 'desc'), limit(50)),
      async (snap) => {
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
        setReceived(msgs);

        if (msgs.length > 0) {
          PookieModule?.saveMessage?.(msgs[0].text, msgs[0].fromName, msgs[0].sentAt);
        }

        if (isChatTabRef.current && user?.uid) {
          updateDoc(doc(db, 'users', user.uid), { lastSeenChat: Date.now() }).catch(() => {});
        }

        if (!receivedInitialRef.current && msgs.length > prevReceivedCountRef.current) {
          const latest = msgs[0];
          if (!isChatTabRef.current) {
            await Notifications.scheduleNotificationAsync({
              content: { title: latest.fromName, body: latest.text, sound: true },
              trigger: null,
            });
          }
        }
        receivedInitialRef.current = false;
        prevReceivedCountRef.current = msgs.length;
      }
    );

    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications', user.uid, 'received'), orderBy('sentAt', 'desc'), limit(50)),
      (snap) => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationItem)))
    );

    return () => { unsubUser(); unsubSent(); unsubReceived(); unsubNotifs(); };
  }, [user?.uid]);

  useEffect(() => {
    if (!partnerProfile?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', partnerProfile.uid), (snap) => {
      if (snap.exists()) setPartnerLastSeen(snap.data().lastSeenChat ?? 0);
    });
    return unsub;
  }, [partnerProfile?.uid]);

  const chatMessages: ChatMessage[] = [
    ...sent.map(m => ({ ...m, isMine: true })),
    ...received.map(m => ({ ...m, isMine: false })),
  ].sort((a, b) => a.sentAt - b.sentAt);

  async function handleCopyId() {
    await Clipboard.setStringAsync(user?.uid ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLink() {
    if (!partnerIdInput.trim() || !user) return;
    if (partnerIdInput.trim() === user.uid) {
      Alert.alert('nope 😭', "you can't link to yourself");
      return;
    }
    setLinking(true);
    try {
      const ok = await linkPartner(user.uid, partnerIdInput.trim());
      if (ok) setPartnerIdInput('');
      else Alert.alert('not found', "no user found with that id.");
    } catch {
      Alert.alert('error', 'something went wrong.');
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    if (!user || !partnerProfile) return;
    Alert.alert('unlink?', `disconnect from ${partnerProfile.displayName}?`, [
      { text: 'cancel', style: 'cancel' },
      { text: 'unlink', style: 'destructive', onPress: () => unlinkPartner(user.uid, partnerProfile.uid).catch(() => {}) },
    ]);
  }

  async function handleSend() {
    if (!messageInput.trim() || !user || !partnerProfile) return;
    setSending(true);
    try {
      await sendPartnerMessage(user.uid, user.displayName, partnerProfile.uid, messageInput.trim());
      setMessageInput('');
    } catch {
      Alert.alert('error', 'failed to send.');
    } finally {
      setSending(false);
    }
  }

  async function handlePickImage() {
    if (!user || !partnerProfile) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.75,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setSendingImage(true);
    try {
      const url = await uploadChatImage(user.uid, result.assets[0].uri);
      await sendImageMessage(user.uid, user.displayName, partnerProfile.uid, url);
    } catch {
      Alert.alert('error', 'failed to send image.');
    } finally {
      setSendingImage(false);
    }
  }

  async function handleSendNotification() {
    if (!notifInput.trim() || !user || !partnerProfile) return;
    setSendingNotif(true);
    try {
      const functions = getFunctions(undefined, 'us-central1');
      const fn = httpsCallable(functions, 'sendPartnerNotification');
      await fn({ title: notifTitle.trim() || undefined, body: notifInput.trim() });
      setNotifTitle('');
      setNotifInput('');
      setShowCompose(false);
    } catch {
      Alert.alert('error', 'failed to send notification.');
    } finally {
      setSendingNotif(false);
    }
  }

  const translateX = underlineAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, TAB_WIDTH, TAB_WIDTH * 2],
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <Text style={styles.headerTitle}>talktou</Text>
          <Text style={styles.headerSub}>
            {partnerProfile ? `with ${partnerProfile.displayName}` : 'find your person'}
          </Text>
          <View style={styles.tabBar}>
            {TABS.map((t) => (
              <TouchableOpacity key={t} style={styles.tabItem} onPress={() => animateTab(t)}>
                <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
            <Animated.View style={[styles.tabUnderline, { transform: [{ translateX }] }]} />
          </View>
        </SafeAreaView>

        {tab === 'chat' && (
          <View style={{ flex: 1 }}>
            <FlatList
              ref={chatListRef}
              data={chatMessages}
              keyExtractor={(item) => item.id ?? String(item.sentAt)}
              contentContainerStyle={styles.chatContent}
              onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: false })}
              ListEmptyComponent={
                <EmptyState
                  text={partnerProfile ? 'say something 💬' : 'link your person first'}
                  sub={partnerProfile ? 'your messages will appear here' : 'go to the connect tab'}
                />
              }
              renderItem={({ item }) => (
                <View style={[styles.bubbleRow, item.isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
                  {item.type === 'image' && item.imageUrl ? (
                    <View>
                      <TouchableOpacity activeOpacity={0.9} onPress={() => setLightboxUri(item.imageUrl!)}>
                        <Image source={{ uri: item.imageUrl }} style={styles.imageBubble} resizeMode="cover" />
                      </TouchableOpacity>
                      <View style={styles.bubbleFooter}>
                        <Text style={[styles.bubbleTime, item.isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                          {timeAgo(item.sentAt)}
                        </Text>
                        {item.isMine && (
                          <Text style={[styles.tick, item.sentAt <= partnerLastSeen && styles.tickSeen]}>
                            {item.sentAt <= partnerLastSeen ? '✓✓' : '✓'}
                          </Text>
                        )}
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.bubble, item.isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      <Text style={[styles.bubbleText, item.isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                        {item.text}
                      </Text>
                      <View style={styles.bubbleFooter}>
                        <Text style={[styles.bubbleTime, item.isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                          {timeAgo(item.sentAt)}
                        </Text>
                        {item.isMine && (
                          <Text style={[styles.tick, item.sentAt <= partnerLastSeen && styles.tickSeen]}>
                            {item.sentAt <= partnerLastSeen ? '✓✓' : '✓'}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              )}
            />
            {partnerProfile && (
              <View style={styles.inputBar}>
                <TouchableOpacity
                  style={[styles.imageFab, sendingImage && styles.sendFabDisabled]}
                  onPress={handlePickImage}
                  disabled={sendingImage}
                >
                  {sendingImage
                    ? <ActivityIndicator color="#6C63FF" size="small" />
                    : <Text style={styles.imageFabText}>🖼</Text>}
                </TouchableOpacity>
                <TextInput
                  style={styles.chatInput}
                  placeholder="say something..."
                  placeholderTextColor="#334155"
                  value={messageInput}
                  onChangeText={setMessageInput}
                  multiline
                  maxLength={120}
                />
                <TouchableOpacity
                  style={[styles.sendFab, (!messageInput.trim() || sending) && styles.sendFabDisabled]}
                  onPress={handleSend}
                  disabled={!messageInput.trim() || sending}
                >
                  {sending ? <ActivityIndicator color="#F7F6F2" size="small" /> : <Text style={styles.sendFabText}>→</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {tab === 'notifs' && (
          <View style={{ flex: 1 }}>
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id ?? String(item.sentAt)}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={
                partnerProfile ? (
                  <View style={styles.composeWrapper}>
                    {!showCompose ? (
                      <TouchableOpacity style={styles.composeToggle} onPress={() => setShowCompose(true)}>
                        <Text style={styles.composeToggleText}>+ send notification</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.composeCard}>
                        <Text style={styles.composeCardTitle}>New Notification</Text>
                        <TextInput
                          style={styles.composeTitleInput}
                          placeholder="Title"
                          placeholderTextColor="#475569"
                          value={notifTitle}
                          onChangeText={setNotifTitle}
                          maxLength={60}
                        />
                        <TextInput
                          style={styles.composeBodyInput}
                          placeholder={`Write a message to ${partnerProfile.displayName}...`}
                          placeholderTextColor="#475569"
                          value={notifInput}
                          onChangeText={setNotifInput}
                          maxLength={200}
                          multiline
                          textAlignVertical="top"
                        />
                        <View style={styles.composeActions}>
                          <TouchableOpacity style={styles.composeCancelBtn} onPress={() => { setShowCompose(false); setNotifTitle(''); setNotifInput(''); }}>
                            <Text style={styles.composeCancelText}>cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.composeSendBtn, (!notifInput.trim() || sendingNotif) && styles.sendFabDisabled]}
                            onPress={handleSendNotification}
                            disabled={!notifInput.trim() || sendingNotif}
                          >
                            {sendingNotif
                              ? <ActivityIndicator color="#fff" size="small" />
                              : <Text style={styles.composeSendText}>Send →</Text>}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                ) : null
              }
              ListEmptyComponent={<EmptyState text="no notifications yet" sub="notifications from your partner or admin will appear here" />}
              renderItem={({ item }) => (
                <View style={styles.notifCard}>
                  <View style={styles.notifHeader}>
                    <Text style={[styles.notifFrom, item.type === 'admin' && styles.notifFromAdmin]}>
                      {item.type === 'admin' ? '⚙ ' : '♥ '}{item.title}
                    </Text>
                    <Text style={styles.notifTime}>{timeAgo(item.sentAt)}</Text>
                  </View>
                  <Text style={styles.notifBody}>{item.body}</Text>
                </View>
              )}
            />
          </View>
        )}

        {tab === 'connect' && (
          <FlatList
            data={[]}
            keyExtractor={() => ''}
            renderItem={() => null}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View>
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>your id</Text>
                  <View style={styles.uidRow}>
                    <Text style={styles.uidText} selectable numberOfLines={1}>{user?.uid ?? '—'}</Text>
                    <TouchableOpacity style={[styles.copyBtn, copied && styles.copyBtnDone]} onPress={handleCopyId}>
                      <Text style={styles.copyBtnText}>{copied ? '✓ copied' : 'copy'}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.cardHint}>share this with your person so they can link up</Text>
                </View>

                {partnerProfile ? (
                  <View style={[styles.card, styles.partnerCard]}>
                    <View style={styles.partnerAvatar}>
                      <Text style={styles.partnerAvatarText}>{partnerProfile.displayName[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.partnerName}>{partnerProfile.displayName}</Text>
                      <Text style={styles.partnerEmail}>{partnerProfile.email}</Text>
                    </View>
                    <TouchableOpacity onPress={handleUnlink}>
                      <Text style={styles.unlinkText}>unlink</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.card}>
                    <Text style={styles.cardLabel}>link your person</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="paste their id..."
                      placeholderTextColor="#334155"
                      value={partnerIdInput}
                      onChangeText={setPartnerIdInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={[styles.btn, linking && styles.btnDisabled]}
                      onPress={handleLink}
                      disabled={linking}
                    >
                      {linking ? <ActivityIndicator color="#F7F6F2" size="small" /> : <Text style={styles.btnText}>link up</Text>}
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.guideCard}>
                  <Text style={styles.guideTitle}>add widget to home screen</Text>
                  <Text style={styles.guideText}>long press home screen → + → search talktou → add pookie widget</Text>
                </View>
              </View>
            }
          />
        )}
      </View>

      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <StatusBar hidden />
        <TouchableOpacity style={styles.lightboxBg} activeOpacity={1} onPress={() => setLightboxUri(null)}>
          {lightboxUri && (
            <Image source={{ uri: lightboxUri }} style={styles.lightboxImage} resizeMode="contain" />
          )}
          <Text style={styles.lightboxClose}>✕</Text>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function EmptyState({ text, sub }: { text: string; sub: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{text}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D14' },
  header: {
    backgroundColor: '#141420',
    paddingHorizontal: 24,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: { fontSize: 13, fontWeight: '700', color: '#6C63FF', letterSpacing: 2, textTransform: 'uppercase', marginTop: 8 },
  headerSub: { fontSize: 20, fontWeight: '700', color: '#F7F6F2', marginTop: 4, marginBottom: 20 },
  tabBar: { flexDirection: 'row', position: 'relative' },
  tabItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabLabel: { fontSize: 13, color: '#475569', fontWeight: '600', textTransform: 'capitalize' },
  tabLabelActive: { color: '#F7F6F2' },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    width: '33.33%',
    height: 2,
    backgroundColor: '#6C63FF',
    borderRadius: 2,
  },
  chatContent: { padding: 16, paddingBottom: 24 },
  bubbleRow: { marginBottom: 6, flexDirection: 'row' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: '#6C63FF', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#1E293B', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextMine: { color: '#F7F6F2' },
  bubbleTextTheirs: { color: '#CBD5E1' },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  bubbleTime: { fontSize: 10 },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.5)' },
  bubbleTimeTheirs: { color: '#475569' },
  tick: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  tickSeen: { color: '#93C5FD' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#141420',
    gap: 10,
  },
  chatInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#F7F6F2',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  imageBubble: {
    width: 200, height: 200, borderRadius: 16,
    overflow: 'hidden',
  },
  imageFab: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(108,99,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  imageFabText: { fontSize: 18 },
  sendFab: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center',
  },
  sendFabDisabled: { opacity: 0.4 },
  sendFabText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  composeWrapper: { marginBottom: 16 },
  composeToggle: {
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.3)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(108,99,255,0.06)',
  },
  composeToggleText: { color: '#6C63FF', fontSize: 14, fontWeight: '600' },
  composeCard: {
    backgroundColor: '#141420',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.2)',
    gap: 10,
  },
  composeCardTitle: { color: '#F7F6F2', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  composeTitleInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: '600',
    color: '#F7F6F2',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  composeBodyInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#F7F6F2',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 100,
  },
  composeActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 2 },
  composeCancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  composeCancelText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  composeSendBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: '#6C63FF' },
  composeSendText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  notifCard: {
    backgroundColor: '#141420',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  notifFrom: { fontSize: 12, fontWeight: '700', color: '#6C63FF' },
  notifFromAdmin: { color: '#94A3B8' },
  notifTime: { fontSize: 11, color: '#334155' },
  notifBody: { fontSize: 14, color: '#CBD5E1', lineHeight: 20 },
  listContent: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: '#141420', borderRadius: 18, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardLabel: { fontSize: 11, color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  cardHint: { fontSize: 12, color: '#334155', marginTop: 8 },
  uidRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uidText: {
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11, color: '#6C63FF',
    backgroundColor: 'rgba(108,99,255,0.08)', padding: 10, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(108,99,255,0.15)',
  },
  copyBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
  },
  copyBtnDone: { borderColor: '#4CAF7D', backgroundColor: 'rgba(76,175,125,0.08)' },
  copyBtnText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#F7F6F2',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 12,
  },
  btn: { backgroundColor: '#6C63FF', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#F7F6F2', fontSize: 14, fontWeight: '700' },
  partnerCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  partnerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center',
  },
  partnerAvatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  partnerName: { fontSize: 15, fontWeight: '700', color: '#F7F6F2' },
  partnerEmail: { fontSize: 12, color: '#475569', marginTop: 2 },
  unlinkText: { fontSize: 12, color: '#475569' },
  guideCard: {
    backgroundColor: 'rgba(108,99,255,0.06)', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(108,99,255,0.12)',
  },
  guideTitle: { fontSize: 12, fontWeight: '700', color: '#6C63FF', marginBottom: 6 },
  guideText: { fontSize: 12, color: '#475569', lineHeight: 18 },
  empty: { paddingTop: 80, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155' },
  emptySub: { fontSize: 13, color: '#1E293B', textAlign: 'center' },
  lightboxBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center', justifyContent: 'center',
  },
  lightboxImage: { width: '100%', height: '100%' },
  lightboxClose: {
    position: 'absolute', top: 56, right: 24,
    color: '#fff', fontSize: 22, fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
});
