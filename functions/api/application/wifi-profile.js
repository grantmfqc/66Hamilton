export async function onRequestGet(context) {
  try {
    const kv = context.env.APPLICATIONS_KV;
    let manual = null;
    if (kv) {
      const rawManual = await kv.get('manual:content');
      if (rawManual) {
        manual = JSON.parse(rawManual);
      }
    }

    const ssid = manual?.wifiSSID || 'MFQC2g';
    const password = manual?.wifiPassword || 'LifeBegins@50';
    const ssid5 = manual?.wifiSSID5 || 'MFQC';
    const password5 = manual?.wifiPassword5 || 'LifeBegins@50';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadDisplayName</key>
    <string>66 Hamilton Rd Wi-Fi Networks</string>
    <key>PayloadIdentifier</key>
    <string>ai.premiumservice.66hamilton.wifi</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>A5F6E4C2-9345-4D3E-969C-605405C6BE12</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
    <key>PayloadContent</key>
    <array>
        <!-- 2.4GHz Network Payload -->
        <dict>
            <key>AutoJoin</key>
            <true/>
            <key>EncryptionType</key>
            <string>WPA</string>
            <key>SSID_STR</key>
            <string>${ssid}</string>
            <key>HIDDEN_NETWORK</key>
            <false/>
            <key>Password</key>
            <string>${password}</string>
            <key>PayloadDisplayName</key>
            <string>Wi-Fi 2.4GHz (${ssid})</string>
            <key>PayloadIdentifier</key>
            <string>com.apple.wifi.managed.2ghz.A5F6E4C2-9345-4D3E-969C-605405C6BE12</string>
            <key>PayloadType</key>
            <string>com.apple.wifi.managed</string>
            <key>PayloadUUID</key>
            <string>E911BD72-20AA-C110-9AAE-E9E119DBA640</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
        <!-- 5GHz Network Payload -->
        <dict>
            <key>AutoJoin</key>
            <true/>
            <key>EncryptionType</key>
            <string>WPA</string>
            <key>SSID_STR</key>
            <string>${ssid5}</string>
            <key>HIDDEN_NETWORK</key>
            <false/>
            <key>Password</key>
            <string>${password5}</string>
            <key>PayloadDisplayName</key>
            <string>Wi-Fi 5GHz (${ssid5})</string>
            <key>PayloadIdentifier</key>
            <string>com.apple.wifi.managed.5ghz.A5F6E4C2-9345-4D3E-969C-605405C6BE12</string>
            <key>PayloadType</key>
            <string>com.apple.wifi.managed</string>
            <key>PayloadUUID</key>
            <string>B1A6D2E4-78BC-40F0-B9AA-C1E91A8BE8C2</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
    </array>
</dict>
</plist>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-apple-aspen-config',
        'Content-Disposition': 'attachment; filename="66_Hamilton_Wifi.mobileconfig"',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500 });
  }
}
