const fs = require('fs');
const path = require('path');

function readAppVersion() {
  try {
    const src = fs.readFileSync(path.join(__dirname, '..', 'version.js'), 'utf8');
    const match = src.match(/EOD_APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (match) return match[1];
  } catch {
    /* ignore */
  }
  return '2.3.1';
}

const APP_VERSION = readAppVersion();

module.exports = { APP_VERSION };
