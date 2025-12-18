// /api/estimate-status/[callbackId].ts
// Polling endpoint - allows frontend to check for results
// Use this if direct webhook callback isn't working

import { getResult } from '../estimate-callback';

const LOG_PREFIX = '[EstimateStatus]';

function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logData = data ? JSON.stringify(data, null, 2) : '';
  console.log(`${timestamp} ${LOG_PREFIX} [${level.toUpperCase()}] ${message}`, logData);
}

export default async function handler(req, res) {
  const requestId = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  log('info', '=== STATUS CHECK REQUEST ===', { 
    requestId,
    method: req.method,
    url: req.url,
    query: req.query,
    headers: {
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']
    }
  });

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*'); // Change to your domain
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  log('info', 'CORS headers set', { requestId });

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    log('info', 'OPTIONS preflight handled', { requestId });
    return res.status(200).end();
  }

  // Only accept GET
  if (req.method !== 'GET') {
    log('warn', 'Invalid method attempted', { 
      requestId,
      method: req.method,
      allowedMethods: ['GET'] 
    });
    return res.status(405).json({ 
      error: 'Method not allowed',
      allowedMethods: ['GET'] 
    });
  }

  try {
    // Extract callbackId from query or path
    const { callbackId } = req.query;
    
    log('info', 'Extracted callbackId from query', { 
      requestId,
      callbackId,
      queryParams: req.query
    });

    if (!callbackId || typeof callbackId !== 'string') {
      log('error', 'Invalid callbackId in request', { 
        requestId,
        callbackId,
        type: typeof callbackId,
        query: req.query
      });
      return res.status(400).json({ 
        error: 'Missing or invalid callbackId parameter',
        received: callbackId
      });
    }
    
    log('info', 'callbackId validated, checking store', { requestId, callbackId });

    // Check for result
    const result = getResult(callbackId);
    
    if (!result) {
      // Result not ready yet
      log('info', 'Result not found - status pending', { 
        requestId,
        callbackId,
        message: 'Client should continue polling'
      });
      
      return res.status(200).json({ 
        status: 'pending',
        callbackId,
        message: 'Estimate is being calculated...',
        checkedAt: new Date().toISOString()
      });
    }

    // Result found
    log('info', '✓ Result found - returning to client', { 
      requestId,
      callbackId,
      resultStatus: result.status,
      totalEstimate: result.totalEstimate,
      age: `${Math.round((Date.now() - result.receivedAt) / 1000)}s`
    });
    
    return res.status(200).json({
      status: 'completed',
      callbackId,
      result,
      retrievedAt: new Date().toISOString()
    });

  } catch (error) {
    log('error', '✗ CRITICAL ERROR checking status', {
      requestId,
      error: error.message,
      stack: error.stack,
      query: req.query
    });
    
    return res.status(500).json({ 
      error: 'Internal server error',
      requestId,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
