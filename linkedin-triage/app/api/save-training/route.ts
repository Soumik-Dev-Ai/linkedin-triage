import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

function checkApiKey(request: Request): NextResponse | null {
  const apiKey = request.headers.get('x-api-key');
  const expected = process.env.API_SECRET;
  if (!expected) return null;
  if (apiKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function POST(req: Request) {
  const authCheck = checkApiKey(req);
  if (authCheck) return authCheck;

  try {
    const { jsonlContent } = await req.json();

    if (!jsonlContent) {
      return NextResponse.json({ error: 'Missing content' }, { status: 400 });
    }

    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, 'training.jsonl');

    // Ensure data directory exists
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }

    // Overwrite training.jsonl with the new export from the UI
    await fs.writeFile(filePath, jsonlContent, 'utf-8');

    return NextResponse.json({ success: true, message: 'Training data saved locally for Few-Shot learning.' });
  } catch (error) {
    console.error('[save-training] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
