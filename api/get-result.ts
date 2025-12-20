// /api/get-result.ts
// GET endpoint - frontend polls this for results

import { getResult } from './estimate-callback';

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
    log('error', 'Invalid callbackId', { requestId, callbackId });
    return res.status(400).json({ error: 'Missing callbackId' });
  }

  log('info', 'Checking for result', { requestId, callbackId });

  const result = getResult(callbackId);

  if (!result) {
    log('info', 'Result not found', { requestId, callbackId });
    return res.status(404).json({ error: 'Result not found' });
  }

  log('info', 'Result found', { requestId, callbackId, status: result.status });

  return res.status(200).json(result);
}
