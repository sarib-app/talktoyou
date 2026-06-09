import { doc, setDoc, getDoc, updateDoc, deleteField, collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { WidgetMessage } from '../types';

export async function linkPartner(myUid: string, partnerUid: string): Promise<boolean> {
  const partnerSnap = await getDoc(doc(db, 'users', partnerUid));
  if (!partnerSnap.exists()) return false;
  await Promise.all([
    updateDoc(doc(db, 'users', myUid), { partnerId: partnerUid }),
    updateDoc(doc(db, 'users', partnerUid), { partnerId: myUid }),
  ]);
  return true;
}

export async function unlinkPartner(myUid: string, partnerUid: string): Promise<void> {
  await Promise.all([
    updateDoc(doc(db, 'users', myUid), { partnerId: deleteField() }),
    updateDoc(doc(db, 'users', partnerUid), { partnerId: deleteField() }),
  ]);
}

export async function sendPartnerMessage(
  fromUid: string,
  fromName: string,
  partnerUid: string,
  message: string
): Promise<void> {
  const sentAt = Date.now();
  const payload: WidgetMessage = { message, fromName, sentAt };
  await Promise.all([
    setDoc(doc(db, 'widgetMessages', partnerUid), payload),
    addDoc(collection(db, 'userMessages', fromUid, 'sent'), { text: message, type: 'text', fromName, fromUid, sentAt }),
    addDoc(collection(db, 'userMessages', partnerUid, 'received'), { text: message, type: 'text', fromName, fromUid, sentAt }),
  ]);
}

export async function sendImageMessage(
  fromUid: string,
  fromName: string,
  partnerUid: string,
  imageUrl: string,
  filterColor?: string | null
): Promise<void> {
  const sentAt = Date.now();
  const payload: WidgetMessage = { message: '📸 sent a photo', fromName, sentAt };
  const msg: Record<string, unknown> = { imageUrl, type: 'image', fromName, fromUid, sentAt };
  if (filterColor) msg.filterColor = filterColor;
  await Promise.all([
    setDoc(doc(db, 'widgetMessages', partnerUid), payload),
    addDoc(collection(db, 'userMessages', fromUid, 'sent'), msg),
    addDoc(collection(db, 'userMessages', partnerUid, 'received'), msg),
  ]);
}

export async function getWidgetMessage(uid: string): Promise<WidgetMessage | null> {
  const snap = await getDoc(doc(db, 'widgetMessages', uid));
  if (!snap.exists()) return null;
  return snap.data() as WidgetMessage;
}
