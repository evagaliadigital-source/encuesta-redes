module.exports = {
  apps: [
    {
      name: 'encuesta-redes',
      script: 'server.js',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
