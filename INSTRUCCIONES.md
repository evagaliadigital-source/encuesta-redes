# 📋 INSTRUCCIONES - Sistema Encuesta MVP Galia Digital

## 🎯 URLs DEL SISTEMA

### ✅ ENCUESTA PÚBLICA (Para compartir con peluquerías)
```
https://3000-ij818hriex2ipsllstcap-8f57ffe2.sandbox.novita.ai
```
**Comparte esta URL** por WhatsApp, redes sociales, email, etc.

### 📊 DASHBOARD PRIVADO (Solo para ti, Eva)
```
https://3000-ij818hriex2ipsllstcap-8f57ffe2.sandbox.novita.ai/dashboard
```
**Guarda esta URL** en favoritos. Aquí ves todas las respuestas en tiempo real.

---

## 🚀 CÓMO FUNCIONA EL SISTEMA

### 1️⃣ CAPTURA AUTOMÁTICA
Cuando alguien completa la encuesta:
- ✅ Se guarda automáticamente en el sistema
- ✅ Se calcula prioridad (🔥 HOT / 🟡 WARM / 🟢 COLD)
- ✅ Si es de A Coruña, recibe número de sorteo (empezando desde #20)
- ✅ Aparece instantáneamente en tu dashboard

### 2️⃣ EMAILS AUTOMÁTICOS (Preparados para cuando configures SMTP)

**Email a ti (eva@galiadigital.com):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 NUEVO LEAD - ENCUESTA MVP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 DATOS DE CONTACTO:
Nombre: [Nombre]
Peluquería: [Salón]
WhatsApp: [Teléfono]
...

🔥 CUALIFICACIÓN MVP:
PRIORIDAD: 🔥 HOT / 🟡 WARM / 🟢 COLD
...
```

**Email al participante:**
```
Hola [Nombre],

¡Muchas gracias por ayudarme a mejorar la vida de las peluqueras! 🙌

📊 HE ANALIZADO TU SITUACIÓN:
→ Dedicas [X] tiempo a gestionar citas
→ Tu mayor dolor es: [Y]

🎯 MI RECOMENDACIÓN PARA TI:
[Recomendación personalizada según sus respuestas]

[SI ES DE A CORUÑA]
🎉 ¡ENHORABUENA!
🎫 TU NÚMERO DE SORTEO: #XX
📅 Fecha del sorteo: 24 de noviembre 2025

Eva Rodríguez
+34 676 351 851
```

### 3️⃣ PRIORIZACIÓN AUTOMÁTICA

**🔥 HOT (Llamar HOY):**
- Dispuesto a pagar 40-60€ o más
- Quiere probarlo "ahora mismo"
- Contactar "esta semana"

**🟡 WARM (Llamar esta semana):**
- Probaría en 1-2 meses
- Contactar "próxima semana"

**🟢 COLD (Follow-up largo plazo):**
- Resto de combinaciones

---

## 📊 USANDO TU DASHBOARD

### Ver Estadísticas
1. Abre: `https://3000-ij818hriex2ipsllstcap-8f57ffe2.sandbox.novita.ai/dashboard`
2. Verás:
   - 📋 Total respuestas
   - 🔥 Leads HOT
   - 🟡 Leads WARM
   - 🎁 Participantes sorteo A Coruña

### Ver Gráficos
- 💰 **Disposición de pago**: Cuánto están dispuestos a pagar
- 🚧 **Frenos principales**: Qué les detiene (precio, dudas, etc.)
- ⏰ **Tiempo RRSS**: Cuánto dedican a redes sociales
- 📱 **Redes usadas**: Instagram, Facebook, TikTok, etc.

### Ver Tabla Completa
- Lista de todas las respuestas
- Click en **"🔄 Actualizar Datos"** para refrescar
- Click en **"📥 Exportar CSV"** para descargar Excel

### Exportar Datos
1. Click en **"📥 Exportar CSV"**
2. Se descarga archivo con:
   - Todas las respuestas
   - Campos completos
   - Listo para importar a Taskade o Excel

---

## 🎁 REALIZAR EL SORTEO

### Cuando llegue el 24 de noviembre:

1. Abre el dashboard
2. Click en **"🎲 SORTEAR GANADOR"**
3. El sistema elige aleatoriamente entre todos los participantes de A Coruña
4. Te muestra:
   - 👤 Nombre del ganador
   - 🏢 Nombre de la peluquería
   - 🎫 Número de sorteo ganador
   - 📧 Email para contactar
   - 📱 WhatsApp

5. **COPIA ESOS DATOS** y:
   - Llama por WhatsApp para dar la noticia
   - Envía email de confirmación
   - Publica en RRSS anunciando al ganador (con permiso)

---

## 🔧 GESTIÓN TÉCNICA DEL SISTEMA

### Servidor Activo
El servidor está corriendo con PM2 (proceso en background).

**Comandos útiles:**
```bash
# Ver estado del servidor
pm2 list

# Ver logs en tiempo real
pm2 logs encuesta-mvp --nostream

# Reiniciar servidor (si hace falta)
pm2 restart encuesta-mvp

# Parar servidor
pm2 stop encuesta-mvp
```

### Base de Datos
- **Actual**: Datos en memoria (se pierden si reinicias servidor)
- **Producción**: Usarías Cloudflare D1, KV o R2 para persistencia

### Emails
- **Actual**: Los emails se simulan (aparecen en logs)
- **Producción**: Configurarías SendGrid, Mailgun o similar

---

## 📢 COMPARTIR LA ENCUESTA

### Mensaje WhatsApp para peluquerías:
```
Hola [Nombre] 👋

Soy Eva de Galia Digital. Estoy creando una Agenda Inteligente IA para peluquerías que gestiona citas 24/7 y reduce no-shows un 80%.

¿Me ayudas con 3 minutos de tu tiempo?
👉 [LINK ENCUESTA]

Y si estás en A Coruña... ¡entras en el sorteo de una Agenda IA GRATIS (valor 1.020€)! 🎁

¿Te viene bien? 😊
```

### Post Redes Sociales:
```
🎁 SORTEO para peluquerías de A Coruña

¿Tu agenda te roba más de 2 horas al día?

Estoy creando una solución que devuelve LIBERTAD a las peluqueras.
Y necesito tu ayuda (solo 3 minutos).

PREMIO: 1 Agenda Inteligente IA
VALOR: 1.020€ (setup + 12 meses gratis)

👉 Completa la encuesta: [LINK]

Sorteo: 24 noviembre 2025
Solo A Coruña 💜

#Peluquerías #ACoruña #AgendaIA #GaliaDigital
```

### Email:
```
Asunto: [Nombre], 3 minutos = posible premio de 1.020€ 🎁

Hola [Nombre],

Soy Eva Rodríguez, fundadora de Galia Digital.

Estoy desarrollando una Agenda Inteligente con IA que gestiona citas 24/7, reduce no-shows un 80% y devuelve 8 horas semanales a las peluqueras.

¿Me ayudas a hacerla perfecta para ti?
Solo 3 minutos: [LINK ENCUESTA]

BONUS: Si tu salón está en A Coruña, entras automáticamente en el sorteo de:
✨ 1 Agenda Inteligente IA (valor 1.020€)
✨ Setup profesional gratis (300€)
✨ 12 meses de servicio sin coste (720€)

Sorteo: 24 de noviembre 2025

Mil gracias por tu tiempo 💜

Eva Rodríguez
Galia Digital
+34 676 351 851
```

---

## 🎯 PLAN DE ACCIÓN

### SEMANA 1 (Hoy - 7 días):
1. ✅ **Testea el sistema**: Completa tú la encuesta para ver cómo funciona
2. ✅ **Comparte el link**: 
   - 10 peluquerías de Coruña por WhatsApp
   - 5 contactos de tu red por email
   - 2 posts en RRSS
3. ✅ **Revisa dashboard**: Mira respuestas cada día
4. ✅ **Llama leads HOT**: En 24h máximo

### SEMANA 2-3 (Captura masiva):
1. ✅ **Expande alcance**:
   - Grupos de Facebook de peluqueras
   - LinkedIn posts
   - Asociaciones de peluquerías A Coruña
2. ✅ **Seguimiento leads**:
   - HOT: Llamar en 24h
   - WARM: Llamar en 3-5 días
   - COLD: Email follow-up

### 24 NOVIEMBRE (DÍA DEL SORTEO):
1. ✅ **Sorteo en vivo**:
   - Dashboard → "🎲 SORTEAR GANADOR"
   - Graba vídeo del sorteo (transparencia)
2. ✅ **Contacto ganador**:
   - WhatsApp inmediato
   - Email confirmación
3. ✅ **Anuncio público**:
   - RRSS con foto/vídeo
   - Email a todos los participantes

---

## 📞 SOPORTE TÉCNICO

**¿Problemas con el sistema?**
- Servidor caído → `pm2 restart encuesta-mvp`
- Dashboard no carga → Verifica URL correcta
- Datos no aparecen → Refresca con "🔄 Actualizar Datos"

**¿Necesitas cambios?**
- Modificar preguntas
- Cambiar diseño
- Añadir funcionalidades

Contacta al desarrollador o házlo tú desde:
- `/home/user/webapp/src/index.js` (backend)
- `/home/user/webapp/dashboard.html` (dashboard)

---

## 🎉 ¡ÉXITO CON TU ENCUESTA!

Este sistema te dará:
✅ Validación MVP (willingness to pay real)
✅ Base de leads cualificados
✅ Insights Nivel 2/3 (RRSS, automatización)
✅ Buzz local (sorteo A Coruña)
✅ Data para ajustar tu producto

**A por esos primeros 20 clientes, Eva!** 💪🔥

---

**Última actualización:** 31 octubre 2025
**Versión:** 1.0
**Creado para:** Eva Rodríguez - Galia Digital
