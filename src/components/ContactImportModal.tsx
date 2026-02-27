import { useState } from 'react';
import { 
  ArrowDownTrayIcon, 
  CheckIcon, 
  XMarkIcon,
  SparklesIcon,
  BoltIcon
} from '@heroicons/react/24/outline';

interface ContactImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (contacts: Array<{ name: string; phoneNumber: string; source: string }>) => void;
}

const APPS = [
  { 
    id: 'whatsapp', 
    name: 'WhatsApp', 
    emoji: '💬', 
    color: 'from-green-500 to-emerald-600',
    description: 'Meistgenutzt in Europa'
  },
  { 
    id: 'telegram', 
    name: 'Telegram', 
    emoji: '✈️', 
    color: 'from-sky-500 to-blue-600',
    description: 'Schnell & sicher'
  },
  { 
    id: 'instagram', 
    name: 'Instagram', 
    emoji: '📸', 
    color: 'from-pink-500 via-purple-500 to-orange-500',
    description: 'Stories & DMs'
  },
  { 
    id: 'snapchat', 
    name: 'Snapchat', 
    emoji: '👻', 
    color: 'from-yellow-400 to-black',
    description: 'U20 Favorite'
  },
];

export default function ContactImportModal({ isOpen, onClose, onImport }: ContactImportModalProps) {
  const [step, setStep] = useState<'select' | 'importing' | 'done'>('select');
  const [selectedApps, setSelectedApps] = useState<string[]>(['whatsapp']);
  const [importedCount, setImportedCount] = useState(0);

  if (!isOpen) return null;

  const toggleApp = (appId: string) => {
    setSelectedApps(prev => 
      prev.includes(appId) 
        ? prev.filter(id => id !== appId)
        : [...prev, appId]
    );
  };

  const handleImportAll = async () => {
    // Select all apps at once
    setSelectedApps(APPS.map(a => a.id));
    setStep('importing');
    
    // Simulate importing contacts from all apps
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Mock imported contacts from ALL apps
    const mockContacts: Array<{ name: string; phoneNumber: string; source: string }> = [
      { name: 'Anna 💚', phoneNumber: '+49 170 1111111', source: 'whatsapp' },
      { name: 'Max 🏀', phoneNumber: '+49 170 2222222', source: 'whatsapp' },
      { name: 'Lena 🎸', phoneNumber: '+49 170 3333333', source: 'whatsapp' },
      { name: 'Tom 🚀', phoneNumber: '+49 170 4444444', source: 'telegram' },
      { name: 'Mia 🎨', phoneNumber: '+49 170 5555555', source: 'telegram' },
      { name: 'Leo 📸', phoneNumber: '+49 170 6666666', source: 'instagram' },
      { name: 'Sophie ✨', phoneNumber: '+49 170 7777777', source: 'instagram' },
      { name: 'Noah 👻', phoneNumber: '+49 170 8888888', source: 'snapchat' },
      { name: 'Emma 🌟', phoneNumber: '+49 170 9999999', source: 'snapchat' },
      { name: 'Lukas 🎮', phoneNumber: '+49 170 1010101', source: 'phone' },
      { name: 'Sarah 🎵', phoneNumber: '+49 170 2020202', source: 'phone' },
      { name: 'Felix ⚽', phoneNumber: '+49 170 3030303', source: 'phone' },
    ];

    setImportedCount(mockContacts.length);
    setStep('done');
    
    // Auto close after showing success
    setTimeout(() => {
      onImport(mockContacts);
      onClose();
      setStep('select');
      setImportedCount(0);
    }, 1500);
  };

  const handleImport = async () => {
    setStep('importing');
    
    // Simulate importing contacts from selected apps
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock imported contacts based on selected apps
    const mockContacts: Array<{ name: string; phoneNumber: string; source: string }> = [];
    
    if (selectedApps.includes('whatsapp')) {
      mockContacts.push(
        { name: 'Anna 💚', phoneNumber: '+49 170 1111111', source: 'whatsapp' },
        { name: 'Max 🏀', phoneNumber: '+49 170 2222222', source: 'whatsapp' },
        { name: 'Lena 🎸', phoneNumber: '+49 170 3333333', source: 'whatsapp' },
      );
    }
    if (selectedApps.includes('telegram')) {
      mockContacts.push(
        { name: 'Tom 🚀', phoneNumber: '+49 170 4444444', source: 'telegram' },
        { name: 'Mia 🎨', phoneNumber: '+49 170 5555555', source: 'telegram' },
      );
    }
    if (selectedApps.includes('instagram')) {
      mockContacts.push(
        { name: 'Leo 📸', phoneNumber: '+49 170 6666666', source: 'instagram' },
        { name: 'Sophie ✨', phoneNumber: '+49 170 7777777', source: 'instagram' },
      );
    }
    if (selectedApps.includes('snapchat')) {
      mockContacts.push(
        { name: 'Noah 👻', phoneNumber: '+49 170 8888888', source: 'snapchat' },
        { name: 'Emma 🌟', phoneNumber: '+49 170 9999999', source: 'snapchat' },
      );
    }

    setImportedCount(mockContacts.length);
    setStep('done');
    
    // Auto close after showing success
    setTimeout(() => {
      onImport(mockContacts);
      onClose();
      setStep('select');
      setImportedCount(0);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-r from-sky-500 to-cyan-500 rounded-xl flex items-center justify-center mr-3">
              <ArrowDownTrayIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Kontakte importieren 📇</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Wähle deine Apps</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl">
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'select' && (
            <div className="space-y-4 animate-slide-up">
              {/* ONE-CLICK Button */}
              <button
                onClick={handleImportAll}
                className="w-full p-5 rounded-2xl bg-gradient-to-r from-green-500 via-emerald-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-green-500/30 transition-all transform hover:scale-[1.02]"
              >
                <div className="flex items-center justify-center">
                  <BoltIcon className="w-8 h-8 mr-3" />
                  <div className="text-left">
                    <div className="font-black text-xl">ALLE KONTAKTE IMPORTIEREN</div>
                    <div className="text-white/80 text-sm">📱 + 💬 + ✈️ + 📸 + 👻 auf einmal!</div>
                  </div>
                </div>
              </button>

              <div className="text-center text-gray-500 dark:text-gray-400 text-sm my-2">
                oder einzelne Apps auswählen:
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {APPS.map((app) => {
                  const isSelected = selectedApps.includes(app.id);
                  return (
                    <button
                      key={app.id}
                      onClick={() => toggleApp(app.id)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                          : 'border-gray-200 dark:border-slate-700 hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{app.emoji}</span>
                        {isSelected && (
                          <div className="w-6 h-6 bg-sky-500 rounded-full flex items-center justify-center">
                            <CheckIcon className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="font-bold text-gray-900 dark:text-white">{app.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{app.description}</div>
                    </button>
                  );
                })}
              </div>

              {/* Selected count */}
              {selectedApps.length > 0 && (
                <div className="bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-2xl p-4">
                  <div className="flex items-center">
                    <SparklesIcon className="w-5 h-5 text-sky-500 mr-2" />
                    <span className="text-sm text-sky-700 dark:text-sky-300">
                      <span className="font-bold">~{selectedApps.length * 3}</span> Kontakte werden importiert
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 text-center animate-slide-up">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 border-4 border-sky-200 rounded-full" />
                <div className="absolute inset-0 border-4 border-transparent border-t-sky-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-3xl">
                  ⚡
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Importiere alle Kontakte...
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Telefon + alle Messenger
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-12 text-center animate-slide-up">
              <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckIcon className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
                🎉 {importedCount} Kontakte!
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Alle deine Freunde sind jetzt in der App
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'select' && (
          <div className="p-6 pt-0">
            <button
              onClick={handleImport}
              disabled={selectedApps.length === 0}
              className="btn btn-gradient w-full font-bold tap-target disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
              Ausgewählte importieren
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
