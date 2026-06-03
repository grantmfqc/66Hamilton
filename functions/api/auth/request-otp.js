export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const rawEmail = data.email;

    if (!rawEmail || typeof rawEmail !== 'string') {
      return new Response(JSON.stringify({ error: 'Valid email address is required.' }), { status: 400 });
    }

    const email = rawEmail.trim().toLowerCase();
    const kv = context.env.APPLICATIONS_KV;

    if (!kv) {
      return new Response(JSON.stringify({ error: 'System Error: APPLICATIONS_KV binding is missing.' }), { status: 500 });
    }

    // 1. Enforce Per-Email Rate Limit (60 seconds)
    const emailRateKey = `ratelimit:email:${email}`;
    const emailCooldown = await kv.get(emailRateKey);
    if (emailCooldown) {
      return new Response(JSON.stringify({ error: 'Please wait 60 seconds before requesting another code.' }), { status: 429 });
    }

    // 2. Enforce Per-IP Rate Limit (5 requests per hour)
    const clientIp = context.request.headers.get('cf-connecting-ip') || 'unknown-ip';
    const ipRateKey = `ratelimit:ip:${clientIp}`;
    const ipAttemptsStr = await kv.get(ipRateKey);
    const ipAttempts = ipAttemptsStr ? parseInt(ipAttemptsStr, 10) : 0;
    if (ipAttempts >= 5) {
      return new Response(JSON.stringify({ error: 'Hourly request limit exceeded. Please try again later.' }), { status: 429 });
    }

    // 3. Resolve Role and Permissions
    const expectedAdminEmail = (context.env.ADMIN_EMAIL || 'grant@orcacom.co.nz').trim().toLowerCase();
    let role = null;
    let tokenId = null;

    if (email === expectedAdminEmail) {
      role = 'admin';
    } else {
      // Scan all applications to find matching tenant email (billing email or primary occupant email)
      const list = await kv.list({ prefix: 'application:' });
      for (const key of list.keys) {
        const val = await kv.get(key.name);
        if (val) {
          const app = JSON.parse(val);
          if (app.tenantDetails) {
            const billingEmail = app.tenantDetails.email?.trim().toLowerCase();
            const primaryOccupantEmail = app.tenantDetails.primaryOccupantEmail?.trim().toLowerCase();
            if ((billingEmail && billingEmail === email) || (primaryOccupantEmail && primaryOccupantEmail === email)) {
              role = 'tenant';
              tokenId = app.id;
              break;
            }
          }
        }
      }

      // Fallback: check portal_access_emails (manually granted access, e.g. additional occupants)
      if (!role) {
        const portalRaw = await kv.get('portal_access_emails');
        const portalEmails = portalRaw ? JSON.parse(portalRaw) : [];
        if (portalEmails.includes(email)) {
          role = 'tenant';
          tokenId = null; // no specific application — portal access only
        }
      }
    }

    // 4. Save Cooldown & IP Rates (Independent of whether email is registered, to prevent abuse)
    await kv.put(emailRateKey, 'true', { expirationTtl: 60 });
    await kv.put(ipRateKey, (ipAttempts + 1).toString(), { expirationTtl: 3600 });

    // 5. User Enumeration Protection: If not registered, return silent success
    if (!role) {
      return new Response(JSON.stringify({ message: 'If your email is registered in our residence registry, a verification code will arrive shortly.' }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // 6. Cryptographically Secure OTP Generation
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const otp = ((array[0] % 900000) + 100000).toString(); // Generates exactly a 6-digit code

    // 7. Store OTP in KV with a strict 3-minute (180s) TTL
    const otpKey = `otp:${email}`;
    await kv.put(otpKey, JSON.stringify({ otp, role, tokenId, attempts: 0 }), { expirationTtl: 180 });

    // 8. Dispatch Email via Resend
    if (context.env.RESEND_API_KEY) {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: '66 Hamilton Road <prospectus@contact.premiumservice.ai>',
          to: email,
          subject: 'Your Access Code for 66 Hamilton Road',
          html: `
            <div style="font-family: 'Times New Roman', serif; background-color: #0b0b0d; color: #ffffff; padding: 40px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1a1a1c;">
              <div style="text-align: center; border-bottom: 1px solid rgba(201, 169, 110, 0.2); padding-bottom: 20px; margin-bottom: 30px;">
                <h1 style="color: #c9a96e; font-size: 26px; font-weight: normal; margin: 0; letter-spacing: 2px;">THE HAMILTON RESIDENCE</h1>
                <p style="color: #888; font-size: 11px; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Premium Serviced Accommodation</p>
              </div>
              
              <p style="font-size: 15px; line-height: 1.6; color: #d0d0d5;">Hello,</p>
              <p style="font-size: 15px; line-height: 1.6; color: #d0d0d5;">Please use the following single-use one-time verification code to securely sign in to your resident portal or administration dashboard:</p>
              
              <div style="text-align: center; margin: 40px 0;">
                <span style="font-family: monospace; font-size: 36px; font-weight: bold; color: #c9a96e; background: rgba(201, 169, 110, 0.05); padding: 15px 35px; border: 1px solid rgba(201, 169, 110, 0.2); border-radius: 6px; letter-spacing: 6px;">${otp}</span>
              </div>
              
              <p style="font-size: 13px; color: #ff6b6b; line-height: 1.5; background: rgba(255, 107, 107, 0.05); border: 1px solid rgba(255, 107, 107, 0.15); padding: 12px; border-radius: 4px;">
                <strong>Security Notice:</strong> This code is valid for exactly <strong>3 minutes</strong>. For your security, do not share this email or verification code with anyone.
              </p>
              
              <div style="border-top: 1px solid rgba(201, 169, 110, 0.1); padding-top: 20px; margin-top: 40px; text-align: center; font-size: 11px; color: #888;">
                <p style="margin: 0;">Apartment 1, 66 Hamilton Road, Herne Bay, Auckland 1011, New Zealand</p>
                <p style="margin: 5px 0 0 0;">Confidential Access Control System</p>
              </div>
            </div>
          `
        })
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        throw new Error(`Email Dispatch Failure: ${errText}`);
      }
    }

    return new Response(JSON.stringify({ message: 'A verification code has been dispatched to your email address.' }), { 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error: ' + err.message }), { status: 500 });
  }
}
