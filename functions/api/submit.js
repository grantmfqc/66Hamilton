export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const { name, email, org, phone, pref, token } = data;

    // 1. Verify Cloudflare Turnstile token
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing Turnstile token' }), { status: 400 });
    }

    const turnstileData = new FormData();
    turnstileData.append('secret', context.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA'); // dummy secret for the testing sitekey
    turnstileData.append('response', token);
    turnstileData.append('remoteip', context.request.headers.get('CF-Connecting-IP'));

    const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: turnstileData
    });
    const turnstileOutcome = await turnstileRes.json();

    if (!turnstileOutcome.success) {
      return new Response(JSON.stringify({ error: 'Turnstile verification failed.' }), { status: 403 });
    }

    // 2. Send Email via Resend (if configured)
    if (!context.env.RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'System Error: RESEND_API_KEY is missing in Cloudflare Dashboard.' }), { status: 500 });
    }

    const securePdfUrl = 'https://www.premiumservice.ai/assets/prospectus_SECURE_9a8B4f2X.pdf';

    const emailToProspect = fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'The Hamilton Residence <prospectus@contact.premiumservice.ai>',
          to: email,
          subject: 'The Hamilton Residence - Exclusive Prospectus',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0b0d; color: #ffffff; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #121214; border: 1px solid #2a2a2f; }
                .hero { width: 100%; max-height: 300px; object-fit: cover; }
                .content { padding: 40px; text-align: center; }
                .gold-text { color: #C9A96E; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; display: block; }
                h1 { font-family: 'Georgia', serif; font-weight: normal; font-size: 28px; margin: 0 0 20px 0; }
                p { font-size: 15px; line-height: 1.6; color: #a0a0a5; margin-bottom: 25px; }
                .btn { display: inline-block; background-color: #C9A96E; color: #000000; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: bold; letter-spacing: 1px; margin-top: 10px; }
                .footer { padding: 30px; text-align: center; font-size: 12px; color: #555; border-top: 1px solid #2a2a2f; }
              </style>
            </head>
            <body>
              <div class="container">
                <img src="https://www.premiumservice.ai/assets/hero-platter.jpg" alt="The Hamilton Residence" class="hero" />
                <div class="content">
                  <span class="gold-text">Private Corporate Lease</span>
                  <h1>The Hamilton Residence</h1>
                  <p>Dear ${name},</p>
                  <p>Thank you for your enquiry regarding 66 Hamilton Road, Herne Bay.</p>
                  <p>As requested, please find the exclusive digital prospectus for the residence below. It contains comprehensive details regarding the residence, including floor plans, executive inclusions, and corporate lease terms.</p>
                  <div style="margin: 30px 0;">
                    <a href="${securePdfUrl}" class="btn">DOWNLOAD PDF PROSPECTUS</a>
                  </div>
                  <p style="font-size: 13px;">You can also <a href="https://www.premiumservice.ai/prospectus.html" style="color: #C9A96E;">view the enhanced digital version online</a>.</p>
                </div>
                <div class="footer">
                  This communication is intended for ${email}.<br/>
                  &copy; ${new Date().getFullYear()} The Hamilton Residence. All rights reserved.
                </div>
              </div>
            </body>
            </html>
          `
        })
    });

    const emailToOwner = fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'The Hamilton Residence <prospectus@contact.premiumservice.ai>',
          to: 'grant@orcacom.co.nz',
          subject: `New Prospectus Request: ${name}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px;">
              <h2 style="color: #C9A96E;">New Prospectus Download</h2>
              <p>Someone has just downloaded the prospectus for 66 Hamilton Road.</p>
              <table border="1" cellpadding="10" style="border-collapse: collapse; width: 100%; max-width: 500px;">
                <tr><th style="text-align: left; width: 30%;">Name</th><td>${name}</td></tr>
                <tr><th style="text-align: left;">Email</th><td>${email}</td></tr>
                <tr><th style="text-align: left;">Phone</th><td>${phone}</td></tr>
                <tr><th style="text-align: left;">Organisation</th><td>${org || 'N/A'}</td></tr>
                <tr><th style="text-align: left;">Prefers</th><td>${pref}</td></tr>
              </table>
            </div>
          `
        })
    });

    const [resendRes, ownerRes] = await Promise.all([emailToProspect, emailToOwner]);

    if (!resendRes.ok) {
      console.error('Failed to send email via Resend', await resendRes.text());
    }

    // Return success
    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500 });
  }
}
