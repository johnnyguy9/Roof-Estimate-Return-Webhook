// /api/get-result.ts
// GET endpoint for polling estimate results

import { getResult } from './estimate-callback';

const LOG_PREFIX = '[GetResult]';

function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logData = data ? JSON.stringify(data, null, 2) : '';
  console.log(`${timestamp} ${LOG_PREFIX} [${level.toUpperCase()}] ${message}`, logData);
}

export default async function handler(req, res) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  log('info', '=== POLL REQUEST ===', { 
    requestId,
    method: req.method,
    query: req.query
  });

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { callbackId } = req.query;

    if (!callbackId || typeof callbackId !== 'string') {
      log('error', 'Invalid callbackId', { requestId, callbackId });
      return res.status(400).json({ error: 'Missing callbackId' });
    }

    log('info', 'Checking for result', { requestId, callbackId });

    // Get result from store
    const result = getResult(callbackId);

    if (!result) {
      log('info', 'Result not found yet', { requestId, callbackId });
      return res.status(404).json({ error: 'Result not found' });
    }

    log('info', 'Result found, returning to client', { 
      requestId, 
      callbackId,
      status: result.status 
    });

    return res.status(200).json(result);

  } catch (error) {
    log('error', 'Error retrieving result', {
      requestId,
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}
