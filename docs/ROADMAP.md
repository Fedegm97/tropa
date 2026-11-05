# Roadmap

## Fase 1 · MVP para pilotos ✅

- Multi-tenancy por subdominio + RLS en todas las tablas + tests de aislamiento
- Auth: mail mágico, Google, contraseña (para cuentas de prueba)
- Roles owner / coach / corredor, invitaciones de corredores (link + WhatsApp + QR) y de coaches (por email)
- Branding por club: nombre, slug validado en vivo, color (6 swatches + custom), logo o iniciales
- PWA por club: manifest, íconos 192/512/maskable/apple/favicon, theme-color, service worker, guía de instalación
- Onboarding en 3 pasos con barra de progreso y preview de celular en vivo
- Perfil del corredor (foto, nacimiento, teléfono, contacto de emergencia, ritmo de referencia)
- Turnos con días, horario, lugar, coach y asignación de corredores
- Planes: constructor por bloques, 7 tipos de sesión, % / zonas personalizados por corredor, audiencia club / turno / corredores, borradores, biblioteca, duplicar semana, completar con sensación + comentario, vista del coach de quién completó
- Avisos con imagen, segmentación por turno, fijados, reacciones, "Visto por N", push con la marca del club
- Homes de corredor y coach, cumpleaños del día
- Superadmin: clubes, uso, cambio manual de plan (pilotos)
- Límites por plan al sumar corredores / coaches (sin bloquear datos existentes)

## Fase 2 · Cuotas, aptos, eventos y recordatorios ✅

- Cuotas: montos por club / turno / corredor (becas con 0) con vigencia por mes, el corredor informa el pago con comprobante (imagen comprimida en el cliente o PDF, máx. 1 MB), el coach confirma o rechaza con un toque (con motivo), estados Al día / Pendiente de confirmar / Debe, resumen "N de M al día", filtros, exportación CSV para Excel y recordatorio automático el día configurado
- Apto médico: carga de certificado (foto o PDF) con vencimiento, estados Vigente / Por vencer (30 días) / Vencido / Sin cargar, vista del coach con filtros, recordatorios 30 y 7 días antes, el día y el día después del vencimiento
- Eventos: calle / trail / pista / salida especial / viaje, distancias, link de inscripción, precio, anotarse o bajarse con distancia, avatares "+N", cuenta regresiva, push al publicar y recordatorio el día anterior
- Cumpleaños: aviso al staff y saludo automático opcional del club
- Recordatorios con pg_cron (cada hora; cada club a las 9:00 de su zona horaria), idempotentes con `reminder_log`
- Funciones según el plan: cuotas, apto y cumpleaños desde el plan Coach, con mensaje + upsell; los datos ya cargados siempre se siguen viendo
- Seed: cuotas con estados mezclados (incluye pago parcial, rechazado y becado), aptos en todos los estados y 4 eventos con inscriptos

## Fase 3

- Tienda (productos, talles, stock, pedidos con numeración por club)
- Suscripciones con Mercado Pago (capa `BillingProvider` para sumar Stripe), prueba de 30 días sin tarjeta
- Activación automática de funciones al suscribirse (hoy el gating por plan ya funciona; el cambio de plan es manual desde /admin)
- Tienda bajo la feature `store` (plan Team)
- Garmin Connect Training API ("Enviando… → En el reloj")

## Pendientes transversales

- Sentry y analytics de uso por club
- Splash screens de iOS (`apple-touch-startup-image`)
- Modo claro (hoy solo dark)
- Tests E2E con Playwright en CI
