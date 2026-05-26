export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const token = url.searchParams.get('token');
    const passcode = url.searchParams.get('passcode'); // for admin overview

    // 1. Verify access
    if (!token && !passcode) {
      return new Response(JSON.stringify({ error: 'Missing access credentials' }), { status: 400 });
    }

    const kv = context.env.APPLICATIONS_KV;
    if (!kv) {
      return new Response(JSON.stringify({ error: 'System Error: APPLICATIONS_KV binding is missing in Cloudflare.' }), { status: 500 });
    }

    // Admin Mode: Load all applications or a specific one
    const expectedPasscode = context.env.ADMIN_PASSCODE || 'HouseNow!6969';
    if (passcode === expectedPasscode) {
      if (token) {
        // Fetch specific application for admin review
        const data = await kv.get(`application:${token}`);
        if (!data) return new Response(JSON.stringify({ error: 'Application not found' }), { status: 404 });
        return new Response(data, { headers: { 'Content-Type': 'application/json' } });
      } else {
        // List all applications (fetch keys with prefix `application:`)
        const list = await kv.list({ prefix: 'application:' });
        const apps = [];
        for (const key of list.keys) {
          const val = await kv.get(key.name);
          if (val) {
            // Parse and parse minimal fields to avoid huge response
            const parsed = JSON.parse(val);
            apps.push({
              id: parsed.id,
              status: parsed.status,
              createdAt: parsed.createdAt,
              rent: parsed.rent,
              startDate: parsed.startDate,
              tenantName: parsed.tenantDetails ? parsed.tenantDetails.name : 'Unknown'
            });
          }
        }
        // Also fetch manual content for editing
        let manual = await kv.get('manual:content');
        if (!manual) {
          manual = JSON.stringify(getDefaultManual());
        }
        return new Response(JSON.stringify({ applications: apps, manual: JSON.parse(manual) }), { 
          headers: { 'Content-Type': 'application/json' } 
        });
      }
    }

    // Tenant / Applicant Mode: Load specific application by token
    const data = await kv.get(`application:${token}`);
    if (!data) {
      return new Response(JSON.stringify({ error: 'Application not found' }), { status: 404 });
    }

    const app = JSON.parse(data);

    // If fully completed, fetch the manual content to include in the response
    let responseData = { ...app };
    if (app.status === 'completed') {
      let manual = await kv.get('manual:content');
      if (!manual) {
        manual = JSON.stringify(getDefaultManual());
      }
      responseData.manual = JSON.parse(manual);
    } else {
      // Hide manual details if contract is not complete
      responseData.manual = null;
    }

    return new Response(JSON.stringify(responseData), { 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500 });
  }
}

function getDefaultManual() {
  return {
    wifiSSID: 'MFQC2g',
    wifiPassword: 'LifeBegins@50',
    wifiSSID5: 'MFQC5g',
    wifiPassword5: 'LifeBegins@50',
    address: 'Apartment 1, 66 Hamilton Road, Herne Bay, Auckland 1011, New Zealand',
    checkinCode: '2580',
    accessPedestrian: '2580',
    accessDriveway: '2580',
    accessStreetGlass: '2580',
    accessBasementGlass: '2580',
    accessApartment: '2580',
    accessGarage: '2580',
    checkinDetails: 'The keybox is located on the right-hand wall immediately outside the main vehicle entrance gate. Slide down the protective cover, enter the code 2580, and pull down the open latch. Inside you will find the physical apartment keys and a smart building proximity fob.',
    checkinDetailsImage: '',
    rubbishDetails: 'Auckland Council rubbish collection is on Tuesday mornings. Please place the bins on the curb on Monday evening. The Red-lidded bin is for general refuse, and the Blue or Yellow-lidded bin is for recycling. Cardboard must be flattened and placed inside the recycling bin.',
    rubbishDetailsImage: '',
    additionalDetails: 'Quiet hours must be observed between 10:00 PM and 7:00 AM daily. Please ensure the pool and spa gates are closed securely at all times.',
    additionalDetailsImage: '',
    customSections: []
  };
}
