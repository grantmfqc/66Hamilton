export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const { passcode, rent, startDate, linenService } = data;

    // 1. Verify admin passcode
    const expectedPasscode = context.env.ADMIN_PASSCODE || 'HouseNow!6969';
    if (passcode !== expectedPasscode) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid admin passcode' }), { status: 401 });
    }

    // 2. Check KV binding
    const kv = context.env.APPLICATIONS_KV;
    if (!kv) {
      return new Response(JSON.stringify({ error: 'System Error: APPLICATIONS_KV binding is missing in Cloudflare.' }), { status: 500 });
    }

    // 3. Generate unique application ID
    const applicationId = crypto.randomUUID();

    // 4. Initialize application data
    const application = {
      id: applicationId,
      status: 'pending_tenant', // pending_tenant | pending_owner | completed
      createdAt: new Date().toISOString(),
      rent: rent || 2400, // weekly rate
      startDate: startDate || new Date().toISOString().split('T')[0],
      linenService: !!linenService,
      tenantDetails: null,
      tenantSignature: null,
      tenantSignedAt: null,
      ownerSignature: null,
      ownerSignedAt: null,
      feedback: [],
      maintenance: []
    };

    // 5. Save to KV
    await kv.put(`application:${applicationId}`, JSON.stringify(application));

    return new Response(JSON.stringify({ 
      success: true, 
      id: applicationId,
      inviteUrl: `${new URL(context.request.url).origin}/apply.html?token=${applicationId}`
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500 });
  }
}
