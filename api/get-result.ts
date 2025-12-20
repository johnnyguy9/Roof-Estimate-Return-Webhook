// /api/get-result.ts
// GET endpoint for polling results

import { getResult } from './estimate-callback';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { callbackId } = req.query;

  if (!callbackId) {
    return res.status(400).json({ error: 'Missing callbackId' });
  }

  const result = getResult(callbackId as string);

  if (!result) {
    return res.status(404).json({ error: 'Result not found' });
  }

  return res.status(200).json(result);
}
