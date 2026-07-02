const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withNetworkSecurityXml(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const resDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res');
      const xmlDir = path.join(resDir, 'xml');
      
      // Ensure the directory exists
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }
      
      const configXml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Configure specific domain exception for UCAM -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">ucam.uiu.ac.bd</domain>
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </domain-config>
    <!-- Trust system and user certificates globally in fallback -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
</network-security-config>`;

      fs.writeFileSync(path.join(xmlDir, 'network_security_config.xml'), configXml);
      return config;
    },
  ]);
}

function withNetworkSecurityManifest(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];
    
    // Add networkSecurityConfig attribute to <application>
    mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return config;
  });
}

module.exports = function withNetworkSecurity(config) {
  config = withNetworkSecurityXml(config);
  config = withNetworkSecurityManifest(config);
  return config;
};
