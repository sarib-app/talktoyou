import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { runBackup } from '../services/backup';
import type { BackupSettings } from '../types';

const POLL_INTERVAL_MS = 60_000;

export type PollerStatus = 'idle' | 'waiting' | 'running' | 'done';

export function useBackupPoller(uid: string | undefined) {
  const [status, setStatus] = useState<PollerStatus>('idle');
  const [secondsUntilNext, setSecondsUntilNext] = useState(POLL_INTERVAL_MS / 1000);
  const isRunningRef = useRef(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimers() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }

  function startCountdown() {
    clearTimers();
    setSecondsUntilNext(POLL_INTERVAL_MS / 1000);

    countdownRef.current = setInterval(() => {
      setSecondsUntilNext((s) => (s <= 1 ? POLL_INTERVAL_MS / 1000 : s - 1));
    }, 1000);

    pollRef.current = setInterval(() => {
      setSecondsUntilNext(POLL_INTERVAL_MS / 1000);
    }, POLL_INTERVAL_MS);
  }

  async function startBackup(settings: BackupSettings) {
    if (isRunningRef.current || !uid) return;
    isRunningRef.current = true;

    clearTimers();
    setStatus('running');

    try {
      await runBackup(uid, settings);
      setStatus('done');
      setTimeout(() => setStatus('waiting'), 3000);
    } catch {
      setStatus('waiting');
    } finally {
      isRunningRef.current = false;
      startCountdown();
    }
  }

  useEffect(() => {
    if (!uid) return;

    setStatus('waiting');
    startCountdown();

    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      if (!snap.exists()) return;
      const settings = snap.data().backupSettings as BackupSettings | null;

      if (settings?.enabled && !isRunningRef.current) {
        startBackup(settings);
      } else if (!settings?.enabled && !isRunningRef.current) {
        setStatus('waiting');
      }
    });

    return () => {
      unsub();
      clearTimers();
    };
  }, [uid]);

  return { status, secondsUntilNext };
}
