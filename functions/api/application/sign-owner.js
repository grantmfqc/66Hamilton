export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const { token, ownerSignature, pdfData } = data;

    if (!token || !ownerSignature) {
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

    if (app.status !== 'pending_owner') {
      return new Response(JSON.stringify({ error: 'Application is not in a status ready for owner signature' }), { status: 400 });
    }

    // 2. Save owner signature and PDF data
    app.ownerSignature = ownerSignature;
    app.ownerSignedAt = new Date().toISOString();
    app.status = 'completed';
    
    // Store PDF in the app object inside KV so it's always downloadable online
    if (pdfData) {
      app.signedPdfData = pdfData;
    }

    await kv.put(`application:${token}`, JSON.stringify(app));



    // 4. Send confirmation emails to both Tenant and Owner
    if (context.env.RESEND_API_KEY) {
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

      // Email to Tenant
      const emailToTenant = fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'The Hamilton Residence <prospectus@contact.premiumservice.ai>',
          to: app.tenantDetails.email,
          subject: 'Executed Agreement & Onboarding Portal - 66 Hamilton Road',
          attachments: emailAttachments,
          html: `
            <div style="font-family: sans-serif; background-color: #0b0b0d; color: #ffffff; padding: 40px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #C9A96E; font-weight: normal; font-size: 24px;">Welcome to The Hamilton Residence</h2>
              <p>Dear ${app.tenantDetails.name},</p>
              <p>We are pleased to inform you that your Licence to Occupy agreement for 66 Hamilton Road has been fully executed by both parties.</p>
              <p>A copy of your fully executed agreement has been attached to this email as a PDF.</p>
              
              <p>Your onboarding portal is now fully unlocked. You can use it to:</p>
              <ul style="color: #a0a0a5; line-height: 1.6;">
                <li>Download the fully executed PDF contract at any time.</li>
                <li>Access the complete Apartment House Manual (including check-in keybox codes, rubbish schedules, and building guidelines).</li>
                <li>Configure your mobile devices to automatically connect to the building's Wi-Fi network.</li>
                <li>Submit maintenance requests, provide feedback, or leave a review.</li>
              </ul>

              <div style="text-align: center; margin: 35px 0;">
                <a href="${portalUrl}" style="background-color: #C9A96E; color: #000000; font-weight: bold; padding: 14px 28px; text-decoration: none; border-radius: 4px; display: inline-block;">ACCESS YOUR PORTAL</a>
              </div>

              <p style="font-size: 13px; color: #a0a0a5;">Please keep this email secure, as the link below is your private key to access the tenant portal at any time during your stay.</p>
              <p style="font-size: 12px; color: #555; border-top: 1px solid #2a2a2f; padding-top: 20px;">
                Secure link: <a href="${portalUrl}" style="color: #C9A96E;">${portalUrl}</a>
              </p>
            </div>
          `
        })
      });

      // Email to Owner
      const emailToOwner = fetch('https://api.resend.com/emails', {
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
              <p>The tenant has been sent their welcome email, the attached PDF, and tenant portal access details.</p>
              
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

      await Promise.all([emailToTenant, emailToOwner]);
    }

    return new Response(JSON.stringify({ success: true, status: app.status }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500 });
  }
}
