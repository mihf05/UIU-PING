const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withNetworkSecurityXml(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const resDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res');
      
      // 1. Copy the UCAM certificates to res/raw
      const rawDir = path.join(resDir, 'raw');
      if (!fs.existsSync(rawDir)) {
        fs.mkdirSync(rawDir, { recursive: true });
      }
      
      const certFiles = ['ucam_leaf.pem', 'ucam_intermediate.pem', 'ucam_root.pem'];
      
      for (const file of certFiles) {
        const srcCertPath = path.join(config.modRequest.projectRoot, 'assets', file);
        const destCertPath = path.join(rawDir, file);
        
        if (fs.existsSync(srcCertPath)) {
          console.log(`[withNetworkSecurity] Copying certificate from ${srcCertPath} to ${destCertPath}`);
          fs.copyFileSync(srcCertPath, destCertPath);
        } else {
          console.warn(`[withNetworkSecurity] Certificate not found at ${srcCertPath}!`);
        }
      }

      // 2. Create the network_security_config.xml in res/xml
      const xmlDir = path.join(resDir, 'xml');
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }
      
      const configXml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Configure specific domain exception for UCAM -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">ucam.uiu.ac.bd</domain>
        <trust-anchors>
            <!-- Trust the bundled UCAM cert chain components -->
            <certificates src="@raw/ucam_leaf" />
            <certificates src="@raw/ucam_intermediate" />
            <certificates src="@raw/ucam_root" />
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </domain-config>
    <!-- Trust system, user, and bundled certs globally in fallback -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="@raw/ucam_leaf" />
            <certificates src="@raw/ucam_intermediate" />
            <certificates src="@raw/ucam_root" />
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
