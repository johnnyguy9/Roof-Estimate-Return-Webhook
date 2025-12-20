// /api/estimate-callback.ts
import { kv } from '@vercel/kv';

const LOG_PREFIX = '[EstimateCallback]';

function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${LOG_PREFIX} [${level.toUpperCase()}] ${message}`, data ? JSON.stringify(data) : '');
}

export default async function handler(req: any, res: any) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  log('info', '=== CALLBACK RECEIVED ===', { 
    requestId,
    method: req.method
  });

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { callbackId, status } = req.body;
    
    // Extract totalEstimate from various possible field names
    const totalEstimate = req.body.totalEstimate || 
                          req.body['Total Estimate $'] || 
                          req.body['total_estimate_'];
    
    const squares = req.body.squares || req.body.Squares;
    const message = req.body.message;
    
    log('info', 'Body parsed', { 
      requestId,
      callbackId,
      status,
      totalEstimate,
      squares
    });

    // Validate callbackId
    if (!callbackId || typeof callbackId !== 'string') {
      log('error', 'Missing callbackId', { requestId });
      return res.status(400).json({ error: 'Missing callbackId' });
    }

    // Status defaults to success
    const validStatus = (status && ['success', 'error'].includes(status)) ? status : 'success';

    // Validate totalEstimate
    if (validStatus === 'success' && typeof totalEstimate !== 'number') {
      log('error', 'Invalid totalEstimate', { requestId, totalEstimate, type: typeof totalEstimate });
      return res.status(400).json({ error: 'totalEstimate must be a number' });
    }

    // Build result
    const result = {
      status: validStatus,
      receivedAt: Date.now(),
      ...(totalEstimate !== undefined && { totalEstimate }),
      ...(squares !== undefined && { squares }),
      ...(message && { message })
    };
    
    // Store in Redis with 5 minute expiry
    await kv.set(`estimate:${callbackId}`, result, { ex: 300 });
    
    log('info', '✓ Result stored in Redis', { requestId, callbackId, result });

    return res.status(200).json({ 
      success: true,
      callbackId,
      stored: true
    });

  } catch (error: any) {
    log('error', 'Error processing callback', { 
      requestId, 
      error: error.message
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
