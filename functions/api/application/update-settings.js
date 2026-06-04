export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const { token, passcode, rateValue, rateType, startDate, endDate, linenService, paymentTermsChoice } = data;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Application token is required.' }), { status: 400 });
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

    // Fallback to legacy passcode
    if (!isAuthorized && passcode) {
      const expectedPasscode = context.env.ADMIN_PASSCODE || 'HouseNow!6969';
      if (passcode === expectedPasscode) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Admin access required.' }), { status: 401 });
    }

    // 2. Fetch and check status
    const appKey = `application:${token}`;
    const rawApp = await kv.get(appKey);
    if (!rawApp) {
      return new Response(JSON.stringify({ error: 'Application record not found.' }), { status: 404 });
    }

    const app = JSON.parse(rawApp);

    // Prevent updates if already signed by the tenant
    if (app.status === 'pending_owner' || app.status === 'completed') {
      return new Response(JSON.stringify({ error: 'Cannot update settings after the contract has been signed by the tenant.' }), { status: 400 });
    }

    // 3. Update settings
    if (rateValue !== undefined) app.rateValue = Number(rateValue);
    if (rateType !== undefined) app.rateType = rateType; // 'daily' | 'weekly' | 'monthly'
    if (startDate !== undefined) app.startDate = startDate;
    if (endDate !== undefined) app.endDate = endDate;
    if (linenService !== undefined) app.linenService = !!linenService;
    if (paymentTermsChoice !== undefined) app.paymentTermsChoice = paymentTermsChoice; // 'full' | 'monthly'

    // Synchronize legacy rent value for backwards compatibility
    if (app.rateValue) {
      if (app.rateType === 'weekly') {
        app.rent = app.rateValue;
      } else if (app.rateType === 'daily') {
        app.rent = app.rateValue * 7;
      } else if (app.rateType === 'monthly') {
        app.rent = Math.round((app.rateValue * 12) / 52);
      }
    }

    // 4. Save to KV
    await kv.put(appKey, JSON.stringify(app));

    return new Response(JSON.stringify({ success: true, message: 'Application settings updated successfully.', application: app }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500 });
  }
}
