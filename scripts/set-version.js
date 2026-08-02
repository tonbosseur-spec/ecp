import fs from 'fs';
import path from 'path';

const version = process.argv[2];

if (!['client', 'admin'].includes(version)) {
  console.error('Veuillez spécifier "client" ou "admin"');
  process.exit(1);
}

const config = {
  client: {
    appId: 'com.excellerchezpierre.app',
    appName: 'ECP Apprenant',
  },
  admin: {
    appId: 'com.excellerchezpierre.admin',
    appName: 'ECP Admin',
  }
};

const target = config[version];

// 1. Update capacitor.config.ts
const capConfigPath = path.resolve('capacitor.config.ts');
let capConfig = fs.readFileSync(capConfigPath, 'utf8');
capConfig = capConfig.replace(/appId:\s*['"][^'"]+['"]/, `appId: '${target.appId}'`);
capConfig = capConfig.replace(/appName:\s*['"][^'"]+['"]/, `appName: '${target.appName}'`);
fs.writeFileSync(capConfigPath, capConfig);

// 2. Update android/app/build.gradle
const buildGradlePath = path.resolve('android/app/build.gradle');
if (fs.existsSync(buildGradlePath)) {
  let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
  buildGradle = buildGradle.replace(/applicationId\s+"[^"]+"/, `applicationId "${target.appId}"`);
  fs.writeFileSync(buildGradlePath, buildGradle);
}

// 3. Update android/app/src/main/res/values/strings.xml
const stringsXmlPath = path.resolve('android/app/src/main/res/values/strings.xml');
if (fs.existsSync(stringsXmlPath)) {
  let stringsXml = fs.readFileSync(stringsXmlPath, 'utf8');
  stringsXml = stringsXml.replace(/<string name="app_name">[^<]+<\/string>/g, `<string name="app_name">${target.appName}</string>`);
  stringsXml = stringsXml.replace(/<string name="title_activity_main">[^<]+<\/string>/g, `<string name="title_activity_main">${target.appName}</string>`);
  stringsXml = stringsXml.replace(/<string name="package_name">[^<]+<\/string>/g, `<string name="package_name">${target.appId}</string>`);
  stringsXml = stringsXml.replace(/<string name="custom_url_scheme">[^<]+<\/string>/g, `<string name="custom_url_scheme">${target.appId}</string>`);
  fs.writeFileSync(stringsXmlPath, stringsXml);
}

console.log(`✅ Configuration mise à jour pour la version : ${target.appName} (${target.appId})`);
