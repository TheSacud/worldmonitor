import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { jsonResponse } from './_json-response.js';
import { getSelfHostPublicConfig } from './_self-host.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (isDisallowedOrigin(req)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403);
  }

  const cors = getCorsHeaders(req, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, cors);
  }

  const body = await getSelfHostPublicConfig(req);
  return jsonResponse(body, 200, {
    ...cors,
    'Cache-Control': 'private, no-store',
  });
}