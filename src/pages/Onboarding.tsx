import { useState } from 'react';
import { CameraIcon, XMarkIcon, UserIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import ContactImportModal from '../components/ContactImportModal';
import type { AgeBand, User } from '../types';

export default function Onboarding() {
  const { updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [showContactImport, setShowContactImport] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    avatar: '',
    instagram: '',
    snapchat: '',
    tiktok: '',
    ageBand: '16_20' as AgeBand,
    consentConfirmed: false,
  });

  const handleNext = () => {
    if (step === 3) {
      if (formData.ageBand === 'under_13') {
        setOnboardingError('Plan It ist aktuell erst ab 13 Jahren verfügbar.');
        return;
      }
      if (formData.ageBand === '13_15' && !formData.consentConfirmed) {
        setOnboardingError('Für 13–15 Jahre ist eine bestätigte Einwilligung erforderlich.');
        return;
      }
    }
    setOnboardingError('');
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const socialHandles = {
      ...(formData.instagram && { instagram: formData.instagram }),
      ...(formData.snapchat && { snapchat: formData.snapchat }),
      ...(formData.tiktok && { tiktok: formData.tiktok }),
    };

    updateUser({
      name: formData.name,
      avatar: formData.avatar,
      socialHandles,
      ageBand: formData.ageBand,
      consentStatus:
        formData.ageBand === 'under_13'
          ? 'blocked'
          : formData.ageBand === '13_15'
            ? (formData.consentConfirmed ? 'granted' : 'required')
            : 'not_required',
    } as Partial<User>);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-2xl mb-4">
                <UserIcon className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                Wer bist du? 👋
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Damit Freunde dich erkennen können
              </p>
            </div>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Dein Name"
              className="input text-xl text-center"
              autoFocus
            />
            
            {/* Contact Import CTA */}
            {formData.name.trim() && (
              <button
                onClick={() => setShowContactImport(true)}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800 hover:border-green-400 transition-all"
              >
                <div className="flex items-center justify-center">
                  <span className="text-2xl mr-3">⚡</span>
                  <div className="text-left">
                    <div className="font-bold text-green-700 dark:text-green-300">
                      Kontakte importieren
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-400">
                      Finde alle deine Freunde automatisch
                    </div>
                  </div>
                </div>
              </button>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl mb-4">
                <CameraIcon className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                Profilbild 📸
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Optional, aber hilfreich für Freunde
              </p>
            </div>
            
            <div className="flex justify-center">
              <div className="relative">
                {formData.avatar ? (
                  <div className="relative">
                    <img
                      src={formData.avatar}
                      alt="Avatar"
                      className="w-40 h-40 rounded-3xl object-cover shadow-2xl"
                    />
                    <button
                      onClick={() => setFormData({ ...formData, avatar: '' })}
                      className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2 shadow-lg hover:scale-110 transition-transform"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <label className="w-40 h-40 bg-gradient-to-br from-sky-100 to-cyan-100 dark:from-gray-700 dark:to-gray-600 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-lg">
                    <CameraIcon className="w-12 h-12 text-sky-500 dark:text-sky-400 mb-2" />
                    <span className="text-sm text-sky-600 dark:text-sky-300 font-medium">Foto wählen</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl mb-4">
                <SparklesIcon className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                Socials ✨
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Optional - damit dich Freunde finden
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Altersbereich
                </label>
                <select
                  value={formData.ageBand}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      ageBand: e.target.value as AgeBand,
                      consentConfirmed: e.target.value === '13_15' ? formData.consentConfirmed : false,
                    })
                  }
                  className="input"
                >
                  <option value="13_15">13–15</option>
                  <option value="16_20">16–20</option>
                  <option value="21_plus">21+</option>
                  <option value="under_13">Unter 13</option>
                </select>
              </div>

              {formData.ageBand === '13_15' && (
                <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  <input
                    type="checkbox"
                    checked={formData.consentConfirmed}
                    onChange={(e) => setFormData({ ...formData, consentConfirmed: e.target.checked })}
                    className="mt-1"
                  />
                  <span>Ich bestätige, dass die erforderliche Einwilligung vorliegt.</span>
                </label>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  📸 Instagram
                </label>
                <input
                  type="text"
                  value={formData.instagram}
                  onChange={(e) => {
                    const value = e.target.value.replace('@', ''); // Remove any @
                    if (!value) {
                      setFormData({ ...formData, instagram: '' }); // Empty if nothing
                    } else {
                      setFormData({ ...formData, instagram: '@' + value });
                    }
                  }}
                  placeholder="@username"
                  className="input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  👻 Snapchat
                </label>
                <input
                  type="text"
                  value={formData.snapchat}
                  onChange={(e) => {
                    const value = e.target.value.replace('@', '');
                    if (!value) {
                      setFormData({ ...formData, snapchat: '' });
                    } else {
                      setFormData({ ...formData, snapchat: '@' + value });
                    }
                  }}
                  placeholder="@username"
                  className="input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  🎵 TikTok
                </label>
                <input
                  type="text"
                  value={formData.tiktok}
                  onChange={(e) => {
                    const value = e.target.value.replace('@', '');
                    if (!value) {
                      setFormData({ ...formData, tiktok: '' });
                    } else {
                      setFormData({ ...formData, tiktok: '@' + value });
                    }
                  }}
                  placeholder="@username"
                  className="input"
                />
              </div>
            </div>
          </div>
        );

    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-candy dark:bg-gradient-dark flex items-center justify-center px-4 py-8 animate-fade-in">
      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-60 h-60 bg-white/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-60 h-60 bg-white/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-md w-full relative z-10">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4 px-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-2 flex-1 mx-1 rounded-full transition-all duration-300 ${
                  i <= step 
                    ? 'bg-white shadow-lg' 
                    : 'bg-white/30'
                }`}
              />
            ))}
          </div>
          <p className="text-center text-sm text-white/80 font-medium">
            Schritt {step} von 3
          </p>
        </div>

        <div className="glass-card p-8">
          {renderStep()}

          {onboardingError && (
            <div className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-3 text-center text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              {onboardingError}
            </div>
          )}

          <div className="mt-8 flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="btn btn-secondary flex-1 tap-target"
              >
                ← Zurück
              </button>
            )}
            
            <button
              onClick={handleNext}
              disabled={step === 1 && !formData.name.trim()}
              className="btn btn-gradient flex-1 tap-target disabled:opacity-50 text-lg font-bold"
            >
              {step === 3 ? 'Fertig 🎉' : 'Weiter →'}
            </button>
          </div>

          {step === 3 && (
            <button
              onClick={handleSubmit}
              className="btn btn-ghost w-full mt-4 text-gray-500 dark:text-gray-400 tap-target"
            >
              Überspringen
            </button>
          )}
        </div>
      </div>

      {/* Contact Import Modal */}
      <ContactImportModal
        isOpen={showContactImport}
        onClose={() => setShowContactImport(false)}
        onImport={() => undefined}
      />
    </div>
  );
}
