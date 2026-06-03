export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const { token, ownerSignature, pdfData, initialPaymentReceived } = data;

    if (!token || !ownerSignature) {
      return new Response(JSON.stringify({ error: 'Missing token or signature' }), { status: 400 });
    }

    if (!initialPaymentReceived) {
      return new Response(JSON.stringify({ error: 'Initial securement payment must be confirmed as received' }), { status: 400 });
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

    if (app.status !== 'pending_owner') {
      return new Response(JSON.stringify({ error: 'Application is not in a status ready for owner signature' }), { status: 400 });
    }

    // 2. Save owner signature and PDF data
    app.ownerSignature = ownerSignature;
    app.ownerSignedAt = new Date().toISOString();
    app.initialPaymentReceived = true;
    app.status = 'completed';

    // Store PDF in KV so it's always downloadable from the admin panel
    if (pdfData) {
      app.signedPdfData = pdfData;
    }

    await kv.put(`application:${token}`, JSON.stringify(app));

    // 3. Auto-register tenant emails in portal_access_emails
    try {
      const portalKey = 'portal_access_emails';
      const rawPortal = await kv.get(portalKey);
      const portalEmails = rawPortal ? JSON.parse(rawPortal) : [];
      const toAdd = [
        app.tenantDetails?.email?.trim().toLowerCase(),
        app.tenantDetails?.primaryOccupantEmail?.trim().toLowerCase()
      ].filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      for (const email of toAdd) {
        if (!portalEmails.includes(email)) {
          portalEmails.push(email);
        }
      }
      await kv.put(portalKey, JSON.stringify(portalEmails));
    } catch (portalErr) {
      console.error('Failed to update portal_access_emails:', portalErr);
    }

    // 4. Send exactly 2 emails: tenant billing email then admin.
    // Sent SEQUENTIALLY with a 700ms gap to respect Resend's 2 req/sec rate limit.
    const emailErrors = [];

    if (context.env.RESEND_API_KEY) {
      const loginUrl  = `${new URL(context.request.url).origin}/index.html?login=1`;
      const portalUrl = `${new URL(context.request.url).origin}/apply.html?token=${token}`;
      const adminUrl  = `${new URL(context.request.url).origin}/admin.html`;

      // Respect Resend's 2 requests/sec limit by waiting 2 seconds before the first email
      await new Promise(resolve => setTimeout(resolve, 2000));

      // --- Email 1: Tenant (billing email only) ---
      const tenantEmail = app.tenantDetails?.email?.trim().toLowerCase();
      if (!tenantEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenantEmail)) {
        emailErrors.push('No valid billing email found — tenant notification skipped.');
      } else {
        const resTenant = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${context.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'The Hamilton Residence <prospectus@contact.premiumservice.ai>',
            to: tenantEmail,
            subject: 'Your Executed Licence to Occupy — 66 Hamilton Road, Herne Bay',
            html: `
              <div style="font-family:'Times New Roman',serif;background-color:#0b0b0d;color:#ffffff;padding:40px;border-radius:8px;max-width:600px;margin:0 auto;border:1px solid #1a1a1c;">
                <div style="text-align:center;border-bottom:1px solid rgba(201,169,110,0.2);padding-bottom:20px;margin-bottom:30px;">
                   <h1 style="color:#c9a96e;font-size:26px;font-weight:normal;margin:0;letter-spacing:2px;">THE HAMILTON RESIDENCE</h1>
                   <p style="color:#888;font-size:11px;margin:5px 0 0;text-transform:uppercase;letter-spacing:1px;">Premium Serviced Accommodation</p>
                </div>
                <p style="font-size:15px;line-height:1.6;color:#d0d0d5;">Dear ${app.tenantDetails.name},</p>
                <p style="font-size:15px;line-height:1.6;color:#d0d0d5;">Your Licence to Occupy agreement for 66 Hamilton Road has been fully executed by both parties.</p>
                <p style="font-size:15px;line-height:1.6;color:#d0d0d5;">You can view, download, or print a copy of your executed agreement at any time by clicking the button below:</p>
                <div style="text-align:center;margin:35px 0;">
                  <a href="${new URL(context.request.url).origin}/view-agreement.html?token=${token}" style="background-color:#c9a96e;color:#000000;font-weight:bold;padding:14px 28px;text-decoration:none;border-radius:4px;display:inline-block;letter-spacing:1px;margin-bottom:15px;">VIEW EXECUTED AGREEMENT</a>
                  <br/><br/>
                  <a href="${loginUrl}" style="color:#c9a96e;text-decoration:underline;font-size:14px;">Log in to Resident Portal</a>
                </div>
                <p style="font-size:15px;line-height:1.6;color:#d0d0d5;">Once logged in you can access:</p>
                <ul style="color:#a0a0a5;line-height:1.8;font-size:14px;padding-left:20px;">
                  <li>The <strong>House Manual</strong> (check-in instructions &amp; building access codes)</li>
                  <li><strong>Smart Wi-Fi</strong> setup tools</li>
                  <li>Your <strong>Payment Schedule</strong></li>
                  <li><strong>Maintenance Requests</strong> and feedback</li>
                </ul>
                <div style="border-top:1px solid rgba(201,169,110,0.1);padding-top:20px;margin-top:40px;text-align:center;font-size:11px;color:#888;">
                  <p style="margin:0;">Apartment 1, 66 Hamilton Road, Herne Bay, Auckland 1011, New Zealand</p>
                </div>
              </div>
            `
          })
        });
        if (!resTenant.ok) {
          const err = await resTenant.text();
          emailErrors.push(`Tenant email failed: ${err}`);
        }
      }

      // 2000ms pause — respect Resend's 2 requests/sec rate limit
      await new Promise(resolve => setTimeout(resolve, 2000));

      // --- Email 2: Admin/Owner ---
      const resOwner = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${context.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'The Hamilton Residence <prospectus@contact.premiumservice.ai>',
          to: 'grant@orcacom.co.nz',
          subject: `Executed Contract Finalized: ${app.tenantDetails.name}`,
          html: `
            <div style="font-family:sans-serif;background-color:#0b0b0d;color:#ffffff;padding:40px;border-radius:8px;max-width:600px;margin:0 auto;">
              <h2 style="color:#C9A96E;font-weight:normal;font-size:24px;">Contract Executed Successfully</h2>
              <p>Dear Grant,</p>
              <p>The agreement for <strong>${app.tenantDetails.name}</strong> is now fully signed and stored in your admin datastore.</p>
              <p>Tenant notified at: <strong>${app.tenantDetails?.email || 'unknown'}</strong></p>
              <div style="text-align:center;margin:35px 0;">
                <a href="${adminUrl}" style="background-color:#C9A96E;color:#000000;font-weight:bold;padding:14px 28px;text-decoration:none;border-radius:4px;display:inline-block;">VIEW EXECUTED AGREEMENT</a>
              </div>
              <p style="font-size:12px;color:#555;border-top:1px solid #2a2a2f;padding-top:20px;">
                Direct Contract Viewer Link: <a href="${new URL(context.request.url).origin}/view-agreement.html?token=${token}" style="color:#C9A96E;">View Contract</a>
                <br/><br/>
                Tenant Onboarding Link: <a href="${portalUrl}" style="color:#C9A96E;">${portalUrl}</a>
              </p>
            </div>
          `
        })
      });
      if (!resOwner.ok) {
        const err = await resOwner.text();
        emailErrors.push(`Owner email failed: ${err}`);
      }

    } else {
      emailErrors.push('RESEND_API_KEY not configured — no emails were sent.');
    }

    return new Response(JSON.stringify({
      success: true,
      status: app.status,
      emailErrors: emailErrors.length ? emailErrors : undefined
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500 });
  }
}
