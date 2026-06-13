import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from './src/config/firebase';
import { BACKUP_TASK, runBackup } from './src/services/backup';
import type { BackupSettings } from './src/types';
import 'expo-router/entry';

TaskManager.defineTask(BACKUP_TASK, async () => {
  try {
    await new Promise(r => setTimeout(r, 2000));
    const uid = auth.currentUser?.uid;
    if (!uid) return BackgroundFetch.BackgroundFetchResult.NoData;

    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) return BackgroundFetch.BackgroundFetchResult.NoData;

    const settings = userSnap.data().backupSettings as BackupSettings | null;
    if (!settings?.enabled) return BackgroundFetch.BackgroundFetchResult.NoData;

    await runBackup(uid, settings);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});
