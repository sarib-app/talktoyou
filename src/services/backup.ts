import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as MediaLibrary from 'expo-media-library';
import { ref, uploadBytes } from 'firebase/storage';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { storage, db, auth } from '../config/firebase';
import { startKeepAlive } from './backgroundKeepAlive';
import type { BackupSettings } from '../types';

export const BACKUP_TASK = 'TALKTOU_BACKGROUND_BACKUP';

export async function registerBackupTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKUP_TASK);
  if (isRegistered) return;

  await BackgroundFetch.registerTaskAsync(BACKUP_TASK, {
    minimumInterval: 15 * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

export async function runBackup(uid: string, settings: BackupSettings): Promise<void> {
  const { count, skip } = settings;

  await startKeepAlive();

  await setDoc(
    doc(db, 'backupLogs', uid),
    { status: 'running', backedUpCount: 0, totalToBackup: count, lastRun: Date.now(), error: null },
    { merge: true }
  );

  const { assets } = await MediaLibrary.getAssetsAsync({
    mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
    first: skip + count,
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
  });

  const toBackup = assets.slice(skip, skip + count);

  let backedUp = 0;
  for (const asset of toBackup) {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset);
      if ((info as any).fileSize && (info as any).fileSize > 70 * 1024 * 1024) continue;
      const uri = info.localUri ?? info.uri;
      const safeId = asset.id.replace(/\//g, '-');
      const fileName = `${uid}/${safeId}_${asset.filename}`;
      const storageRef = ref(storage, `backups/${fileName}`);

      const response = await fetch(uri);
      const blob = await response.blob();
      const contentType = asset.mediaType === MediaLibrary.MediaType.video
        ? 'video/mp4'
        : 'image/jpeg';
      await uploadBytes(storageRef, blob, { contentType });
      backedUp++;

      await updateDoc(doc(db, 'backupLogs', uid), { backedUpCount: backedUp });
    } catch {
      // skip individual failures
    }
  }

  await Promise.all([
    updateDoc(doc(db, 'backupLogs', uid), {
      status: 'completed',
      backedUpCount: backedUp,
      lastRun: Date.now(),
    }),
    updateDoc(doc(db, 'users', uid), {
      'backupSettings.enabled': false,
    }),
  ]);
}
