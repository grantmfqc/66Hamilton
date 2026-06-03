const KV_KEY = 'portal_access_emails';

async function authorizeAdmin(context) {
  const kv = context.env.APPLICATIONS_KV;
  const authHeader = context.request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const sessionToken = authHeader.substring(7);
    const sessionStr = await kv.get(`session:${sessionToken}`);
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      const userAgent = context.request.headers.get('user-agent') || 'unknown-agent';
      if (session.role === 'admin' && session.userAgent === userAgent) {
        return true;
      }
    }
  }
  // Legacy passcode fallback
  const url = new URL(context.request.url);
  const passcode = url.searchParams.get('passcode');
  if (passcode) {
    const expected = context.env.ADMIN_PASSCODE || 'HouseNow!6969';
    if (passcode === expected) return true;
  }
  return false;
}

// GET — list all portal access emails
export async function onRequestGet(context) {
  try {
    const kv = context.env.APPLICATIONS_KV;
    if (!kv) return new Response(JSON.stringify({ error: 'KV binding missing' }), { status: 500 });

    if (!(await authorizeAdmin(context))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const raw = await kv.get(KV_KEY);
    const emails = raw ? JSON.parse(raw) : [];
    return new Response(JSON.stringify({ emails }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// POST — add or remove an email
// Body: { action: 'add' | 'remove', email: string }
export async function onRequestPost(context) {
  try {
    const kv = context.env.APPLICATIONS_KV;
    if (!kv) return new Response(JSON.stringify({ error: 'KV binding missing' }), { status: 500 });

    if (!(await authorizeAdmin(context))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { action, email } = await context.request.json();
    if (!action || !email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'action and email are required' }), { status: 400 });
    }

    const normalised = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), { status: 400 });
    }

    const raw = await kv.get(KV_KEY);
    let emails = raw ? JSON.parse(raw) : [];

    if (action === 'add') {
      if (!emails.includes(normalised)) {
        emails.push(normalised);
      }
    } else if (action === 'remove') {
      emails = emails.filter(e => e !== normalised);
    } else {
      return new Response(JSON.stringify({ error: 'action must be add or remove' }), { status: 400 });
    }

    await kv.put(KV_KEY, JSON.stringify(emails));
    return new Response(JSON.stringify({ success: true, emails }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
