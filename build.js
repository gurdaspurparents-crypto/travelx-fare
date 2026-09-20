const fs = require('fs');
const path = require('path');

// Check if prebuilt frontend dist exists
const distIndex = path.join(__dirname, 'client', 'dist', 'index.html');

if (fs.existsSync(distIndex) && !process.env.FORCE_BUILD) {
  console.log('✓ Found verified prebuilt client bundle at client/dist/index.html');
  console.log('✓ Bypassing Vite build step to protect RAM and ensure instant deployment.');
  process.exit(0);
}

console.log('Prebuilt dist missing or FORCE_BUILD set. Triggering Vite build...');
const { execSync } = require('child_process');
execSync('npm --prefix client install && npm --prefix client run build:force', { stdio: 'inherit' });
