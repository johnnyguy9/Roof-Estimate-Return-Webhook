// /api/estimate-callback.ts
// Receives estimate results from GHL workflow

const LOG_PREFIX = '[EstimateCallback]';

function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${LOG_PREFIX} [${level.toUpperCase()}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

interface EstimateResult {
  status: 'success' | 'error';
  totalEstimate?: number;
  squares?: number;
  message?: string;
  receivedAt: number;
}

// In-memory storage
const resultStore = new Map<string, EstimateResult>();
const RESULT_TTL = 5 * 60 * 1000; // 5 minutes

// Auto-cleanup
setInterval(() => {
  const now = Date.now();
  for (const [id, result] of resultStore.entries()) {
    if (now - result.receivedAt > RESULT_TTL) {
      resultStore.delete(id);
      log('info', 'Cleaned expired result', { callbackId: id });
    }
  }
}, 60 * 1000);

log('info', 'Result store initialized');

export default async function handler(req: any, res: any) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  log('info', '=== CALLBACK RECEIVED ===', { 
    requestId,
    method: req.method,
    headers: {
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent']
    }
  });

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    log('warn', 'Invalid method', { requestId, method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { callbackId, status } = req.body;
    
    // GHL sends the estimate field as "Total Estimate $"
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
      squares,
      bodyKeys: Object.keys(req.body).slice(0, 10)
    });

    // Validate callbackId
    if (!callbackId || typeof callbackId !== 'string') {
      log('error', 'Missing callbackId', { requestId, callbackId });
      return res.status(400).json({ error: 'Missing callbackId' });
    }

    log('info', 'callbackId validated', { requestId, callbackId });

    // Status defaults to success
    const validStatus = (status && ['success', 'error'].includes(status)) ? status : 'success';
    
    log('info', 'Status determined', { requestId, callbackId, status: validStatus });

    // Validate totalEstimate for success
    if (validStatus === 'success' && typeof totalEstimate !== 'number') {
      log('error', 'Invalid totalEstimate', { 
        requestId, 
        callbackId, 
        totalEstimate,
        type: typeof totalEstimate 
      });
      return res.status(400).json({ 
        error: 'totalEstimate must be a number',
        received: totalEstimate,
        type: typeof totalEstimate
      });
    }

    // Store result
    const result: EstimateResult = {
      status: validStatus,
      receivedAt: Date.now(),
      ...(totalEstimate !== undefined && { totalEstimate }),
      ...(squares !== undefined && { squares }),
      ...(message && { message })
    };
    
    resultStore.set(callbackId, result);
    
    log('info', '✓ Result stored', { 
      requestId, 
      callbackId, 
      result,
      storeSize: resultStore.size 
    });

    return res.status(200).json({ 
      success: true,
      callbackId,
      stored: true
    });

  } catch (error: any) {
    log('error', 'Error processing callback', { 
      requestId, 
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Export for get-result endpoint
export function getResult(callbackId: string): EstimateResult | null {
  const result = resultStore.get(callbackId);
  if (!result) return null;
  
  const age = Date.now() - result.receivedAt;
  if (age > RESULT_TTL) {
    resultStore.delete(callbackId);
    return null;
  }
  
  return result;
}
