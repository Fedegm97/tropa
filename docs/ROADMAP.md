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

## Fase 3 · Tienda, suscripciones y reloj ✅

- Tienda: productos con foto, precio, talles y stock; el corredor pide (precio y stock salen de la base, con lock), numeración por club ("Nuevo pedido #92" al staff), estados Pendiente de pago → Pagado → Entregado, cancelar devuelve el stock
- Suscripciones de la plataforma con Mercado Pago (preapproval mensual en pesos) detrás de una interfaz `BillingProvider` (sumar Stripe = implementar la interfaz); webhooks con firma `x-signature` verificada, idempotentes y que consultan el estado real; cambio de plan cancela la suscripción anterior; proveedor simulado para desarrollo
- Prueba gratis de 30 días sin tarjeta (una vez por club), aviso al owner 3 días antes, vuelta a Free automática al vencer; los pilotos quedan fijos
- Funciones por plan en UI y en la base (tienda desde Team; envío al reloj desde Coach)
- Garmin: conexión OAuth 2.0 + PKCE, mapeo de bloques a workout con ritmos personalizados (rangos de velocidad), envío en segundo plano con estados "Enviando… → En el reloj", reintentos y refresh de tokens; reloj simulado para desarrollo
- Superadmin: estado de la suscripción por club

## Para salir a producción con pagos y Garmin

- Mercado Pago: credenciales de producción + clave de webhooks (ver `docs/DEPLOY.md`)
- Garmin: aprobación en el Garmin Connect Developer Program (Training API). Al aprobarte, confirmar los endpoints en `src/lib/watch/providers.ts` (se pueden sobrescribir por variables de entorno) y probar con una cuenta real
- Stripe: implementar `BillingProvider` en `src/lib/billing/stripe.ts` y registrarlo en `src/lib/billing/index.ts`

## Pendientes transversales

- Sentry y analytics de uso por club
- Splash screens de iOS (`apple-touch-startup-image`)
- Modo claro (hoy solo dark)
- Tests E2E con Playwright en CI (hoy se corren a mano)
- Carrito con varios productos por pedido (la base ya lo soporta; la UI pide de a un producto)
