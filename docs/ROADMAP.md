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

## Fase 2

- Cuotas (reglas por club / turno / corredor, declaración con comprobante, confirmación del coach, resumen, CSV, recordatorio pg_cron)
  - La lógica de estados y montos ya está implementada y testeada en `src/lib/domain/fees.ts`
- Apto médico (estados, recordatorios, vista del coach) — lógica en `src/lib/domain/medical.ts`
- Eventos (inscripción con distancia, avatares, cuenta regresiva, recordatorio del día anterior)
- Cumpleaños: aviso al coach por push + saludo automático opcional
- Jobs de pg_cron para cuotas, aptos, eventos y cumpleaños (con `reminder_log`)
- Seed: cuotas con estados mezclados y eventos

## Fase 3

- Tienda (productos, talles, stock, pedidos con numeración por club)
- Suscripciones con Mercado Pago (capa `BillingProvider` para sumar Stripe), prueba de 30 días sin tarjeta
- Feature flags por plan en la UI (la lógica ya existe en `src/lib/domain/plans.ts` y `club_has_feature()`)
- Garmin Connect Training API ("Enviando… → En el reloj")

## Pendientes transversales

- Sentry y analytics de uso por club
- Splash screens de iOS (`apple-touch-startup-image`)
- Modo claro (hoy solo dark)
- Tests E2E con Playwright en CI
