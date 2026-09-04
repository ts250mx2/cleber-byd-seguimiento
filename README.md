# CLEBER Care — Seguimiento Postventa BYD

Sistema web para reemplazar los archivos de seguimiento postventa de Grupo CLEBER. Mantiene la arquitectura técnica de `nexus-dashboard`: Next.js App Router, React, TypeScript, Tailwind CSS, Lucide y Recharts.

## Alcance del MVP

- Bandeja diaria unificada para seguimientos post entrega y post servicio/NPS.
- Ruta automática de contactos a 7, 15 y 28 días.
- Expediente por cliente, unidad y VIN con historial de contactos.
- Clientes con uno o varios vehículos/VIN y modelo obligatorio por unidad.
- Registro de llamadas e incidencias con prioridad.
- Alta manual de clientes e incidencias, sin depender de una importación.
- Filtros por agencia y estado, búsqueda, importación de Excel y exportación CSV.
- Persistencia MySQL mediante APIs de Next.js para clientes, incidencias y seguimientos.

## Ejecutar

```bash
npm install
npm run dev
```

Abrir `http://localhost:3047`.

La conexión se configura en `.env.local`; usa `.env.example` como referencia. El archivo con credenciales está excluido de Git.

Para crear el esquema y migrar los dos libros históricos de forma idempotente:

```bash
npm run migrate:excel
```

## Recomendación para producción

La aplicación ya usa MySQL y separa clientes, vehículos, ciclos de seguimiento, contactos e incidencias. La siguiente fase recomendada es agregar autenticación por roles y activar la bitácora por usuario. La importación de Excel queda como herramienta de migración y contingencia, no como operación diaria.

Los nombres históricos de agencia se homologan automáticamente a: Carretera Nacional, Chihuahua, Linda Vista, Juárez y San Pedro.

El directorio maestro usa el índice compuesto `cliente normalizado + VIN`. Los seguimientos históricos se conservan, pero una misma combinación no se duplica en Clientes ni en el buscador de incidencias. Los VIN diferentes del mismo cliente permanecen como vehículos independientes.
