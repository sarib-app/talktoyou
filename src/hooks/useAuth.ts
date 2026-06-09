import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { AppUser } from '../types';

interface AuthState {
  user: AppUser | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      if (!firebaseUser) {
        setState({ user: null, loading: false });
        return;
      }

      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));

      if (snap.exists()) {
        const data = snap.data();
        const user: AppUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? data.email ?? '',
          displayName: data.displayName ?? firebaseUser.displayName ?? '',
          role: data.role ?? 'user',
          partnerId: data.partnerId ?? null,
          createdAt: data.createdAt ?? Date.now(),
        };
        setState({ user, loading: false });
      } else {
        const user: AppUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          displayName: firebaseUser.displayName ?? 'User',
          role: 'user',
          partnerId: null,
          createdAt: Date.now(),
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), user);
        setState({ user, loading: false });
      }
    });
    return unsub;
  }, []);

  return state;
}
