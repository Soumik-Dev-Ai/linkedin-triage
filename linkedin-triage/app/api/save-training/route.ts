import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
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
