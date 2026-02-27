import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PhoneIcon, LockClosedIcon, SparklesIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { isApiAuthEnabled } from '../services/authApi';
import { getErrorMessage } from '../services/serviceErrors';
import { featureFlags } from '../config/featureFlags';

type RetryAction = 'send-code' | 'login' | null;

export default function Login() {
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [retryAction, setRetryAction] = useState<RetryAction>(null);
  const { login, sendCode, requestMagicLink, consumeMagicLinkSession } = useAuth();
  const apiAuthEnabled = isApiAuthEnabled();
  const magicLinkMode = featureFlags.authMagicLinkOnly;

  const attemptSendCode = async () => {
    setError('');
    setRetryAction(null);
    setIsLoading(true);
    try {
      const success = await sendCode(phoneNumber);
      if (success) {
        setShowCodeInput(true);
        return;
      }
      setError('Fehler beim Senden des Codes 😕');
      setRetryAction('send-code');
    } catch (submitError) {
      setError(
        getErrorMessage(submitError, {
          fallback: 'Fehler beim Senden des Codes 😕',
          network: 'Keine Verbindung. Bitte versuche es erneut.',
          rateLimit: 'Zu viele Code-Anfragen.',
        }),
      );
      setRetryAction('send-code');
    } finally {
      setIsLoading(false);
    }
  };

  const attemptLogin = async () => {
    setError('');
    setRetryAction(null);
    setIsLoading(true);
    try {
      const success = await login(phoneNumber, code);
      if (!success) {
        setError('Ungültiger Code 🤔');
        return;
      }
    } catch (submitError) {
      setError(
        getErrorMessage(submitError, {
          fallback: 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.',
          network: 'Netzwerkfehler bei der Anmeldung.',
          rateLimit: 'Zu viele Login-Versuche.',
        }),
      );
      setRetryAction('login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (magicLinkMode) {
      if (!magicLinkSent) {
        void handleRequestMagicLink();
      } else {
        void handleConsumeMagicLink();
      }
      return;
    }
    if (retryAction === 'send-code') {
      void attemptSendCode();
      return;
    }
    if (retryAction === 'login') {
      void attemptLogin();
    }
  };

  const handleRequestMagicLink = async () => {
    if (!email || !email.includes('@')) {
      setError('Bitte gib eine gültige E-Mail ein ✉️');
      return;
    }

    setError('');
    setRetryAction(null);
    setIsLoading(true);
    try {
      const result = await requestMagicLink(email);
      if (!result.sent) {
        setError('Magic Link konnte nicht gesendet werden.');
        return;
      }
      setMagicLinkSent(true);
    } catch (submitError) {
      setError(
        getErrorMessage(submitError, {
          fallback: 'Magic Link konnte nicht gesendet werden.',
          network: 'Keine Verbindung. Bitte versuche es erneut.',
          rateLimit: 'Zu viele Anfragen.',
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsumeMagicLink = async () => {
    setError('');
    setRetryAction(null);
    setIsLoading(true);
    try {
      const success = await consumeMagicLinkSession();
      if (!success) {
        setError('Kein aktiver Magic Link gefunden. Bitte Link erneut anfordern.');
      }
    } catch (submitError) {
      setError(
        getErrorMessage(submitError, {
          fallback: 'Session konnte nicht aktiviert werden.',
          network: 'Keine Verbindung. Bitte versuche es erneut.',
          rateLimit: 'Zu viele Versuche.',
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Bitte gib eine gültige Telefonnummer ein 📱');
      setRetryAction(null);
      return;
    }
    await attemptSendCode();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setError('Bitte gib einen 6-stelligen Code ein 🔢');
      setRetryAction(null);
      return;
    }
    await attemptLogin();
  };

  if (magicLinkMode) {
    return (
      <div className="min-h-screen bg-gradient-neon dark:bg-gradient-dark flex items-center justify-center px-4 py-8 animate-fade-in">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-md w-full relative z-10">
          <div className="text-center mb-10 animate-slide-up">
            <div className="inline-flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse-glow" />
              <div className="relative w-24 h-24 bg-gradient-to-br from-white/30 to-white/10 rounded-full backdrop-blur-xl border border-white/30 flex items-center justify-center shadow-2xl">
                <SparklesIcon className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Plan It.</h1>
            <p className="text-white/80 text-lg font-medium">Sicherer Login mit Magic Link</p>
          </div>

          <div className="glass-card p-8 animate-scale-in space-y-5">
            {!magicLinkSent ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center">Login mit E-Mail ✉️</h2>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="du@beispiel.de"
                  className="input text-lg"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => void handleRequestMagicLink()}
                  className="btn btn-gradient w-full text-lg font-bold"
                  disabled={isLoading}
                >
                  {isLoading ? 'Sende...' : 'Magic Link senden'}
                </button>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center">Link geöffnet?</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  Prüfe dein Postfach und öffne den Link. Kehre danach hierher zurück.
                </p>
                <button
                  type="button"
                  onClick={() => void handleConsumeMagicLink()}
                  className="btn btn-gradient w-full text-lg font-bold"
                  disabled={isLoading}
                >
                  {isLoading ? 'Prüfe Session...' : 'Weiter mit Session'}
                </button>
                <button
                  type="button"
                  onClick={() => setMagicLinkSent(false)}
                  className="btn btn-secondary w-full"
                  disabled={isLoading}
                >
                  E-Mail ändern
                </button>
              </>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-medium text-center">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isLoading}
                  className="mt-2 inline-flex rounded-xl bg-red-500/15 px-3 py-1 text-xs font-bold text-red-700 transition hover:bg-red-500/25 disabled:opacity-60 dark:text-red-300"
                >
                  Erneut versuchen
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-white/60 text-sm mt-8">
            By continuing, you agree to our{' '}
            <Link className="underline" to="/legal/terms">Terms</Link>,{' '}
            <Link className="underline" to="/legal/privacy">Privacy</Link> and{' '}
            <Link className="underline" to="/legal/community">Community Rules</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-neon dark:bg-gradient-dark flex items-center justify-center px-4 py-8 animate-fade-in">
      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-10 animate-slide-up">
          <div className="inline-flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse-glow" />
            <div className="relative w-24 h-24 bg-gradient-to-br from-white/30 to-white/10 rounded-full backdrop-blur-xl border border-white/30 flex items-center justify-center shadow-2xl">
              <SparklesIcon className="w-12 h-12 text-white" />
            </div>
          </div>
          
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
            Plan It.
          </h1>
          <p className="text-white/80 text-lg font-medium">
            Einfach. Schnell. Mit Freunden.
          </p>
        </div>

        {/* Main Card */}
        <div className="glass-card p-8 animate-scale-in">
          {!showCodeInput ? (
            <form onSubmit={handleSendCode} className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  Los geht's! 🚀
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Gib deine Nummer ein, wir schicken dir einen Code
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2">
                    <PhoneIcon className="w-6 h-6 text-sky-500" />
                  </div>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+49 123 456789"
                    className="input text-lg w-full"
                    style={{ paddingLeft: '3.5rem' }}
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-medium text-center">
                  <p>{error}</p>
                  {retryAction && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isLoading}
                      className="mt-2 inline-flex rounded-xl bg-red-500/15 px-3 py-1 text-xs font-bold text-red-700 transition hover:bg-red-500/25 disabled:opacity-60 dark:text-red-300"
                    >
                      Erneut versuchen
                    </button>
                  )}
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-gradient w-full text-lg font-bold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Code senden 📲'
                )}
              </button>

              <p className="text-center text-gray-500 dark:text-gray-400 text-xs">
                Kein Spam, versprochen! 🤞
              </p>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              <button
                type="button"
                onClick={() => {
                  setShowCodeInput(false);
                  setCode('');
                  setError('');
                  setRetryAction(null);
                }}
                className="flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors mb-2"
              >
                <ArrowLeftIcon className="w-5 h-5 mr-1" />
                Zurück
              </button>

              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  Code eingeben 🔐
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Wir haben dir einen 6-stelligen Code geschickt
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2">
                    <LockClosedIcon className="w-6 h-6 text-sky-500" />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className="input text-center text-3xl tracking-[0.5em] font-bold h-16 w-full"
                    style={{ paddingLeft: '3.5rem', paddingRight: '3.5rem' }}
                    maxLength={6}
                    autoFocus
                  />
                </div>
                
                <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-2xl p-3 text-center">
                  <p className="text-sm text-sky-700 dark:text-sky-300 font-medium">
                    {apiAuthEnabled ? (
                      'SMS-Code wurde an deine Nummer gesendet.'
                    ) : (
                      <>🔑 Demo-Code: <span className="font-mono font-bold">123456</span></>
                    )}
                  </p>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-medium text-center">
                  <p>{error}</p>
                  {retryAction && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isLoading}
                      className="mt-2 inline-flex rounded-xl bg-red-500/15 px-3 py-1 text-xs font-bold text-red-700 transition hover:bg-red-500/25 disabled:opacity-60 dark:text-red-300"
                    >
                      Erneut versuchen
                    </button>
                  )}
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-gradient w-full text-lg font-bold"
                disabled={isLoading || code.length !== 6}
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Anmelden ✨'
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-white/60 text-sm mt-8">
          By continuing, you agree to our{' '}
          <Link className="underline" to="/legal/terms">Terms</Link>,{' '}
          <Link className="underline" to="/legal/privacy">Privacy</Link> and{' '}
          <Link className="underline" to="/legal/community">Community Rules</Link>.
        </p>
      </div>
    </div>
  );
}
