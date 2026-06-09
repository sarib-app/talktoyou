import { useState, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { usePartnerProfile } from '@/hooks/usePartnerProfile';
import { uploadSnapImage } from '@/services/uploadImage';
import { sendImageMessage } from '@/services/partner';

const { width: W, height: H } = Dimensions.get('window');

const FILTERS = [
  { id: 'none',  label: 'none',   color: null },
  { id: 'warm',  label: 'warm',   color: 'rgba(255,140,0,0.22)' },
  { id: 'cool',  label: 'cool',   color: 'rgba(40,140,255,0.22)' },
  { id: 'rose',  label: 'rose',   color: 'rgba(255,80,130,0.22)' },
  { id: 'dusk',  label: 'dusk',   color: 'rgba(110,40,200,0.22)' },
  { id: 'night', label: 'night',  color: 'rgba(0,20,80,0.35)' },
  { id: 'glow',  label: 'glow',   color: 'rgba(255,250,240,0.35)' },
];

type Stage = 'live' | 'preview' | 'sending' | 'sent';

export default function CameraScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const partner = usePartnerProfile();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [filter, setFilter] = useState(FILTERS[0]);
  const [stage, setStage] = useState<Stage>('live');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [frontCapture, setFrontCapture] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [isFocused, setIsFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => setIsFocused(true), 600);
      return () => {
        clearTimeout(timer);
        setIsFocused(false);
      };
    }, [])
  );

  if (!permission) return <View style={styles.bg} />;

  if (!permission.granted) {
    return (
      <View style={styles.permContainer}>
        <SafeAreaView edges={['top']} />
        <Text style={styles.permTitle}>camera access needed</Text>
        <Text style={styles.permSub}>to send snaps to your person</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>allow camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function handleCapture() {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.75 });
    if (photo?.uri) {
      setFrontCapture(facing === 'front');
      setPhotoUri(photo.uri);
      setStage('preview');
    }
  }

  async function handleSend() {
    if (!photoUri || !user || !partner) return;
    setStage('sending');
    try {
      const url = await uploadSnapImage(user.uid, photoUri);
      await sendImageMessage(user.uid, user.displayName, partner.uid, url, filter.color);
      setStage('sent');
      setTimeout(() => {
        setPhotoUri(null);
        setStage('live');
      }, 1500);
    } catch {
      setStage('preview');
    }
  }

  function handleRetake() {
    setPhotoUri(null);
    setStage('live');
  }

  return (
    <View style={styles.bg}>
      {stage === 'live' && (
        <>
          {isFocused && <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />}
          {filter.color && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: filter.color }]} pointerEvents="none" />
          )}

          <SafeAreaView edges={['top']} style={styles.topBar}>
            <Text style={styles.snapLabel}>snap</Text>
            {!partner && (
              <Text style={styles.noPartnerBadge}>link a partner to send snaps</Text>
            )}
          </SafeAreaView>

          <View style={styles.filterStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setFilter(f)}
                  style={[styles.filterChip, filter.id === f.id && styles.filterChipActive]}
                >
                  {f.color && (
                    <View style={[styles.filterDot, { backgroundColor: f.color.replace('0.22', '1').replace('0.35', '1') }]} />
                  )}
                  <Text style={[styles.filterLabel, filter.id === f.id && styles.filterLabelActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity style={styles.flipBtn} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
              <Text style={styles.flipText}>⟳</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.shutterOuter, !partner && styles.shutterDisabled]}
              onPress={handleCapture}
              disabled={!partner}
            >
              <View style={styles.shutterInner} />
            </TouchableOpacity>
            <View style={{ width: 52 }} />
          </View>
        </>
      )}

      {(stage === 'preview' || stage === 'sending' || stage === 'sent') && photoUri && (
        <>
          <Image
        source={{ uri: photoUri }}
        style={[StyleSheet.absoluteFill, frontCapture && { transform: [{ scaleX: -1 }] }]}
        resizeMode="cover"
      />
          {filter.color && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: filter.color }]} pointerEvents="none" />
          )}

          {stage === 'preview' && (
            <>
              <SafeAreaView edges={['top']} style={styles.topBar}>
                <TouchableOpacity onPress={handleRetake} style={styles.retakeBtn}>
                  <Text style={styles.retakeBtnText}>✕  retake</Text>
                </TouchableOpacity>
              </SafeAreaView>
              <View style={styles.previewBottom}>
                <TouchableOpacity style={styles.sendSnapBtn} onPress={handleSend}>
                  <Text style={styles.sendSnapText}>send to {partner?.displayName ?? 'partner'} →</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {stage === 'sending' && (
            <View style={styles.overlay}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={styles.overlayText}>sending...</Text>
            </View>
          )}

          {stage === 'sent' && (
            <View style={styles.overlay}>
              <Text style={styles.sentCheck}>✓</Text>
              <Text style={styles.overlayText}>sent!</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: 'center',
  },
  snapLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 2, textTransform: 'uppercase' },
  noPartnerBadge: {
    marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  filterStrip: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
  },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  filterDot: { width: 10, height: 10, borderRadius: 5 },
  filterLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  filterLabelActive: { color: '#fff' },
  controls: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    paddingHorizontal: 40,
  },
  flipBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  flipText: { fontSize: 24, color: '#fff' },
  shutterOuter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: { opacity: 0.4 },
  shutterInner: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#fff',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  retakeBtn: {
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  retakeBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  previewBottom: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  sendSnapBtn: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 32, paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#6C63FF',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  sendSnapText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  overlayText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sentCheck: { fontSize: 52, color: '#fff' },
  permContainer: {
    flex: 1, backgroundColor: '#0D0D14',
    alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12,
  },
  permTitle: { fontSize: 20, fontWeight: '700', color: '#F7F6F2' },
  permSub: { fontSize: 14, color: '#475569', textAlign: 'center' },
  permBtn: {
    marginTop: 16, backgroundColor: '#6C63FF',
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16,
  },
  permBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
