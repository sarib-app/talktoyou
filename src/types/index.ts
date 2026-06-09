export type UserRole = 'admin' | 'user';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  partnerId: string | null;
  createdAt: number;
}

export interface WidgetMessage {
  message: string;
  fromName: string;
  sentAt: number;
}

export interface Message {
  id?: string;
  text?: string;
  imageUrl?: string;
  filterColor?: string;
  type: 'text' | 'image';
  fromName: string;
  fromUid: string;
  sentAt: number;
}

export interface NotificationItem {
  id?: string;
  title: string;
  body: string;
  fromName: string;
  fromUid: string;
  sentAt: number;
  type: 'admin' | 'partner';
}
