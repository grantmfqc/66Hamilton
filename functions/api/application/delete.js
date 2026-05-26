export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const { targetAppId } = data;

    if (!targetAppId) {
      return new Response(JSON.stringify({ error: 'Target Application ID is required.' }), { status: 400 });
    }

    const kv = context.env.APPLICATIONS_KV;
    if (!kv) {
      return new Response(JSON.stringify({ error: 'System Error: APPLICATIONS_KV binding is missing.' }), { status: 500 });
    }

    // 1. Authorize Admin
    let isAuthorized = false;
    const authHeader = context.request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.substring(7);
      const sessionStr = await kv.get(`session:${sessionToken}`);
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        const userAgent = context.request.headers.get('user-agent') || 'unknown-agent';
        if (session.role === 'admin' && session.userAgent === userAgent) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Admin access required.' }), { status: 401 });
    }

    // 2. Perform deletion
    const appKey = `application:${targetAppId}`;
    const rawApp = await kv.get(appKey);
    if (!rawApp) {
      return new Response(JSON.stringify({ error: 'Application record not found.' }), { status: 404 });
    }

    // Delete main application entry
    await kv.delete(appKey);

    return new Response(JSON.stringify({ success: true, message: 'Application agreement and associated data have been permanently deleted.' }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500 });
  }
}
