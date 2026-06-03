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
    
    // Store PDF in the app object inside KV so it's always downloadable online
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

    // 4. Send confirmation emails to both Tenant and Owner
    const emailErrors = [];
    if (context.env.RESEND_API_KEY) {
      const loginUrl = `${new URL(context.request.url).origin}/index.html`;
      const portalUrl = `${new URL(context.request.url).origin}/apply.html?token=${token}`;

      // Setup Resend attachments if PDF is available
      const emailAttachments = [];
      if (pdfData) {
        const rawBase64 = pdfData.split(';base64,').pop();
        emailAttachments.push({
          content: rawBase64,
          filename: '66_Hamilton_Road_Tenancy_Agreement.pdf'
        });
      }

      // Collect all distinct, valid tenant email addresses to notify
      const billingEmail = app.tenantDetails?.email?.trim().toLowerCase();
      const primaryEmail = app.tenantDetails?.primaryOccupantEmail?.trim().toLowerCase();
      const tenantEmailSet = [...new Set([billingEmail, primaryEmail].filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];

      if (tenantEmailSet.length === 0) {
        emailErrors.push('No valid tenant email address found — tenant notification skipped.');
      }

      // Send to each distinct tenant email
      const tenantEmailPromises = tenantEmailSet.map(toEmail =>
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'The Hamilton Residence <prospectus@contact.premiumservice.ai>',
            to: toEmail,
            subject: 'Executed Tenancy Agreement & Portal Access - 66 Hamilton Road',
            attachments: emailAttachments,
            html: `
              <div style="font-family: 'Times New Roman', serif; background-color: #0b0b0d; color: #ffffff; padding: 40px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1a1a1c;">
                <div style="text-align: center; border-bottom: 1px solid rgba(201, 169, 110, 0.2); padding-bottom: 20px; margin-bottom: 30px;">
                  <h1 style="color: #c9a96e; font-size: 26px; font-weight: normal; margin: 0; letter-spacing: 2px;">THE HAMILTON RESIDENCE</h1>
                  <p style="color: #888; font-size: 11px; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Premium Serviced Accommodation</p>
                </div>

                <p style="font-size: 15px; line-height: 1.6; color: #d0d0d5;">Dear ${app.tenantDetails.name},</p>
                <p style="font-size: 15px; line-height: 1.6; color: #d0d0d5;">We are pleased to inform you that your Licence to Occupy agreement for 66 Hamilton Road has been fully executed by both parties.</p>
                <p style="font-size: 15px; line-height: 1.6; color: #d0d0d5;">A copy of your fully executed agreement has been attached to this email as a PDF.</p>

                <p style="font-size: 15px; line-height: 1.6; color: #d0d0d5;">To access your Resident Portal, click the button below. Sign in using your registered email address: <strong style="color: #c9a96e;">${toEmail}</strong>. A secure 6-digit code will be sent to you — enter it to authenticate.</p>

                <div style="text-align: center; margin: 35px 0;">
                  <a href="${loginUrl}" style="background-color: #c9a96e; color: #000000; font-weight: bold; padding: 14px 28px; text-decoration: none; border-radius: 4px; display: inline-block; letter-spacing: 1px;">LOG IN TO RESIDENT PORTAL</a>
                </div>

                <p style="font-size: 15px; line-height: 1.6; color: #d0d0d5;">Once logged in, you will have full access to your premium portal:</p>
                <ul style="color: #a0a0a5; line-height: 1.8; font-size: 14px; padding-left: 20px;">
                  <li>View the complete <strong>Apartment House Manual</strong> (check-in guidelines and building keycodes).</li>
                  <li>Access tools to connect your devices to the <strong>Smart Wi-Fi Network</strong>.</li>
                  <li>Track and view your <strong>Calculated Payment Schedule</strong>.</li>
                  <li>Submit <strong>Maintenance Requests</strong>, write feedback, or leave a review.</li>
                </ul>

                <div style="border-top: 1px solid rgba(201, 169, 110, 0.1); padding-top: 20px; margin-top: 40px; text-align: center; font-size: 11px; color: #888;">
                  <p style="margin: 0;">Apartment 1, 66 Hamilton Road, Herne Bay, Auckland 1011, New Zealand</p>
                  <p style="margin: 5px 0 0 0;">Confidential Access Control System</p>
                </div>
              </div>
            `
          })
        })
      );

      // Email to Owner/Admin
      const ownerEmailPromise = fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'The Hamilton Residence <prospectus@contact.premiumservice.ai>',
          to: 'grant@orcacom.co.nz',
          subject: `Executed Contract Finalized: ${app.tenantDetails.name}`,
          attachments: emailAttachments,
          html: `
            <div style="font-family: sans-serif; background-color: #0b0b0d; color: #ffffff; padding: 40px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #C9A96E; font-weight: normal; font-size: 24px;">Contract Executed Successfully</h2>
              <p>Dear Grant,</p>
              <p>The agreement for <strong>${app.tenantDetails.name}</strong> is now fully signed and finalized. The executed PDF contract has been attached to this email and is safely stored in your secure administrative datastore.</p>
              <p>Tenant notification emails were sent to: <strong>${tenantEmailSet.join(', ') || 'none found'}</strong></p>
              <p>You can download the final PDF contract and view their onboarding details in your admin dashboard or via the private link below.</p>
              <div style="text-align: center; margin: 35px 0;">
                <a href="${portalUrl}" style="background-color: #C9A96E; color: #000000; font-weight: bold; padding: 14px 28px; text-decoration: none; border-radius: 4px; display: inline-block;">VIEW EXECUTED AGREEMENT</a>
              </div>
              <p style="font-size: 12px; color: #555; border-top: 1px solid #2a2a2f; padding-top: 20px;">
                Tenant Link: <a href="${portalUrl}" style="color: #C9A96E;">${portalUrl}</a>
              </p>
            </div>
          `
        })
      });

      const allResults = await Promise.all([...tenantEmailPromises, ownerEmailPromise]);
      const tenantResults = allResults.slice(0, tenantEmailPromises.length);
      const ownerResult = allResults[allResults.length - 1];

      for (let i = 0; i < tenantResults.length; i++) {
        if (!tenantResults[i].ok) {
          const errText = await tenantResults[i].text();
          emailErrors.push(`Tenant email to ${tenantEmailSet[i]} failed: ${errText}`);
        }
      }
      if (!ownerResult.ok) {
        const errText = await ownerResult.text();
        emailErrors.push(`Owner email failed: ${errText}`);
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
