export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const { passcode, manual } = data;

    // 1. Verify admin passcode
    const expectedPasscode = context.env.ADMIN_PASSCODE || 'Hamilton66';
    if (passcode !== expectedPasscode) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid admin passcode' }), { status: 401 });
    }

    if (!manual) {
      return new Response(JSON.stringify({ error: 'Missing manual content' }), { status: 400 });
    }

    const kv = context.env.APPLICATIONS_KV;
    if (!kv) {
      return new Response(JSON.stringify({ error: 'System Error: APPLICATIONS_KV binding is missing in Cloudflare.' }), { status: 500 });
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
