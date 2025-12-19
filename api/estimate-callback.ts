// /api/estimate-callback.ts
// Production-ready callback endpoint for GHL webhook responses

// ============================================
// LOGGING CONFIGURATION
// ============================================
const LOG_PREFIX = '[EstimateCallback]';

function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logData = data ? JSON.stringify(data, null, 2) : '';
  console.log(`${timestamp} ${LOG_PREFIX} [${level.toUpperCase()}] ${message}`, logData);
}

// ============================================
// IN-MEMORY STORAGE (IMPROVED)
// ============================================
// NOTE: For production, consider Redis, Upstash, or database
// In-memory storage works for serverless but has limitations:
// - Results clear on cold starts
// - No persistence across deployments
// - Limited to single instance

interface EstimateResult {
  status: 'success' | 'error';
  totalEstimate?: number;
  message?: string;
  receivedAt: number;
}

// Store results with automatic cleanup
const resultStore = new Map<string, EstimateResult>();

log('info', 'Result store initialized');

// Auto-cleanup old results (prevent memory leak)
const RESULT_TTL = 5 * 60 * 1000; // 5 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  log('info', 'Starting cleanup routine', { 
    currentStoreSize: resultStore.size,
    ttl: RESULT_TTL 
  });
  
  for (const [id, result] of resultStore.entries()) {
    const age = now - result.receivedAt;
    if (age > RESULT_TTL) {
      resultStore.delete(id);
      cleanedCount++;
      log('info', `Cleaned up expired result`, { 
        callbackId: id, 
        age: `${Math.round(age / 1000)}s` 
      });
    }
  }
  
  log('info', 'Cleanup completed', { 
    cleanedCount, 
    remainingCount: resultStore.size 
  });
}, 60 * 1000); // Run cleanup every minute

// ============================================
// MAIN HANDLER
// ============================================
export default async function handler(req, res) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  log('info', '=== NEW REQUEST ===', { 
    requestId,
    method: req.method,
    url: req.url,
    headers: {
      origin: req.headers.origin,
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent']
    }
  });

  // CORS headers (adjust origin in production)
  res.setHeader('Access-Control-Allow-Origin', '*'); // Change to your domain
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  log('info', 'CORS headers set', { requestId });

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    log('info', 'OPTIONS preflight request handled', { requestId });
    return res.status(200).end();
  }

  // Only accept POST
  if (req.method !== 'POST') {
    log('warn', 'Invalid method attempted', { 
      requestId,
      method: req.method,
      allowedMethods: ['POST'] 
    });
    return res.status(405).json({ 
      error: 'Method not allowed',
      allowedMethods: ['POST'] 
    });
  }

  try {
    log('info', 'Parsing request body', { requestId });
    
    // Extract and validate payload
    // GHL sends "Total Estimate $" as the field name, not "totalEstimate"
    const { callbackId, status } = req.body;
    const totalEstimate = req.body.totalEstimate || req.body['Total Estimate $'] || req.body['total_estimate_'];
    const message = req.body.message;
    
    log('info', 'Request body parsed', { 
      requestId,
      callbackId,
      status,
      totalEstimate,
      totalEstimateRaw: req.body['Total Estimate $'],
      hasMessage: !!message,
      bodyKeys: Object.keys(req.body)
    });

    // Validation: callbackId
    if (!callbackId || typeof callbackId !== 'string') {
      log('error', 'Validation failed: Invalid callbackId', { 
        requestId,
        callbackId,
        type: typeof callbackId 
      });
      return res.status(400).json({ 
        error: 'Missing or invalid callbackId',
        received: callbackId
      });
    }
    
    log('info', 'callbackId validated', { requestId, callbackId });

    // Status is now optional - default to 'success' if not provided or invalid
    const validStatus = status && ['success', 'error'].includes(status) ? status : 'success';
    
    if (status && !['success', 'error'].includes(status)) {
      log('warn', 'Invalid status provided, defaulting to success', { 
        requestId,
        callbackId,
        providedStatus: status,
        usingStatus: validStatus
      });
    }
    
    log('info', 'Status determined', { requestId, callbackId, status: validStatus });

    // Validation: totalEstimate for success
    if (validStatus === 'success') {
      if (typeof totalEstimate !== 'number') {
        log('error', 'Validation failed: Invalid totalEstimate for success', { 
          requestId,
          callbackId,
          totalEstimate,
          type: typeof totalEstimate
        });
        return res.status(400).json({ 
          error: 'totalEstimate must be a number for success status',
          received: totalEstimate,
          type: typeof totalEstimate
        });
      }
      
      if (totalEstimate < 0 || totalEstimate > 10000000) {
        log('warn', 'Suspicious totalEstimate value', { 
          requestId,
          callbackId,
          totalEstimate,
          reason: 'Out of expected range (0-10M)'
        });
      }
    }
    
    log('info', 'All validations passed', { requestId, callbackId });

    // Build result object
    const result: EstimateResult = {
      status: validStatus,
      receivedAt: Date.now(),
      ...(totalEstimate !== undefined && { totalEstimate }),
      ...(message && { message })
    };
    
    log('info', 'Result object built', { requestId, callbackId, result });

    // Store result
    const existingResult = resultStore.get(callbackId);
    if (existingResult) {
      log('warn', 'Overwriting existing result', { 
        requestId,
        callbackId,
        existingResult,
        newResult: result
      });
    }
    
    resultStore.set(callbackId, result);
    
    log('info', 'Result stored successfully', { 
      requestId,
      callbackId,
      storeSize: resultStore.size,
      storedAt: new Date(result.receivedAt).toISOString()
    });

    // Log summary
    log('info', '✓ Callback processed successfully', {
      requestId,
      callbackId,
      status: validStatus,
      totalEstimate,
      processingTime: `${Date.now() - result.receivedAt}ms`,
      currentStoreSize: resultStore.size
    });

    // Return HTML that notifies the parent window
    const notificationScript = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Processing Estimate</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0A0E14;
            color: #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .container {
            text-align: center;
            padding: 40px;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #2D3A4D;
            border-top-color: #00BFFF;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 20px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .message {
            font-size: 16px;
            color: #9FBDC9;
          }
          .debug {
            margin-top: 20px;
            font-size: 12px;
            color: #2D3A4D;
            font-family: monospace;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <p class="message">Processing your estimate...</p>
          <div class="debug">ID: ${callbackId.substring(0, 12)}...</div>
        </div>
        <script>
          (function() {
            console.log('[CallbackPage] Starting notification sequence');
            console.log('[CallbackPage] callbackId:', '${callbackId}');
            console.log('[CallbackPage] status:', '${validStatus}');
            
            const result = ${JSON.stringify(result)};
            const callbackId = ${JSON.stringify(callbackId)};
            
            let notificationSent = false;
            
            // Method 1: Direct function call (if available)
            console.log('[CallbackPage] Attempting Method 1: Direct parent.handleEstimateCallback');
            if (window.parent && typeof window.parent.handleEstimateCallback === 'function') {
              console.log('[CallbackPage] ✓ Found parent.handleEstimateCallback, calling...');
              try {
                window.parent.handleEstimateCallback(result);
                notificationSent = true;
                console.log('[CallbackPage] ✓ Successfully called parent.handleEstimateCallback');
              } catch (error) {
                console.error('[CallbackPage] ✗ Error calling parent.handleEstimateCallback:', error);
              }
            } else {
              console.log('[CallbackPage] ✗ parent.handleEstimateCallback not available');
            }
            
            // Method 2: Window opener (popup scenario)
            console.log('[CallbackPage] Attempting Method 2: opener.handleEstimateCallback');
            if (window.opener && typeof window.opener.handleEstimateCallback === 'function') {
              console.log('[CallbackPage] ✓ Found opener.handleEstimateCallback, calling...');
              try {
                window.opener.handleEstimateCallback(result);
                notificationSent = true;
                console.log('[CallbackPage] ✓ Successfully called opener.handleEstimateCallback');
                setTimeout(() => {
                  console.log('[CallbackPage] Closing popup window');
                  window.close();
                }, 500);
              } catch (error) {
                console.error('[CallbackPage] ✗ Error calling opener.handleEstimateCallback:', error);
              }
            } else {
              console.log('[CallbackPage] ✗ opener.handleEstimateCallback not available');
            }
            
            // Method 3: PostMessage (most reliable for iframes)
            console.log('[CallbackPage] Attempting Method 3: postMessage to parent');
            if (window.parent !== window) {
              console.log('[CallbackPage] ✓ Parent window detected, sending postMessage...');
              try {
                window.parent.postMessage({
                  type: 'ESTIMATE_RESULT',
                  callbackId: callbackId,
                  result: result
                }, '*');
                notificationSent = true;
                console.log('[CallbackPage] ✓ postMessage sent successfully');
              } catch (error) {
                console.error('[CallbackPage] ✗ Error sending postMessage:', error);
              }
            } else {
              console.log('[CallbackPage] ✗ No parent window (top-level window)');
            }
            
            // Method 4: Top window
            console.log('[CallbackPage] Attempting Method 4: top.handleEstimateCallback');
            if (window.top && window.top !== window && typeof window.top.handleEstimateCallback === 'function') {
              console.log('[CallbackPage] ✓ Found top.handleEstimateCallback, calling...');
              try {
                window.top.handleEstimateCallback(result);
                notificationSent = true;
                console.log('[CallbackPage] ✓ Successfully called top.handleEstimateCallback');
              } catch (error) {
                console.error('[CallbackPage] ✗ Error calling top.handleEstimateCallback:', error);
              }
            } else {
              console.log('[CallbackPage] ✗ top.handleEstimateCallback not available');
            }
            
            // Summary
            if (notificationSent) {
              console.log('[CallbackPage] ✓ Notification sent successfully via at least one method');
            } else {
              console.error('[CallbackPage] ✗ Failed to send notification via any method');
              console.error('[CallbackPage] Debug info:', {
                hasParent: window.parent !== window,
                hasOpener: !!window.opener,
                hasTop: window.top !== window,
                parentType: typeof window.parent,
                openerType: typeof window.opener,
                topType: typeof window.top
              });
            }
            
            // Auto-close if popup
            if (window.opener) {
              setTimeout(() => {
                console.log('[CallbackPage] Auto-closing popup window');
                window.close();
              }, 1000);
            }
          })();
        </script>
      </body>
      </html>
    `;
    
    log('info', 'Sending HTML response with notification script', { 
      requestId, 
      callbackId 
    });

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).send(notificationScript);

  } catch (error) {
    log('error', '✗ CRITICAL ERROR processing callback', {
      requestId,
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    
    return res.status(500).json({ 
      error: 'Internal server error',
      requestId,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// ============================================
// HELPER: GET STORED RESULT
// ============================================
// Used by polling endpoint if needed
export function getResult(callbackId: string): EstimateResult | null {
  log('info', 'Getting result from store', { callbackId });
  
  const result = resultStore.get(callbackId);
  
  if (!result) {
    log('warn', 'Result not found in store', { 
      callbackId,
      storeSize: resultStore.size,
      availableIds: Array.from(resultStore.keys()).slice(0, 5)
    });
    return null;
  }

  // Check if expired
  const age = Date.now() - result.receivedAt;
  if (age > RESULT_TTL) {
    log('warn', 'Result expired, removing from store', { 
      callbackId,
      age: `${Math.round(age / 1000)}s`,
      ttl: `${RESULT_TTL / 1000}s`
    });
    resultStore.delete(callbackId);
    return null;
  }
  
  log('info', 'Result found and valid', { 
    callbackId,
    status: result.status,
    age: `${Math.round(age / 1000)}s`
  });

  return result;
}

// ============================================
// HELPER: CLEAR RESULT (MANUAL CLEANUP)
// ============================================
export function clearResult(callbackId: string): boolean {
  log('info', 'Manual result clear requested', { callbackId });
  
  const existed = resultStore.has(callbackId);
  const deleted = resultStore.delete(callbackId);
  
  log('info', 'Result clear completed', { 
    callbackId,
    existed,
    deleted,
    newStoreSize: resultStore.size
  });
  
  return deleted;
}

// ============================================
// STATS (OPTIONAL - FOR MONITORING)
// ============================================
export function getStats() {
  const results = Array.from(resultStore.values());
  const now = Date.now();
  
  const stats = {
    totalStored: resultStore.size,
    successCount: results.filter(r => r.status === 'success').length,
    errorCount: results.filter(r => r.status === 'error').length,
    oldestResult: results.length > 0 ? Math.min(...results.map(r => r.receivedAt)) : null,
    newestResult: results.length > 0 ? Math.max(...results.map(r => r.receivedAt)) : null,
    averageAge: results.length > 0 
      ? Math.round(results.reduce((sum, r) => sum + (now - r.receivedAt), 0) / results.length / 1000)
      : null,
    callbackIds: Array.from(resultStore.keys())
  };
  
  log('info', 'Stats generated', stats);
  
  return stats;
}
