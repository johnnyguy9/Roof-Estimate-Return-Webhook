// /api/estimate-callback.ts
// Receives estimate results from GHL webhook

const LOG_PREFIX = '[EstimateCallback]';

function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logData = data ? JSON.stringify(data, null, 2) : '';
  console.log(`${timestamp} ${LOG_PREFIX} [${level.toUpperCase()}] ${message}`, logData);
}

interface EstimateResult {
  status: 'success' | 'error';
  totalEstimate?: number;
  message?: string;
  receivedAt: number;
}

// In-memory storage (results expire after 5 minutes)
const resultStore = new Map<string, EstimateResult>();
const RESULT_TTL = 5 * 60 * 1000;

// Auto-cleanup
setInterval(() => {
  const now = Date.now();
  for (const [id, result] of resultStore.entries()) {
    if (now - result.receivedAt > RESULT_TTL) {
      resultStore.delete(id);
    }
  }
}, 60 * 1000);

export default async function handler(req: any, res: any) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  log('info', '=== NEW REQUEST ===', { 
    requestId,
    method: req.method,
    url: req.url
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
    // Extract from GHL payload
    const { callbackId, status } = req.body;
    
    // GHL sends as "Total Estimate $" field
    const totalEstimate = req.body.totalEstimate || 
                          req.body['Total Estimate $'] || 
                          req.body['total_estimate_'];
    
    const message = req.body.message;
    
    log('info', 'Request body parsed', { 
      requestId,
      callbackId,
      status,
      totalEstimate,
      bodyKeys: Object.keys(req.body)
    });

    // Validate callbackId
    if (!callbackId || typeof callbackId !== 'string') {
      log('error', 'Invalid callbackId', { requestId, callbackId });
      return res.status(400).json({ error: 'Missing callbackId' });
    }

    // Status defaults to success
    const validStatus = status && ['success', 'error'].includes(status) ? status : 'success';

    // Validate totalEstimate
    if (validStatus === 'success' && typeof totalEstimate !== 'number') {
      log('error', 'Invalid totalEstimate', { requestId, totalEstimate });
      return res.status(400).json({ error: 'totalEstimate must be a number' });
    }

    // Store result
    const result: EstimateResult = {
      status: validStatus,
      receivedAt: Date.now(),
      ...(totalEstimate !== undefined && { totalEstimate }),
      ...(message && { message })
    };
    
    resultStore.set(callbackId, result);
    
    log('info', '✓ Callback processed', { requestId, callbackId, result });

    // Return success HTML
    return res.status(200).send(`
      <!DOCTYPE html>
      <html><body>
        <p>Estimate received: $${totalEstimate}</p>
        <script>console.log('Callback processed:', ${JSON.stringify(result)});</script>
      </body></html>
    `);

  } catch (error: any) {
    log('error', 'Error processing callback', { requestId, error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Export for polling endpoint
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
