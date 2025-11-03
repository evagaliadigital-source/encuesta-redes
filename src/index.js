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

// Serve dashboard
app.get('/dashboard', (c) => {
  return c.html(readFileSync('./dashboard.html', 'utf8'))
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
  
  // Check if participates in raffle (must want it AND be from A Coruña)
  const isFromCoruna = data.p14?.toLowerCase().includes('coruña') || 
                       data.p14?.toLowerCase().includes('coruna')
  const wantsRaffle = data.wantRaffle === 'si'
  const participatesInRaffle = wantsRaffle && isFromCoruna
  
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

        <!-- Raffle Banner -->
        <div class="max-w-3xl mx-auto mb-8">
            <div class="bg-gradient-to-r from-[#E6F2F2] to-[#EBF5F5] border-2 border-[#B3D9D9] rounded-xl p-6 text-center">
                <div class="text-4xl mb-2">🎁</div>
                <h2 class="text-2xl font-bold text-gray-800 mb-2">¡Sorteo Especial A Coruña!</h2>
                <p class="text-gray-600 mb-1">Participa y gana 1 año de Agenda Inteligente IA</p>
                <p class="text-[#008080] font-bold text-lg">Valor: 1.020€ (300€ setup + 720€ servicio anual)</p>
                <p class="text-sm text-gray-500 mt-2">📅 Sorteo: 8 diciembre 2025</p>
                <p class="text-xs text-gray-500 mt-2">
                    <a href="https://galiadigital.es/sorteo/" target="_blank" class="text-[#008080] underline hover:text-[#006666]">
                        📋 Ver bases legales del sorteo
                    </a>
                </p>
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
                                14. ⭐ Ciudad (importante para el sorteo 🎁)
                            </label>
                            <input type="text" name="p14" required 
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none"
                                   placeholder="Ej: A Coruña">
                            <p class="text-sm text-[#008080] mt-2">💡 Si eres de A Coruña, entras automáticamente en el sorteo</p>
                        </div>

                        <!-- P15 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                15. ⭐ Ciudad donde está tu salón
                            </label>
                            <input type="text" name="p15" required
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none"
                                   placeholder="Ej: A Coruña">
                            <p class="text-sm text-[#008080] mt-2">💡 Si eres de A Coruña, entras automáticamente en el sorteo</p>
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
                                    <span class="font-bold text-gray-800">🎁 Quiero participar en el sorteo de A Coruña</span>
                                    <p class="text-sm text-gray-600 mt-1">Sorteo exclusivo: 1 año de Agenda Inteligente IA (Valor: 1.020€)</p>
                                    <p class="text-xs text-gray-500 mt-1">
                                        📅 Fecha: 8 diciembre 2025 • Solo peluquerías de A Coruña • 
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
                        <h3 class="text-2xl font-bold text-gray-800 mb-2">¡Participas en el Sorteo!</h3>
                        <p class="text-[#008080] font-bold text-3xl mb-2">Tu número: <span id="raffleNumberDisplay"></span></p>
                        <p class="text-gray-600">Sorteo: 8 diciembre 2025</p>
                        <p class="text-sm text-gray-500 mt-2">Premio: 1 año Agenda Inteligente IA (1.020€)</p>
                    </div>
                    <p class="text-gray-600 mt-6">¡Mucha suerte! 🍀</p>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script>
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
                
                // Hide form, show success
                document.getElementById('surveyForm').classList.add('hidden')
                document.getElementById('successMessage').classList.remove('hidden')
                
                // Show raffle info if applicable
                if (response.data.raffleNumber) {
                    document.getElementById('raffleInfo').classList.remove('hidden')
                    document.getElementById('raffleNumberDisplay').textContent = '#' + response.data.raffleNumber
                }
                
                window.scrollTo({ top: 0, behavior: 'smooth' })
                
                // Generar y descargar PDF automáticamente
                await generatePDF(data)
                
            } catch (error) {
                alert('Error al enviar la encuesta. Por favor, intenta de nuevo.')
                submitBtn.disabled = false
                submitBtn.innerHTML = '✅ Enviar Encuesta'
            }
        })

        // Función para generar PDF con las respuestas (VERSIÓN PROFESIONAL CON UTF-8 Y LOGO)
        async function generatePDF(data) {
            const { jsPDF } = window.jspdf
            const doc = new jsPDF()
            
            let yPos = 15
            const lineHeight = 6
            const pageHeight = 270
            const pageWidth = 210
            const margin = 15
            const contentWidth = pageWidth - (margin * 2)
            
            // CARGAR LOGO DE GALIA DIGITAL
            const logoUrl = 'https://page.gensparksite.com/v1/base64_upload/a70b1fe40910547351447ef32a13f4af'
            let logoData = null
            try {
                const response = await fetch(logoUrl)
                const blob = await response.blob()
                logoData = await new Promise((resolve) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result)
                    reader.readAsDataURL(blob)
                })
            } catch (e) {
                console.warn('No se pudo cargar el logo:', e)
            }
            
            // HEADER CON DEGRADADO Y LOGO
            doc.setFillColor(0, 128, 128) // Turquesa
            doc.rect(0, 0, pageWidth, 45, 'F')
            
            doc.setFillColor(27, 40, 94) // Azul marino
            doc.rect(0, 35, pageWidth, 10, 'F')
            
            // INSERTAR LOGO (si se cargó)
            if (logoData) {
                try {
                    doc.addImage(logoData, 'PNG', 15, 8, 25, 25) // x, y, ancho, alto
                } catch (e) {
                    console.warn('Error al insertar logo:', e)
                }
            }
            
            // Título
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
            
            // Función para dibujar una caja decorativa
            function drawBox(y, height, color) {
                doc.setFillColor(color[0], color[1], color[2])
                doc.roundedRect(margin, y, contentWidth, height, 2, 2, 'F')
            }
            
            // Función para agregar sección con título
            function addSection(title, icon) {
                if (yPos > pageHeight - 15) {
                    doc.addPage()
                    yPos = 20
                }
                
                // Línea separadora superior
                doc.setDrawColor(0, 128, 128)
                doc.setLineWidth(0.5)
                doc.line(margin, yPos - 3, pageWidth - margin, yPos - 3)
                
                // Título de sección
                doc.setFontSize(13)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(0, 128, 128)
                doc.text(icon + ' ' + title, margin, yPos + 3)
                
                yPos += 10
            }
            
            // Función para agregar campo con estilo
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
            
            // SECCIÓN 1: DATOS PERSONALES
            addSection('DATOS PERSONALES', '👤')
            
            // Caja destacada con nombre
            drawBox(yPos - 4, 12, [78, 53, 128]) // Morado
            doc.setFontSize(14)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(255, 255, 255)
            doc.text(data.p10 || 'Sin nombre', margin + 5, yPos + 4)
            yPos += 15
            
            addField('🏢 Peluquería:', data.p11, true)
            addField('📱 WhatsApp:', data.p12)
            addField('📧 Email:', data.p13)
            addField('📍 Ciudad:', data.p14)
            addField('🏠 Ubicación del salón:', data.p15)
            if (data.p15_direccion) addField('📫 Dirección completa:', data.p15_direccion)
            
            yPos += 5
            
            // SECCIÓN 2: CUALIFICACIÓN
            addSection('CUALIFICACIÓN', '📋')
            addField('⏰ Tiempo dedicado a gestión de agenda:', data.p1)
            addField('⚠️ Mayor problema con las citas:', data.p2)
            
            yPos += 3
            
            // SECCIÓN 3: NECESIDADES
            addSection('NECESIDADES DEL NEGOCIO', '📱')
            addField('🔧 Qué más te quita tiempo o dinero:', data.p5)
            addField('📄 Facturación obligatoria 2026:', data.p6)
            addField('📦 Tiempo gestión stock semanal:', data.p7)
            addField('👥 Gestión horarios empleados:', data.p8)
            
            yPos += 3
            
            // SECCIÓN 4: VALIDACIÓN
            addSection('VALIDACIÓN DE SOLUCIÓN', '💡')
            addField('🚫 Qué te frena para automatizar:', data.p3)
            addField('🎁 Probar GRATIS 15 días:', data.p4)
            addField('💰 Sistema todo-en-uno:', data.p9)
            
            // PRECIO DESTACADO
            yPos += 2
            drawBox(yPos - 4, 12, [230, 242, 242])
            doc.setFontSize(11)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(0, 128, 128)
            doc.text('💵 PRECIO QUE PAGARÍAS:', margin + 3, yPos + 2)
            doc.setFontSize(12)
            doc.setTextColor(27, 40, 94)
            doc.text(data.p18_precio || 'No especificado', margin + 70, yPos + 2)
            yPos += 15
            
            // SECCIÓN 5: CONTACTO
            addSection('HORARIO DE CONTACTO', '📞')
            if (data.p17_horario) addField('🕐 Horarios preferidos:', data.p17_horario)
            if (data.p17_dias) addField('📅 Días preferidos:', data.p17_dias)
            if (data.p17_solo_email) {
                drawBox(yPos - 4, 8, [230, 242, 255])
                doc.setFontSize(10)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(27, 40, 94)
                doc.text('📧 SOLO CONTACTO POR EMAIL', margin + 3, yPos + 2)
                yPos += 10
            }
            
            // SECCIÓN 6: OBSERVACIONES
            if (data.observaciones) {
                yPos += 3
                addSection('OBSERVACIONES', '💬')
                drawBox(yPos - 4, Math.min(30, 5 + (data.observaciones.length / 50) * 5), [255, 250, 240])
                yPos += 2
                addField('', data.observaciones)
            }
            
            // SECCIÓN 7: OPCIONES
            yPos += 5
            addSection('OPCIONES SELECCIONADAS', '✅')
            
            if (data.wantRaffle) {
                drawBox(yPos - 4, 8, [230, 255, 230])
                doc.setFontSize(10)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(0, 128, 0)
                doc.text('🎁 PARTICIPA EN SORTEO - 8 diciembre 2025', margin + 3, yPos + 2)
                yPos += 10
            }
            
            if (data.wantReport) {
                drawBox(yPos - 4, 8, [230, 240, 255])
                doc.setFontSize(10)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(27, 40, 94)
                doc.text('📊 QUIERE RECIBIR INFORME PERSONALIZADO', margin + 3, yPos + 2)
                yPos += 10
            }
            
            // FOOTER EN CADA PÁGINA
            const totalPages = doc.internal.getNumberOfPages()
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i)
                
                // Línea footer
                doc.setDrawColor(0, 128, 128)
                doc.setLineWidth(0.3)
                doc.line(margin, 285, pageWidth - margin, 285)
                
                // Texto footer
                doc.setFontSize(8)
                doc.setTextColor(100, 100, 100)
                doc.setFont('helvetica', 'italic')
                doc.text('Galia Digital - Agenda Inteligente IA', pageWidth / 2, 290, { align: 'center' })
                doc.text('Página ' + i + ' de ' + totalPages, pageWidth - margin, 290, { align: 'right' })
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
