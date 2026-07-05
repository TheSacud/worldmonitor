import type { EntitlementState } from './entitlements';

export interface SelfHostUser {
  id: string;
  name: string;
  email: string;
  role: 'pro';
}

export interface SelfHostConfig {
  enabled: boolean;
  configured?: boolean;
  autoSession?: boolean;
  user?: SelfHostUser;
  entitlements?: EntitlementState;
}

let cachedConfig: SelfHostConfig | null = null;
let pendingConfig: Promise<SelfHostConfig> | null = null;

const DISABLED_CONFIG: SelfHostConfig = { enabled: false };

async function refreshSelfHostSession(): Promise<void> {
  await fetch('/api/wm-session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => undefined);
}

export function getCachedSelfHostConfig(): SelfHostConfig | null {
  return cachedConfig;
}

export async function loadSelfHostConfig(): Promise<SelfHostConfig> {
  if (cachedConfig) return cachedConfig;
  if (pendingConfig) return pendingConfig;

  pendingConfig = fetch('/api/self-host-config', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
    .then(async (resp) => {
      if (!resp.ok) return DISABLED_CONFIG;
      const parsed = await resp.json().catch(() => null) as SelfHostConfig | null;
      if (!parsed || parsed.enabled !== true || !parsed.user || !parsed.entitlements) {
        return { enabled: false, configured: Boolean(parsed?.configured) };
      }
      if (parsed.autoSession === true) {
        await refreshSelfHostSession();
      }
      return parsed;
    })
    .catch(() => DISABLED_CONFIG)
    .then((config) => {
      cachedConfig = config;
      pendingConfig = null;
      return config;
    });

  return pendingConfig;
}