const KV_KEY = 'portal_access_emails';

async function authorizeAdmin(context) {
  const kv = context.env.APPLICATIONS_KV;
  const authHeader = context.request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const sessionToken = authHeader.substring(7);
    const sessionStr = await kv.get(`session:${sessionToken}`);
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      const userAgent = context.request.headers.get('user-agent') || 'unknown-agent';
      if (session.role === 'admin' && session.userAgent === userAgent) {
        return true;
      }
    }
  }
  // Legacy passcode fallback
  const url = new URL(context.request.url);
  const passcode = url.searchParams.get('passcode');
  if (passcode) {
    const expected = context.env.ADMIN_PASSCODE || 'HouseNow!6969';
    if (passcode === expected) return true;
  }
  return false;
}

// GET — list all portal access emails
export async function onRequestGet(context) {
  try {
    const kv = context.env.APPLICATIONS_KV;
    if (!kv) return new Response(JSON.stringify({ error: 'KV binding missing' }), { status: 500 });

    if (!(await authorizeAdmin(context))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const raw = await kv.get(KV_KEY);
    const emails = raw ? JSON.parse(raw) : [];
    return new Response(JSON.stringify({ emails }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// POST — add or remove an email
// Body: { action: 'add' | 'remove', email: string }
export async function onRequestPost(context) {
  try {
    const kv = context.env.APPLICATIONS_KV;
    if (!kv) return new Response(JSON.stringify({ error: 'KV binding missing' }), { status: 500 });

    if (!(await authorizeAdmin(context))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { action, email } = await context.request.json();
    if (!action || !email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'action and email are required' }), { status: 400 });
    }

    const normalised = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), { status: 400 });
    }

    const raw = await kv.get(KV_KEY);
    let emails = raw ? JSON.parse(raw) : [];

    let emailWarning = null;

    if (action === 'add') {
      const isNew = !emails.includes(normalised);
      if (isNew) {
        emails.push(normalised);
      }

      // Send welcome email via Resend (only when newly added)
      if (isNew && context.env.RESEND_API_KEY) {
        const loginUrl = `${new URL(context.request.url).origin}/index.html?login=1`;
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'The Hamilton Residence <prospectus@contact.premiumservice.ai>',
            to: normalised,
            subject: 'Your Resident Portal Access — 66 Hamilton Road',
            html: `
              <div style="font-family: 'Times New Roman', serif; background-color: #0b0b0d; color: #ffffff; padding: 40px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1a1a1c;">
                <div style="text-align: center; border-bottom: 1px solid rgba(201, 169, 110, 0.2); padding-bottom: 20px; margin-bottom: 30px;">
                  <h1 style="color: #c9a96e; font-size: 26px; font-weight: normal; margin: 0; letter-spacing: 2px;">THE HAMILTON RESIDENCE</h1>
                  <p style="color: #888; font-size: 11px; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Premium Serviced Accommodation</p>
                </div>

                <p style="font-size: 15px; line-height: 1.6; color: #d0d0d5;">Hello,</p>
                <p style="font-size: 15px; line-height: 1.6; color: #d0d0d5;">You have been granted access to the Resident Portal for <strong style="color: #c9a96e;">66 Hamilton Road, Herne Bay, Auckland</strong>.</p>

                <p style="font-size: 15px; line-height: 1.6; color: #d0d0d5;">To sign in, visit the login page and enter your email address: <strong style="color: #c9a96e;">${normalised}</strong>. A secure 6-digit verification code will be sent to you — enter it to access the portal.</p>

                <div style="text-align: center; margin: 35px 0;">
                  <a href="${loginUrl}" style="background-color: #c9a96e; color: #000000; font-weight: bold; padding: 14px 28px; text-decoration: none; border-radius: 4px; display: inline-block; letter-spacing: 1px;">ACCESS RESIDENT PORTAL</a>
                </div>

                <p style="font-size: 15px; line-height: 1.6; color: #d0d0d5;">Once signed in, you can access:</p>
                <ul style="color: #a0a0a5; line-height: 1.8; font-size: 14px; padding-left: 20px;">
                  <li>The complete <strong>Apartment House Manual</strong> (check-in guidelines and building access codes)</li>
                  <li>Tools to connect your devices to the <strong>Smart Wi-Fi Network</strong></li>
                  <li>Your <strong>Payment Schedule</strong></li>
                  <li><strong>Maintenance Requests</strong> and feedback</li>
                </ul>

                <div style="border-top: 1px solid rgba(201, 169, 110, 0.1); padding-top: 20px; margin-top: 40px; text-align: center; font-size: 11px; color: #888;">
                  <p style="margin: 0;">Apartment 1, 66 Hamilton Road, Herne Bay, Auckland 1011, New Zealand</p>
                  <p style="margin: 5px 0 0 0;">Resident Portal Access</p>
                </div>
              </div>
            `
          })
        });

        if (!emailRes.ok) {
          const errText = await emailRes.text();
          emailWarning = `Email saved but welcome email failed to send: ${errText}`;
        }
      } else if (isNew && !context.env.RESEND_API_KEY) {
        emailWarning = 'Email saved but RESEND_API_KEY is not configured — welcome email was not sent.';
      }

    } else if (action === 'remove') {
      emails = emails.filter(e => e !== normalised);
    } else {
      return new Response(JSON.stringify({ error: 'action must be add or remove' }), { status: 400 });
    }

    await kv.put(KV_KEY, JSON.stringify(emails));
    return new Response(JSON.stringify({ success: true, emails, warning: emailWarning || undefined }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
