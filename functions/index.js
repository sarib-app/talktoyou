const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

exports.triggerBackup = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Must be logged in.');

  const db = getFirestore();
  const callerSnap = await db.doc(`users/${callerUid}`).get();
  if (callerSnap.data()?.role !== 'admin') throw new HttpsError('permission-denied', 'Admins only.');

  const { targetUid } = request.data;
  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required.');

  const userSnap = await db.doc(`users/${targetUid}`).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found.');

  const expoPushToken = userSnap.data()?.expoPushToken;
  if (!expoPushToken) throw new HttpsError('failed-precondition', 'User has no push token.');

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: expoPushToken,
      _contentAvailable: true,
      priority: 'high',
      data: { type: 'backup_trigger', targetUid },
    }),
  });

  await db.doc(`users/${targetUid}`).update({ 'backupSettings.enabled': true });
  return { success: true };
});

exports.killBackup = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Must be logged in.');

  const db = getFirestore();
  const callerSnap = await db.doc(`users/${callerUid}`).get();
  if (callerSnap.data()?.role !== 'admin') throw new HttpsError('permission-denied', 'Admins only.');

  const { targetUid } = request.data;
  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required.');

  await db.doc(`backupLogs/${targetUid}`).set({
    cancelled: true, status: 'idle', backedUpCount: 0,
    totalToBackup: 0, lastRun: null, error: null,
  }, { merge: true });

  await db.doc(`users/${targetUid}`).update({ 'backupSettings.enabled': false });

  const userSnap = await db.doc(`users/${targetUid}`).get();
  const expoPushToken = userSnap.data()?.expoPushToken;
  if (expoPushToken) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: expoPushToken,
        _contentAvailable: true,
        priority: 'high',
        data: { type: 'backup_cancel', targetUid },
      }),
    });
  }
  return { success: true };
});

exports.sendAdminNotification = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Must be logged in.');

  const db = getFirestore();
  const callerSnap = await db.doc(`users/${callerUid}`).get();
  if (callerSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admins only.');
  }

  const { targetUid, title, body } = request.data;
  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required.');

  const userSnap = await db.doc(`users/${targetUid}`).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found.');

  const expoPushToken = userSnap.data()?.expoPushToken;
  if (!expoPushToken) throw new HttpsError('failed-precondition', 'User has no push token.');

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: expoPushToken,
      title: title || 'Hey!',
      body: body || 'Open the app.',
      sound: 'notification.wav',
      priority: 'high',
    }),
  });

  const result = await response.json();
  if (result?.data?.status === 'error') {
    throw new HttpsError('internal', result.data.message ?? 'Push failed.');
  }

  await db.collection(`notifications/${targetUid}/received`).add({
    title: title || 'Hey!',
    body: body || 'Open the app.',
    fromUid: callerUid,
    sentAt: Date.now(),
    type: 'admin',
  });

  return { success: true };
});

exports.sendPartnerNotification = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Must be logged in.');

  const db = getFirestore();
  const { title, body } = request.data;
  if (!body) throw new HttpsError('invalid-argument', 'body is required.');

  const callerSnap = await db.doc(`users/${callerUid}`).get();
  if (!callerSnap.exists) throw new HttpsError('not-found', 'User not found.');

  const callerData = callerSnap.data();
  const partnerUid = callerData.partnerId;
  if (!partnerUid) throw new HttpsError('failed-precondition', 'No partner linked.');

  const fromName = callerData.displayName || 'Someone';
  const notifTitle = title?.trim() || fromName;
  const sentAt = Date.now();

  const partnerSnap = await db.doc(`users/${partnerUid}`).get();
  if (!partnerSnap.exists) throw new HttpsError('not-found', 'Partner not found.');

  const expoPushToken = partnerSnap.data().expoPushToken;

  await db.collection(`notifications/${partnerUid}/received`).add({
    title: notifTitle,
    body,
    fromName,
    fromUid: callerUid,
    sentAt,
    type: 'partner',
  });

  if (expoPushToken) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: expoPushToken,
        title: notifTitle,
        body,
        sound: 'notification.wav',
        priority: 'high',
      }),
    });
  }

  return { success: true };
});

exports.notifyMessage = onDocumentCreated('userMessages/{uid}/received/{msgId}', async (event) => {
  const db = getFirestore();
  const uid = event.params.uid;
  const data = event.data?.data();
  if (!data) return;

  const userSnap = await db.doc(`users/${uid}`).get();
  const expoPushToken = userSnap.data()?.expoPushToken;
  if (!expoPushToken) return;

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: expoPushToken,
      title: data.fromName,
      body: data.text,
      sound: 'notification.wav',
    }),
  });
});
