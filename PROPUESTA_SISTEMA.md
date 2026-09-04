# Propuesta de sistema de seguimiento postventa

## Diagnóstico de los archivos actuales

Los dos libros representan procesos relacionados, pero distintos:

- `NPS POSTVENTA.xlsx` concentra órdenes de servicio y contactos NPS por San Pedro, Lindavista, Carretera Nacional, Juárez y Chihuahua. Cada sucursal usa encabezados y posiciones diferentes.
- `Plantilla de seguimiento Q4 - BYD CLEBER.xlsx` controla el seguimiento posterior a la entrega a los 7, 15 y 28 días, junto con quejas, soluciones y agentes BDC.

El principal riesgo no es Excel en sí, sino la duplicación del cliente por filas, la falta de un responsable único para cada incidencia y la imposibilidad de saber con certeza qué llamada vence hoy.

## Sistema recomendado

Un sistema web centralizado, construido con la misma base técnica de `nexus-dashboard`:

- Next.js 16 con App Router, React 19 y TypeScript.
- Tailwind CSS para el sistema visual, Lucide para iconografía y Recharts para indicadores.
- MySQL como fuente única de información.
- Autenticación por roles: administrador, supervisor, agente BDC y asesor.

La unidad de trabajo debe ser un **expediente**, no una fila. El expediente une cliente, vehículo, VIN, agencia, orden o entrega, contactos programados e incidencias.

## Módulos

1. **Bandeja diaria:** contactos vencidos, del día y próximos; asignación por agente y agencia.
2. **Ruta 7·15·28:** fechas calculadas desde la entrega, resultado de cada intento e invitación a encuesta.
3. **NPS post servicio:** contacto posterior a facturación/entrega del taller y seguimiento a la encuesta.
4. **Incidencias:** responsable, fecha compromiso, evidencia, solución y escalamiento.
5. **Expediente 360:** historial inmutable del cliente y su unidad, aunque cambie de sucursal.
6. **Reportes:** cumplimiento, contactabilidad, incidencias por categoría, tiempo de solución, desempeño por agencia y agente.
7. **Migración/importación:** lectura de los dos formatos actuales, validación de VIN/teléfono y reporte de duplicados.

## Reglas operativas sugeridas

- Crear automáticamente los contactos a 7, 15 y 28 días al registrar una entrega.
- Crear el contacto NPS a 7 días de la fecha de servicio o facturación.
- Marcar en rojo un contacto vencido y escalar a supervisión después de 24 horas.
- Toda queja requiere responsable, fecha compromiso y cierre documentado.
- No permitir duplicar un expediente con el mismo VIN, tipo de proceso y fecha de referencia.
- Conservar una bitácora de cada cambio; nunca reemplazar notas anteriores.
- Enmascarar teléfono, correo y VIN para usuarios sin permiso operativo.

## Fases

### Fase 1 — MVP operativo

Bandeja, expedientes, ruta 7·15·28, NPS, incidencias, importación y reportes básicos. El prototipo de este repositorio cubre la experiencia y los flujos de esta fase.

### Fase 2 — Producción

Conectar MySQL, autenticación, roles, carga masiva validada, respaldos y auditoría. El esquema inicial está en `db/schema.sql`.

### Fase 3 — Automatización

Integrar CRM/DMS para evitar captura manual; WhatsApp Business o telefonía para registrar intentos; alertas automáticas y encuesta NPS. Estas integraciones deben agregarse después de estabilizar las reglas operativas.

## Migración recomendada

1. Crear un catálogo definitivo de agencias y usuarios.
2. Homologar nombres de columnas de todas las hojas.
3. Deduplicar clientes y vehículos usando VIN como clave principal.
4. Importar primero entregas, después servicios y por último contactos históricos.
5. Comparar totales por sucursal y mes contra los Excel.
6. Operar una semana en paralelo y después dejar los libros en modo solo lectura.
