module.exports = {
  apps: [
    {
      name: "travelx-backend",
      script: "./server/index.js",
      cwd: "C:/Users/admin/Documents/travelx-special-fare-manager",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        NODE_ENV: "production",
        PORT: 5001
      }
    },
    {
      name: "travelx-frontend",
      script: "./node_modules/vite/bin/vite.js",
      cwd: "C:/Users/admin/Documents/travelx-special-fare-manager/client",
      args: "--host --port 5173",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000
    }
  ]
};
