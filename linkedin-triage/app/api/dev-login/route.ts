import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const devEmail = process.env.DEVELOPER_EMAIL;
    const devPassword = process.env.DEVELOPER_PASSWORD;

    if (!devEmail || !devPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (email === devEmail && password === devPassword) {
      // In a real production app, we would return an HTTP-only JWT cookie.
      // For this triage tool, a simple success flag that the frontend stores in sessionStorage is sufficient for UI toggles.
      return NextResponse.json({ success: true, token: 'dev_token_123' });
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
