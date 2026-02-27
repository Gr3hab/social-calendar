import type { User } from '../../src/types';

export function seedAuthenticatedUser(overrides: Partial<User> = {}) {
  const user: User = {
    id: 'self',
    name: 'Alex',
    phoneNumber: '+491700000000',
    createdAt: new Date(),
    ...overrides,
  };

  window.localStorage.setItem('user', JSON.stringify(user));
  return user;
}
