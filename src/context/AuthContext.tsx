/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { User, AuthState } from '../types';
import { maybeThrowMockFault } from '../services/mockFaults';
import { isApiAuthEnabled, sendCodeApi, verifyCodeApi } from '../services/authApi';
import { featureFlags } from '../config/featureFlags';
import {
  getCurrentProfile,
  isSupabaseConfigured,
  signInWithEmail,
  supabase,
  updateProfile as updateSupabaseProfile,
} from '../lib/supabase';

type AuthAction = 
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGIN_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<User> };

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
};

const MAGIC_LINK_PENDING_EMAIL_KEY = 'auth_magic_link_pending_email';
const SUPABASE_MAGIC_LINK_ENABLED = featureFlags.authMagicLinkOnly && isSupabaseConfigured();

interface MagicLinkRequestResult {
  sent: boolean;
}

function cleanSocialHandle(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

async function mapSupabaseUserToUser(authUser: {
  id: string;
  email?: string;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
}): Promise<User> {
  const profile = await getCurrentProfile().catch(() => null);
  const metadata = authUser.user_metadata ?? {};
  const displayName =
    profile?.display_name?.trim() ||
    (typeof metadata.display_name === 'string' ? metadata.display_name.trim() : '') ||
    (typeof metadata.name === 'string' ? metadata.name.trim() : '') ||
    authUser.email?.split('@')[0] ||
    '';

  const instagram = cleanSocialHandle(
    profile?.instagram_handle ??
      (typeof metadata.instagram === 'string' ? metadata.instagram : undefined),
  );
  const snapchat = cleanSocialHandle(
    profile?.snapchat_handle ??
      (typeof metadata.snapchat === 'string' ? metadata.snapchat : undefined),
  );
  const tiktok = cleanSocialHandle(
    profile?.tiktok_handle ??
      (typeof metadata.tiktok === 'string' ? metadata.tiktok : undefined),
  );

  return {
    id: authUser.id,
    name: displayName,
    phoneNumber: profile?.phone_number ?? '',
    email: authUser.email,
    avatar: profile?.avatar_url ?? undefined,
    socialHandles: {
      ...(instagram ? { instagram } : {}),
      ...(snapchat ? { snapchat } : {}),
      ...(tiktok ? { tiktok } : {}),
    },
    ageBand: '16_20',
    consentStatus: 'not_required',
    createdAt: new Date(authUser.created_at ?? Date.now()),
  };
}

function toProfilePatch(data: Partial<User>) {
  return {
    ...(typeof data.name === 'string' ? { display_name: data.name.trim() } : {}),
    ...(typeof data.phoneNumber === 'string' ? { phone_number: data.phoneNumber.trim() || undefined } : {}),
    ...(typeof data.avatar === 'string' ? { avatar_url: data.avatar.trim() || undefined } : {}),
    ...(data.socialHandles ? {
      instagram_handle: data.socialHandles.instagram?.trim() || undefined,
      snapchat_handle: data.socialHandles.snapchat?.trim() || undefined,
      tiktok_handle: data.socialHandles.tiktok?.trim() || undefined,
    } : {}),
  };
}

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true };
    case 'LOGIN_SUCCESS':
      return { user: action.payload, isAuthenticated: true, isLoading: false };
    case 'LOGIN_FAILURE':
      return { user: null, isAuthenticated: false, isLoading: false };
    case 'LOGOUT':
      return { user: null, isAuthenticated: false, isLoading: false };
    case 'UPDATE_USER':
      return { 
        ...state, 
        user: state.user ? { ...state.user, ...action.payload } : null 
      };
    default:
      return state;
  }
}

const AuthContext = createContext<{
  state: AuthState;
  requestMagicLink: (email: string) => Promise<MagicLinkRequestResult>;
  consumeMagicLinkSession: () => Promise<boolean>;
  signOut: () => void;
  login: (phoneNumber: string, code: string) => Promise<boolean>;
  sendCode: (phoneNumber: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      if (SUPABASE_MAGIC_LINK_ENABLED) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const mappedUser = await mapSupabaseUserToUser(data.session.user);
          if (!isMounted) {
            return;
          }
          localStorage.setItem('user', JSON.stringify(mappedUser));
          dispatch({ type: 'LOGIN_SUCCESS', payload: mappedUser });
          return;
        }
      }

      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        dispatch({ type: 'LOGIN_SUCCESS', payload: JSON.parse(savedUser) });
      } else {
        dispatch({ type: 'LOGIN_FAILURE' });
      }
    };

    void bootstrap();

    if (!SUPABASE_MAGIC_LINK_ENABLED) {
      return () => {
        isMounted = false;
      };
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }
      if (!session?.user) {
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
        dispatch({ type: 'LOGOUT' });
        return;
      }

      void mapSupabaseUserToUser(session.user).then((mappedUser) => {
        if (!isMounted) {
          return;
        }
        localStorage.setItem('user', JSON.stringify(mappedUser));
        dispatch({ type: 'LOGIN_SUCCESS', payload: mappedUser });
      });
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const sendCode = async (phoneNumber: string): Promise<boolean> => {
    if (isApiAuthEnabled()) {
      await sendCodeApi(phoneNumber);
      return true;
    }

    maybeThrowMockFault('auth.sendCode');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Code sent to:', phoneNumber);
    return true;
  };

  const requestMagicLink = async (email: string): Promise<MagicLinkRequestResult> => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return { sent: false };
    }

    if (SUPABASE_MAGIC_LINK_ENABLED) {
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/`
          : undefined;
      await signInWithEmail(normalizedEmail, redirectTo);
      window.localStorage.setItem(MAGIC_LINK_PENDING_EMAIL_KEY, normalizedEmail);
      return { sent: true };
    }

    window.localStorage.setItem(MAGIC_LINK_PENDING_EMAIL_KEY, normalizedEmail);
    return { sent: true };
  };

  const consumeMagicLinkSession = async (): Promise<boolean> => {
    if (SUPABASE_MAGIC_LINK_ENABLED) {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        return false;
      }
      const user = await mapSupabaseUserToUser(data.session.user);
      window.localStorage.setItem('user', JSON.stringify(user));
      window.localStorage.setItem('auth_token', data.session.access_token);
      window.localStorage.removeItem(MAGIC_LINK_PENDING_EMAIL_KEY);
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      return true;
    }

    const pendingEmail = window.localStorage.getItem(MAGIC_LINK_PENDING_EMAIL_KEY)?.trim();
    if (!pendingEmail) {
      return false;
    }

    const existing = state.user;
    const user: User = existing
      ? {
          ...existing,
          email: pendingEmail,
        }
      : {
          id: `user_${Date.now()}`,
          name: '',
          phoneNumber: '',
          email: pendingEmail,
          consentStatus: 'not_required',
          ageBand: '16_20',
          createdAt: new Date(),
        };

    window.localStorage.setItem('user', JSON.stringify(user));
    window.localStorage.removeItem(MAGIC_LINK_PENDING_EMAIL_KEY);
    dispatch({ type: 'LOGIN_SUCCESS', payload: user });
    return true;
  };

  const login = async (phoneNumber: string, code: string): Promise<boolean> => {
    dispatch({ type: 'LOGIN_START' });
    try {
      if (isApiAuthEnabled()) {
        const verifyResult = await verifyCodeApi(phoneNumber, code);
        if (verifyResult.status === 'invalid_code') {
          dispatch({ type: 'LOGIN_FAILURE' });
          return false;
        }

        const user: User = {
          ...verifyResult.user,
          createdAt: new Date(verifyResult.user.createdAt),
        };

        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('auth_token', verifyResult.token);
        dispatch({ type: 'LOGIN_SUCCESS', payload: user });
        return true;
      }

      maybeThrowMockFault('auth.login');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (code === '123456') {
        const user: User = {
          id: Date.now().toString(),
          name: '',
          phoneNumber,
          createdAt: new Date(),
        };
        
        localStorage.setItem('user', JSON.stringify(user));
        dispatch({ type: 'LOGIN_SUCCESS', payload: user });
        return true;
      }
      
      dispatch({ type: 'LOGIN_FAILURE' });
      return false;
    } catch (error) {
      dispatch({ type: 'LOGIN_FAILURE' });
      throw error;
    }
  };

  const logout = () => {
    if (SUPABASE_MAGIC_LINK_ENABLED) {
      void supabase.auth.signOut();
    }
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
    localStorage.removeItem(MAGIC_LINK_PENDING_EMAIL_KEY);
    dispatch({ type: 'LOGOUT' });
  };

  const updateUser = (data: Partial<User>) => {
    if (state.user) {
      const updatedUser = { ...state.user, ...data };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      dispatch({ type: 'UPDATE_USER', payload: data });

      if (SUPABASE_MAGIC_LINK_ENABLED) {
        const patch = toProfilePatch(data);
        if (Object.keys(patch).length > 0) {
          void updateSupabaseProfile(patch).catch((error) => {
            console.error('Failed to sync profile to Supabase', error);
          });
        }
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        state,
        requestMagicLink,
        consumeMagicLinkSession,
        signOut: logout,
        login,
        sendCode,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
