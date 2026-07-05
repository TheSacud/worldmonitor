// Shared helpers for single-owner self-host deployments. This file must not
// expose secret values; public responses only contain non-secret account state.

import { validateApiKey } from './_api-key.js';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;

function isTruthy(value) {
  return TRUE_VALUES.has(String(value || '').trim().toLowerCase());
}

function envList(name) {
  return (process.env[name] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getSelfHostEnterpriseKey() {
  return envList('WORLDMONITOR_VALID_KEYS')[0] || '';
}

export function isSelfHostProConfigured() {
  return isTruthy(process.env.WM_SELF_HOST_PRO) && Boolean(getSelfHostEnterpriseKey());
}

export function isSelfHostAutoSessionEnabled() {
  return isSelfHostProConfigured() && isTruthy(process.env.WM_SELF_HOST_AUTO_SESSION);
}

export function getSelfHostUserId() {
  return (process.env.WM_SELF_HOST_USER_ID || 'selfhost-owner').trim() || 'selfhost-owner';
}

export function getSelfHostUser() {
  return {
    id: getSelfHostUserId(),
    name: (process.env.WM_SELF_HOST_USER_NAME || 'Self-host Owner').trim() || 'Self-host Owner',
    email: (process.env.WM_SELF_HOST_USER_EMAIL || 'owner@self-host.local').trim() || 'owner@self-host.local',
    role: 'pro',
  };
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

export async function isSelfHostRequestAuthorized(req) {
  if (!isSelfHostProConfigured()) return false;
  if (isSelfHostAutoSessionEnabled()) return true;
  const keyCheck = await validateApiKey(req, { forceKey: true });
  return keyCheck.valid === true && keyCheck.kind === 'enterprise';
}

export async function getSelfHostPublicConfig(req) {
  const configured = isSelfHostProConfigured();
  const authorized = configured && await isSelfHostRequestAuthorized(req);
  if (!authorized) {
    return { enabled: false, configured };
  }
  return {
    enabled: true,
    configured: true,
    autoSession: isSelfHostAutoSessionEnabled(),
    user: getSelfHostUser(),
    entitlements: getSelfHostEntitlements(),
  };
}