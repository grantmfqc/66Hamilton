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
      
      const rateType = app.rateType || 'weekly';
      const rateValue = app.rateValue || app.rent || 2400;
      
      let dailyRent = 0;
      if (rateType === 'weekly') {
        dailyRent = rateValue / 7;
      } else if (rateType === 'daily') {
        dailyRent = rateValue;
      } else if (rateType === 'monthly') {
        dailyRent = rateValue / 30;
      }
      const weeklyRent = dailyRent * 7;

      let rateTypeDisplay = rateType;
      if (rateType === 'daily') rateTypeDisplay = 'day';
      else if (rateType === 'weekly') rateTypeDisplay = 'week';
      else if (rateType === 'monthly') rateTypeDisplay = 'month';

      const gstMultiplier = app.noGst ? 1.0 : 1.15;
      const weeklyRentFormatted = `NZD $${(weeklyRent * gstMultiplier).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${app.noGst ? '(GST Exempt)' : '(incl. GST)'}`;
      const rentRateFormatted = `NZD $${rateValue.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per ${rateTypeDisplay} ${app.noGst ? '(GST Exempt)' : '(excl. GST)'}`;
      
      const commencementDateFormatted = app.tenantDetails?.arrivalDate 
        ? new Date(app.tenantDetails.arrivalDate).toLocaleDateString('en-NZ', { dateStyle: 'long' }) 
        : app.startDate;

      const expiryDateFormatted = app.tenantDetails?.departureDate 
        ? new Date(app.tenantDetails.departureDate).toLocaleDateString('en-NZ', { dateStyle: 'long' }) 
        : (app.endDate || 'N/A');

      const paymentTermsChoice = app.paymentTermsChoice || 'full';
      let paymentOptionStr = '';
      if (paymentTermsChoice === 'full') {
        paymentOptionStr = `Option 1: Full Payment Upfront (Sub-option ${app.tenantDetails?.bookingOption || 'A'})`;
      } else {
        paymentOptionStr = 'Option 2: Monthly Installments';
      }

      const securityBond = app.securityBond !== undefined ? app.securityBond : 5000;
      const securityBondFormatted = `NZD $${securityBond.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const utilitiesFormatted = app.separateUtilitiesEnabled 
        ? `Yes (NZD $${(app.separateUtilitiesRate || 1080).toLocaleString('en-NZ', { minimumFractionDigits: 2 })}/mo)` 
        : 'No (Bundled)';

      const carHireFormatted = app.carHireEnabled 
        ? `Yes (Kia Sportage 2022, Reg PGS970 - NZD $${(app.carHireRate || 1500).toLocaleString('en-NZ', { minimumFractionDigits: 2 })}/mo)` 
        : 'No';

      const gstFormatted = app.noGst ? 'GST Exempt / Not Applicable' : '15% GST Applicable';

      const linenFormatted = app.linenService 
        ? (app.separateUtilitiesEnabled ? 'Yes ($30.00 per bed, billed in arrears)' : 'Yes ($45+GST/wk)')
        : 'No';

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
                  <tr><td style="padding: 6px 0; font-weight: bold; width: 45%;">Applicant Name:</td><td>${app.tenantDetails.name}</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Rent Rate:</td><td>${rentRateFormatted}</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Equivalent Weekly Rent:</td><td>${weeklyRentFormatted}</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Commencement Date:</td><td>${commencementDateFormatted}</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Expiry Date:</td><td>${expiryDateFormatted}</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Payment Terms:</td><td>${paymentOptionStr}</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Commercial Security Bond:</td><td>${securityBondFormatted}</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Separate Utilities:</td><td>${utilitiesFormatted}</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Vehicle Hire:</td><td>${carHireFormatted}</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">GST Status:</td><td>${gstFormatted}</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Linen Service Selected:</td><td>${linenFormatted}</td></tr>
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
