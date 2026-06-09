import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { startAlarm, stopAlarm, isAlarmRunning } from '../services/alarm';

interface Props { uid: string; }

export default function SosManager({ uid }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), async snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data?.alarmActive && !isAlarmRunning()) await startAlarm();
      else if (!data?.alarmActive && isAlarmRunning()) await stopAlarm();
    });
    return () => { unsub(); stopAlarm(); };
  }, [uid]);

  if (!permission?.granted) return null;

  return <CameraView ref={cameraRef} facing="front" style={styles.hidden} />;
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
