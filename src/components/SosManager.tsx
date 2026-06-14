import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { startAlarm, stopAlarm, isAlarmRunning } from '../services/alarm';

interface Props { uid: string; }

export default function SosManager({ uid }: Props) {
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

  return null;
}
