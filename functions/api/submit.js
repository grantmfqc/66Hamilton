export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const { name, email, org, token } = data;

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

    const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'The Hamilton Residence <prospectus@contact.premiumservice.ai>',
          to: email,
          bcc: 'grant@orcacom.co.nz', // Alert owner
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
                <img src="https://premiumservice.ai/assets/hero-platter.jpg" alt="The Hamilton Residence" class="hero" />
                <div class="content">
                  <span class="gold-text">Private Corporate Lease</span>
                  <h1>The Hamilton Residence</h1>
                  <p>Dear ${name},</p>
                  <p>Thank you for your enquiry regarding Apartment 1, 66 Hamilton Road, Herne Bay.</p>
                  <p>As requested, please find your exclusive digital prospectus attached to this email. It contains comprehensive details regarding the residence, including floor plans, inclusions, and lease terms.</p>
                  <a href="https://premiumservice.ai/assets/prospectus.pdf" class="btn">VIEW PROSPECTUS ONLINE</a>
                </div>
                <div class="footer">
                  This communication is intended for ${email} (${org || 'Private Enquiry'}).<br/>
                  &copy; ${new Date().getFullYear()} The Hamilton Residence. All rights reserved.
                </div>
              </div>
            </body>
            </html>
          `,
          attachments: [
            {
              filename: 'The_Hamilton_Residence_Prospectus.pdf',
              path: 'https://premiumservice.ai/assets/prospectus.pdf'
            }
          ]
        })
      });
      if (!resendRes.ok) {
        console.error('Failed to send email via Resend', await resendRes.text());
        // Continue to return success to the user even if email delivery fails,
        // or you could return an error here depending on preference.
      }

    // Return success
    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500 });
  }
}
