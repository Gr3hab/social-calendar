import { useState } from 'react';
import { CameraIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import {
  generateICSFeedUrl,
  loginWithInstagram,
  loginWithSnapchat,
  loginWithTikTok,
  syncToGoogleCalendar,
  syncToOutlook,
  copyToClipboard,
} from '../services/invitationService';
import { requestAccountDeletion, requestDataExport } from '../services/complianceService';

export default function Profile() {
  const { state: authState, logout, updateUser } = useAuth();
  const { state: appState, dispatch } = useApp();
  const { events } = useData();
  const [isEditing, setIsEditing] = useState(false);
  const [complianceMessage, setComplianceMessage] = useState('');
  const [editForm, setEditForm] = useState({
    name: authState.user?.name || '',
    instagram: authState.user?.socialHandles?.instagram || '',
    snapchat: authState.user?.socialHandles?.snapchat || '',
    tiktok: authState.user?.socialHandles?.tiktok || '',
  });

  const handleSave = () => {
    const socialHandles = {
      ...(editForm.instagram && { instagram: editForm.instagram }),
      ...(editForm.snapchat && { snapchat: editForm.snapchat }),
      ...(editForm.tiktok && { tiktok: editForm.tiktok }),
    };

    updateUser({
      name: editForm.name,
      socialHandles,
    });

    setIsEditing(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateUser({ avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleDarkMode = () => {
    dispatch({ type: 'TOGGLE_DARK_MODE' });
  };

  const handlePlaceholderAction = (message: string) => {
    setComplianceMessage(`🧪 ${message}`);
  };

  const getEventForSync = () => {
    return [...events].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  };

  if (!authState.user) {
    return null;
  }
  const user = authState.user;

  return (
    <div className="p-4 pb-28">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Profil
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Verwalte deine Daten und Einstellungen
        </p>
      </div>

      <div className="space-y-4">
        {/* Settings - Dark Mode at top */}
        <div className="card p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">Einstellungen</h3>
          
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center">
              {appState.darkMode ? (
                <SunIcon className="w-5 h-5 text-amber-500 mr-3" />
              ) : (
                <MoonIcon className="w-5 h-5 text-slate-500 mr-3" />
              )}
              <span className="font-medium text-gray-900 dark:text-white">
                {appState.darkMode ? 'Hell' : 'Dunkel'} Mode
              </span>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors ${
              appState.darkMode ? 'bg-sky-500' : 'bg-gray-300'
            }`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                appState.darkMode ? 'translate-x-6' : 'translate-x-0.5'
              } mt-0.5`} />
            </div>
          </button>
        </div>

        {/* Profile Card */}
        <div className="card p-6">
          <div className="flex items-center mb-6">
            <div className="relative">
              {authState.user.avatar ? (
                <img
                  src={user.avatar}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {isEditing && (
                <label className="absolute bottom-0 right-0 bg-sky-600 text-white rounded-full p-1 cursor-pointer hover:bg-sky-700">
                  <CameraIcon className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <div className="ml-4 flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="input text-xl font-bold"
                />
              ) : (
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {user.name}
                </h2>
              )}
              <p className="text-gray-600 dark:text-gray-400">
                {user.phoneNumber}
              </p>
              {user.email && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user.email}
                </p>
              )}
              {user.ageBand && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Alterssegment: {user.ageBand}
                </p>
              )}
            </div>
          </div>

          {/* Social Handles */}
          <div className="space-y-3">
            {isEditing ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Instagram
                  </label>
                  <input
                    type="text"
                    value={editForm.instagram}
                    onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })}
                    placeholder="@username"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Snapchat
                  </label>
                  <input
                    type="text"
                    value={editForm.snapchat}
                    onChange={(e) => setEditForm({ ...editForm, snapchat: e.target.value })}
                    placeholder="@username"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    TikTok
                  </label>
                  <input
                    type="text"
                    value={editForm.tiktok}
                    onChange={(e) => setEditForm({ ...editForm, tiktok: e.target.value })}
                    placeholder="@username"
                    className="input"
                  />
                </div>
              </>
            ) : (
              <>
                {authState.user.socialHandles?.instagram && (
                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                    <span className="font-medium mr-2">Instagram:</span>
                    {authState.user.socialHandles.instagram}
                  </div>
                )}
                {authState.user.socialHandles?.snapchat && (
                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                    <span className="font-medium mr-2">Snapchat:</span>
                    {authState.user.socialHandles.snapchat}
                  </div>
                )}
                {authState.user.socialHandles?.tiktok && (
                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                    <span className="font-medium mr-2">TikTok:</span>
                    {authState.user.socialHandles.tiktok}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            {isEditing ? (
              <>
                <button onClick={handleSave} className="btn btn-primary flex-1 tap-target">
                  Speichern
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditForm({
                      name: authState.user?.name || '',
                      instagram: authState.user?.socialHandles?.instagram || '',
                      snapchat: authState.user?.socialHandles?.snapchat || '',
                      tiktok: authState.user?.socialHandles?.tiktok || '',
                    });
                  }}
                  className="btn btn-secondary flex-1 tap-target"
                >
                  Abbrechen
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="btn btn-primary w-full tap-target"
              >
                Profil bearbeiten
              </button>
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="card p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">Einstellungen</h3>
          
          <div className="space-y-3">
            <button
              onClick={toggleDarkMode}
              className="tap-target w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <div className="flex items-center">
                {appState.darkMode ? (
                  <MoonIcon className="w-5 h-5 mr-3 text-gray-600 dark:text-gray-400" />
                ) : (
                  <SunIcon className="w-5 h-5 mr-3 text-gray-600 dark:text-gray-400" />
                )}
                <span className="text-gray-900 dark:text-white">Dark Mode</span>
              </div>
              <div className={`w-12 h-6 rounded-full transition-colors ${
                appState.darkMode ? 'bg-sky-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}>
                <div className={`w-5 h-5 bg-white rounded-full transition-transform transform ${
                  appState.darkMode ? 'translate-x-6' : 'translate-x-0.5'
                } mt-0.5`} />
              </div>
            </button>

            <button className="tap-target w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
              <div className="flex items-center">
                <Cog6ToothIcon className="w-5 h-5 mr-3 text-gray-600 dark:text-gray-400" />
                <span className="text-gray-900 dark:text-white">Benachrichtigungen</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>

            <button className="tap-target w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
              <div className="flex items-center">
                <Cog6ToothIcon className="w-5 h-5 mr-3 text-gray-600 dark:text-gray-400" />
                <span className="text-gray-900 dark:text-white">Datenschutz</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">Integrationen (Mock)</h3>
          <div className="space-y-2">
            <button
              onClick={() => handlePlaceholderAction(loginWithInstagram().message)}
              className="btn btn-secondary w-full justify-start tap-target"
            >
              📸 Instagram Login
            </button>
            <button
              onClick={() => handlePlaceholderAction(loginWithSnapchat().message)}
              className="btn btn-secondary w-full justify-start tap-target"
            >
              👻 Snapchat Login
            </button>
            <button
              onClick={() => handlePlaceholderAction(loginWithTikTok().message)}
              className="btn btn-secondary w-full justify-start tap-target"
            >
              🎵 TikTok Login
            </button>
            <button
              onClick={() => {
                const event = getEventForSync();
                if (!event) {
                  alert('Kein Event für Sync vorhanden.');
                  return;
                }
                handlePlaceholderAction(syncToGoogleCalendar(event).message);
              }}
              className="btn btn-secondary w-full justify-start tap-target"
            >
              🗓️ Google Calendar Sync
            </button>
            <button
              onClick={() => {
                const event = getEventForSync();
                if (!event) {
                  alert('Kein Event für Sync vorhanden.');
                  return;
                }
                handlePlaceholderAction(syncToOutlook(event).message);
              }}
              className="btn btn-secondary w-full justify-start tap-target"
            >
              📅 Outlook Sync
            </button>
            <button
              onClick={async () => {
                const url = generateICSFeedUrl(user.id);
                await copyToClipboard(url);
                alert('ICS-Feed URL kopiert (Mock).');
              }}
              className="btn btn-secondary w-full justify-start tap-target"
            >
              🔗 ICS-Feed kopieren
            </button>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">Datenschutz</h3>
          <div className="space-y-2">
            <button
              onClick={async () => {
                await requestDataExport(user.id);
                setComplianceMessage('Datenexport angefordert. Wir informieren dich in der App.');
              }}
              className="btn btn-secondary w-full justify-start tap-target"
            >
              Datenexport anfordern
            </button>
            <button
              onClick={async () => {
                await requestAccountDeletion(user.id, 'User request');
                setComplianceMessage('Löschanfrage erfasst. Wir prüfen die Anfrage.');
              }}
              className="btn btn-secondary w-full justify-start tap-target text-rose-700 dark:text-rose-300"
            >
              Account-Löschung anfragen
            </button>
          </div>
          {complianceMessage && (
            <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
              {complianceMessage}
            </p>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="card p-4 w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors tap-target"
        >
          <div className="flex items-center justify-center">
            <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" />
            <span className="font-medium">Ausloggen</span>
          </div>
        </button>
      </div>
    </div>
  );
}
