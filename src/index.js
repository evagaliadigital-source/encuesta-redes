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
            <div class="bg-gradient-to-r from-[#9B8DC6] to-[#1b285e] text-white rounded-2xl shadow-xl p-8 text-center">
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
                <p class="text-[#9B8DC6] font-bold text-lg">Valor: 1.020€ (300€ setup + 720€ servicio anual)</p>
                <p class="text-sm text-gray-500 mt-2">📅 Sorteo: 24 noviembre 2025</p>
                <p class="text-xs text-gray-500 mt-2">
                    <a href="https://galiadigital.es/sorteo/" target="_blank" class="text-[#9B8DC6] underline hover:text-[#006666]">
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
                        <span class="text-sm font-semibold text-[#9B8DC6]" id="progress-text">0/16</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-3">
                        <div class="bg-gradient-to-r from-[#9B8DC6] to-[#1b285e] h-3 rounded-full transition-all duration-300" 
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
                                1. ¿Cuánto tiempo dedicas al día a gestionar tu agenda de citas?
                            </label>
                            <select name="p1" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#9B8DC6] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="Menos de 30 min">Menos de 30 min</option>
                                <option value="30-60 min">30-60 min</option>
                                <option value="1-2 horas">1-2 horas</option>
                                <option value="Más de 2 horas">Más de 2 horas</option>
                            </select>
                        </div>

                        <!-- P2 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                2. ¿Cuál es tu mayor problema con las citas?
                            </label>
                            <select name="p2" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#9B8DC6] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="Cancelaciones de última hora">Cancelaciones de última hora</option>
                                <option value="Horas muertas sin aprovechar">Horas muertas sin aprovechar</option>
                                <option value="Gestión de listas de espera">Gestión de listas de espera</option>
                                <option value="Recordatorios manuales">Recordatorios manuales</option>
                                <option value="Todo lo anterior">Todo lo anterior</option>
                            </select>
                        </div>
                    </div>

                    <!-- Block 2: Validación MVP -->
                    <div class="question-block" data-block="2">
                        <h3 class="text-2xl font-bold text-gray-800 mb-6">💰 Bloque 2: Validación MVP</h3>
                        
                        <!-- P3 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                3. Si una agenda inteligente con IA te recuperase 8h/semana y redujese no-shows 80%, ¿cuánto pagarías al mes?
                            </label>
                            <select name="p3" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#9B8DC6] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="20-40€/mes">20-40€/mes</option>
                                <option value="40-60€/mes">40-60€/mes</option>
                                <option value="60-80€/mes">60-80€/mes</option>
                                <option value="80-100€/mes">80-100€/mes</option>
                                <option value="Más de 100€/mes">Más de 100€/mes</option>
                                <option value="No pagaría">No pagaría</option>
                            </select>
                        </div>

                        <!-- P4 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                4. ¿Cuál es tu principal freno para automatizar tu agenda?
                            </label>
                            <select name="p4" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#9B8DC6] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="No sé cómo funciona">No sé cómo funciona</option>
                                <option value="Me da miedo perder el control">Me da miedo perder el control</option>
                                <option value="Creo que es muy caro">Creo que es muy caro</option>
                                <option value="No tengo tiempo de aprenderlo">No tengo tiempo de aprenderlo</option>
                                <option value="Ninguno, lo haría hoy">Ninguno, lo haría hoy</option>
                            </select>
                        </div>

                        <!-- P5 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                5. ¿Probarías gratis 15 días sin compromiso?
                            </label>
                            <select name="p5" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#9B8DC6] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="Sí, ahora mismo">Sí, ahora mismo</option>
                                <option value="Sí, en 1-2 meses">Sí, en 1-2 meses</option>
                                <option value="Quizás más adelante">Quizás más adelante</option>
                                <option value="No me interesa">No me interesa</option>
                            </select>
                        </div>
                    </div>

                    <!-- Block 3: Exploración Nivel 2/3 -->
                    <div class="question-block" data-block="3">
                        <h3 class="text-2xl font-bold text-gray-800 mb-6">📱 Bloque 3: Redes Sociales</h3>
                        
                        <!-- P6 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                6. Además de la agenda, ¿qué más te quita tiempo? (puedes marcar varias)
                            </label>
                            <div class="space-y-2">
                                <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#9B8DC6] cursor-pointer">
                                    <input type="checkbox" name="p6" value="Crear contenido RRSS" class="mr-3 w-5 h-5 text-[#9B8DC6]">
                                    <span>Crear contenido para redes sociales</span>
                                </label>
                                <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#9B8DC6] cursor-pointer">
                                    <input type="checkbox" name="p6" value="Responder mensajes" class="mr-3 w-5 h-5 text-[#9B8DC6]">
                                    <span>Responder mensajes de clientes</span>
                                </label>
                                <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#9B8DC6] cursor-pointer">
                                    <input type="checkbox" name="p6" value="Facturación" class="mr-3 w-5 h-5 text-[#9B8DC6]">
                                    <span>Facturación y gestión administrativa</span>
                                </label>
                                <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#9B8DC6] cursor-pointer">
                                    <input type="checkbox" name="p6" value="Campañas marketing" class="mr-3 w-5 h-5 text-[#9B8DC6]">
                                    <span>Campañas de marketing</span>
                                </label>
                            </div>
                        </div>

                        <!-- P7 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                7. ¿Qué redes sociales usas para tu negocio? (puedes marcar varias)
                            </label>
                            <div class="space-y-2">
                                <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#9B8DC6] cursor-pointer">
                                    <input type="checkbox" name="p7" value="Instagram" class="mr-3 w-5 h-5 text-[#9B8DC6]">
                                    <span>Instagram</span>
                                </label>
                                <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#9B8DC6] cursor-pointer">
                                    <input type="checkbox" name="p7" value="Facebook" class="mr-3 w-5 h-5 text-[#9B8DC6]">
                                    <span>Facebook</span>
                                </label>
                                <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#9B8DC6] cursor-pointer">
                                    <input type="checkbox" name="p7" value="TikTok" class="mr-3 w-5 h-5 text-[#9B8DC6]">
                                    <span>TikTok</span>
                                </label>
                                <label class="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-[#9B8DC6] cursor-pointer">
                                    <input type="checkbox" name="p7" value="Ninguna" class="mr-3 w-5 h-5 text-[#9B8DC6]">
                                    <span>No uso redes sociales</span>
                                </label>
                            </div>
                        </div>

                        <!-- P8 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                8. ¿Cuánto tiempo dedicas a la semana a redes sociales?
                            </label>
                            <select name="p8" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#9B8DC6] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="Menos de 1 hora">Menos de 1 hora</option>
                                <option value="1-3 horas">1-3 horas</option>
                                <option value="3-5 horas">3-5 horas</option>
                                <option value="Más de 5 horas">Más de 5 horas</option>
                                <option value="No uso RRSS">No uso RRSS</option>
                            </select>
                        </div>

                        <!-- P9 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                9. ¿Pagarías por contenido generado automáticamente con IA para tus redes?
                            </label>
                            <select name="p9" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#9B8DC6] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="Sí, definitivamente">Sí, definitivamente</option>
                                <option value="Depende del precio">Depende del precio</option>
                                <option value="Quizás">Quizás</option>
                                <option value="No">No</option>
                            </select>
                        </div>
                    </div>

                    <!-- Block 4: Datos de Contacto -->
                    <div class="question-block" data-block="4">
                        <h3 class="text-2xl font-bold text-gray-800 mb-6">📞 Bloque 4: Datos de Contacto</h3>
                        
                        <!-- P10 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                10. Tu nombre completo
                            </label>
                            <input type="text" name="p10" required 
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#9B8DC6] focus:outline-none"
                                   placeholder="Ej: María García López">
                        </div>

                        <!-- P11 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                11. Nombre de tu peluquería/salón
                            </label>
                            <input type="text" name="p11" required 
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#9B8DC6] focus:outline-none"
                                   placeholder="Ej: Salón María Estilo">
                        </div>

                        <!-- P12 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                12. WhatsApp (con prefijo +34)
                            </label>
                            <input type="tel" name="p12" required 
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#9B8DC6] focus:outline-none"
                                   placeholder="Ej: +34 600 123 456">
                        </div>

                        <!-- P13 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                13. Email
                            </label>
                            <input type="email" name="p13" required 
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#9B8DC6] focus:outline-none"
                                   placeholder="tu@email.com">
                        </div>

                        <!-- P14 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                14. Ciudad (importante para el sorteo 🎁)
                            </label>
                            <input type="text" name="p14" required 
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#9B8DC6] focus:outline-none"
                                   placeholder="Ej: A Coruña">
                            <p class="text-sm text-[#9B8DC6] mt-2">💡 Si eres de A Coruña, entras automáticamente en el sorteo</p>
                        </div>

                        <!-- P15 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                15. Dirección del salón (opcional)
                            </label>
                            <input type="text" name="p15" 
                                   class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#9B8DC6] focus:outline-none"
                                   placeholder="Calle, número, código postal">
                        </div>
                    </div>

                    <!-- Block 5: Intereses -->
                    <div class="question-block" data-block="5">
                        <h3 class="text-2xl font-bold text-gray-800 mb-6">💡 Bloque 5: Tus Intereses</h3>
                        
                        <!-- P16 -->
                        <div class="mb-6">
                            <label class="block text-gray-700 font-semibold mb-3">
                                16. ¿Cuándo prefieres que te contactemos?
                            </label>
                            <select name="p16" required class="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#9B8DC6] focus:outline-none">
                                <option value="">Selecciona una opción...</option>
                                <option value="Esta semana">Esta semana</option>
                                <option value="Próxima semana">Próxima semana</option>
                                <option value="Este mes">Este mes</option>
                                <option value="No tengo prisa">No tengo prisa</option>
                            </select>
                        </div>

                        <!-- Sorteo Opt-in -->
                        <div class="mb-6 bg-gradient-to-r from-[#E6F2F2] to-[#EBF5F5] border-2 border-[#B3D9D9] rounded-xl p-6">
                            <div class="flex items-start">
                                <input type="checkbox" id="wantRaffle" name="wantRaffle" value="si" class="mt-1 mr-3 w-5 h-5 text-[#9B8DC6]">
                                <label for="wantRaffle" class="cursor-pointer">
                                    <span class="font-bold text-gray-800">🎁 Quiero participar en el sorteo de A Coruña</span>
                                    <p class="text-sm text-gray-600 mt-1">Sorteo exclusivo: 1 año de Agenda Inteligente IA (Valor: 1.020€)</p>
                                    <p class="text-xs text-gray-500 mt-1">
                                        📅 Fecha: 24 noviembre 2025 • Solo peluquerías de A Coruña • 
                                        <a href="https://galiadigital.es/sorteo/" target="_blank" class="text-[#9B8DC6] underline hover:text-[#006666]">Ver bases legales</a>
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
                    </div>

                    <!-- Block 6: Confirmación Legal -->
                    <div class="question-block" data-block="6">
                        <h3 class="text-2xl font-bold text-gray-800 mb-6">✅ Confirmación Final</h3>
                        
                        <div class="bg-gray-50 border-2 border-gray-300 rounded-xl p-6 mb-6">
                            <div class="flex items-start">
                                <input type="checkbox" id="acceptGDPR" name="acceptGDPR" required class="mt-1 mr-3 w-5 h-5 text-[#9B8DC6]">
                                <label for="acceptGDPR" class="cursor-pointer text-sm">
                                    <span class="font-semibold text-gray-800">He leído y acepto la <a href="https://galiadigital.es/politica-de-privacidad/" target="_blank" class="text-[#9B8DC6] underline hover:text-[#006666]">Política de Protección de Datos</a></span>
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
                                class="ml-auto px-6 py-3 bg-[#9B8DC6] text-white rounded-lg font-bold hover:bg-[#006666] transition">
                            Siguiente →
                        </button>
                        <button type="submit" id="submitBtn" 
                                class="ml-auto px-8 py-3 bg-gradient-to-r from-[#9B8DC6] to-[#1b285e] text-white rounded-lg font-bold hover:shadow-xl transition transform hover:scale-105 hidden">
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
                        <p class="text-[#9B8DC6] font-bold text-3xl mb-2">Tu número: <span id="raffleNumberDisplay"></span></p>
                        <p class="text-gray-600">Sorteo: 24 noviembre 2025</p>
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
        const totalBlocks = 6
        const totalQuestions = 16
        
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
            
            // Count regular inputs
            form.querySelectorAll('input[type="text"]:not([name="p15"]), input[type="email"], input[type="tel"], select').forEach(input => {
                if (input.value.trim() !== '') count++
            })
            
            // Count checkboxes (p6 and p7)
            if (form.querySelectorAll('input[name="p6"]:checked').length > 0) count++
            if (form.querySelectorAll('input[name="p7"]:checked').length > 0) count++
            
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
                    // For optional multi-checkboxes (p6, p7)
                    const checkboxGroup = currentBlockElement.querySelectorAll(\`input[name="\${input.name}"]\`)
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
                if (key === 'p6' || key === 'p7') {
                    if (!data[key]) data[key] = []
                    data[key].push(value)
                } else {
                    data[key] = value
                }
            }
            
            // Convert arrays to strings
            if (data.p6) data.p6 = data.p6.join(', ')
            if (data.p7) data.p7 = data.p7.join(', ')
            
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
                
            } catch (error) {
                alert('Error al enviar la encuesta. Por favor, intenta de nuevo.')
                submitBtn.disabled = false
                submitBtn.innerHTML = '✅ Enviar Encuesta'
            }
        })

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
