# Jarvis OS

PWA y dashboard de integración personal orientado a la automatización de flujos de trabajo, gestión de hábitos y centralización de métricas en un único punto de control.

El proyecto está diseñado bajo una arquitectura serverless centrada en **seguridad por capas (RLS), rendimiento ligero y una estética visual técnica y minimalista**.

---

## 📌 Descripción

Jarvis OS surge de la necesidad de unificar datos dispersos en múltiples plataformas cotidianas (tareas, calendarios, entrenamiento y descanso) sin depender de aplicaciones de terceros cerradas.

Funciona como un centro de mando personal que combina llamadas a APIs de terceros, persistencia relacional en tiempo real y componentes visuales interactivos.

---

## 🛠️ Tecnologías y Arquitectura

- **Frontend:** React / TypeScript (PWA instalable)
- **Estilos:** Tailwind CSS (tema oscuro técnico inspirado en diseño minimalista)
- **Backend & Auth:** Supabase (PostgreSQL) con políticas estrictas de **Row Level Security (RLS)**
- **Despliegue & Edge:** Vercel (CI/CD continuo)
- **Integraciones externas:**
  - Google Tasks API & Google Calendar API (gestión de agenda y compromisos)
  - Strava API & Garmin Connect (seguimiento de sesiones de running/ciclismo y métricas biométricas)
  - Integración de hábitos y descanso

---

## ⚙️ Decisiones de Diseño y Desarrollo

- **Seguridad y privacidad por diseño:** Acceso aislado por usuario mediante UUID vinculado a Auth en Supabase. Credenciales y tokens OAuth gestionados estrictamente en variables de entorno seguras.
- **Enfoque PWA:** Experiencia fluida en móvil y escritorio sin sobrecarga de frameworks nativos pesados.
- **Visualización de datos activa:** Componentes interactivos optimizados para consulta rápida de estado diario sin fricción.
- **Arquitectura desacoplada:** Servicios independientes por cada proveedor de API para aislar fallos de conexión y renovar tokens de forma transparente.

---

## 🎯 Qué demuestra este proyecto

- Integración y consumo de APIs REST con flujos de autenticación OAuth2.
- Modelado relacional en PostgreSQL y control granular de permisos con RLS.
- Arquitectura frontend mantenible con tipado estricto en TypeScript.
- Desarrollo orientado a producto personal funcional en producción continua.

---

## 📄 Licencia

Este proyecto se publica bajo la licencia **MIT**.
