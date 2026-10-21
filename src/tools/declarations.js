import { Type } from '@google/genai';

export const assistantTools = [
  {
    functionDeclarations: [
      // --- GESTIÓN DE CALENDARIOS ---
      {
        name: 'crear_calendario',
        description: 'Crea un nuevo calendario secundario en Google Calendar.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Nombre del nuevo calendario' },
            description: { type: Type.STRING, description: 'Descripción opcional del calendario' }
          },
          required: ['title']
        }
      },
      {
        name: 'editar_calendario',
        description: 'Cambia el nombre o la descripción de un calendario secundario existente en Google Calendar.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            search_title: { type: Type.STRING, description: 'Nombre actual del calendario a modificar' },
            new_title: { type: Type.STRING, description: 'Nuevo nombre para el calendario' },
            description: { type: Type.STRING, description: 'Nueva descripción' }
          },
          required: ['search_title']
        }
      },
      {
        name: 'borrar_calendario',
        description: 'Elimina por completo un calendario secundario de Google Calendar.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Nombre del calendario que se quiere eliminar' }
          },
          required: ['title']
        }
      },

      // --- EVENTOS DE GOOGLE CALENDAR ---
      {
        name: 'crear_evento',
        description: 'Agenda un evento en Google Calendar. IMPORTANTE: Elige siempre el calendar_name que mejor encaje por temática entre los calendarios que tenga creados el usuario.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título del evento' },
            calendar_name: { type: Type.STRING, description: 'Nombre exacto del calendario de destino según la temática del evento (ej. estudios/exámenes en el académico, ejercicio en deporte, etc.). Si aún no sabes qué calendarios tiene el usuario, consulta antes consultar_estado_dia.' },
            start_time: { type: Type.STRING, description: 'Inicio en formato YYYY-MM-DDTHH:mm (o YYYY-MM-DD si es todo el día)' },
            end_time: { type: Type.STRING, description: 'Fin en formato YYYY-MM-DDTHH:mm' },
            description: { type: Type.STRING, description: 'Descripción, notas o detalles del evento' },
            location: { type: Type.STRING, description: 'Ubicación' },
            recurrence_type: { type: Type.STRING, description: '"DAILY", "WEEKLY", "MONTHLY" o "YEARLY"' },
            recurrence_interval: { type: Type.NUMBER, description: 'Intervalo de repetición (ej: 1)' },
            days_of_week: { type: Type.STRING, description: 'Días si es WEEKLY (ej: "TUESDAY,FRIDAY")' },
            reminders: { type: Type.STRING, description: 'Minutos antes separados por comas (ej: "25, 120, 4320")' }
          },
          required: ['title', 'start_time', 'calendar_name']
        }
      },
      {
        name: 'editar_evento',
        description: 'Modifica un evento existente: cambia título, fecha/hora, descripción, lo mueve a otro calendario o cambia su recordatorio.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            search_title: { type: Type.STRING, description: 'Nombre actual del evento a buscar' },
            new_title: { type: Type.STRING, description: 'Nuevo título' },
            calendar_name: { type: Type.STRING, description: 'Nombre del calendario de destino si el usuario pide mover el evento de calendario' },
            description: { type: Type.STRING, description: 'Nueva descripción o notas del evento' },
            location: { type: Type.STRING, description: 'Nueva ubicación' },
            start_time: { type: Type.STRING, description: 'Nuevo inicio YYYY-MM-DDTHH:mm o YYYY-MM-DD' },
            end_time: { type: Type.STRING, description: 'Nuevo fin YYYY-MM-DDTHH:mm' },
            reminder_minutes: { type: Type.NUMBER, description: 'Nuevos minutos antes para el recordatorio' }
          },
          required: ['search_title']
        }
      },
      {
        name: 'borrar_evento',
        description: 'Elimina un evento de cualquier calendario de Google Calendar.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Nombre del evento a eliminar' },
            delete_series: { type: Type.BOOLEAN, description: 'Pon true si es un evento recurrente y quiere borrar todas las repeticiones' }
          },
          required: ['title']
        }
      },
      {
        name: 'consultar_calendario',
        description: 'Lee los eventos de TODOS los calendarios del usuario y devuelve también la lista de calendarios disponibles.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            start_date: { type: Type.STRING, description: 'Fecha de inicio en formato YYYY-MM-DD' },
            end_date: { type: Type.STRING, description: 'Fecha de fin en formato YYYY-MM-DD' }
          }
        }
      },

      // --- HERRAMIENTAS DE GOOGLE TASKS ---
      {
        name: 'crear_lista',
        description: 'Crea una nueva lista o cajón de tareas en Google Tasks.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Nombre de la nueva lista de tareas' }
          },
          required: ['title']
        }
      },
      {
        name: 'editar_lista',
        description: 'Cambia el nombre de una lista de tareas existente en Google Tasks.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            search_title: { type: Type.STRING, description: 'Nombre actual de la lista' },
            new_title: { type: Type.STRING, description: 'Nuevo nombre para la lista' }
          },
          required: ['search_title', 'new_title']
        }
      },
      {
        name: 'borrar_lista',
        description: 'Elimina por completo una lista de tareas de Google Tasks.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Nombre de la lista a eliminar' }
          },
          required: ['title']
        }
      },
      {
        name: 'limpiar_completadas',
        description: 'Limpia todas las tareas ya completadas de una lista de Google Tasks.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: 'Nombre de la lista a limpiar' }
          },
          required: ['category']
        }
      },
      {
        name: 'crear_tarea',
        description: 'Crea una tarea (o subtarea) en Google Tasks asignándola a la lista que mejor encaje semánticamente de las que tenga el usuario.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título claro de la tarea o subtarea' },
            category: { type: Type.STRING, description: 'Nombre exacto de la lista de destino donde mejor encaje según las listas del usuario.' },
            description: { type: Type.STRING, description: 'Descripción, notas o detalles adicionales de la tarea' },
            due_date: { type: Type.STRING, description: 'Fecha de vencimiento en formato YYYY-MM-DD' },
            parent_title: { type: Type.STRING, description: 'Si es una subtarea, nombre de la tarea principal' }
          },
          required: ['title', 'category']
        }
      },
      {
        name: 'editar_tarea',
        description: 'Modifica una tarea existente en Google Tasks: cambia título, añade o cambia su descripción (description), cambia fecha (due_date), la mueve a otra lista (new_category) o cambia su estado (completed).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            search_title: { type: Type.STRING, description: 'Nombre actual de la tarea que se quiere buscar' },
            new_title: { type: Type.STRING, description: 'Nuevo título si se quiere renombrar' },
            new_category: { type: Type.STRING, description: 'Nombre de la lista de destino si pide moverla de lista' },
            description: { type: Type.STRING, description: 'Descripción, notas o detalles a añadir o modificar en la tarea' },
            due_date: { type: Type.STRING, description: 'Nueva fecha en formato YYYY-MM-DD' },
            completed: { type: Type.BOOLEAN, description: 'true para marcar como completada, false para pendiente' }
          },
          required: ['search_title']
        }
      },
      {
        name: 'borrar_tarea',
        description: 'Elimina por completo una tarea individual de Google Tasks.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Nombre de la tarea a borrar' }
          },
          required: ['title']
        }
      },

      // --- NUTRICIÓN Y COMIDAS (Supabase) ---
      {
        name: 'registrar_comida',
        description: 'Registra una comida y sus macronutrientes en la base de datos de nutrición.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: 'Descripción clara de la comida' },
            calories: { type: Type.NUMBER, description: 'Calorías totales estimadas' },
            protein_g: { type: Type.NUMBER, description: 'Gramos de proteína estimados' }
          },
          required: ['description', 'calories', 'protein_g']
        }
      },
      {
        name: 'editar_comida',
        description: 'Modifica una comida ya registrada hoy (por si hubo un error en cantidades, calorías, proteínas o nombre).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            search_description: { type: Type.STRING, description: 'Texto o nombre de la comida registrada que se quiere modificar' },
            new_description: { type: Type.STRING, description: 'Nueva descripción corregida' },
            calories: { type: Type.NUMBER, description: 'Nuevas calorías corregidas' },
            protein_g: { type: Type.NUMBER, description: 'Nuevos gramos de proteína corregidos' }
          },
          required: ['search_description']
        }
      },
      {
        name: 'borrar_comida',
        description: 'Elimina una comida registrada por error en la base de datos.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            search_description: { type: Type.STRING, description: 'Nombre o descripción de la comida a eliminar' }
          },
          required: ['search_description']
        }
      },
      {
        name: 'consultar_comidas',
        description: 'Consulta el registro de comidas, calorías totales y proteínas de una fecha específica o rango de días.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: 'Fecha a consultar en formato YYYY-MM-DD (si no se envía, consulta hoy)' }
          }
        }
      },

      // --- ESTADO GLOBAL ---
      {
        name: 'consultar_estado_dia',
        description: 'Lee en tiempo real los nombres de TODAS las listas de Google Tasks y sus tareas, TODOS los calendarios del usuario y sus eventos, y las comidas registradas hoy. Úsala también antes de crear un evento o tarea si no conoces qué listas o calendarios tiene el usuario.',
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      }
    ]
  }
];