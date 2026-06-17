import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ref, listAll, getDownloadURL, getMetadata, deleteObject } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { storage } from '@/config/firebase';

const { width } = Dimensions.get('window');
const THUMB_SIZE = (width - 4) / 3;

interface MediaItem {
  name: string;
  url: string;
  contentType: string;
  size: number;
  createdAt: string;
}

export default function UserMediaScreen() {
  const { uid, name } = useLocalSearchParams<{ uid: string; name: string }>();
  const router = useRouter();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [dlProgress, setDlProgress] = useState<{ done: number; total: number; skipped: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadMedia();
  }, [uid]);

  async function loadMedia() {
    setLoading(true);
    try {
      const folderRef = ref(storage, `backups/${uid}`);
      const { items: allItems } = await listAll(folderRef);

      const metas = await Promise.all(allItems.map(item => getMetadata(item)));
      metas.sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime());
      const top40 = metas.slice(0, 40);

      const items = await Promise.all(
        top40.map(async (meta) => {
          const itemRef = ref(storage, meta.fullPath);
          const url = await getDownloadURL(itemRef);
          return {
            name: meta.name,
            url,
            contentType: meta.contentType ?? 'image/jpeg',
            size: meta.size ?? 0,
            createdAt: meta.timeCreated ?? '',
          };
        })
      );

      setMedia(items);
    } catch {
      Alert.alert('Error', 'Failed to load backed up media.');
    } finally {
      setLoading(false);
    }
  }

  async function downloadAll() {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow media library access to save files to your device.');
      return;
    }

    setDownloading(true);
    setDlProgress(null);

    try {
      const folderRef = ref(storage, `backups/${uid}`);
      const { items } = await listAll(folderRef);

      const metas = await Promise.all(items.map(item => getMetadata(item)));
      const MAX = 200 * 1024 * 1024;
      const toDownload = metas.filter(m => m.size <= MAX);
      const skipped = metas.length - toDownload.length;

      setDlProgress({ done: 0, total: toDownload.length, skipped });

      let done = 0;
      for (const meta of toDownload) {
        try {
          const url = await getDownloadURL(ref(storage, meta.fullPath));
          const localUri = FileSystem.cacheDirectory + meta.name;
          await FileSystem.downloadAsync(url, localUri);
          await MediaLibrary.saveToLibraryAsync(localUri);
          await FileSystem.deleteAsync(localUri, { idempotent: true });
          done++;
          setDlProgress({ done, total: toDownload.length, skipped });
        } catch {
          // skip individual failures
        }
      }

      Alert.alert(
        'Download complete',
        `Saved ${done} of ${toDownload.length} files to your camera roll.${skipped > 0 ? `\nSkipped ${skipped} file${skipped > 1 ? 's' : ''} over 200 MB.` : ''}`
      );
    } catch {
      Alert.alert('Error', 'Something went wrong during download.');
    } finally {
      setDownloading(false);
      setDlProgress(null);
    }
  }

  function confirmDeleteAll() {
    Alert.alert(
      'Delete all media?',
      `This will permanently delete every backed up file for ${name ?? 'this user'} from storage. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete All', style: 'destructive', onPress: runDeleteAll },
      ]
    );
  }

  async function runDeleteAll() {
    setDeleting(true);
    try {
      const folderRef = ref(storage, `backups/${uid}`);
      const { items } = await listAll(folderRef);
      await Promise.all(items.map(item => deleteObject(item)));
      setMedia([]);
      Alert.alert('Done', `Deleted ${items.length} file${items.length !== 1 ? 's' : ''}.`);
    } catch {
      Alert.alert('Error', 'Failed to delete all files.');
    } finally {
      setDeleting(false);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderItem({ item }: { item: MediaItem }) {
    const isVideo = item.contentType.startsWith('video');
    return (
      <TouchableOpacity style={styles.thumb} onPress={() => setSelected(item)} activeOpacity={0.8}>
        <Image source={{ uri: item.url }} style={styles.thumbImage} resizeMode="cover" />
        {isVideo && (
          <View style={styles.videoOverlay}>
            <Text style={styles.videoIcon}>▶</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{name ?? 'User'}'s Backup</Text>
          <Text style={styles.headerSub}>showing latest {media.length} item{media.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          style={[styles.dlBtn, downloading && styles.dlBtnDisabled]}
          onPress={downloadAll}
          disabled={downloading || deleting}
        >
          {downloading && dlProgress ? (
            <Text style={styles.dlBtnText}>{dlProgress.done}/{dlProgress.total}</Text>
          ) : downloading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.dlBtnText}>⬇ All</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.delBtn, deleting && styles.dlBtnDisabled]}
          onPress={confirmDeleteAll}
          disabled={deleting || downloading}
        >
          {deleting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.dlBtnText}>🗑 All</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Loading backed up media...</Text>
        </View>
      ) : media.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={styles.emptyTitle}>No backups yet</Text>
          <Text style={styles.emptySub}>No media has been backed up for this user.</Text>
        </View>
      ) : (
        <FlatList
          data={media}
          keyExtractor={(item) => item.name}
          renderItem={renderItem}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{ paddingBottom: 20 }}
          onRefresh={loadMedia}
          refreshing={loading}
        />
      )}

      <Modal visible={!!selected} animationType="fade" statusBarTranslucent>
        <View style={styles.modal}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modalName} numberOfLines={1}>{selected?.name}</Text>
                <Text style={styles.modalMeta}>
                  {selected ? formatSize(selected.size) : ''} •{' '}
                  {selected?.createdAt ? new Date(selected.createdAt).toLocaleDateString() : ''}
                </Text>
              </View>
            </View>
            {selected && (
              <Image source={{ uri: selected.url }} style={styles.fullImage} resizeMode="contain" />
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    backgroundColor: '#1a1a2e', paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: { paddingRight: 8 },
  backText: { color: '#a5b4fc', fontSize: 15 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#6b7280', fontSize: 14 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  emptySub: { color: '#6b7280', fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  row: { gap: 2 },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, backgroundColor: '#1a1a2e', marginBottom: 2 },
  thumbImage: { width: '100%', height: '100%' },
  dlBtn: {
    backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 8, minWidth: 64, alignItems: 'center', justifyContent: 'center',
  },
  dlBtnDisabled: { opacity: 0.6 },
  dlBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  delBtn: {
    backgroundColor: '#991b1b', borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 8, minWidth: 64, alignItems: 'center', justifyContent: 'center',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
  },
  videoIcon: { fontSize: 24, color: '#fff' },
  modal: { flex: 1, backgroundColor: '#000' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 20, paddingBottom: 16, backgroundColor: '#111',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center',
  },
  closeText: { color: '#fff', fontSize: 16 },
  modalName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modalMeta: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  fullImage: { flex: 1, width: '100%' },
});
