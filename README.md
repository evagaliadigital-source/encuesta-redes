# 🎯 Encuesta MVP - Agenda Inteligente IA

## 📊 Proyecto Overview

Sistema completo de encuesta para validación MVP de **Galia Digital** - Agenda Inteligente IA para peluquerías.

### 🎯 Objetivos
1. **Validación MVP**: Medir willingness to pay real
2. **Captura de leads**: Base de datos cualificada con priorización automática
3. **Exploración Nivel 2/3**: Identificar necesidades de RRSS y automatización
4. **Marketing local**: Sorteo exclusivo A Coruña (1.020€ de valor)

---

## 🚀 URLs Activas

### Encuesta Pública
```
https://3000-ij818hriex2ipsllstcap-8f57ffe2.sandbox.novita.ai
```

### Dashboard Eva (Privado)
```
https://3000-ij818hriex2ipsllstcap-8f57ffe2.sandbox.novita.ai/dashboard
```

---

## ✨ Características Implementadas

### 🎨 Frontend (Encuesta)
- ✅ Diseño profesional con Tailwind CSS
- ✅ Logo Galia Digital (GAL IA)
- ✅ Barra de progreso visual
- ✅ 16 preguntas organizadas en 4 bloques
- ✅ Validación de formulario
- ✅ Animaciones y UX fluida
- ✅ Responsive (móvil/tablet/desktop)
- ✅ Página de agradecimiento con número sorteo

### ⚙️ Backend (API Hono)
- ✅ Procesamiento de respuestas
- ✅ Cálculo automático de prioridad (🔥 HOT / 🟡 WARM / 🟢 COLD)
- ✅ Numeración automática sorteo (desde #20)
- ✅ Detección geográfica A Coruña
- ✅ Generación de recomendaciones personalizadas
- ✅ Emails automáticos (estructura preparada)
- ✅ API REST para dashboard

### 📊 Dashboard (Control Panel)
- ✅ Estadísticas en tiempo real
- ✅ Gráficos interactivos (Chart.js)
- ✅ Tabla de respuestas completa
- ✅ Exportación CSV
- ✅ Sistema de sorteo aleatorio
- ✅ Actualización en vivo

---

## 📋 Estructura de Preguntas

### Bloque 1: Cualificación (30s)
- P1: Tiempo diario en gestión de citas
- P2: Mayor problema con citas

### Bloque 2: Validación MVP (60s)
- P3: Willingness to pay (20-100€+/mes)
- P4: Principal freno para automatizar
- P5: Probaría gratis 15 días

### Bloque 3: Exploración Nivel 2/3 (90s)
- P6: Qué más les quita tiempo (multi-select)
- P7: Redes sociales que usan (multi-select)
- P8: Tiempo semanal en RRSS
- P9: Pagarían por contenido IA

### Bloque 4: Captura de Datos (30s)
- P10: Nombre
- P11: Nombre peluquería
- P12: WhatsApp
- P13: Email
- P14: Ciudad (para sorteo)
- P15: Dirección (opcional)
- P16: Cuándo contactar

---

## 🔥 Sistema de Priorización

### 🔥 HOT (Acción inmediata - 24h)
```javascript
WTP: 40-60€ o más
Trial: "Sí, ahora mismo"
Contacto: "Esta semana"
```

### 🟡 WARM (Seguimiento 3-5 días)
```javascript
Trial: "Sí, en 1-2 meses"
O
Contacto: "Próxima semana"
```

### 🟢 COLD (Follow-up largo plazo)
```javascript
Resto de combinaciones
```

---

## 🎁 Sistema de Sorteo

### Mecánica
- **Participantes**: Solo peluquerías de A Coruña
- **Detección**: Automática por ciudad (case-insensitive)
- **Numeración**: Secuencial desde #20 (efecto momentum)
- **Fecha**: 24 noviembre 2025
- **Premio**: Agenda IA (300€ setup + 720€ año servicio)

### Realizar Sorteo
```
Dashboard → Botón "🎲 SORTEAR GANADOR"
→ Sistema elige aleatoriamente
→ Muestra datos completos del ganador
```

---

## 🛠️ Stack Técnico

### Frontend
- HTML5 + Tailwind CSS
- JavaScript Vanilla
- Axios (HTTP client)
- Font Awesome (iconos)
- Chart.js (gráficos dashboard)

### Backend
- Hono (web framework)
- Node.js v20+
- PM2 (process manager)
- ES Modules

### Hosting
- Sandbox Novita.ai
- Puerto 3000
- PM2 daemon

---

## 📂 Estructura del Proyecto

```
webapp/
├── src/
│   └── index.js          # Backend Hono (API + HTML)
├── server.js             # Entry point servidor
├── dashboard.html        # Dashboard Eva (privado)
├── ecosystem.config.cjs  # PM2 config
├── package.json          # Dependencies
├── .gitignore            # Git exclusions
├── README.md             # Este archivo
└── INSTRUCCIONES.md      # Manual de uso para Eva
```

---

## 🚀 Comandos de Gestión

### Desarrollo Local
```bash
# Instalar dependencias
npm install

# Iniciar servidor (desarrollo)
npm run dev

# Iniciar con PM2 (producción)
pm2 start ecosystem.config.cjs

# Ver logs
pm2 logs encuesta-mvp --nostream

# Reiniciar
pm2 restart encuesta-mvp

# Parar
pm2 stop encuesta-mvp
```

### Testing
```bash
# Test endpoint principal
curl http://localhost:3000

# Test API responses
curl http://localhost:3000/api/responses

# Test submit (POST)
curl -X POST http://localhost:3000/api/submit-survey \
  -H "Content-Type: application/json" \
  -d '{"p1":"1-2 horas","p2":"Todo lo anterior",...}'
```

---

## 📊 API Endpoints

### `GET /`
Encuesta pública HTML

### `POST /api/submit-survey`
**Body:** Objeto con p1-p16 + timestamp
**Response:**
```json
{
  "success": true,
  "raffleNumber": 20,
  "priority": "🔥 HOT",
  "message": "Encuesta recibida correctamente"
}
```

### `GET /api/responses`
**Response:**
```json
{
  "total": 10,
  "hot": 2,
  "warm": 5,
  "cold": 3,
  "raffleParticipants": 4,
  "responses": [...]
}
```

### `POST /api/draw-winner`
**Response:**
```json
{
  "winner": {
    "name": "María López",
    "business": "Salón María",
    "raffleNumber": 23,
    "email": "maria@salon.com",
    "whatsapp": "+34 600 123 456"
  },
  "totalParticipants": 8
}
```

### `GET /dashboard`
Dashboard HTML con estadísticas y gráficos

---

## 📈 Métricas Tracked

### Cualificación MVP
- Tiempo en gestión de citas
- Mayor problema con citas
- Willingness to pay (clave)
- Principal freno
- Disposición a probar gratis

### Nivel 2/3 Exploration
- Tareas que quitan tiempo
- Redes sociales usadas
- Tiempo en RRSS
- Interés en contenido IA

### Contacto
- Nombre, peluquería, ciudad
- WhatsApp, email
- Preferencia timing contacto

---

## 🔐 Seguridad y Privacidad

### Datos
- Almacenados en memoria (temporal)
- No se comparten con terceros
- Solo Eva tiene acceso al dashboard

### Producción (Recomendaciones)
- [ ] Añadir autenticación al dashboard
- [ ] Migrar datos a Cloudflare D1/KV
- [ ] Configurar HTTPS forzado
- [ ] Rate limiting en API
- [ ] GDPR compliance (política privacidad)

---

## 🎯 Próximos Pasos

### Técnico
- [ ] Configurar servicio email (SendGrid/Mailgun)
- [ ] Migrar a Cloudflare D1 para persistencia
- [ ] Añadir autenticación dashboard
- [ ] Webhook para integración Taskade

### Marketing
- [ ] Preparar posts RRSS
- [ ] Mensajes WhatsApp templates
- [ ] Email campaigns
- [ ] Landing page de sorteo

### Operaciones
- [ ] Proceso de contacto HOT leads
- [ ] Scripts de seguimiento WARM/COLD
- [ ] Plantillas email personalizado
- [ ] Calendario 24 nov sorteo

---

## 📞 Contacto

**Proyecto:** Encuesta MVP Galia Digital  
**Cliente:** Eva Rodríguez  
**WhatsApp:** +34 676 351 851  
**Email:** eva@galiadigital.com  
**Website:** www.galiadigital.com

---

## 📝 Changelog

### v1.0 (31 Oct 2025)
- ✅ Encuesta completa 16 preguntas
- ✅ Sistema priorización automática
- ✅ Sorteo A Coruña funcional
- ✅ Dashboard con gráficos
- ✅ API REST completa
- ✅ Exportación CSV
- ✅ Documentación completa

---

## 📄 Licencia

Proyecto privado - Galia Digital © 2025

---

**Hecho con 💜 para revolucionar la vida de las peluqueras**
