// Single-owner self-host entitlement helpers. Keep this server-side only:
// it reads env configuration, but never returns secret values.

// @ts-expect-error - JS module, no declaration file
import { validateApiKey } from '../../api/_api-key.js';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;

function isTruthy(value: string | undefined): boolean {
  return TRUE_VALUES.has(String(value || '').trim().toLowerCase());
}

function envList(name: string): string[] {
  return (process.env[name] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getSelfHostEnterpriseKey(): string {
  return envList('WORLDMONITOR_VALID_KEYS')[0] || '';
}

export function isSelfHostProConfigured(): boolean {
  return isTruthy(process.env.WM_SELF_HOST_PRO) && Boolean(getSelfHostEnterpriseKey());
}

export function isSelfHostAutoSessionEnabled(): boolean {
  return isSelfHostProConfigured() && isTruthy(process.env.WM_SELF_HOST_AUTO_SESSION);
}

export function getSelfHostUserId(): string {
  return (process.env.WM_SELF_HOST_USER_ID || 'selfhost-owner').trim() || 'selfhost-owner';
}

export function isSelfHostUserId(userId: string | null | undefined): boolean {
  return isSelfHostProConfigured() && userId === getSelfHostUserId();
}

export function getSelfHostEntitlements() {
  return {
    planKey: 'self_host_enterprise',
    features: {
      tier: 3,
      apiAccess: true,
      apiRateLimit: 1000,
      apiDailyAllowance: -1,
      maxDashboards: 1000,
      prioritySupport: true,
      exportFormats: ['csv', 'json', 'geojson', 'png', 'pdf'],
      mcpAccess: true,
    },
    validUntil: Date.now() + TEN_YEARS_MS,
  };
}

export async function resolveSelfHostRequest(request: Request): Promise<{ userId: string; entitlements: ReturnType<typeof getSelfHostEntitlements> } | null> {
  if (!isSelfHostProConfigured()) return null;
  if (isSelfHostAutoSessionEnabled()) {
    return { userId: getSelfHostUserId(), entitlements: getSelfHostEntitlements() };
  }
  const keyCheck = await validateApiKey(request, { forceKey: true }) as { valid?: boolean; kind?: string };
  if (keyCheck.valid === true && keyCheck.kind === 'enterprise') {
    return { userId: getSelfHostUserId(), entitlements: getSelfHostEntitlements() };
  }
  return null;
}