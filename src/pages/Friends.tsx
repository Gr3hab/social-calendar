import { useState } from 'react';
import { UserPlusIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useData } from '../context/DataContext';

export default function Friends() {
  const { friends, addFriend } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFriend, setNewFriend] = useState({ name: '', phoneNumber: '' });

  const filteredFriends = friends.filter(friend => 
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.phoneNumber.includes(searchQuery)
  );

  const handleAddFriend = () => {
    if (newFriend.name.trim() && newFriend.phoneNumber.trim()) {
      addFriend({
        name: newFriend.name.trim(),
        phoneNumber: newFriend.phoneNumber.trim(),
      });
      setNewFriend({ name: '', phoneNumber: '' });
      setShowAddModal(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'from-pink-500 to-rose-500',
      'from-purple-500 to-indigo-500',
      'from-blue-500 to-cyan-500',
      'from-green-500 to-emerald-500',
      'from-yellow-500 to-orange-500',
      'from-red-500 to-pink-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="p-4 pb-28">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
          Freunde 👥
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {friends.length} Kontakte in deiner App
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Freunde suchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input input-with-icon"
        />
      </div>

      {/* Add Friend Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full btn btn-gradient mb-6 flex items-center justify-center"
      >
        <UserPlusIcon className="w-5 h-5 mr-2" />
        Freund hinzufügen
      </button>

      {/* Friends List */}
      <div className="space-y-2">
        {filteredFriends.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlusIcon className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery ? 'Keine Freunde gefunden' : 'Noch keine Freunde'}
            </p>
            {!searchQuery && (
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Importiere Kontakte im Onboarding
              </p>
            )}
          </div>
        ) : (
          filteredFriends.map((friend) => (
            <div
              key={friend.id}
              className="card p-4 flex items-center"
            >
              <div className={`w-12 h-12 bg-gradient-to-br ${getAvatarColor(friend.name)} rounded-full flex items-center justify-center mr-3`}>
                <span className="text-white font-bold">
                  {getInitials(friend.name)}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white">
                  {friend.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {friend.phoneNumber}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Friend Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 animate-slide-up">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>

            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-6">
              Freund hinzufügen
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={newFriend.name}
                  onChange={(e) => setNewFriend({ ...newFriend, name: e.target.value })}
                  placeholder="Max Mustermann"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Telefonnummer
                </label>
                <input
                  type="tel"
                  value={newFriend.phoneNumber}
                  onChange={(e) => setNewFriend({ ...newFriend, phoneNumber: e.target.value })}
                  placeholder="+49 170 1234567"
                  className="input"
                />
              </div>
            </div>

            <button
              onClick={handleAddFriend}
              disabled={!newFriend.name.trim() || !newFriend.phoneNumber.trim()}
              className="btn btn-gradient w-full mt-6 disabled:opacity-50"
            >
              Hinzufügen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
