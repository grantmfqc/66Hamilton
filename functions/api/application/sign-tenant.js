export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const { token, tenantSignature } = data;

    if (!token || !tenantSignature) {
      return new Response(JSON.stringify({ error: 'Missing token or signature' }), { status: 400 });
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

    if (app.status !== 'pending_tenant_signature') {
      return new Response(JSON.stringify({ error: 'Application is not ready to sign, or has already been signed' }), { status: 400 });
    }

    // 2. Save signature
    app.tenantSignature = tenantSignature;
    app.tenantSignedAt = new Date().toISOString();
    app.status = 'pending_owner';

    await kv.put(`application:${token}`, JSON.stringify(app));

    // 3. Email Owner via Resend
    if (context.env.RESEND_API_KEY) {
      const ownerSignUrl = `${new URL(context.request.url).origin}/sign-owner.html?token=${token}`;
      
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'The Hamilton Residence <prospectus@contact.premiumservice.ai>',
          to: 'grant@orcacom.co.nz',
          subject: `Action Required: Rent Agreement Signed by ${app.tenantDetails.name}`,
          html: `
            <div style="font-family: sans-serif; background-color: #0b0b0d; color: #ffffff; padding: 40px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #C9A96E; font-weight: normal; font-size: 24px;">Rental Agreement Signed</h2>
              <p>Dear Grant,</p>
              <p>The applicant <strong>${app.tenantDetails.name}</strong> has completed the onboarding questionnaire and digitally signed the Licence to Occupy agreement for 66 Hamilton Road.</p>
              
              <div style="background-color: #121214; border: 1px solid #2a2a2f; padding: 20px; border-radius: 4px; margin: 25px 0;">
                <h3 style="color: #C9A96E; margin-top: 0;">Application Summary:</h3>
                <table style="width: 100%; border-collapse: collapse; color: #a0a0a5; font-size: 14px;">
                  <tr><td style="padding: 6px 0; font-weight: bold; width: 40%;">Applicant Name:</td><td>${app.tenantDetails.name}</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Weekly Rent:</td><td>NZD $2,400.00</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Commencement Date:</td><td>${app.startDate}</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Booking Deposit Option:</td><td>Option ${app.tenantDetails.bookingOption}</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Linen Service Selected:</td><td>${app.linenService ? 'Yes ($45+GST/wk)' : 'No'}</td></tr>
                </table>
              </div>

              <p>Please review their verification details and add your signature to execute and finalize the agreement.</p>
              
              <div style="text-align: center; margin: 35px 0;">
                <a href="${ownerSignUrl}" style="background-color: #C9A96E; color: #000000; font-weight: bold; padding: 14px 28px; text-decoration: none; border-radius: 4px; display: inline-block;">REVIEW & SIGN CONTRACT</a>
              </div>
              
              <p style="font-size: 12px; color: #555; border-top: 1px solid #2a2a2f; padding-top: 20px;">
                Secure link: <a href="${ownerSignUrl}" style="color: #C9A96E;">${ownerSignUrl}</a>
              </p>
            </div>
          `
        })
      });

      if (!emailRes.ok) {
        console.error('Failed to send Resend email to owner', await emailRes.text());
      }
    }

    return new Response(JSON.stringify({ success: true, status: app.status }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500 });
  }
}
