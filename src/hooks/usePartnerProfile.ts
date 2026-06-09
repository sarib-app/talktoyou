import { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './useAuth';
import type { AppUser } from '../types';

export function usePartnerProfile(): AppUser | null {
  const { user } = useAuth();
  const [partner, setPartner] = useState<AppUser | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    return onSnapshot(doc(db, 'users', user.uid), async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.partnerId) {
        const ps = await getDoc(doc(db, 'users', data.partnerId));
        if (ps.exists()) setPartner(ps.data() as AppUser);
      } else {
        setPartner(null);
      }
    });
  }, [user?.uid]);

  return partner;
}
