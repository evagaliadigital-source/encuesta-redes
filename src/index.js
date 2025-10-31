import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync } from 'fs'

const app = new Hono()

// CORS para desarrollo
app.use('/api/*', cors())

// Servir archivos estáticos
app.use('/*', serveStatic({ root: './public' }))

// Contador global de sorteo (empezar desde 20)
let raffleCounter = 19

// Base de datos simulada (en producción usarías D1 o KV)
const responses = []

// Función para calcular prioridad
function calculatePriority(data) {
  const willingness = data.p3 || ''
  const trial = data.p5 || ''
  const contact = data.p16 || ''
  
  // 🔥 HOT: Alta disposición de pago + Trial inmediato + Contacto urgente
  if ((willingness.includes('40-60€') || willingness.includes('60-100€') || willingness.includes('Más de 100€')) 
      && trial === 'Sí, ahora mismo' 
      && contact === 'Esta semana') {
    return '🔥 HOT'
  }
  
  // 🟡 WARM: Trial en 1-2 meses o contacto próxima semana
  if (trial === 'Sí, pero en 1-2 meses' || contact === 'Próxima semana') {
    return '🟡 WARM'
  }
  
  // 🟢 COLD: Resto
  return '🟢 COLD'
}

// Función para generar recomendación personalizada
function generateRecommendation(data, priority) {
  const willingness = data.p3 || ''
  const blocker = data.p4 || ''
  const socialNeeds = data.p9 || ''
  const socialNetworks = data.p7 || ''
  
  let recommendations = []
  
  if (willingness.includes('40-60€') || willingness.includes('60-100€')) {
    recommendations.push('Tu peluquería tiene el perfil perfecto para la Agenda Inteligente IA. Con tu volumen de gestión, recuperarías la inversión en menos de 2 meses.')
  }
  
  if (blocker === 'No sé si realmente funciona') {
    recommendations.push('Entiendo tu duda. Por eso te ofrezco 15 días de prueba GRATIS sin compromiso. Verás resultados desde el primer día.')
  }
  
  if (blocker === 'El precio') {
    recommendations.push('La Agenda IA se autofinancia con las horas que te libera. Calcula: 8h/semana × 4 semanas = 32h/mes que recuperas para generar más ingresos.')
  }
  
  if (socialNeeds === 'Sí, es justo lo que necesito' && socialNetworks && socialNetworks !== 'Ninguna') {
    recommendations.push('Veo que necesitas ayuda con redes sociales también. Te prepararé una propuesta combinada Agenda + Contenido que te ahorrará aún más tiempo.')
  }
  
  if (priority === '🔥 HOT') {
    recommendations.push('⚡ PRIORIDAD ALTA: Contactaré contigo en las próximas 24h para mostrarte una demo personalizada.')
  }
  
  return recommendations.length > 0 ? recommendations.join('\n\n') : 'Revisaré tu caso personalmente y te contactaré pronto con una propuesta a medida.'
}

// Función para enviar email a Eva
async function sendEmailToEva(data, priority, raffleInfo) {
  const timestamp = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
  
  const emailBody = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 NUEVO LEAD - ENCUESTA MVP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 DATOS DE CONTACTO:
───────────────────────
Nombre: ${data.p10}
Peluquería: ${data.p11}
Ciudad: ${data.p14}
Dirección: ${data.p15 || 'No proporcionada'}
WhatsApp: ${data.p12}
Email: ${data.p13}
Contactar: ${data.p16}

🎯 SORTEO A CORUÑA:
───────────────────────
Participa: ${raffleInfo.participates ? 'SÍ' : 'NO'}
Número asignado: ${raffleInfo.number || 'N/A'}

🔥 CUALIFICACIÓN MVP:
───────────────────────
⏰ Tiempo en agenda/día: ${data.p1}
😤 Mayor problema: ${data.p2}
💰 Dispuesto a pagar: ${data.p3}
🚧 Principal freno: ${data.p4}
✅ Probaría gratis: ${data.p5}

PRIORIDAD: ${priority}

💡 INTERESES NIVEL 2/3:
───────────────────────
⏳ Le quita tiempo: ${data.p6}
📱 Redes que usa: ${data.p7}
🕐 Tiempo RRSS/semana: ${data.p8}
🤖 Pagaría contenido IA: ${data.p9}

📋 RECOMENDACIÓN:
───────────────────────
${generateRecommendation(data, priority)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Respuesta registrada: ${timestamp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim()
  
  console.log('📧 EMAIL A EVA:')
  console.log(emailBody)
  
  // En producción, aquí usarías SendGrid, Mailgun, etc.
  // Por ahora, solo lo registramos en consola
  return emailBody
}

// Función para generar email al participante
async function sendEmailToParticipant(data, raffleInfo) {
  const recommendation = generateRecommendation(data, calculatePriority(data))
  
  let emailBody = `
Hola ${data.p10},

¡Muchas gracias por ayudarme a mejorar la vida de las peluqueras! 🙌

📊 HE ANALIZADO TU SITUACIÓN:

Según tus respuestas:
→ Dedicas ${data.p1} a gestionar citas cada día
→ Tu mayor dolor es: ${data.p2}
→ Valorarías una solución en torno a: ${data.p3}

🎯 MI RECOMENDACIÓN PARA TI:

${recommendation}
`.trim()
  
  // Añadir info del sorteo si participa
  if (raffleInfo.participates) {
    emailBody += `

━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 ¡ENHORABUENA!
━━━━━━━━━━━━━━━━━━━━━━━━━

Has entrado en el sorteo de:
✨ 1 Agenda Inteligente IA 
✨ Valor total: 1.020€
✨ Setup + 12 meses GRATIS

🎫 TU NÚMERO DE SORTEO: #${raffleInfo.number}

📅 Fecha del sorteo: 24 de noviembre 2025
📢 Anunciaremos al ganador por email y en nuestras redes sociales

¡Mucha suerte! 🍀
━━━━━━━━━━━━━━━━━━━━━━━━━
`
  }
  
  emailBody += `

📅 PRÓXIMOS PASOS:

Te contactaré ${data.p16} para:
✅ Darte tu análisis completo (30 min)
✅ Mostrarte cómo funciona la Agenda IA
✅ Ofrecerte prueba gratis 15 días (sin compromiso)

¿Alguna duda antes? 
Responde a este email o escríbeme al WhatsApp.

Un abrazo,

Eva Rodríguez
Fundadora de Galia Digital
📱 +34 676 351 851
🌐 www.galiadigital.com
💜 Devolviendo libertad a las peluqueras

P.D: Si conoces otras peluqueras de A Coruña, pásales esta encuesta. 
Cuantas más seamos, mejor solución crearemos juntas 💪
`
  
  console.log('📧 EMAIL AL PARTICIPANTE:')
  console.log(emailBody)
  
  return emailBody
}

// API endpoint para enviar encuesta
app.post('/api/submit-survey', async (c) => {
  try {
    const data = await c.req.json()
    
    // Validar campos obligatorios
    const requiredFields = ['p1', 'p2', 'p3', 'p4', 'p5', 'p8', 'p9', 'p10', 'p11', 'p12', 'p13', 'p14', 'p16']
    for (const field of requiredFields) {
      if (!data[field]) {
        return c.json({ error: `Campo requerido faltante: ${field}` }, 400)
      }
    }
    
    // Timestamp
    data.timestamp = new Date().toISOString()
    
    // Verificar si participa en sorteo (A Coruña)
    const city = (data.p14 || '').toLowerCase()
    const participatesInRaffle = city.includes('coruña') || city.includes('corunha')
    
    let raffleNumber = null
    if (participatesInRaffle) {
      raffleCounter++
      raffleNumber = raffleCounter
    }
    
    const raffleInfo = {
      participates: participatesInRaffle,
      number: raffleNumber
    }
    
    // Calcular prioridad
    const priority = calculatePriority(data)
    
    // Guardar respuesta
    const response = {
      ...data,
      raffleNumber,
      participatesInRaffle,
      priority,
      timestamp: data.timestamp
    }
    responses.push(response)
    
    // Enviar emails (en producción)
    await sendEmailToEva(data, priority, raffleInfo)
    await sendEmailToParticipant(data, raffleInfo)
    
    // Responder al frontend
    return c.json({
      success: true,
      raffleNumber: raffleNumber,
      priority: priority,
      message: 'Encuesta recibida correctamente'
    })
    
  } catch (error) {
    console.error('Error procesando encuesta:', error)
    return c.json({ error: 'Error al procesar la encuesta' }, 500)
  }
})

// API para obtener todas las respuestas (dashboard Eva)
app.get('/api/responses', (c) => {
  const stats = {
    total: responses.length,
    hot: responses.filter(r => r.priority === '🔥 HOT').length,
    warm: responses.filter(r => r.priority === '🟡 WARM').length,
    cold: responses.filter(r => r.priority === '🟢 COLD').length,
    raffleParticipants: responses.filter(r => r.participatesInRaffle).length,
    responses: responses
  }
  
  return c.json(stats)
})

// API para sortear ganador
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

// Ruta principal - servir el HTML
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>¿Tu agenda te roba más de 2 horas al día? | Galia Digital</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        
        body {
            font-family: 'Inter', sans-serif;
        }
        
        .gradient-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        
        .form-section {
            animation: fadeIn 0.6s ease-in;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .radio-card {
            transition: all 0.3s ease;
        }
        
        .radio-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .radio-card input:checked + label {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-color: #667eea;
        }
        
        .checkbox-card input:checked + label {
            background: #f0f4ff;
            border-color: #667eea;
            color: #667eea;
        }
        
        .progress-bar {
            height: 4px;
            background: #e5e7eb;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 100;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transition: width 0.3s ease;
        }
    </style>
</head>
<body class="bg-gray-50">
    <!-- Barra de progreso -->
    <div class="progress-bar">
        <div class="progress-fill" id="progressBar" style="width: 0%"></div>
    </div>

    <!-- Header con logo -->
    <div class="gradient-bg text-white py-8">
        <div class="max-w-4xl mx-auto px-4 text-center">
            <img src="https://page.gensparksite.com/v1/base64_upload/a70b1fe40910547351447ef32a13f4afgaliadigital.es" 
                 alt="Galia Digital" 
                 class="h-24 mx-auto mb-6">
            <h1 class="text-4xl font-bold mb-3">¿Tu agenda te roba más de 2 horas al día?</h1>
            <p class="text-xl opacity-90">Ayúdanos a mejorar la vida de las peluqueras - Solo 3 minutos</p>
            <div class="mt-4 flex items-center justify-center gap-2 text-sm">
                <i class="fas fa-clock"></i>
                <span>⏱️ 3-4 minutos</span>
                <span class="mx-2">•</span>
                <i class="fas fa-lock"></i>
                <span>🔒 100% confidencial</span>
            </div>
        </div>
    </div>

    <!-- Banner Sorteo -->
    <div class="max-w-4xl mx-auto px-4 -mt-6">
        <div class="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl shadow-2xl p-6 border-4 border-white">
            <div class="text-center">
                <div class="text-3xl mb-2">🎁</div>
                <h2 class="text-2xl font-bold mb-3">SORTEO EXCLUSIVO A CORUÑA</h2>
                <p class="text-lg mb-4">Si tu peluquería está en A Coruña, entras automáticamente en el sorteo de:</p>
                <div class="grid md:grid-cols-3 gap-4 text-left">
                    <div class="bg-white/10 backdrop-blur rounded-lg p-4">
                        <div class="text-2xl mb-2">✨</div>
                        <div class="font-bold text-lg">1 Agenda Inteligente IA</div>
                        <div class="text-sm opacity-90">Valor 1.020€</div>
                    </div>
                    <div class="bg-white/10 backdrop-blur rounded-lg p-4">
                        <div class="text-2xl mb-2">✨</div>
                        <div class="font-bold text-lg">Setup profesional</div>
                        <div class="text-sm opacity-90">300€ gratis</div>
                    </div>
                    <div class="bg-white/10 backdrop-blur rounded-lg p-4">
                        <div class="text-2xl mb-2">✨</div>
                        <div class="font-bold text-lg">12 meses servicio</div>
                        <div class="text-sm opacity-90">720€ sin coste</div>
                    </div>
                </div>
                <p class="mt-4 text-sm opacity-90">📅 Sorteo: 24 de noviembre 2025</p>
            </div>
        </div>
    </div>

    <!-- Formulario -->
    <div class="max-w-4xl mx-auto px-4 py-12">
        <form id="surveyForm" class="space-y-8">
            
            <!-- BLOQUE 1: CUALIFICACIÓN -->
            <div class="form-section bg-white rounded-xl shadow-lg p-8">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xl">1</div>
                    <h2 class="text-2xl font-bold text-gray-800">Tu situación actual</h2>
                </div>

                <!-- P1 -->
                <div class="mb-8">
                    <label class="block text-lg font-semibold text-gray-800 mb-4">
                        ¿Cuánto tiempo dedicas DIARIAMENTE a gestionar citas? *
                    </label>
                    <div class="space-y-3">
                        <div class="radio-card">
                            <input type="radio" id="p1_1" name="p1" value="Menos de 30 minutos" class="hidden" required>
                            <label for="p1_1" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ⏱️ Menos de 30 minutos
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p1_2" name="p1" value="30 minutos - 1 hora" class="hidden">
                            <label for="p1_2" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ⏱️ 30 minutos - 1 hora
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p1_3" name="p1" value="1-2 horas" class="hidden">
                            <label for="p1_3" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ⏱️ 1-2 horas
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p1_4" name="p1" value="Más de 2 horas" class="hidden">
                            <label for="p1_4" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ⏱️ Más de 2 horas
                            </label>
                        </div>
                    </div>
                </div>

                <!-- P2 -->
                <div class="mb-8">
                    <label class="block text-lg font-semibold text-gray-800 mb-4">
                        ¿Cuál es tu MAYOR problema con las citas? *
                    </label>
                    <div class="space-y-3">
                        <div class="radio-card">
                            <input type="radio" id="p2_1" name="p2" value="No-shows (gente que no viene)" class="hidden" required>
                            <label for="p2_1" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                😤 No-shows (gente que no viene)
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p2_2" name="p2" value="WhatsApps fuera de horario" class="hidden">
                            <label for="p2_2" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                📱 WhatsApps fuera de horario
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p2_3" name="p2" value="Horas muertas sin llenar" class="hidden">
                            <label for="p2_3" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ⏰ Horas muertas sin llenar
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p2_4" name="p2" value="Listas de espera desorganizadas" class="hidden">
                            <label for="p2_4" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                📋 Listas de espera desorganizadas
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p2_5" name="p2" value="Todo lo anterior" class="hidden">
                            <label for="p2_5" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                🔥 Todo lo anterior
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <!-- BLOQUE 2: VALIDACIÓN MVP -->
            <div class="form-section bg-white rounded-xl shadow-lg p-8">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xl">2</div>
                    <h2 class="text-2xl font-bold text-gray-800">Validación de solución</h2>
                </div>

                <!-- Pitch Box -->
                <div class="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 mb-8">
                    <div class="text-center mb-4">
                        <div class="text-3xl mb-2">💡</div>
                        <h3 class="text-xl font-bold text-gray-800 mb-3">IMAGINA ESTO:</h3>
                        <p class="text-lg text-gray-700 mb-4">Un asistente IA que gestiona tu agenda 24/7 por WhatsApp:</p>
                    </div>
                    <div class="grid md:grid-cols-2 gap-4">
                        <div class="flex items-start gap-3">
                            <div class="text-green-600 text-xl">✅</div>
                            <div>
                                <div class="font-semibold">Reduce no-shows en un 80%</div>
                            </div>
                        </div>
                        <div class="flex items-start gap-3">
                            <div class="text-green-600 text-xl">✅</div>
                            <div>
                                <div class="font-semibold">Llena tus horas muertas automáticamente</div>
                            </div>
                        </div>
                        <div class="flex items-start gap-3">
                            <div class="text-green-600 text-xl">✅</div>
                            <div>
                                <div class="font-semibold">Gestiona listas de espera inteligentes</div>
                            </div>
                        </div>
                        <div class="flex items-start gap-3">
                            <div class="text-green-600 text-xl">✅</div>
                            <div>
                                <div class="font-semibold">Te devuelve 8 horas a la semana</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- P3 -->
                <div class="mb-8">
                    <label class="block text-lg font-semibold text-gray-800 mb-4">
                        💰 ¿Cuánto vale para ti recuperar 8 horas/semana? *
                    </label>
                    <div class="space-y-3">
                        <div class="radio-card">
                            <input type="radio" id="p3_1" name="p3" value="20-40€/mes (café diario menos)" class="hidden" required>
                            <label for="p3_1" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                20-40€/mes <span class="text-gray-500 text-sm">(café diario menos)</span>
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p3_2" name="p3" value="40-60€/mes (precio real)" class="hidden">
                            <label for="p3_2" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                40-60€/mes <span class="text-gray-500 text-sm">(precio real)</span>
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p3_3" name="p3" value="60-100€/mes (lo pagaría ahora)" class="hidden">
                            <label for="p3_3" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                60-100€/mes <span class="text-gray-500 text-sm">(lo pagaría ahora)</span>
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p3_4" name="p3" value="Más de 100€/mes (urgente para mí)" class="hidden">
                            <label for="p3_4" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                Más de 100€/mes <span class="text-gray-500 text-sm">(urgente para mí)</span>
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p3_5" name="p3" value="Necesito más info para decidir" class="hidden">
                            <label for="p3_5" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                Necesito más info para decidir
                            </label>
                        </div>
                    </div>
                </div>

                <!-- P4 -->
                <div class="mb-8">
                    <label class="block text-lg font-semibold text-gray-800 mb-4">
                        ¿Qué te frena para automatizar tu agenda HOY? *
                    </label>
                    <div class="space-y-3">
                        <div class="radio-card">
                            <input type="radio" id="p4_1" name="p4" value="El precio" class="hidden" required>
                            <label for="p4_1" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                💸 El precio
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p4_2" name="p4" value="No sé si realmente funciona" class="hidden">
                            <label for="p4_2" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                🤔 No sé si realmente funciona
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p4_3" name="p4" value="Miedo a perder control" class="hidden">
                            <label for="p4_3" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                😰 Miedo a perder control
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p4_4" name="p4" value="No tengo tiempo de implementarlo" class="hidden">
                            <label for="p4_4" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ⏰ No tengo tiempo de implementarlo
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p4_5" name="p4" value="Desconfianza en la tecnología" class="hidden">
                            <label for="p4_5" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                🚫 Desconfianza en la tecnología
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p4_6" name="p4" value="Nada, lo haría ahora mismo" class="hidden">
                            <label for="p4_6" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                🔥 Nada, lo haría ahora mismo
                            </label>
                        </div>
                    </div>
                </div>

                <!-- P5 -->
                <div class="mb-8">
                    <label class="block text-lg font-semibold text-gray-800 mb-4">
                        Si pudieras probarlo GRATIS durante 15 días, ¿lo harías? *
                    </label>
                    <div class="space-y-3">
                        <div class="radio-card">
                            <input type="radio" id="p5_1" name="p5" value="Sí, ahora mismo" class="hidden" required>
                            <label for="p5_1" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                🚀 Sí, ahora mismo
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p5_2" name="p5" value="Sí, pero en 1-2 meses" class="hidden">
                            <label for="p5_2" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                📅 Sí, pero en 1-2 meses
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p5_3" name="p5" value="Quizás, necesito más información" class="hidden">
                            <label for="p5_3" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                🤔 Quizás, necesito más información
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p5_4" name="p5" value="No me interesa" class="hidden">
                            <label for="p5_4" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ❌ No me interesa
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <!-- BLOQUE 3: EXPLORACIÓN NIVEL 2/3 -->
            <div class="form-section bg-white rounded-xl shadow-lg p-8">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xl">3</div>
                    <h2 class="text-2xl font-bold text-gray-800">Otras necesidades</h2>
                </div>

                <!-- P6 -->
                <div class="mb-8">
                    <label class="block text-lg font-semibold text-gray-800 mb-4">
                        Además de la agenda, ¿qué más te QUITA TIEMPO? *
                        <span class="text-sm font-normal text-gray-500">(Puedes marcar varias opciones)</span>
                    </label>
                    <div class="space-y-3">
                        <div class="checkbox-card">
                            <input type="checkbox" id="p6_1" name="p6" value="Publicar en redes sociales" class="hidden">
                            <label for="p6_1" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                📱 Publicar en redes sociales
                            </label>
                        </div>
                        <div class="checkbox-card">
                            <input type="checkbox" id="p6_2" name="p6" value="Responder mensajes repetitivos de clientes" class="hidden">
                            <label for="p6_2" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                💬 Responder mensajes repetitivos de clientes
                            </label>
                        </div>
                        <div class="checkbox-card">
                            <input type="checkbox" id="p6_3" name="p6" value="Hacer presupuestos" class="hidden">
                            <label for="p6_3" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                💰 Hacer presupuestos
                            </label>
                        </div>
                        <div class="checkbox-card">
                            <input type="checkbox" id="p6_4" name="p6" value="Enviar recordatorios a clientas" class="hidden">
                            <label for="p6_4" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ⏰ Enviar recordatorios a clientas
                            </label>
                        </div>
                        <div class="checkbox-card">
                            <input type="checkbox" id="p6_5" name="p6" value="Gestión de productos/stock" class="hidden">
                            <label for="p6_5" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                📦 Gestión de productos/stock
                            </label>
                        </div>
                        <div class="checkbox-card">
                            <input type="checkbox" id="p6_6" name="p6" value="Contabilidad y facturas" class="hidden">
                            <label for="p6_6" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                📊 Contabilidad y facturas
                            </label>
                        </div>
                    </div>
                </div>

                <!-- P7 -->
                <div class="mb-8">
                    <label class="block text-lg font-semibold text-gray-800 mb-4">
                        ¿Qué redes sociales usas para tu negocio? *
                        <span class="text-sm font-normal text-gray-500">(Puedes marcar varias)</span>
                    </label>
                    <div class="space-y-3">
                        <div class="checkbox-card">
                            <input type="checkbox" id="p7_1" name="p7" value="Instagram" class="hidden">
                            <label for="p7_1" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                📸 Instagram
                            </label>
                        </div>
                        <div class="checkbox-card">
                            <input type="checkbox" id="p7_2" name="p7" value="Facebook" class="hidden">
                            <label for="p7_2" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                👥 Facebook
                            </label>
                        </div>
                        <div class="checkbox-card">
                            <input type="checkbox" id="p7_3" name="p7" value="TikTok" class="hidden">
                            <label for="p7_3" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                🎵 TikTok
                            </label>
                        </div>
                        <div class="checkbox-card">
                            <input type="checkbox" id="p7_4" name="p7" value="LinkedIn" class="hidden">
                            <label for="p7_4" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                💼 LinkedIn
                            </label>
                        </div>
                        <div class="checkbox-card">
                            <input type="checkbox" id="p7_5" name="p7" value="Ninguna" class="hidden">
                            <label for="p7_5" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ❌ Ninguna
                            </label>
                        </div>
                        <div class="checkbox-card">
                            <input type="checkbox" id="p7_6" name="p7" value="Todas, pero no tengo tiempo de gestionarlas" class="hidden">
                            <label for="p7_6" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                😓 Todas, pero no tengo tiempo de gestionarlas
                            </label>
                        </div>
                    </div>
                </div>

                <!-- P8 -->
                <div class="mb-8">
                    <label class="block text-lg font-semibold text-gray-800 mb-4">
                        ¿Cuánto tiempo dedicas a redes sociales A LA SEMANA? *
                    </label>
                    <div class="space-y-3">
                        <div class="radio-card">
                            <input type="radio" id="p8_1" name="p8" value="Nada" class="hidden" required>
                            <label for="p8_1" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ⭕ Nada
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p8_2" name="p8" value="Menos de 1 hora" class="hidden">
                            <label for="p8_2" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ⏱️ Menos de 1 hora
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p8_3" name="p8" value="1-3 horas" class="hidden">
                            <label for="p8_3" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ⏱️ 1-3 horas
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p8_4" name="p8" value="3-5 horas" class="hidden">
                            <label for="p8_4" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ⏱️ 3-5 horas
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p8_5" name="p8" value="Más de 5 horas" class="hidden">
                            <label for="p8_5" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ⏱️ Más de 5 horas
                            </label>
                        </div>
                    </div>
                </div>

                <!-- P9 -->
                <div class="mb-8">
                    <label class="block text-lg font-semibold text-gray-800 mb-4">
                        Si una IA creara tu contenido y lo publicara automáticamente, ¿pagarías por eso? *
                    </label>
                    <div class="space-y-3">
                        <div class="radio-card">
                            <input type="radio" id="p9_1" name="p9" value="Sí, es justo lo que necesito" class="hidden" required>
                            <label for="p9_1" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ✅ Sí, es justo lo que necesito
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p9_2" name="p9" value="Depende del precio" class="hidden">
                            <label for="p9_2" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                💰 Depende del precio
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p9_3" name="p9" value="No, prefiero hacerlo yo" class="hidden">
                            <label for="p9_3" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ❌ No, prefiero hacerlo yo
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p9_4" name="p9" value="No uso redes sociales" class="hidden">
                            <label for="p9_4" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                ⭕ No uso redes sociales
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <!-- BLOQUE 4: CAPTURA DE DATOS -->
            <div class="form-section bg-white rounded-xl shadow-lg p-8">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xl">4</div>
                    <h2 class="text-2xl font-bold text-gray-800">Tus datos</h2>
                </div>

                <!-- Regalo Box -->
                <div class="bg-gradient-to-r from-green-50 to-teal-50 border-2 border-green-200 rounded-xl p-6 mb-8">
                    <div class="text-center">
                        <div class="text-3xl mb-2">🎁</div>
                        <h3 class="text-xl font-bold text-gray-800 mb-3">TU REGALO INMEDIATO</h3>
                        <p class="text-gray-700 mb-4">Al finalizar recibirás:</p>
                        <div class="space-y-2 text-left max-w-md mx-auto">
                            <div class="flex items-center gap-3">
                                <div class="text-green-600">✅</div>
                                <div>Análisis personalizado de tu situación</div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="text-green-600">✅</div>
                                <div>Plan de automatización a tu medida</div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="text-green-600">✅</div>
                                <div>Consultoría gratuita de 30 minutos</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- P10 -->
                <div class="mb-6">
                    <label class="block text-lg font-semibold text-gray-800 mb-3" for="p10">
                        Tu nombre *
                    </label>
                    <input type="text" id="p10" name="p10" required
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none text-lg">
                </div>

                <!-- P11 -->
                <div class="mb-6">
                    <label class="block text-lg font-semibold text-gray-800 mb-3" for="p11">
                        Nombre de tu peluquería/salón *
                    </label>
                    <input type="text" id="p11" name="p11" required
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none text-lg">
                </div>

                <!-- P12 -->
                <div class="mb-6">
                    <label class="block text-lg font-semibold text-gray-800 mb-3" for="p12">
                        WhatsApp (incluye prefijo +34) *
                    </label>
                    <input type="tel" id="p12" name="p12" required placeholder="+34 600 123 456"
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none text-lg">
                </div>

                <!-- P13 -->
                <div class="mb-6">
                    <label class="block text-lg font-semibold text-gray-800 mb-3" for="p13">
                        Email *
                    </label>
                    <input type="email" id="p13" name="p13" required
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none text-lg">
                </div>

                <!-- P14 -->
                <div class="mb-6">
                    <label class="block text-lg font-semibold text-gray-800 mb-3" for="p14">
                        Ciudad donde está tu salón *
                    </label>
                    <input type="text" id="p14" name="p14" required
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none text-lg"
                           placeholder="Ejemplo: A Coruña">
                </div>

                <!-- P15 -->
                <div class="mb-6">
                    <label class="block text-lg font-semibold text-gray-800 mb-3" for="p15">
                        Dirección completa de tu salón
                        <span class="text-sm font-normal text-gray-500">(Calle + número - opcional para sorteo)</span>
                    </label>
                    <input type="text" id="p15" name="p15"
                           class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none text-lg"
                           placeholder="Calle Ejemplo, 123">
                </div>

                <!-- P16 -->
                <div class="mb-8">
                    <label class="block text-lg font-semibold text-gray-800 mb-4">
                        ¿Cuándo te vendría bien que te contactemos? *
                    </label>
                    <div class="space-y-3">
                        <div class="radio-card">
                            <input type="radio" id="p16_1" name="p16" value="Esta semana" class="hidden" required>
                            <label for="p16_1" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                🔥 Esta semana
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p16_2" name="p16" value="Próxima semana" class="hidden">
                            <label for="p16_2" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                📅 Próxima semana
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p16_3" name="p16" value="Dentro de 2-3 semanas" class="hidden">
                            <label for="p16_3" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                📆 Dentro de 2-3 semanas
                            </label>
                        </div>
                        <div class="radio-card">
                            <input type="radio" id="p16_4" name="p16" value="Solo email, no llamar" class="hidden">
                            <label for="p16_4" class="block p-4 border-2 border-gray-200 rounded-lg cursor-pointer">
                                📧 Solo email, no llamar
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Submit Button -->
                <button type="submit" 
                        class="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xl py-4 rounded-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                    ✅ ENVIAR ENCUESTA Y RECIBIR MI ANÁLISIS
                </button>
            </div>
        </form>

        <!-- Loading State -->
        <div id="loadingState" class="hidden">
            <div class="bg-white rounded-xl shadow-lg p-12 text-center">
                <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
                <p class="text-xl text-gray-700">Procesando tu respuesta...</p>
            </div>
        </div>

        <!-- Thank You Page -->
        <div id="thankYouPage" class="hidden">
            <div class="bg-white rounded-xl shadow-lg p-12 text-center">
                <div class="text-6xl mb-6">✅</div>
                <h2 class="text-3xl font-bold text-gray-800 mb-4">¡GRACIAS POR TU TIEMPO!</h2>
                
                <div class="bg-gradient-to-r from-green-50 to-teal-50 border-2 border-green-200 rounded-xl p-6 mb-8">
                    <p class="text-lg text-gray-700 mb-4">Recibirás en tu email:</p>
                    <div class="space-y-2">
                        <div class="flex items-center justify-center gap-3">
                            <div class="text-green-600">📊</div>
                            <div>Tu análisis personalizado</div>
                        </div>
                        <div class="flex items-center justify-center gap-3">
                            <div class="text-green-600">📅</div>
                            <div>Propuesta de mejora para tu salón</div>
                        </div>
                    </div>
                </div>

                <div id="raffleMessage" class="hidden bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 mb-8">
                    <div class="text-4xl mb-3">🎉</div>
                    <h3 class="text-2xl font-bold text-gray-800 mb-3">¡ENHORABUENA!</h3>
                    <p class="text-lg mb-2">Has entrado en el sorteo con el número:</p>
                    <div class="text-5xl font-bold text-purple-600 mb-3" id="raffleNumber">#XX</div>
                    <p class="text-gray-700">Anunciaremos al ganador el <strong>24 de noviembre 2025</strong></p>
                </div>

                <p class="text-lg text-gray-700 mb-6">Te contactaremos pronto.</p>
                
                <div class="text-gray-600">
                    <p class="font-semibold">Eva Rodríguez - Galia Digital</p>
                    <p class="text-sm mt-2">💜 Devolviendo libertad a las peluqueras</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <div class="bg-gray-800 text-white py-8 mt-12">
        <div class="max-w-4xl mx-auto px-4 text-center">
            <p class="mb-2">🔒 Tus datos están protegidos y no serán compartidos con terceros</p>
            <p class="text-sm text-gray-400">© 2025 Galia Digital - Agenda Inteligente IA para peluquerías</p>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script>
        // Progress bar
        window.addEventListener('scroll', () => {
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (winScroll / height) * 100;
            document.getElementById('progressBar').style.width = scrolled + '%';
        });

        // Form submission
        document.getElementById('surveyForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Collect form data
            const formData = new FormData(e.target);
            const data = {};
            
            // Text and radio inputs
            for (let [key, value] of formData.entries()) {
                if (!data[key]) {
                    data[key] = value;
                }
            }
            
            // Checkboxes (multiple values)
            data.p6 = Array.from(document.querySelectorAll('input[name="p6"]:checked')).map(cb => cb.value).join(', ');
            data.p7 = Array.from(document.querySelectorAll('input[name="p7"]:checked')).map(cb => cb.value).join(', ');
            
            // Timestamp
            data.timestamp = new Date().toISOString();
            
            // Check if A Coruña
            const isCoruna = data.p14.toLowerCase().includes('coruña') || data.p14.toLowerCase().includes('corunha');
            
            // Show loading
            document.getElementById('surveyForm').classList.add('hidden');
            document.getElementById('loadingState').classList.remove('hidden');
            
            try {
                // Send to backend
                const response = await axios.post('/api/submit-survey', data);
                
                // Hide loading
                document.getElementById('loadingState').classList.add('hidden');
                
                // Show thank you page
                document.getElementById('thankYouPage').classList.remove('hidden');
                
                // Show raffle message if Coruña
                if (response.data.raffleNumber) {
                    document.getElementById('raffleMessage').classList.remove('hidden');
                    document.getElementById('raffleNumber').textContent = '#' + response.data.raffleNumber;
                }
                
                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
                
            } catch (error) {
                console.error('Error:', error);
                alert('Hubo un error al enviar la encuesta. Por favor, intenta de nuevo o contacta a eva@galiadigital.com');
                document.getElementById('loadingState').classList.add('hidden');
                document.getElementById('surveyForm').classList.remove('hidden');
            }
        });
    </script>
</body>
</html>`)
})

// Dashboard para Eva
app.get('/dashboard', (c) => {
  // En producción, aquí pondrías autenticación
  return c.html(readFileSync('./dashboard.html', 'utf-8'))
})

export default app
