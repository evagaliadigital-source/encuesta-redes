import { serve } from '@hono/node-server'
import app from './src/index.js'

const port = process.env.PORT || 3001

console.log(`🚀 Servidor iniciado en http://localhost:${port}`)
console.log(`📊 Dashboard Eva: http://localhost:${port}/dashboard`)
console.log(`🎁 Encuesta pública: http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port
})
