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
          subject: 'The Hamilton Residence - Prospectus',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #C9A96E;">The Hamilton Residence</h2>
              <p>Dear ${name},</p>
              <p>Thank you for your interest in The Hamilton Residence.</p>
              <p>Please find the prospectus attached or <a href="https://premiumservice.ai/assets/prospectus.pdf">download it here</a>.</p>
              <br/>
              <p style="font-size: 12px; color: #888;">Organisation: ${org || 'N/A'}</p>
            </div>
          `
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
