const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOOLS_DIR = path.join(__dirname, 'tools');
const ZIP_PATH = path.join(TOOLS_DIR, 'flaresolverr.zip');
const EXTRACT_DIR = path.join(TOOLS_DIR, 'flaresolverr');

const prefix = "  \x1b[96m[ .. ]\x1b[0m ";
const errPrefix = "  \x1b[91m[ ERR ]\x1b[0m ";

const options = {
  hostname: 'api.github.com',
  path: '/repos/FlareSolverr/FlareSolverr/releases/latest',
  method: 'GET',
  headers: {
    'User-Agent': 'Node.js Script'
  }
};

console.log(prefix + "Fetching latest release...");
const req = https.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error(errPrefix + "Failed to fetch release info: " + res.statusCode);
      return;
    }
    const release = JSON.parse(body);
    const asset = release.assets.find(a => a.name.includes('windows_x64') && a.name.endsWith('.zip'));
    if (!asset) {
      console.error(errPrefix + "No windows_x64 zip found in latest release!");
      return;
    }
    
    console.log(prefix + "Found asset: " + asset.name);
    console.log(prefix + "Downloading from: " + asset.browser_download_url);
    
    try {
      execSync(`powershell -NoProfile -Command "Invoke-WebRequest -Uri '${asset.browser_download_url}' -OutFile '${ZIP_PATH}'"`, { stdio: 'inherit' });
      console.log(prefix + "Download complete.");
      
      if (fs.existsSync(EXTRACT_DIR)) {
        console.log(prefix + "Removing old flaresolverr folder...");
        fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
      }
      
      console.log(prefix + "Extracting zip...");
      const tempExtract = path.join(TOOLS_DIR, 'fs_temp');
      if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true });
      fs.mkdirSync(tempExtract, { recursive: true });
      
      execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${tempExtract}' -Force"`, { stdio: 'inherit' });
      
      const innerFolder = path.join(tempExtract, 'flaresolverr');
      if (fs.existsSync(innerFolder)) {
        fs.renameSync(innerFolder, EXTRACT_DIR);
        console.log(prefix + "\x1b[92m[ OK ]\x1b[0m Successfully extracted to " + EXTRACT_DIR);
      } else {
        console.log(errPrefix + "Unexpected zip structure. Please check " + tempExtract);
      }
      
      fs.unlinkSync(ZIP_PATH);
      fs.rmSync(tempExtract, { recursive: true, force: true });
      console.log(prefix + "Done!");
    } catch (err) {
      console.error(errPrefix + "Error during download/extract: " + err.message);
    }
  });
});

req.on('error', e => console.error(errPrefix + e.message));
req.end();

