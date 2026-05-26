export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const { token, tenantDetails } = data;

    if (!token || !tenantDetails) {
      return new Response(JSON.stringify({ error: 'Missing token or application details' }), { status: 400 });
    }

    const kv = context.env.APPLICATIONS_KV;
    if (!kv) {
      return new Response(JSON.stringify({ error: 'System Error: APPLICATIONS_KV binding is missing in Cloudflare.' }), { status: 500 });
    }

    // 1. Fetch existing application
    const rawApp = await kv.get(`application:${token}`);
    if (!rawApp) {
      return new Response(JSON.stringify({ error: 'Application not found' }), { status: 404 });
    }

    const app = JSON.parse(rawApp);

    // Allow editing from both initial and pre-signature states (user may navigate back)
    if (app.status !== 'pending_tenant' && app.status !== 'pending_tenant_signature') {
      return new Response(JSON.stringify({ error: 'Application is not in editable status' }), { status: 400 });
    }

    // 2. Validate details
    const required = ['name', 'address', 'phone', 'email', 'emergencyName', 'emergencyRelationship', 'emergencyPhone', 'emergencyEmail', 'bookingOption', 'transferMethod', 'paymentDate'];
    for (const field of required) {
      if (!tenantDetails[field]) {
        return new Response(JSON.stringify({ error: `Missing required field: ${field}` }), { status: 400 });
      }
    }

    // Validate passport upload
    if (!tenantDetails.passportData) {
      return new Response(JSON.stringify({ error: 'Passport upload is required for verification' }), { status: 400 });
    }

    // 3. Update application details
    app.tenantDetails = {
      name: tenantDetails.name,
      address: tenantDetails.address,
      phone: tenantDetails.phone,
      email: tenantDetails.email,
      occupants: tenantDetails.occupants || [], // array of { name, age }
      passportData: tenantDetails.passportData, // base64 data url
      flightNumber: tenantDetails.flightNumber || '',
      landingTime: tenantDetails.landingTime || '',
      emergencyName: tenantDetails.emergencyName,
      emergencyRelationship: tenantDetails.emergencyRelationship,
      emergencyPhone: tenantDetails.emergencyPhone,
      emergencyEmail: tenantDetails.emergencyEmail,
      bookingOption: tenantDetails.bookingOption, // 'A' or 'B'
      transferMethod: tenantDetails.transferMethod, // 'wire' or 'digital'
      paymentDate: tenantDetails.paymentDate
    };

    // Keep status as 'pending_tenant' but indicate details are uploaded, ready for signature
    app.status = 'pending_tenant_signature';

    await kv.put(`application:${token}`, JSON.stringify(app));

    return new Response(JSON.stringify({ success: true, status: app.status }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500 });
  }
}
