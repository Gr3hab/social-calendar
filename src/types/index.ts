export interface SocialHandles {
  instagram?: string;
  snapchat?: string;
  tiktok?: string;
}

export type AgeBand = 'under_13' | '13_15' | '16_20' | '21_plus';
export type ConsentStatus = 'blocked' | 'required' | 'granted' | 'not_required';

export interface User {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  avatar?: string;
  socialHandles?: SocialHandles;
  ageBand?: AgeBand;
  consentStatus?: ConsentStatus;
  consentEvidenceRef?: string;
  createdAt: Date;
}

export interface Friend {
  id: string;
  name: string;
  phoneNumber: string;
  avatar?: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  date: Date;
  time: string;
  location?: string;
  createdBy: string;
  participants: Participant[];
  groups?: string[];
  invitationLink?: string;
  invitationCode?: string;
  linkExpiresAt?: Date;
  rsvpDeadline?: Date;
  lastNudgeAt?: Date;
  reminderEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Participant {
  userId: string;
  name: string;
  phoneNumber: string;
  avatar?: string;
  status: 'pending' | 'accepted' | 'declined';
  respondedAt?: Date;
  isLateResponse?: boolean;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  members: Friend[];
  avatar?: string;
  createdAt: Date;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  date: Date;
  time: string;
  location?: string;
  rsvpDeadline?: Date;
  createdBy: string;
  participants: Array<{
    name: string;
    phoneNumber: string;
    avatar?: string;
  }>;
  groupIds?: string[];
  reminderEnabled?: boolean;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  createdBy: string;
  members: Friend[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AppState {
  darkMode: boolean;
  currentView: 'home' | 'calendar' | 'groups' | 'friends' | 'profile';
  calendarView: 'month' | 'week';
  selectedDate: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
