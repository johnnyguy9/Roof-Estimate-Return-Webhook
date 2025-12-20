// /api/get-result.ts
import { kv } from '@vercel/kv';

const LOG_PREFIX = '[GetResult]';

function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${LOG_PREFIX} [${level.toUpperCase()}] ${message}`, data ? JSON.stringify(data) : '');
}

export default async function handler(req: any, res: any) {
  const requestId = `poll_${Date.now()}`;
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { callbackId } = req.query;

  if (!callbackId || typeof callbackId !== 'string') {
    log('error', 'Invalid callbackId', { requestId });
    return res.status(400).json({ error: 'Missing callbackId' });
  }

  log('info', 'Checking Redis for result', { requestId, callbackId });

  try {
    // Get from Redis
    const result = await kv.get(`estimate:${callbackId}`);

    if (!result) {
      log('info', 'Result not found', { requestId, callbackId });
      return res.status(404).json({ error: 'Result not found' });
    }

    log('info', 'Result found', { requestId, callbackId });

    return res.status(200).json(result);

  } catch (error: any) {
    log('error', 'Redis error', { requestId, error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
