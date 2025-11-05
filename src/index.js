import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const app = new Hono()

// Persistent storage in JSON file
const RESPONSES_FILE = './responses.json'

// Load existing responses on startup
let responses = []
let nextRaffleNumber = 20

function loadResponses() {
  try {
    if (existsSync(RESPONSES_FILE)) {
      const data = readFileSync(RESPONSES_FILE, 'utf8')
      const parsed = JSON.parse(data)
      responses = parsed.responses || []
      nextRaffleNumber = parsed.nextRaffleNumber || 20
      console.log(`✅ Cargadas ${responses.length} respuestas desde archivo`)
    }
  } catch (error) {
    console.log('⚠️  No hay respuestas previas, empezando desde cero')
  }
}

function saveResponses() {
  try {
    writeFileSync(RESPONSES_FILE, JSON.stringify({ responses, nextRaffleNumber }, null, 2))
  } catch (error) {
    console.error('❌ Error guardando respuestas:', error)
  }
}

// Load on startup
loadResponses()

// Enable CORS
app.use('/api/*', cors())

// Serve dashboard with cache-busting headers
app.get('/dashboard', (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
  c.header('Pragma', 'no-cache')
  c.header('Expires', '0')
  return c.html(readFileSync('./dashboard.html', 'utf8'))
})

// Página especial para generar PDF de una respuesta existente
app.get('/generar-pdf', (c) => {
  const timestamp = c.req.query('timestamp')
  
  if (!timestamp) {
    return c.html('<h1>Error: Timestamp requerido</h1>')
  }
  
  const response = responses.find(r => r.timestamp === timestamp)
  
  if (!response) {
    return c.html('<h1>Error: Respuesta no encontrada</h1>')
  }
  
  // Redirigir al formulario con parámetro para pre-llenar datos
  return c.redirect(`/?pdf=${timestamp}`)
})

// API: Get PDF URL for a response (returns the data, frontend generates PDF)
app.get('/api/pdf/:timestamp', (c) => {
  const timestamp = c.req.param('timestamp')
  const response = responses.find(r => r.timestamp === timestamp)
  
  if (!response) {
    return c.json({ success: false, message: 'Respuesta no encontrada' }, 404)
  }
  
  return c.json(response)
})

// API: Get all responses
app.get('/api/responses', (c) => {
  const hot = responses.filter(r => r.priority === '🔥 HOT').length
  const warm = responses.filter(r => r.priority === '🟡 WARM').length
  const cold = responses.filter(r => r.priority === '🟢 COLD').length
  const raffleParticipants = responses.filter(r => r.participatesInRaffle).length

  return c.json({
    total: responses.length,
    hot,
    warm,
    cold,
    raffleParticipants,
    responses
  })
})

// API: Submit survey
app.post('/api/submit-survey', async (c) => {
  const data = await c.req.json()
  
  // Calculate priority
  const priority = calculatePriority(data)
  
  // Check if participates in raffle (sorteo redes - todos pueden participar)
  const wantsRaffle = data.wantRaffle === 'si'
  const participatesInRaffle = wantsRaffle
  
  const raffleNumber = participatesInRaffle ? nextRaffleNumber++ : null
  
  // Store response
  const response = {
    ...data,
    priority,
    participatesInRaffle,
    raffleNumber,
    timestamp: new Date().toISOString()
  }
  
  responses.push(response)
  
  // Save to file immediately
  saveResponses()
  
  console.log(`✅ Nueva encuesta recibida: ${data.p10} - ${priority}`)
  
  // Send email notification to Eva
  sendEmailToEva(response)
  
  return c.json({
    success: true,
    raffleNumber,
    priority,
    message: 'Encuesta recibida correctamente'
  })
})

// API: Delete response
app.post('/api/delete-response', async (c) => {
  const { timestamp } = await c.req.json()
  
  if (!timestamp) {
    return c.json({ success: false, message: 'Timestamp requerido' }, 400)
  }
  
  const initialLength = responses.length
  responses = responses.filter(r => r.timestamp !== timestamp)
  
  if (responses.length === initialLength) {
    return c.json({ success: false, message: 'Respuesta no encontrada' }, 404)
  }
  
  // Save to file immediately
  saveResponses()
  
  console.log(`🗑️  Respuesta eliminada: timestamp ${timestamp}`)
  
  return c.json({ 
    success: true, 
    message: 'Respuesta eliminada correctamente',
    remaining: responses.length
  })
})

// API: Generate report
app.post('/api/generate-report', async (c) => {
  const { index, type } = await c.req.json()
  
  if (index < 0 || index >= responses.length) {
    return c.json({ error: 'Respuesta no encontrada' }, 404)
  }
  
  const response = responses[index]
  const report = type === 'complete' ? generateCompleteReport(response) : generateCommercialReport(response)
  
  return c.json({ report })
})

// API: Draw winner
app.post('/api/draw-winner', (c) => {
  const participants = responses.filter(r => r.participatesInRaffle)
  
  if (participants.length === 0) {
    return c.json({ error: 'No hay participantes en el sorteo' }, 400)
  }
  
  const randomIndex = Math.floor(Math.random() * participants.length)
  const winner = participants[randomIndex]
  
  return c.json({
    winner: {
      name: winner.p10,
      business: winner.p11,
      raffleNumber: winner.raffleNumber,
      email: winner.p13,
      whatsapp: winner.p12
    },
    totalParticipants: participants.length
  })
})

// Serve main survey page
app.get('/', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Encuesta MVP - Galia Digital</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        body {
            font-family: 'Inter', sans-serif;
        }
        .question-block {
            display: none;
        }
        .question-block.active {
            display: block;
            animation: fadeIn 0.3s ease-in;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body class="bg-gray-50">
    <div class="min-h-screen p-4 md:p-8">
        <!-- Header -->
        <div class="max-w-3xl mx-auto mb-8">
            <div class="bg-gradient-to-r from-[#008080] to-[#1b285e] text-white rounded-2xl shadow-xl p-8 text-center">
                <div class="mb-4">
                    <img src="https://page.gensparksite.com/v1/base64_upload/a70b1fe40910547351447ef32a13f4af" 
                         alt="Galia Digital Logo" 
                         class="mx-auto h-32 md:h-40 object-contain">
                </div>
                <h1 class="text-3xl md:text-4xl font-bold mb-2">GALIA - Agenda Inteligente</h1>
                <p class="text-lg opacity-90">Ayúdanos a mejorar la vida de las peluqueras</p>
            </div>
        </div>

        <!-- Value Proposition Banner -->
        <div class="max-w-3xl mx-auto mb-8">
            <div class="bg-gradient-to-r from-[#E6F2F2] to-[#EBF5F5] border-2 border-[#B3D9D9] rounded-xl p-6">
                <h2 class="text-2xl font-bold text-gray-800 mb-4 text-center">🎯 ¿Tu agenda tiene huecos que cuestan dinero?</h2>
                <p class="text-gray-700 mb-4 text-center">Ayúdanos con esta encuesta de 2 minutos y recibe:</p>
                
                <div class="space-y-3">
                    <div class="bg-white rounded-lg p-4">
                        <p class="font-semibold text-gray-800 mb-2">✅ Informe personalizado gratuito</p>
                        <p class="text-gray-600 text-sm pl-6">"Cómo recuperar +500€/mes perdidos en cancelaciones"</p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4">
                        <p class="font-semibold text-gray-800 mb-2">✅ Invitación exclusiva al Programa Beta</p>
                        <ul class="text-gray-600 text-sm pl-6 space-y-1">
                            <li>• Prueba GALiA Digital sin coste</li>
                            <li>• Conviértete en Cliente Fundador</li>
                            <li>• Condiciones VIP de por vida</li>
                            <li>• Influye en el desarrollo del producto</li>
                        </ul>
                    </div>
                </div>
                
                <p class="text-center text-sm text-gray-500 mt-4">⏱️ Solo 2-3 minutos • 100% confidencial</p>
            </div>
        </div>

        <!-- Survey Form -->
        <div class="max-w-3xl mx-auto">
            <div class="bg-white rounded-xl shadow-lg p-6 md:p-8">
                <!-- Progress Bar -->
                <div class="mb-8">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-semibold text-gray-600">Progreso</span>
                        <span class="text-sm font-semibold text-[#008080]" id="progress-text">0/18</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-3">
                        <div class="bg-gradient-to-r from-[#008080] to-[#1b285e] h-3 rounded-full transition-all duration-300" 
                             id="progress-bar" style="width: 0%"></div>
                    </div>
                </div>

                <form id="surveyForm">
                    <!-- Block 1: Cualificación -->
                    <div class="question-block active" data-block="1">
                        <h3 class="text-2xl font-bold text-gray-800 mb-6">📋 Bloque 1: Cualificación</h3>
                        
                        <!-- P1 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                1. ⭐ ¿Cuánto tiempo dedicas al día a gestionar tu agenda de citas?
                            </label>
                            <select name="p1" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="Menos de 1 hora al día">Menos de 1 hora al día</option>
                                <option value="Entre 1 y 2 horas">Entre 1 y 2 horas</option>
                                <option value="Más de 2 horas">Más de 2 horas</option>
                            </select>
                        </div>

                        <!-- P2 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                2. ⭐ ¿Cuál es tu mayor problema con las citas?
                            </label>
                            <select name="p2" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="Cancelaciones de última hora">Cancelaciones de última hora</option>
                                <option value="Horas muertas sin aprovechar">Horas muertas sin aprovechar</option>
                                <option value="Gestión de listas de espera">Gestión de listas de espera</option>
                                <option value="Recordatorios manuales">Recordatorios manuales</option>
                                <option value="Todo lo anterior">Todo lo anterior</option>
                            </select>
                        </div>
                    </div>

                    <!-- Block 2: Otras Necesidades -->
                    <div class="question-block" data-block="2">
                        <h3 class="text-2xl font-bold text-gray-800 mb-6">📱 Bloque 2: Otras Necesidades</h3>
                        
                        <!-- P5 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                5. ⭐ Además de la agenda, ¿qué más te QUITA TIEMPO o DINERO? (puedes marcar varias)
                            </label>
                            <div class="space-y-2">
                                <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#008080] cursor-pointer">
                                    <input type="checkbox" name="p5" value="Facturación y gestión de tickets/facturas" class="mr-3 w-5 h-5 text-[#008080]">
                                    <span>Facturación y gestión de tickets/facturas</span>
                                </label>
                                <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#008080] cursor-pointer">
                                    <input type="checkbox" name="p5" value="Control de stock de productos" class="mr-3 w-5 h-5 text-[#008080]">
                                    <span>Control de stock de productos</span>
                                </label>
                                <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#008080] cursor-pointer">
                                    <input type="checkbox" name="p5" value="Gestión de horarios y turnos de empleados" class="mr-3 w-5 h-5 text-[#008080]">
                                    <span>Gestión de horarios y turnos de empleados</span>
                                </label>
                                <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#008080] cursor-pointer">
                                    <input type="checkbox" name="p5" value="Nóminas y control de horas trabajadas" class="mr-3 w-5 h-5 text-[#008080]">
                                    <span>Nóminas y control de horas trabajadas</span>
                                </label>
                                <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#008080] cursor-pointer">
                                    <input type="checkbox" name="p5" value="Cálculo de comisiones / precios por servicios" class="mr-3 w-5 h-5 text-[#008080]">
                                    <span>Cálculo de comisiones / precios por servicios</span>
                                </label>
                                <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#008080] cursor-pointer">
                                    <input type="checkbox" name="p5" value="Cuadrar caja al final del día" class="mr-3 w-5 h-5 text-[#008080]">
                                    <span>Cuadrar caja al final del día</span>
                                </label>
                            </div>
                        </div>

                        <!-- P6 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                6. ⭐ ¿Sabes que en 2026 será OBLIGATORIO facturar electrónicamente en tiempo real?
                            </label>
                            <select name="p6" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="Sí, y ya estoy preparándome">Sí, y ya estoy preparándome</option>
                                <option value="Sí, pero no sé cómo hacerlo">Sí, pero no sé cómo hacerlo</option>
                                <option value="No tenía ni idea">No tenía ni idea</option>
                                <option value="Me da igual, ya veré">Me da igual, ya veré</option>
                            </select>
                        </div>

                        <!-- P7 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                7. ⭐ ¿Cuánto tiempo dedicas A LA SEMANA a gestionar stock de productos?
                            </label>
                            <select name="p7" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="Nada, no vendo productos">Nada, no vendo productos</option>
                                <option value="Menos de 1 hora">Menos de 1 hora</option>
                                <option value="1-3 horas">1-3 horas</option>
                                <option value="3-5 horas">3-5 horas</option>
                                <option value="Más de 5 horas">Más de 5 horas</option>
                            </select>
                        </div>

                        <!-- P8 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                8. ⭐ Si tienes empleados, ¿cómo gestionas sus horarios y turnos?
                            </label>
                            <select name="p8" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="No tengo empleados, trabajo sola">No tengo empleados, trabajo sola</option>
                                <option value="Excel / papel / WhatsApp (caos)">Excel / papel / WhatsApp (caos)</option>
                                <option value="App específica de horarios">App específica de horarios</option>
                                <option value="Memoria y cruzo los dedos">Memoria y cruzo los dedos</option>
                            </select>
                        </div>

                    </div>

                    <!-- Block 3: Validación de Solución -->
                    <div class="question-block" data-block="3">
                        <h3 class="text-2xl font-bold text-gray-800 mb-6">💡 Bloque 3: Validación de Solución</h3>
                        
                        <!-- Info Box -->
                        <div class="bg-gradient-to-r from-[#E6F2F2] to-[#EBF5F5] border-2 border-[#B3D9D9] rounded-xl p-6 mb-6">
                            <h4 class="text-xl font-bold text-gray-800 mb-3">💡 IMAGINA ESTO:</h4>
                            <p class="text-gray-700 mb-3">Un asistente IA que gestiona tu agenda 24/7 por WhatsApp:</p>
                            <ul class="space-y-2 text-gray-700">
                                <li>✅ Reduce no-shows en un 80%</li>
                                <li>✅ Llena tus horas muertas automáticamente</li>
                                <li>✅ Gestiona listas de espera inteligentes</li>
                                <li>✅ Te devuelve 8 horas a la semana</li>
                            </ul>
                        </div>

                        <!-- P3 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                3. ⭐ ¿Qué te frena para automatizar tu agenda HOY?
                            </label>
                            <select name="p3" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="El precio">El precio</option>
                                <option value="No sé si realmente funciona">No sé si realmente funciona</option>
                                <option value="Miedo a perder control">Miedo a perder control</option>
                                <option value="No tengo tiempo de implementarlo">No tengo tiempo de implementarlo</option>
                                <option value="Desconfianza en la tecnología">Desconfianza en la tecnología</option>
                                <option value="Nada, lo haría ahora mismo">Nada, lo haría ahora mismo</option>
                            </select>
                        </div>

                        <!-- P4 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                4. ⭐ Si pudieras probarlo GRATIS durante 15 días, ¿lo harías?
                            </label>
                            <select name="p4" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="Sí, ahora mismo">Sí, ahora mismo</option>
                                <option value="Sí, pero en 1-2 meses">Sí, pero en 1-2 meses</option>
                                <option value="Quizás, necesito más información">Quizás, necesito más información</option>
                                <option value="No me interesa">No me interesa</option>
                            </select>
                        </div>

                        <!-- P9 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                9. ⭐ ¿Pagarías por un sistema que automatizara facturación + stock + turnos + agenda TODO EN UNO?
                            </label>
                            <select name="p9" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="Sí, si me ahorra tiempo y dolores de cabeza">Sí, si me ahorra tiempo y dolores de cabeza</option>
                                <option value="Depende del precio">Depende del precio</option>
                                <option value="No, prefiero herramientas separadas">No, prefiero herramientas separadas</option>
                                <option value="No necesito eso">No necesito eso</option>
                            </select>
                        </div>

                        <!-- P18 - PRECIO -->
                        <div class="mb-6 bg-[#E6F2F2] border-2 border-[#008080] rounded-xl p-6">
                            <label class="block text-gray-700 font-bold text-lg mb-4">
                                18. ⭐ Si esto te ahorrara 8 horas/semana, ¿cuánto pagarías al mes?
                            </label>
                            <select name="p18_precio" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="Nada, lo quiero gratis">Nada, lo quiero gratis</option>
                                <option value="20-40€/mes">20-40€/mes</option>
                                <option value="40-60€/mes">40-60€/mes</option>
                                <option value="60-100€/mes">60-100€/mes</option>
                                <option value="Más de 100€/mes">Más de 100€/mes</option>
                            </select>
                        </div>
                    </div>

                    <!-- Block 4: Tus Datos -->
                    <div class="question-block" data-block="4">
                        <h3 class="text-2xl font-bold text-gray-800 mb-6">📝 Bloque 4: Tus Datos</h3>
                        
                        <!-- Info Box -->
                        <div class="bg-gradient-to-r from-[#E6F2F2] to-[#EBF5F5] border-2 border-[#B3D9D9] rounded-xl p-6 mb-6">
                            <h4 class="text-xl font-bold text-gray-800 mb-3">🎁 TU REGALO INMEDIATO:</h4>
                            <p class="text-gray-700 mb-3">Al finalizar recibirás:</p>
                            <ul class="space-y-2 text-gray-700">
                                <li>✅ Análisis personalizado de tu situación</li>
                                <li>✅ Plan de automatización a tu medida</li>
                            </ul>
                        </div>
                        
                        <!-- P10 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                10. ⭐ Tu nombre completo
                            </label>
                            <input type="text" name="p10" required 
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none"
                                   placeholder="Ej: María García López">
                        </div>

                        <!-- P11 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                11. ⭐ Nombre de tu peluquería/salón
                            </label>
                            <input type="text" name="p11" required 
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none"
                                   placeholder="Ej: Salón María Estilo">
                        </div>

                        <!-- P12 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                12. ⭐ WhatsApp (con prefijo +34)
                            </label>
                            <input type="tel" name="p12" required 
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none"
                                   placeholder="Ej: +34 600 123 456">
                        </div>

                        <!-- P13 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                13. ⭐ Email
                            </label>
                            <input type="email" name="p13" required 
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none"
                                   placeholder="tu@email.com">
                        </div>

                        <!-- P14 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                14. ⭐ Ciudad
                            </label>
                            <input type="text" name="p14" required 
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none"
                                   placeholder="Ej: Madrid">
                            <p class="text-sm text-[#008080] mt-2">💡 Sorteo exclusivo para seguidores de Facebook/Instagram/LinkedIn</p>
                        </div>

                        <!-- P15 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                15. ⭐ Ciudad donde está tu salón
                            </label>
                            <input type="text" name="p15" required
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none"
                                   placeholder="Ej: Madrid">
                            <p class="text-sm text-[#008080] mt-2">💡 Sorteo online - Válido para toda España</p>
                        </div>

                        <!-- P16 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                16. ⭐ Dirección completa de tu salón (Calle + número - opcional para sorteo)
                            </label>
                            <input type="text" name="p15_direccion" 
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none"
                                   placeholder="Ej: Calle Real 25">
                        </div>

                        <!-- P17 - Horario de contacto -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-4">
                                17. ⭐ ¿Cuál es el mejor horario para hablar contigo? (puedes marcar varios)
                            </label>
                            
                            <!-- Horarios -->
                            <div class="mb-4">
                                <p class="text-sm font-semibold text-gray-600 mb-2">Horario preferido:</p>
                                <div class="space-y-2">
                                    <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#008080] cursor-pointer">
                                        <input type="checkbox" name="p17_horario" value="Mañana (9:00-13:00)" class="mr-3 w-5 h-5 text-[#008080]">
                                        <span>Mañana (9:00-13:00)</span>
                                    </label>
                                    <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#008080] cursor-pointer">
                                        <input type="checkbox" name="p17_horario" value="Mediodía (13:00-15:00)" class="mr-3 w-5 h-5 text-[#008080]">
                                        <span>Mediodía (13:00-15:00)</span>
                                    </label>
                                    <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#008080] cursor-pointer">
                                        <input type="checkbox" name="p17_horario" value="Tarde (15:00-20:00)" class="mr-3 w-5 h-5 text-[#008080]">
                                        <span>Tarde (15:00-20:00)</span>
                                    </label>
                                </div>
                            </div>
                            
                            <!-- Días -->
                            <div class="mb-4">
                                <p class="text-sm font-semibold text-gray-600 mb-2">Días preferidos:</p>
                                <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#008080] cursor-pointer">
                                        <input type="checkbox" name="p17_dias" value="Lunes" class="mr-2 w-4 h-4 text-[#008080]">
                                        <span class="text-sm">Lunes</span>
                                    </label>
                                    <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#008080] cursor-pointer">
                                        <input type="checkbox" name="p17_dias" value="Martes" class="mr-2 w-4 h-4 text-[#008080]">
                                        <span class="text-sm">Martes</span>
                                    </label>
                                    <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#008080] cursor-pointer">
                                        <input type="checkbox" name="p17_dias" value="Miércoles" class="mr-2 w-4 h-4 text-[#008080]">
                                        <span class="text-sm">Miércoles</span>
                                    </label>
                                    <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#008080] cursor-pointer">
                                        <input type="checkbox" name="p17_dias" value="Jueves" class="mr-2 w-4 h-4 text-[#008080]">
                                        <span class="text-sm">Jueves</span>
                                    </label>
                                    <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#008080] cursor-pointer">
                                        <input type="checkbox" name="p17_dias" value="Viernes" class="mr-2 w-4 h-4 text-[#008080]">
                                        <span class="text-sm">Viernes</span>
                                    </label>
                                </div>
                            </div>
                            
                            <!-- Solo email option -->
                            <label class="flex items-center p-3 bg-blue-50 border-2 border-blue-200 rounded-lg cursor-pointer">
                                <input type="checkbox" name="p17_solo_email" value="Solo email, no llamar" class="mr-3 w-5 h-5 text-blue-600">
                                <span class="font-semibold text-gray-700">📧 Solo email, no llamar</span>
                            </label>
                        </div>

                        <!-- Observaciones (nuevo campo opcional) -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                💬 Observaciones (opcional)
                            </label>
                            <textarea name="observaciones" 
                                      rows="4" 
                                      class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none"
                                      placeholder="¿Algo más que quieras contarnos? Información adicional, necesidades específicas, preguntas..."></textarea>
                            <p class="text-xs text-gray-500 mt-1">Este campo es opcional pero nos ayuda a conocerte mejor</p>
                        </div>

                        <!-- Opt-ins Section -->

                        <!-- Sorteo Opt-in -->
                        <div class="mb-6 bg-gradient-to-r from-[#E6F2F2] to-[#EBF5F5] border-2 border-[#B3D9D9] rounded-xl p-6">
                            <div class="flex items-start">
                                <input type="checkbox" id="wantRaffle" name="wantRaffle" value="si" class="mt-1 mr-3 w-5 h-5 text-[#008080]">
                                <label for="wantRaffle" class="cursor-pointer">
                                    <span class="font-bold text-gray-800">🎁 Quiero participar en el sorteo de Redes Sociales</span>
                                    <p class="text-sm text-gray-600 mt-1">Sorteo online: 1 año de Agenda Inteligente IA (Valor: 1.020€)</p>
                                    <p class="text-xs text-gray-500 mt-1">
                                        📅 Fecha: 15 diciembre 2025 • Válido para seguidores Facebook/Instagram/LinkedIn • 
                                        <a href="https://galiadigital.es/sorteo/" target="_blank" class="text-[#008080] underline hover:text-[#006666]">Ver bases legales</a>
                                    </p>
                                </label>
                            </div>
                        </div>

                        <!-- Report Opt-in -->
                        <div class="mb-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                            <div class="flex items-start">
                                <input type="checkbox" id="wantReport" name="wantReport" value="si" class="mt-1 mr-3 w-5 h-5 text-blue-600">
                                <label for="wantReport" class="cursor-pointer">
                                    <span class="font-bold text-gray-800">📊 Quiero recibir informe de mejoras para mi negocio</span>
                                    <p class="text-sm text-gray-600 mt-1">Análisis personalizado basado en tus respuestas con recomendaciones específicas</p>
                                </label>
                            </div>
                        </div>

                        <!-- Campo Gestor (OPCIONAL) -->
                        <div class="mb-6 bg-purple-50 border-2 border-purple-200 rounded-xl p-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                💼 ¿Tienes gestor en Galia Digital?
                            </label>
                            <input type="text" name="gestor" 
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none"
                                   placeholder="Nombre del gestor (opcional)">
                        </div>

                        <!-- Confirmación Legal (DENTRO del Bloque 4) -->
                        <h3 class="text-2xl font-bold text-gray-800 mb-6 mt-8">✅ Confirmación Final</h3>
                        
                        <div class="bg-gray-50 border-2 border-gray-300 rounded-xl p-6 mb-6">
                            <div class="flex items-start">
                                <input type="checkbox" id="acceptGDPR" name="acceptGDPR" required class="mt-1 mr-3 w-5 h-5 text-[#008080]">
                                <label for="acceptGDPR" class="cursor-pointer text-sm">
                                    <span class="font-semibold text-gray-800">He leído y acepto la <a href="https://galiadigital.es/politica-de-privacidad/" target="_blank" class="text-[#008080] underline hover:text-[#006666]">Política de Protección de Datos</a></span>
                                    <p class="text-xs text-gray-600 mt-2">
                                        Tus datos serán tratados conforme al RGPD. Podrás ejercer tus derechos de acceso, rectificación, cancelación y oposición en cualquier momento contactando con eva@galiadigital.es
                                    </p>
                                </label>
                            </div>
                        </div>

                        <div class="text-center">
                            <p class="text-sm text-gray-600 mb-4">Al enviar esta encuesta confirmas que:</p>
                            <ul class="text-xs text-gray-500 text-left max-w-md mx-auto mb-6 space-y-1">
                                <li>✓ Tus datos son verídicos</li>
                                <li>✓ Autorizas el tratamiento de tus datos personales</li>
                                <li>✓ Aceptas recibir comunicaciones comerciales de Galia Digital (puedes darte de baja en cualquier momento)</li>
                            </ul>
                        </div>
                    </div>

                    <!-- Navigation Buttons -->
                    <div class="flex justify-between mt-8">
                        <button type="button" id="prevBtn" 
                                class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition hidden">
                            ← Anterior
                        </button>
                        <button type="button" id="nextBtn" 
                                class="ml-auto px-6 py-3 bg-[#008080] text-white rounded-lg font-bold hover:bg-[#006666] transition">
                            Siguiente →
                        </button>
                        <button type="submit" id="submitBtn" 
                                class="ml-auto px-8 py-3 bg-gradient-to-r from-[#008080] to-[#1b285e] text-white rounded-lg font-bold hover:shadow-xl transition transform hover:scale-105 hidden">
                            📤 Enviar Resultados
                        </button>
                    </div>
                </form>

                <!-- Success Message -->
                <div id="successMessage" class="hidden text-center py-12">
                    <div class="text-6xl mb-4">🎉</div>
                    <h2 class="text-3xl font-bold text-gray-800 mb-4">¡Gracias por participar!</h2>
                    <p class="text-gray-600 mb-4">Tu respuesta ha sido registrada correctamente</p>
                    <div id="raffleInfo" class="hidden bg-gradient-to-r from-[#E6F2F2] to-[#EBF5F5] border-2 border-[#B3D9D9] rounded-xl p-6 mt-6">
                        <div class="text-4xl mb-3">🎁</div>
                        <h3 class="text-2xl font-bold text-gray-800 mb-2">¡Sorteo Especial Redes Sociales!</h3>
                        <p class="text-gray-600 mb-2">Participa desde Facebook/Instagram/LinkedIn y gana 1 año de Agenda Inteligente IA</p>
                        <p class="text-[#008080] font-bold text-3xl mb-2">Tu número: <span id="raffleNumberDisplay"></span></p>
                        <p class="text-[#008080] font-bold text-lg mb-2">Valor: 1.020€ (300€ setup + 720€ servicio anual)</p>
                        <p class="text-gray-600">📅 Sorteo: 15 diciembre 2025</p>
                        <p class="text-xs text-gray-500 mt-2">
                            <a href="https://galiadigital.es/sorteo/" target="_blank" class="text-[#008080] underline hover:text-[#006666]">
                                📋 Ver bases legales del sorteo
                            </a>
                        </p>
                    </div>
                    <p class="text-gray-600 mt-6">¡Mucha suerte! 🍀</p>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script>
        // DETECCIÓN DE PARÁMETRO ?pdf=timestamp para generar PDF desde dashboard
        const urlParams = new URLSearchParams(window.location.search)
        const pdfTimestamp = urlParams.get('pdf')
        
        if (pdfTimestamp) {
            // Cargar datos y generar PDF automáticamente
            loadAndGeneratePDF(pdfTimestamp)
        }
        
        async function loadAndGeneratePDF(timestamp) {
            try {
                // Ocultar formulario, mostrar mensaje de carga
                document.getElementById('surveyForm').innerHTML = '<div class="text-center py-12"><div class="text-4xl mb-4">📄</div><h2 class="text-2xl font-bold text-gray-800 mb-4">Generando PDF...</h2><p class="text-gray-600">Un momento por favor</p></div>'
                
                // Fetch datos desde backend
                const response = await axios.get('/api/pdf/' + timestamp)
                const data = response.data
                
                // Generar PDF con el código BUENO
                generatePDF(data)
                
                // Mostrar mensaje de éxito
                document.getElementById('surveyForm').innerHTML = '<div class="text-center py-12"><div class="text-4xl mb-4">✅</div><h2 class="text-2xl font-bold text-gray-800 mb-4">PDF Generado</h2><p class="text-gray-600">El PDF se está descargando...</p><button onclick="window.close()" class="mt-6 px-6 py-3 bg-[#008080] text-white rounded-lg font-bold hover:bg-[#006666]">Cerrar Ventana</button></div>'
                
            } catch (error) {
                console.error('Error generando PDF:', error)
                document.getElementById('surveyForm').innerHTML = '<div class="text-center py-12"><div class="text-4xl mb-4">❌</div><h2 class="text-2xl font-bold text-gray-800 mb-4">Error</h2><p class="text-gray-600">No se pudo generar el PDF</p><button onclick="window.close()" class="mt-6 px-6 py-3 bg-gray-500 text-white rounded-lg font-bold">Cerrar</button></div>'
            }
        }
        
        let currentBlock = 1
        const totalBlocks = 4
        const totalQuestions = 18
        
        const blocks = document.querySelectorAll('.question-block')
        const prevBtn = document.getElementById('prevBtn')
        const nextBtn = document.getElementById('nextBtn')
        const submitBtn = document.getElementById('submitBtn')
        const progressBar = document.getElementById('progress-bar')
        const progressText = document.getElementById('progress-text')

        function updateProgress() {
            const answeredQuestions = countAnsweredQuestions()
            const percentage = (answeredQuestions / totalQuestions) * 100
            progressBar.style.width = percentage + '%'
            progressText.textContent = answeredQuestions + '/' + totalQuestions
        }

        function countAnsweredQuestions() {
            let count = 0
            const form = document.getElementById('surveyForm')
            
            // Count select questions (p1, p2, p3, p4, p6, p7, p8, p9, p18_precio)
            const selects = ['p1', 'p2', 'p3', 'p4', 'p6', 'p7', 'p8', 'p9', 'p18_precio']
            selects.forEach(name => {
                const select = form.querySelector('select[name="' + name + '"]')
                if (select && select.value.trim() !== '') count++
            })
            
            // Count text/email/tel inputs (p10, p11, p12, p13, p14, p15, p15_direccion)
            const textInputs = ['p10', 'p11', 'p12', 'p13', 'p14', 'p15', 'p15_direccion']
            textInputs.forEach(name => {
                const input = form.querySelector('input[name="' + name + '"]')
                if (input && input.value.trim() !== '') count++
            })
            
            // Count checkbox questions (p5, p17 - multi-checkbox counts as 1 question)
            if (form.querySelectorAll('input[name="p5"]:checked').length > 0) count++
            if (form.querySelectorAll('input[name="p17_horario"]:checked').length > 0 || 
                form.querySelectorAll('input[name="p17_dias"]:checked').length > 0 ||
                form.querySelectorAll('input[name="p17_solo_email"]:checked').length > 0) count++
            
            return count
        }

        function showBlock(blockNumber) {
            blocks.forEach(block => block.classList.remove('active'))
            blocks[blockNumber - 1].classList.add('active')
            
            prevBtn.classList.toggle('hidden', blockNumber === 1)
            nextBtn.classList.toggle('hidden', blockNumber === totalBlocks)
            submitBtn.classList.toggle('hidden', blockNumber !== totalBlocks)
            
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }

        function validateCurrentBlock() {
            const currentBlockElement = blocks[currentBlock - 1]
            const inputs = currentBlockElement.querySelectorAll('input[required], select[required]')
            
            for (let input of inputs) {
                if (input.type === 'checkbox' && input.required) {
                    // For required single checkboxes (like GDPR)
                    if (!input.checked) {
                        alert('Debes aceptar la Política de Protección de Datos para continuar')
                        input.focus()
                        return false
                    }
                } else if (input.type === 'checkbox') {
                    // For optional multi-checkboxes (p5)
                    const checkboxGroup = currentBlockElement.querySelectorAll('input[name="' + input.name + '"]')
                    const checkedCount = Array.from(checkboxGroup).filter(cb => cb.checked).length
                    if (checkedCount === 0) {
                        alert('Por favor, selecciona al menos una opción')
                        return false
                    }
                } else {
                    if (!input.value.trim()) {
                        alert('Por favor, completa todos los campos requeridos')
                        input.focus()
                        return false
                    }
                }
            }
            
            // Special validation for P17 (horario de contacto) - at least one option required
            if (currentBlock === 4) {
                const p17_horario = currentBlockElement.querySelectorAll('input[name="p17_horario"]:checked').length
                const p17_dias = currentBlockElement.querySelectorAll('input[name="p17_dias"]:checked').length
                const p17_solo_email = currentBlockElement.querySelectorAll('input[name="p17_solo_email"]:checked').length
                
                if (p17_horario === 0 && p17_dias === 0 && p17_solo_email === 0) {
                    alert('Por favor, indica tu horario y días preferidos para contactarte (o marca "Solo email")')
                    window.scrollTo({ top: document.querySelector('[name="p17_horario"]').offsetTop - 100, behavior: 'smooth' })
                    return false
                }
            }
            
            return true
        }

        nextBtn.addEventListener('click', () => {
            if (validateCurrentBlock()) {
                currentBlock++
                showBlock(currentBlock)
                updateProgress()
            }
        })

        prevBtn.addEventListener('click', () => {
            currentBlock--
            showBlock(currentBlock)
        })

        document.getElementById('surveyForm').addEventListener('submit', async (e) => {
            e.preventDefault()
            
            if (!validateCurrentBlock()) return
            
            submitBtn.disabled = true
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Enviando...'
            
            const formData = new FormData(e.target)
            const data = {}
            
            // Process regular fields
            for (let [key, value] of formData.entries()) {
                if (key === 'p5' || key === 'p17_horario' || key === 'p17_dias' || key === 'p17_solo_email') {
                    if (!data[key]) data[key] = []
                    data[key].push(value)
                } else {
                    data[key] = value
                }
            }
            
            // Convert arrays to strings
            if (data.p5) data.p5 = data.p5.join(', ')
            if (data.p17_horario) data.p17_horario = data.p17_horario.join(', ')
            if (data.p17_dias) data.p17_dias = data.p17_dias.join(', ')
            if (data.p17_solo_email) data.p17_solo_email = 'Sí'
            
            data.timestamp = new Date().toISOString()
            
            try {
                const response = await axios.post('/api/submit-survey', data)
                
                // IMPORTANTE: Añadir raffleNumber a los datos para el PDF
                if (response.data.raffleNumber) {
                    data.raffleNumber = response.data.raffleNumber
                }
                
                // Hide form, show success
                document.getElementById('surveyForm').classList.add('hidden')
                document.getElementById('successMessage').classList.remove('hidden')
                
                // Show raffle info if applicable
                if (response.data.raffleNumber) {
                    document.getElementById('raffleInfo').classList.remove('hidden')
                    document.getElementById('raffleNumberDisplay').textContent = '#' + response.data.raffleNumber
                }
                
                window.scrollTo({ top: 0, behavior: 'smooth' })
                
                // Generar y descargar PDF automaticamente (ahora con raffleNumber incluido)
                generatePDF(data)
                
            } catch (error) {
                alert('Error al enviar la encuesta. Por favor, intenta de nuevo.')
                submitBtn.disabled = false
                submitBtn.innerHTML = '✅ Enviar Encuesta'
            }
        })

        // Funcion para generar PDF con las respuestas (VERSION PROFESIONAL CON UTF-8 Y LOGO)
        function generatePDF(data) {
            const { jsPDF } = window.jspdf
            const doc = new jsPDF()
            
            let yPos = 15
            const lineHeight = 6
            const pageHeight = 270
            const pageWidth = 210
            const margin = 15
            const contentWidth = pageWidth - (margin * 2)
            
            // HEADER CON DEGRADADO
            doc.setFillColor(0, 128, 128) // Turquesa
            doc.rect(0, 0, pageWidth, 45, 'F')
            
            doc.setFillColor(27, 40, 94) // Azul marino
            doc.rect(0, 35, pageWidth, 10, 'F')
            
            // LOGO GALIA DIGITAL EMBEDADO
            const logoData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAH0A9QDASIAAhEBAxEB/8QAHQABAAICAwEBAAAAAAAAAAAAAAcIAwYCBAUBCf/EAFIQAAEDAgIEBg4FCwQABgIDAAABAgMEBQYRBxIhMQgUQVFhgRMXIjVTVXFzkZKUobLSMjZCdLEVFiM3UmKCk7PB0SQzVHIYNEOiwvFk4WPi8P/EABsBAQACAwEBAAAAAAAAAAAAAAADBAIFBgEH/8QANhEBAAIBAgMECAYDAQADAQAAAAECAwQREjFRBRMhMhUiQVKBocHRBjRhcZGxFCMzQkPh8fD/2gAMAwEAAhEDEQA/APAABsHy8AAAAytp5nJm2GRU6GqCI3YgZuK1HgJfUUcVqPAS+ooe8M9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajwEvqKDhnowgzcVqPAS+oo4rUeAl9RQcM9GEGbitR4CX1FHFajw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'
            try {
                doc.addImage(logoData, 'JPEG', 15, 8, 30, 15)
            } catch (e) {
                console.warn('Error logo:', e)
            }
            
            // Titulo
            doc.setFontSize(24)
            doc.setTextColor(255, 255, 255)
            doc.setFont('helvetica', 'bold')
            doc.text('GALIA DIGITAL', pageWidth / 2, 20, { align: 'center' })
            
            doc.setFontSize(12)
            doc.setFont('helvetica', 'normal')
            doc.text('Encuesta MVP - Agenda Inteligente IA', pageWidth / 2, 28, { align: 'center' })
            
            // Fecha en el header
            doc.setFontSize(9)
            doc.text('Fecha: ' + new Date().toLocaleString('es-ES'), pageWidth / 2, 40, { align: 'center' })
            
            yPos = 55
            
            // Funcion para dibujar una caja decorativa
            function drawBox(y, height, color) {
                doc.setFillColor(color[0], color[1], color[2])
                doc.roundedRect(margin, y, contentWidth, height, 2, 2, 'F')
            }
            
            // Funcion para agregar seccion con titulo
            function addSection(title) {
                if (yPos > pageHeight - 15) {
                    doc.addPage()
                    yPos = 20
                }
                
                // Linea separadora superior
                doc.setDrawColor(0, 128, 128)
                doc.setLineWidth(0.5)
                doc.line(margin, yPos - 3, pageWidth - margin, yPos - 3)
                
                // Titulo de seccion
                doc.setFontSize(13)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(0, 128, 128)
                doc.text(title, margin, yPos + 3)
                
                yPos += 10
            }
            
            // Funcion para agregar campo con estilo
            function addField(label, value, highlight = false) {
                if (yPos > pageHeight) {
                    doc.addPage()
                    yPos = 20
                }
                
                if (highlight) {
                    // Fondo destacado para campos importantes
                    drawBox(yPos - 4, 8, [230, 242, 242])
                }
                
                // Etiqueta
                doc.setFontSize(10)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(45, 45, 45)
                doc.text(label, margin + 2, yPos)
                
                // Valor
                yPos += 5
                doc.setFont('helvetica', 'normal')
                doc.setTextColor(80, 80, 80)
                doc.setFontSize(9)
                
                const displayValue = value || 'No respondido'
                const lines = doc.splitTextToSize(displayValue, contentWidth - 10)
                doc.text(lines, margin + 5, yPos)
                
                yPos += (lines.length * 5) + 4
            }
            
            // SECCION 1: DATOS PERSONALES
            addSection('DATOS PERSONALES')
            
            // Caja destacada con nombre
            drawBox(yPos - 4, 12, [78, 53, 128]) // Morado
            doc.setFontSize(14)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(255, 255, 255)
            doc.text(data.p10 || 'Sin nombre', margin + 5, yPos + 4)
            yPos += 15
            
            addField('Peluqueria:', data.p11, true)
            addField('WhatsApp:', data.p12)
            addField('Email:', data.p13)
            addField('Ciudad:', data.p14)
            addField('Ubicacion del salon:', data.p15)
            if (data.p15_direccion) addField('Direccion completa:', data.p15_direccion)
            
            // GESTOR
            if (data.gestor) {
                yPos += 3
                drawBox(yPos - 4, 10, [243, 232, 255])
                doc.setFontSize(10)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(128, 0, 128)
                doc.text('ENCUESTA RECOGIDA POR:', margin + 3, yPos + 2)
                doc.setFontSize(11)
                doc.setTextColor(75, 0, 130)
                doc.text(data.gestor, margin + 3, yPos + 7)
                yPos += 13
            }
            
            yPos += 5
            
            // SECCION 2: CUALIFICACION
            addSection('CUALIFICACION')
            addField('Tiempo dedicado a gestion de agenda:', data.p1)
            addField('Mayor problema con las citas:', data.p2)
            
            yPos += 3
            
            // SECCION 3: NECESIDADES
            addSection('NECESIDADES DEL NEGOCIO')
            addField('Que mas te quita tiempo o dinero:', data.p5)
            addField('Facturacion obligatoria 2026:', data.p6)
            addField('Tiempo gestion stock semanal:', data.p7)
            addField('Gestion horarios empleados:', data.p8)
            
            yPos += 3
            
            // SECCION 4: VALIDACION
            addSection('VALIDACION DE SOLUCION')
            addField('Que te frena para automatizar:', data.p3)
            addField('Probar GRATIS 15 dias:', data.p4)
            addField('Sistema todo-en-uno:', data.p9)
            
            // PRECIO DESTACADO
            yPos += 2
            drawBox(yPos - 4, 12, [230, 242, 242])
            doc.setFontSize(11)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(0, 128, 128)
            doc.text('PRECIO QUE PAGARIAS:', margin + 3, yPos + 2)
            doc.setFontSize(12)
            doc.setTextColor(27, 40, 94)
            doc.text(data.p18_precio || 'No especificado', margin + 70, yPos + 2)
            yPos += 15
            
            // SECCION 5: CONTACTO
            addSection('HORARIO DE CONTACTO')
            if (data.p17_horario) addField('Horarios preferidos:', data.p17_horario)
            if (data.p17_dias) addField('Dias preferidos:', data.p17_dias)
            if (data.p17_solo_email) {
                drawBox(yPos - 4, 8, [230, 242, 255])
                doc.setFontSize(10)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(27, 40, 94)
                doc.text('SOLO CONTACTO POR EMAIL', margin + 3, yPos + 2)
                yPos += 10
            }
            
            // SECCION 6: OBSERVACIONES
            if (data.observaciones) {
                yPos += 3
                addSection('OBSERVACIONES')
                drawBox(yPos - 4, Math.min(30, 5 + (data.observaciones.length / 50) * 5), [255, 250, 240])
                yPos += 2
                addField('', data.observaciones)
            }
            
            // SECCION 7: OPCIONES
            yPos += 5
            addSection('OPCIONES SELECCIONADAS')
            
            if (data.raffleNumber) {
                drawBox(yPos - 4, 12, [230, 255, 230])
                doc.setFontSize(11)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(0, 128, 0)
                doc.text('PARTICIPA EN SORTEO REDES - 15 diciembre 2025', margin + 3, yPos + 2)
                doc.setFontSize(16)
                doc.setTextColor(0, 100, 0)
                doc.text('NUMERO DE SORTEO: #' + data.raffleNumber, margin + 3, yPos + 8)
                yPos += 15
            } else if (data.wantRaffle) {
                drawBox(yPos - 4, 8, [255, 245, 230])
                doc.setFontSize(10)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(200, 100, 0)
                doc.text('No marco participar en sorteo', margin + 3, yPos + 2)
                yPos += 10
            }
            
            if (data.wantReport) {
                drawBox(yPos - 4, 8, [230, 240, 255])
                doc.setFontSize(10)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(27, 40, 94)
                doc.text('QUIERE RECIBIR INFORME PERSONALIZADO', margin + 3, yPos + 2)
                yPos += 10
            }
            
            // FOOTER EN CADA PAGINA
            const totalPages = doc.internal.getNumberOfPages()
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i)
                
                // Linea footer
                doc.setDrawColor(0, 128, 128)
                doc.setLineWidth(0.3)
                doc.line(margin, 285, pageWidth - margin, 285)
                
                // Texto footer
                doc.setFontSize(8)
                doc.setTextColor(100, 100, 100)
                doc.setFont('helvetica', 'italic')
                doc.text('Galia Digital - Agenda Inteligente IA', pageWidth / 2, 290, { align: 'center' })
                doc.text('Pagina ' + i + ' de ' + totalPages, pageWidth - margin, 290, { align: 'right' })
            }
            
            // Generar nombre del archivo
            const fileName = 'GaliaDigital_' + (data.p11 || 'Encuesta').replace(/[^a-z0-9]/gi, '_') + '_' + new Date().toISOString().split('T')[0] + '.pdf'
            
            // Descargar PDF
            doc.save(fileName)
        }

        // Update progress on input change
        document.getElementById('surveyForm').addEventListener('change', updateProgress)
        document.getElementById('surveyForm').addEventListener('input', updateProgress)
    </script>
</body>
</html>
  `)
})

function calculatePriority(data) {
  const wtp = data.p3
  const trial = data.p5
  const contact = data.p16

  // HOT: High WTP + Want trial now + Contact this week
  if ((wtp === '40-60€/mes' || wtp === '60-80€/mes' || wtp === '80-100€/mes' || wtp === 'Más de 100€/mes') &&
      trial === 'Sí, ahora mismo' &&
      contact === 'Esta semana') {
    return '🔥 HOT'
  }

  // WARM: Want trial in 1-2 months OR contact next week
  if (trial === 'Sí, en 1-2 meses' || contact === 'Próxima semana') {
    return '🟡 WARM'
  }

  // COLD: Everything else
  return '🟢 COLD'
}

function sendEmailToEva(response) {
  const priorityIcon = response.priority === '🔥 HOT' ? '🔥' : 
                       response.priority === '🟡 WARM' ? '🟡' : '🟢'
  
  console.log('\n' + '='.repeat(80))
  console.log(`📧 EMAIL PARA: eva@galiadigital.es`)
  console.log('='.repeat(80))
  console.log(`Asunto: ${priorityIcon} NUEVO LEAD ${response.priority} - ${response.p10} (${response.p11})`)
  console.log('='.repeat(80))
  console.log('')
  console.log(`PRIORIDAD: ${response.priority}`)
  console.log(`Nombre: ${response.p10}`)
  console.log(`Peluquería: ${response.p11}`)
  console.log(`Ciudad: ${response.p14}`)
  console.log(`WhatsApp: ${response.p12}`)
  console.log(`Email: ${response.p13}`)
  console.log(`Dirección: ${response.p15 || 'No proporcionada'}`)
  console.log('')
  console.log('💰 VALIDACIÓN MVP:')
  console.log(`  - Tiempo gestión agenda/día: ${response.p1}`)
  console.log(`  - Mayor problema: ${response.p2}`)
  console.log(`  - Pagaría: ${response.p3}`)
  console.log(`  - Principal freno: ${response.p4}`)
  console.log(`  - Prueba gratis: ${response.p5}`)
  console.log(`  - Contactar: ${response.p16}`)
  console.log('')
  console.log('📱 REDES SOCIALES:')
  console.log(`  - Qué le quita tiempo: ${response.p6}`)
  console.log(`  - Usa: ${response.p7}`)
  console.log(`  - Tiempo semanal RRSS: ${response.p8}`)
  console.log(`  - Pagaría contenido IA: ${response.p9}`)
  console.log('')
  console.log('💡 INTERESES:')
  console.log(`  - Quiere informe de mejoras: ${response.wantReport === 'si' ? 'SÍ' : 'NO'}`)
  console.log(`  - Quiere participar en sorteo: ${response.wantRaffle === 'si' ? 'SÍ' : 'NO'}`)
  console.log('')
  
  if (response.participatesInRaffle) {
    console.log('🎁 SORTEO:')
    console.log(`  Participa: SÍ`)
    console.log(`  Número: #${response.raffleNumber}`)
    console.log('')
  } else if (response.wantRaffle === 'si') {
    console.log('⚠️ SORTEO:')
    console.log(`  Quería participar pero NO es de A Coruña`)
    console.log('')
  }
  
  console.log('⚡ ACCIÓN RECOMENDADA:')
  if (response.priority === '🔥 HOT') {
    console.log(`  🔥 LLAMAR EN LAS PRÓXIMAS 24 HORAS`)
    console.log(`  Perfil ideal: alta disposición de pago + necesita solución urgente`)
  } else if (response.priority === '🟡 WARM') {
    console.log(`  🟡 SEGUIMIENTO EN 3-5 DÍAS`)
    console.log(`  Interesado pero no urgente. Nutrir con contenido de valor`)
  } else {
    console.log(`  🟢 FOLLOW-UP LARGO PLAZO`)
    console.log(`  Añadir a lista de nurturing. Email automatizado mensual`)
  }
  
  console.log('')
  console.log(`Timestamp: ${response.timestamp}`)
  console.log('='.repeat(80))
  console.log('\n')
}

function generateCompleteReport(r) {
  const timeValue = r.p1 === 'Más de 2 horas' ? '2+ horas' : r.p1
  const timeSaved = r.p1 === 'Más de 2 horas' ? '10h' : r.p1 === '1-2 horas' ? '8h' : '5h'
  const roiMonths = r.p3 === '40-60€/mes' ? '6' : r.p3 === '60-80€/mes' ? '5' : r.p3 === '20-40€/mes' ? '8' : '4'
  
  const socialOpportunity = (r.p7 && r.p7 !== 'Ninguna' && r.p8 !== 'No uso RRSS') 
    ? `\n3. **Automatización RRSS**: Usas ${r.p7} y dedicas ${r.p8}/semana. Con nuestro sistema de contenido IA podrías recuperar 60% de ese tiempo.`
    : ''
  
  const report = `🎯 ANÁLISIS PERSONALIZADO PARA ${r.p11.toUpperCase()}

Hola ${r.p10.split(' ')[0]},

He analizado tus respuestas y esto es lo que he identificado:

📊 TU SITUACIÓN ACTUAL:
• Tiempo perdido en gestión de agenda: ${timeValue} al día
• Principal problema: ${r.p2}
• Disposición de inversión: ${r.p3}
• Principal freno: ${r.p4}

💡 OPORTUNIDADES DETECTADAS:

1. **Recuperación de Tiempo**: Con ${timeValue} diarios perdidos en gestión manual, estás dedicando aproximadamente ${timeValue === '2+ horas' ? '10+ horas' : timeValue === '1-2 horas' ? '7-8 horas' : '3-5 horas'} semanales a tareas que podrían automatizarse completamente.

2. **Reducción de No-Shows**: El problema "${r.p2}" tiene solución directa con recordatorios automáticos por WhatsApp. Nuestros clientes reducen cancelaciones en un 80%.${socialOpportunity}

🎯 RECOMENDACIONES PRIORITARIAS:

**Para ${r.p11}:**
${r.priority === '🔥 HOT' ? '✅ Tu perfil es IDEAL para implementar ahora. Tienes necesidad urgente + disposición de inversión.' : ''}
${r.priority === '🟡 WARM' ? '✅ Estás en el momento perfecto para dar el salto. La inversión se recupera rápido.' : ''}
${r.priority === '🟢 COLD' ? '✅ Puedes empezar con una demo gratuita para ver el impacto sin compromiso.' : ''}

**Acción inmediata:**
1. Agenda Inteligente IA → Soluciona "${r.p2}"
2. Integración WhatsApp 24/7 → Gestión automática
3. Listas de espera inteligentes → Aprovecha horas muertas

📈 IMPACTO ESTIMADO PARA ${r.p11}:

• **Tiempo recuperado**: +${timeSaved}/semana = ${parseInt(timeSaved) * 4}h/mes
• **Reducción no-shows**: -80% cancelaciones
• **ROI esperado**: Inversión recuperada en ${roiMonths} meses
• **Valor anual recuperado**: ${timeValue === '2+ horas' ? '500h' : timeValue === '1-2 horas' ? '400h' : '250h'} anuales = ${timeValue === '2+ horas' ? '12.500€' : timeValue === '1-2 horas' ? '10.000€' : '6.250€'}* en tiempo

*Calculado a 25€/hora (valor promedio tiempo peluquera)

🔄 COMPARATIVA:

**Situación Actual:**
❌ ${timeValue} diarios en gestión manual
❌ Cancelaciones frecuentes
❌ Horas muertas sin aprovechar
❌ Estrés por agenda caótica

**Con Agenda Inteligente IA:**
✅ Gestión automática 24/7
✅ 80% menos cancelaciones
✅ Horas muertas recuperadas
✅ Libertad total de tu agenda

¿Te gustaría que hablemos sobre cómo implementar esto en ${r.p11}?

${r.p16 === 'Esta semana' ? '📞 Veo que prefieres que hablemos esta semana. ¿Te viene bien mañana?' : ''}
${r.p16 === 'Próxima semana' ? '📞 Perfecto, te contacto la próxima semana para una demo rápida.' : ''}

Un abrazo,

**Eva Rodríguez**
Fundadora Galia Digital
📱 +34 676 351 851
📧 eva@galiadigital.es
🌐 galiadigital.es`

  return report
}

function generateCommercialReport(r) {
  const timeValue = r.p1 === 'Más de 2 horas' ? '2+ horas' : r.p1
  const recommendedPrice = r.p3 === '40-60€/mes' ? '60€/mes' : 
                          r.p3 === '60-80€/mes' ? '75€/mes' : 
                          r.p3 === '20-40€/mes' ? '49€/mes' : '90€/mes'
  const roiMonths = r.p3 === '40-60€/mes' ? '6' : r.p3 === '60-80€/mes' ? '5' : r.p3 === '20-40€/mes' ? '7' : '4'
  
  const socialAddon = (r.p9 === 'Sí, definitivamente' || r.p9 === 'Depende del precio')
    ? `\n📱 **BONUS: Gestión Contenido RRSS con IA**
• Generación automática de posts
• Calendario editorial mensual
• Stories personalizadas
• Inversión adicional: +30€/mes
• Ahorro tiempo: 3-5h/semana`
    : ''
  
  const urgencyNote = r.p16 === 'Esta semana' 
    ? '\n\n🔥 **OFERTA VÁLIDA ESTA SEMANA**: Si decidimos trabajar juntas antes del viernes, te regalo el setup (300€). Solo pagas desde mes 1.'
    : ''
  
  const report = `💼 PROPUESTA PERSONALIZADA PARA ${r.p11.toUpperCase()}

Hola ${r.p10.split(' ')[0]},

Basándome en tus respuestas, he preparado una solución a medida para ${r.p11}:

🎯 LO QUE HAS IDENTIFICADO:

Dedicas ${timeValue} al día a gestión de agenda manual, tu mayor problema es "${r.p2}", y estás ${r.p5 === 'Sí, ahora mismo' ? 'lista para probar una solución YA' : r.p5 === 'Sí, en 1-2 meses' ? 'considerando probar una solución pronto' : 'abierta a explorar opciones'}.

${r.p4 === 'Ninguno, lo haría hoy' ? '✨ Y lo mejor: no tienes frenos. ¡Estás lista para dar el salto!' : `Tu principal freno es "${r.p4}" - te entiendo perfectamente, y por eso nuestra solución es súper fácil de implementar.`}

✨ SOLUCIÓN GALIA DIGITAL PARA ${r.p11}:

📱 **AGENDA INTELIGENTE IA - PLAN PERSONALIZADO**

**Lo que incluye:**
✅ Integración WhatsApp 24/7 (tus clientes reservan sin molestarte)
✅ Recordatorios automáticos (adiós no-shows)
✅ Gestión de listas de espera inteligente (aprovecha horas muertas)
✅ Dashboard control total (tú tienes el poder, la IA trabaja para ti)
✅ Integración con tu sistema actual (${r.p4 === 'No sé cómo funciona' ? 'súper fácil, yo te lo configuro todo' : 'proceso sencillo'})
✅ Soporte personalizado (estoy disponible para lo que necesites)

💰 INVERSIÓN PARA ${r.p11}:

**Setup inicial**: 300€ (una sola vez)
• Configuración personalizada
• Integración completa
• Formación incluida
• Soporte primeras 2 semanas

**Servicio mensual**: ${recommendedPrice}
• Gestión automática 24/7
• Actualizaciones incluidas
• Soporte continuo
• Sin permanencia

**ROI**: Tu inversión se recupera en ${roiMonths} meses
• Después, es puro beneficio (tiempo + dinero)${socialAddon}

🎁 BENEFICIOS CONCRETOS PARA ${r.p11}:

✅ **+8 horas/semana libres** → Puedes atender 16 clientes más/semana
✅ **-80% cancelaciones** → Recuperas ingresos perdidos (aprox. 400€/mes)
✅ **Gestión automática 24/7** → Reservas mientras duermes
✅ **Horas muertas = €€€** → Las listas de espera llenan tus huecos
${r.p7 && r.p7 !== 'Ninguna' ? `✅ **Presencia digital profesional** → Aprovechas que usas ${r.p7}` : ''}

📊 EJEMPLO REAL:

**Mes 1-${roiMonths}**: Recuperas inversión
**Mes ${parseInt(roiMonths) + 1}+**: 
• Ganas: ${timeValue === '2+ horas' ? '40h' : timeValue === '1-2 horas' ? '32h' : '20h'}/mes libres
• Reduces: 80% no-shows (≈ 400€/mes recuperados)
• Rentabilidad: ∞ (sigues ganando más cada mes)

⚡ PRÓXIMO PASO:

${r.p16 === 'Esta semana' ? '📞 **Demo personalizada esta semana** (30 min)\nTe muestro cómo funciona específicamente para ' + r.p11 : ''}
${r.p16 === 'Próxima semana' ? '📞 **Demo personalizada próxima semana** (30 min)\nAgendamos cuando mejor te venga' : ''}
${r.p16 === 'Este mes' || r.p16 === 'No tengo prisa' ? '📞 **Demo sin compromiso cuando quieras** (30 min)\nTú decides cuándo' : ''}

🎯 **GARANTÍA GALIA DIGITAL:**
Si en los primeros 15 días no ves resultados claros, cancelamos y te devuelvo el dinero. Sin letra pequeña.${urgencyNote}

¿Hablamos ${r.p16 === 'Esta semana' ? 'esta semana' : r.p16 === 'Próxima semana' ? 'la próxima' : 'pronto'}?

**Eva Rodríguez**
Fundadora Galia Digital
📱 +34 676 351 851 (WhatsApp disponible)
📧 eva@galiadigital.es
🌐 galiadigital.es

PD: ${r.wantReport === 'si' ? 'Vi que querías este informe. Espero que te ayude a tomar la decisión 💜' : 'Créeme, ${r.p11} merece tener su tiempo de vuelta.'}`

  return report
}

export default app
