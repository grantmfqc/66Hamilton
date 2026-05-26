export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const { token, type, payload, passcode } = data; // type: 'maintenance' | 'feedback' | 'update-maintenance'

    if (!type || !payload) {
      return new Response(JSON.stringify({ error: 'Missing type or payload' }), { status: 400 });
    }

    const kv = context.env.APPLICATIONS_KV;
    if (!kv) {
      return new Response(JSON.stringify({ error: 'System Error: APPLICATIONS_KV binding is missing in Cloudflare.' }), { status: 500 });
    }

    const expectedPasscode = context.env.ADMIN_PASSCODE || 'Hamilton66';

    // 1. Authorize action
    let activeToken = token;
    let isAdmin = false;

    if (passcode === expectedPasscode) {
      isAdmin = true;
      activeToken = token || payload.token;
    }

    if (!activeToken) {
      return new Response(JSON.stringify({ error: 'Missing application token' }), { status: 400 });
    }

    // 2. Fetch application
    const rawApp = await kv.get(`application:${activeToken}`);
    if (!rawApp) {
      return new Response(JSON.stringify({ error: 'Application not found' }), { status: 404 });
    }

    const app = JSON.parse(rawApp);

    if (app.status !== 'completed') {
      return new Response(JSON.stringify({ error: 'Feedback portal is only available after contract execution' }), { status: 403 });
    }

    const timestamp = new Date().toISOString();

    // 3. Save / Update record
    if (type === 'maintenance') {
      if (!app.maintenance) app.maintenance = [];
      const entry = {
        id: 'maint-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        category: payload.category,
        description: payload.description,
        imageUrl: payload.imageUrl || '',
        accessDate: payload.accessDate || '',
        accessTime: payload.accessTime || '',
        initiator: payload.initiator || 'tenant',
        resolved: false,
        ownerFeedback: '',
        timestamp
      };
      app.maintenance.push(entry);

      // Email Owner if it is a maintenance request
      if (context.env.RESEND_API_KEY) {
        const portalUrl = `${new URL(context.request.url).origin}/apply.html?token=${activeToken}`;
        let imgHtml = '';
        if (entry.imageUrl) {
          imgHtml = `<p><strong>Attachment Attached:</strong><br/><img src="${entry.imageUrl}" style="max-width: 300px; border-radius: 4px; border: 1px solid #2a2a2f; margin-top: 10px;" alt="Maintenance Image" /></p>`;
        }
        
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'The Hamilton Residence <prospectus@contact.premiumservice.ai>',
            to: 'grant@orcacom.co.nz',
            subject: `Urgent: Maintenance Request from ${app.tenantDetails.name}`,
            html: `
              <div style="font-family: sans-serif; background-color: #0b0b0d; color: #ffffff; padding: 40px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #ff6b6b; font-weight: normal; font-size: 24px;">New Maintenance Request</h2>
                <p>Dear Grant,</p>
                <p>A new maintenance request has been submitted by your tenant, <strong>${app.tenantDetails.name}</strong>, at 66 Hamilton Road.</p>
                
                <div style="background-color: #121214; border: 1px solid #2a2a2f; padding: 20px; border-radius: 4px; margin: 25px 0;">
                  <table style="width: 100%; border-collapse: collapse; color: #a0a0a5; font-size: 14px;">
                    <tr><td style="padding: 6px 0; font-weight: bold; width: 30%;">Category:</td><td style="color: #ffffff; font-weight: bold;">${entry.category}</td></tr>
                    <tr><td style="padding: 6px 0; font-weight: bold; vertical-align: top;">Description:</td><td style="color: #ffffff; line-height: 1.5;">${entry.description}</td></tr>
                    <tr><td style="padding: 6px 0; font-weight: bold;">Submitted At:</td><td>${new Date(timestamp).toLocaleString()}</td></tr>
                  </table>
                  ${imgHtml}
                </div>
  
                <p>Please contact the tenant or schedule a maintenance technician as required. You can view their contact information and full history in your admin dashboard.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${portalUrl}" style="background-color: #C9A96E; color: #000000; font-weight: bold; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">VIEW TENANT PORTAL</a>
                </div>
              </div>
            `
          })
        });
  
        if (!emailRes.ok) {
          console.error('Failed to send maintenance email to owner', await emailRes.text());
        }
      }
    } else if (type === 'update-maintenance') {
      if (!app.maintenance || !Array.isArray(app.maintenance)) {
        return new Response(JSON.stringify({ error: 'No maintenance logs found' }), { status: 400 });
      }
      
      const issueId = payload.id;
      const targetMaint = app.maintenance.find(m => m.id === issueId || m.timestamp === issueId);
      if (!targetMaint) {
        return new Response(JSON.stringify({ error: 'Maintenance ticket not found' }), { status: 404 });
      }

      // Tenants can only update 'resolved' status, Admin can update resolved and feedback text
      if (isAdmin) {
        targetMaint.resolved = payload.resolved === true || payload.resolved === 'true';
        if (payload.ownerFeedback !== undefined) {
          targetMaint.ownerFeedback = payload.ownerFeedback;
        }
      } else {
        targetMaint.resolved = payload.resolved === true || payload.resolved === 'true';
      }

      // Append new comment log if provided
      if (payload.newComment && payload.newComment.trim()) {
        if (!targetMaint.updates) targetMaint.updates = [];
        targetMaint.updates.push({
          sender: isAdmin ? 'landlord' : 'tenant',
          text: payload.newComment.trim(),
          timestamp
        });
      }
    } else if (type === 'feedback') {
      if (!app.feedback) app.feedback = [];
      const entry = { ...payload, timestamp };
      app.feedback.push(entry);
    } else {
      return new Response(JSON.stringify({ error: 'Invalid submission type' }), { status: 400 });
    }

    await kv.put(`application:${activeToken}`, JSON.stringify(app));

    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500 });
  }
}
