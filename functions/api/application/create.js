export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const { passcode, rent, startDate, endDate, linenService, rateType, rateValue, paymentTermsChoice, securityBond, cleaningFrequency, utilityBaseline, noGst, separateUtilitiesEnabled, separateUtilitiesRate, carHireEnabled, carHireRate, autoRenew } = data;

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

    // 3. Generate unique application ID
    const applicationId = crypto.randomUUID();

    // 4. Initialize application data
    const finalRateType = rateType || 'weekly';
    const finalRateValue = rateValue || rent || 2400;

    let computedWeeklyRent = finalRateValue;
    if (finalRateType === 'daily') {
      computedWeeklyRent = finalRateValue * 7;
    } else if (finalRateType === 'monthly') {
      computedWeeklyRent = Math.round((finalRateValue * 12) / 52);
    }

    const application = {
      id: applicationId,
      status: 'pending_tenant', // pending_tenant | pending_owner | completed
      createdAt: new Date().toISOString(),
      rent: computedWeeklyRent, // weekly rate
      rateType: finalRateType,
      rateValue: finalRateValue,
      paymentTermsChoice: paymentTermsChoice || 'full', // 'full' | 'monthly'
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || null,
      linenService: !!linenService,
      securityBond: securityBond !== undefined ? securityBond : 5000,
      cleaningFrequency: cleaningFrequency || 'weekly',
      utilityBaseline: utilityBaseline !== undefined ? Number(utilityBaseline) : 500,
      noGst: !!noGst,
      separateUtilitiesEnabled: !!separateUtilitiesEnabled,
      separateUtilitiesRate: separateUtilitiesRate !== undefined ? Number(separateUtilitiesRate) : 1080,
      carHireEnabled: !!carHireEnabled,
      carHireRate: carHireRate !== undefined ? Number(carHireRate) : 1500,
      autoRenew: !!autoRenew,
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
