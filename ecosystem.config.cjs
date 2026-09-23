const path = require('path');

const root = __dirname;

module.exports = {
  apps: [
    {
      name: 'travelx-backend',
      cwd: root,
      script: 'server/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      }
    },
    {
      name: 'travelx-frontend',
      cwd: root,
      script: 'npm',
      args: 'run dev:client',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
};
