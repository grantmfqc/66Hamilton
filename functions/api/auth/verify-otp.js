export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const rawEmail = data.email;
    const rawOtp = data.otp;

    if (!rawEmail || !rawOtp) {
      return new Response(JSON.stringify({ error: 'Email and verification code are required.' }), { status: 400 });
    }

    const email = rawEmail.trim().toLowerCase();
    const otp = rawOtp.trim();
    const kv = context.env.APPLICATIONS_KV;

    if (!kv) {
      return new Response(JSON.stringify({ error: 'System Error: APPLICATIONS_KV binding is missing.' }), { status: 500 });
    }

    const lockoutKey = `lockout:${email}`;
    const otpKey = `otp:${email}`;

    // 1. Check Lockout State
    const isLocked = await kv.get(lockoutKey);
    if (isLocked) {
      return new Response(JSON.stringify({ error: 'This login session has been blocked due to multiple failed attempts. Please wait 5 minutes.' }), { status: 403 });
    }

    // 2. Fetch Stored OTP Record
    const recordStr = await kv.get(otpKey);
    if (!recordStr) {
      return new Response(JSON.stringify({ error: 'Verification code is invalid or has expired.' }), { status: 400 });
    }

    const record = JSON.parse(recordStr);

    // 3. Handle Wrong OTP (With Attempt Count)
    if (record.otp !== otp) {
      const attempts = (record.attempts || 0) + 1;
      
      if (attempts >= 3) {
        // Lockout user and purge OTP
        await kv.delete(otpKey);
        await kv.put(lockoutKey, 'true', { expirationTtl: 300 }); // 5 minutes
        return new Response(JSON.stringify({ error: 'Too many incorrect attempts. For your security, this session is blocked for 5 minutes.' }), { status: 403 });
      }

      // Save updated attempts (refreshing TTL to 3 minutes max)
      await kv.put(otpKey, JSON.stringify({ ...record, attempts }), { expirationTtl: 180 });
      const remaining = 3 - attempts;
      return new Response(JSON.stringify({ error: `Invalid verification code. You have ${remaining} attempts remaining.` }), { status: 400 });
    }

    // 4. Verification Successful! Generate Cryptographically Secure 64-char Session Token
    const tokenBuffer = new Uint8Array(32);
    crypto.getRandomValues(tokenBuffer);
    const sessionToken = Array.from(tokenBuffer).map(b => b.toString(16).padStart(2, '0')).join('');

    // 5. Gather Audit Metadata
    const clientIp = context.request.headers.get('cf-connecting-ip') || 'unknown-ip';
    const userAgent = context.request.headers.get('user-agent') || 'unknown-agent';
    const now = Date.now();
    const expirationTtl = record.role === 'admin' ? 172800 : 7200; // Exactly 2 Days for admin (172800 seconds), 2 Hours for others

    const sessionData = {
      email,
      role: record.role,
      tokenId: record.tokenId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + expirationTtl * 1000).toISOString(),
      ipAddress: clientIp,
      userAgent: userAgent
    };

    // 6. Save Session to KV and Purge OTP
    await kv.put(`session:${sessionToken}`, JSON.stringify(sessionData), { expirationTtl });
    await kv.delete(otpKey);
    
    // Clear any residual lockouts
    await kv.delete(lockoutKey);

    return new Response(JSON.stringify({ 
      token: sessionToken, 
      role: record.role, 
      tokenId: record.tokenId 
    }), { 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error: ' + err.message }), { status: 500 });
  }
}
