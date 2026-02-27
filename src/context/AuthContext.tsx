/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { User, AuthState } from '../types';
import { maybeThrowMockFault } from '../services/mockFaults';
import { isApiAuthEnabled, sendCodeApi, verifyCodeApi } from '../services/authApi';

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

interface MagicLinkRequestResult {
  sent: boolean;
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
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      dispatch({ type: 'LOGIN_SUCCESS', payload: JSON.parse(savedUser) });
    } else {
      dispatch({ type: 'LOGIN_FAILURE' });
    }
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

    window.localStorage.setItem(MAGIC_LINK_PENDING_EMAIL_KEY, normalizedEmail);
    return { sent: true };
  };

  const consumeMagicLinkSession = async (): Promise<boolean> => {
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
