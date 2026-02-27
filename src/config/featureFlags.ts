function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  return null;
}

function resolveFlag(raw: unknown, defaultInProd: boolean): boolean {
  const explicit = normalizeBoolean(raw);
  if (explicit !== null) {
    return explicit;
  }
  return import.meta.env.PROD ? defaultInProd : false;
}

export const featureFlags = {
  authMagicLinkOnly: resolveFlag(import.meta.env.VITE_FEATURE_AUTH_MAGIC_LINK_ONLY, true),
  phoneOptional: resolveFlag(import.meta.env.VITE_FEATURE_PHONE_OPTIONAL, true),
  publicRsvp: resolveFlag(import.meta.env.VITE_FEATURE_PUBLIC_RSVP, true),
  nativeIosEnabled: resolveFlag(import.meta.env.VITE_FEATURE_NATIVE_IOS_ENABLED, false),
} as const;
