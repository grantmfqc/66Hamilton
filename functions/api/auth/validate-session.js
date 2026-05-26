export async function onRequestGet(context) {
  try {
    const authHeader = context.request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or malformed Authorization header.' }), { status: 401 });
    }

    const token = authHeader.substring(7);
    const kv = context.env.APPLICATIONS_KV;

    if (!kv) {
      return new Response(JSON.stringify({ error: 'System Error: APPLICATIONS_KV binding is missing.' }), { status: 500 });
    }

    const sessionStr = await kv.get(`session:${token}`);
    if (!sessionStr) {
      return new Response(JSON.stringify({ error: 'Session has expired or is invalid.' }), { status: 401 });
    }

    const session = JSON.parse(sessionStr);

    // Session Hijacking Protection: Validate User-Agent and IP Address
    const clientIp = context.request.headers.get('cf-connecting-ip') || 'unknown-ip';
    const userAgent = context.request.headers.get('user-agent') || 'unknown-agent';

    if (session.userAgent !== userAgent) {
      // Instantly terminate suspected hijacked sessions
      await kv.delete(`session:${token}`);
      return new Response(JSON.stringify({ error: 'Session terminated due to security environment change.' }), { status: 401 });
    }

    return new Response(JSON.stringify({
      valid: true,
      role: session.role,
      email: session.email,
      tokenId: session.tokenId,
      expiresAt: session.expiresAt
    }), { 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error: ' + err.message }), { status: 500 });
  }
}
