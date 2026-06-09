import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { AppUser, UserRole } from '../types';

export async function register(
  email: string,
  password: string,
  displayName: string,
  role: UserRole = 'user'
): Promise<AppUser> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });

  const user: AppUser = {
    uid: cred.user.uid,
    email,
    displayName,
    role,
    partnerId: null,
    createdAt: Date.now(),
  };

  await setDoc(doc(db, 'users', cred.user.uid), user);
  return user;
}

export async function login(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function fetchUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as AppUser;
}
