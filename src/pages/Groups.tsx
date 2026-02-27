import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  CalendarDaysIcon,
  PlusIcon,
  UserGroupIcon,
  UserIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import type { Friend } from '../types';

function dedupeByPhone(members: Friend[]): Friend[] {
  const seen = new Set<string>();
  return members.filter((member) => {
    if (!member.phoneNumber || seen.has(member.phoneNumber)) {
      return false;
    }
    seen.add(member.phoneNumber);
    return true;
  });
}

export default function Groups() {
  const { state: authState } = useAuth();
  const { groups, friends, events, createGroup, addMembersToGroup } = useData();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [manualMemberName, setManualMemberName] = useState('');
  const [manualMemberPhone, setManualMemberPhone] = useState('');

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [extraMemberName, setExtraMemberName] = useState('');
  const [extraMemberPhone, setExtraMemberPhone] = useState('');
  const [extraFriendIds, setExtraFriendIds] = useState<string[]>([]);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const selectedGroupEvents = useMemo(
    () =>
      selectedGroup
        ? events
            .filter((event) => event.groups?.includes(selectedGroup.id))
            .sort((a, b) => a.date.getTime() - b.date.getTime())
        : [],
    [events, selectedGroup],
  );

  const toggleListEntry = (id: string, items: string[], setItems: (next: string[]) => void) => {
    if (items.includes(id)) {
      setItems(items.filter((value) => value !== id));
      return;
    }
    setItems([...items, id]);
  };

  const resolveFriendIds = (ids: string[]) => {
    const lookup = new Set(ids);
    return friends.filter((friend) => lookup.has(friend.id));
  };

  const currentUserAsFriend: Friend | null = authState.user
    ? {
        id: authState.user.id,
        name: authState.user.name.trim() || 'Du',
        phoneNumber: authState.user.phoneNumber,
        avatar: authState.user.avatar,
      }
    : null;

  const handleCreateGroup = async () => {
    if (!authState.user || !newGroupName.trim()) {
      return;
    }

    const members = resolveFriendIds(selectedFriendIds);
    if (manualMemberPhone.trim()) {
      members.push({
        id: `manual_${manualMemberPhone.trim()}`,
        name: manualMemberName.trim() || 'Kontakt',
        phoneNumber: manualMemberPhone.trim(),
      });
    }
    if (currentUserAsFriend) {
      members.unshift(currentUserAsFriend);
    }

    const created = await createGroup({
      name: newGroupName.trim(),
      description: newGroupDescription.trim() || undefined,
      createdBy: authState.user.id,
      members: dedupeByPhone(members),
    });

    setSelectedGroupId(created.id);
    setIsCreatingGroup(false);
    setNewGroupName('');
    setNewGroupDescription('');
    setSelectedFriendIds([]);
    setManualMemberName('');
    setManualMemberPhone('');
  };

  const handleAddMembers = async () => {
    if (!selectedGroup) {
      return;
    }

    const members = resolveFriendIds(extraFriendIds);
    if (extraMemberPhone.trim()) {
      members.push({
        id: `manual_${extraMemberPhone.trim()}`,
        name: extraMemberName.trim() || 'Kontakt',
        phoneNumber: extraMemberPhone.trim(),
      });
    }

    if (members.length === 0) {
      return;
    }

    await addMembersToGroup(selectedGroup.id, members);
    setIsAddMemberOpen(false);
    setExtraMemberName('');
    setExtraMemberPhone('');
    setExtraFriendIds([]);
  };

  if (selectedGroup) {
    return (
      <div className="p-4 pb-28">
        <button
          onClick={() => {
            setSelectedGroupId(null);
            setIsAddMemberOpen(false);
          }}
          className="mb-4 text-sky-600 dark:text-sky-400 hover:underline"
        >
          ← Zurück zu Gruppen
        </button>

        <div className="card p-6 mb-4">
          <div className="flex items-center mb-4">
            <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center mr-4">
              <UserGroupIcon className="w-8 h-8 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedGroup.name}</h2>
              {selectedGroup.description && (
                <p className="text-gray-600 dark:text-gray-400">{selectedGroup.description}</p>
              )}
            </div>
          </div>

          <div className="mb-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              Mitglieder ({selectedGroup.members.length})
            </h3>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {selectedGroup.members.map((member) => (
                <div
                  key={`${selectedGroup.id}_${member.phoneNumber}`}
                  className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl"
                >
                  <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center mr-3">
                    <UserIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{member.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{member.phoneNumber}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => setIsAddMemberOpen((current) => !current)} className="btn btn-primary w-full tap-target">
            <UserPlusIcon className="w-5 h-5 mr-2" />
            Mitglieder hinzufügen
          </button>

          {isAddMemberOpen && (
            <div className="mt-4 space-y-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/60">
              <p className="font-semibold text-gray-900 dark:text-white">Freunde auswählen</p>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                {friends.map((friend) => (
                  <button
                    key={`add_${friend.id}`}
                    onClick={() => toggleListEntry(friend.id, extraFriendIds, setExtraFriendIds)}
                    className={`p-2 rounded-xl border text-left ${
                      extraFriendIds.includes(friend.id)
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                        : 'border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{friend.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{friend.phoneNumber}</p>
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={extraMemberName}
                onChange={(event) => setExtraMemberName(event.target.value)}
                placeholder="Name (optional)"
                className="input"
              />
              <input
                type="tel"
                value={extraMemberPhone}
                onChange={(event) => setExtraMemberPhone(event.target.value)}
                placeholder="Telefonnummer"
                className="input"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button onClick={handleAddMembers} className="btn btn-gradient tap-target">
                  Speichern
                </button>
                <button onClick={() => setIsAddMemberOpen(false)} className="btn btn-secondary tap-target">
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center">
            <CalendarDaysIcon className="w-5 h-5 mr-2 text-sky-500" />
            Gruppen-Kalender
          </h3>
          {selectedGroupEvents.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Noch keine Gruppen-Events. Erstelle über den + Button einen Termin und wähle diese Gruppe.
            </p>
          ) : (
            <div className="space-y-3">
              {selectedGroupEvents.map((event) => (
                <div key={event.id} className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-700">
                  <p className="font-semibold text-gray-900 dark:text-white">{event.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {format(event.date, "EEEE, d. MMMM '•' HH:mm", { locale: de })}
                  </p>
                  {event.location && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{event.location}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-28">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Deine Gruppen</h1>
        <p className="text-gray-600 dark:text-gray-400">Erstelle Gruppen und plane Events im Gruppen-Kalender.</p>
      </div>

      {isCreatingGroup && (
        <div className="card p-5 mb-4 space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Neue Gruppe</h3>
          <input
            type="text"
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            placeholder="Gruppenname"
            className="input"
          />
          <textarea
            value={newGroupDescription}
            onChange={(event) => setNewGroupDescription(event.target.value)}
            placeholder="Beschreibung (optional)"
            className="input min-h-[90px] resize-none"
          />

          <p className="font-semibold text-gray-900 dark:text-white">Freunde hinzufügen</p>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
            {friends.map((friend) => (
              <button
                key={`create_${friend.id}`}
                onClick={() => toggleListEntry(friend.id, selectedFriendIds, setSelectedFriendIds)}
                className={`p-2 rounded-xl border text-left ${
                  selectedFriendIds.includes(friend.id)
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                    : 'border-gray-200 dark:border-gray-600'
                }`}
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">{friend.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{friend.phoneNumber}</p>
              </button>
            ))}
          </div>

          <input
            type="text"
            value={manualMemberName}
            onChange={(event) => setManualMemberName(event.target.value)}
            placeholder="Zusätzlicher Name (optional)"
            className="input"
          />
          <input
            type="tel"
            value={manualMemberPhone}
            onChange={(event) => setManualMemberPhone(event.target.value)}
            placeholder="Zusätzliche Telefonnummer"
            className="input"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button onClick={handleCreateGroup} className="btn btn-gradient tap-target" disabled={!newGroupName.trim()}>
              Gruppe erstellen
            </button>
            <button onClick={() => setIsCreatingGroup(false)} className="btn btn-secondary tap-target">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-12">
          <UserGroupIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Noch keine Gruppen</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Erstelle deine erste Gruppe und lade Freunde per Telefonnummer ein.
          </p>
          <button onClick={() => setIsCreatingGroup(true)} className="btn btn-primary tap-target">
            <PlusIcon className="w-5 h-5 mr-2" />
            Neue Gruppe
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              className="card p-4 w-full text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center">
                <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center mr-4">
                  <UserGroupIcon className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{group.name}</h3>
                  {group.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{group.description}</p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {group.members.length} Mitglieder
                  </p>
                </div>
              </div>
            </button>
          ))}

          {!isCreatingGroup && (
            <button onClick={() => setIsCreatingGroup(true)} className="btn btn-secondary w-full tap-target">
              <PlusIcon className="w-5 h-5 mr-2" />
              Neue Gruppe
            </button>
          )}
        </div>
      )}
    </div>
  );
}
