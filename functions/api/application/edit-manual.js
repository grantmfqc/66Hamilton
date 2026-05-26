export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const { passcode, manual } = data;

    const kv = context.env.APPLICATIONS_KV;
    if (!kv) {
      return new Response(JSON.stringify({ error: 'System Error: APPLICATIONS_KV binding is missing in Cloudflare.' }), { status: 500 });
    }

    // 1. Verify admin authorization
    let isAuthorized = false;
    
    // Check session token
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
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid admin credentials' }), { status: 401 });
    }

    if (!manual) {
      return new Response(JSON.stringify({ error: 'Missing manual content' }), { status: 400 });
    }

    // 2. Validate manual fields
    const required = [
      'wifiSSID', 'wifiPassword', 'wifiSSID5', 'wifiPassword5', 'address',
      'accessPedestrian', 'accessDriveway', 'accessStreetGlass', 'accessBasementGlass', 'accessApartment', 'accessGarage',
      'checkinDetails', 'rubbishDetails', 'additionalDetails'
    ];
    for (const field of required) {
      if (manual[field] === undefined) {
        return new Response(JSON.stringify({ error: `Missing manual field: ${field}` }), { status: 400 });
      }
    }

    // Maintain old keybox code for robust backward compatibility
    manual.checkinCode = manual.accessPedestrian || '';

    // Ensure customSections is always a valid array
    if (!Array.isArray(manual.customSections)) {
      manual.customSections = [];
    }

    // 3. Save manual to KV
    await kv.put('manual:content', JSON.stringify(manual));

    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500 });
  }
}
