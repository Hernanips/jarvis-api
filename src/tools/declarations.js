import { Type } from '@google/genai';

export const assistantTools = [
  {
    functionDeclarations: [
      // --- GESTIÓN DE CALENDARIOS (Cajones de Google Calendar) ---
      {
        name: 'crear_calendario',
        description: 'Crea un nuevo calendario secundario en Google Calendar (ej: Deporte, Exámenes, Cumpleaños).',
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

      // --- EVENTOS DE GOOGLE CALENDAR (Con soporte Multi-calendario y Recurrencias) ---
      {
        name: 'crear_evento',
        description: 'Agenda un evento (único o recurrente) en Google Calendar. Si es un cumpleaños, pon solo YYYY-MM-DD en start_time y recurrence_type="YEARLY". Si es de deporte o entreno, pon calendar_name="Deporte".',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título del evento' },
            calendar_name: { type: Type.STRING, description: 'Nombre del calendario donde guardarlo (ej: "Deporte", "Principal"). Si no especifica, déjalo vacío.' },
            start_time: { type: Type.STRING, description: 'Inicio en formato YYYY-MM-DDTHH:mm (o solo YYYY-MM-DD si dura todo el día / cumpleaños)' },
            end_time: { type: Type.STRING, description: 'Fin en formato YYYY-MM-DDTHH:mm (opcional)' },
            description: { type: Type.STRING, description: 'Descripción o notas del evento' },
            location: { type: Type.STRING, description: 'Ubicación o lugar' },
            recurrence_type: { type: Type.STRING, description: 'Tipo de repetición si es recurrente: "DAILY" (diario), "WEEKLY" (semanal), "MONTHLY" (mensual) o "YEARLY" (anual, ideal para cumpleaños).' },
            recurrence_interval: { type: Type.NUMBER, description: 'Intervalo de repetición (ej: 1 para cada semana/día, 2 para cada 2 días o cada 2 semanas).' },
            days_of_week: { type: Type.STRING, description: 'Solo si recurrence_type es WEEKLY: días separados por comas en inglés (ej: "TUESDAY,FRIDAY" para martes y viernes).' }
          },
          required: ['title', 'start_time']
        }
      },
      {
        name: 'editar_evento',
        description: 'Modifica un evento existente en cualquier calendario de Google Calendar (título, fecha/hora, descripción, o lo mueve a otro calendario como Deporte).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            search_title: { type: Type.STRING, description: 'Nombre actual del evento a buscar' },
            new_title: { type: Type.STRING, description: 'Nuevo título' },
            new_calendar: { type: Type.STRING, description: 'Nombre del calendario de destino si el usuario pide mover el evento a otro calendario (ej: "Deporte")' },
            start_time: { type: Type.STRING, description: 'Nueva fecha y hora de inicio en formato YYYY-MM-DDTHH:mm' },
            end_time: { type: Type.STRING, description: 'Nueva fecha y hora de fin en formato YYYY-MM-DDTHH:mm' },
            description: { type: Type.STRING, description: 'Nueva descripción' },
            location: { type: Type.STRING, description: 'Nueva ubicación' }
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
            delete_series: { type: Type.BOOLEAN, description: 'Pon true si es un evento recurrente y quiere borrar todas las repeticiones futuras' }
          },
          required: ['title']
        }
      },
      {
        name: 'consultar_calendario',
        description: 'Lee todos los calendarios del usuario (Principal, Deporte, Cumpleaños, etc.) para los próximos N días.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            days: { type: Type.NUMBER, description: 'Días hacia adelante a consultar (por defecto 14)' }
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
        description: 'Cambia el nombre de una lista o cajón de tareas existente en Google Tasks.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            search_title: { type: Type.STRING, description: 'Nombre actual de la lista que se quiere renombrar' },
            new_title: { type: Type.STRING, description: 'Nuevo nombre para la lista' }
          },
          required: ['search_title', 'new_title']
        }
      },
      {
        name: 'borrar_lista',
        description: 'Elimina por completo una lista o cajón de tareas de Google Tasks.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Nombre de la lista que se quiere eliminar' }
          },
          required: ['title']
        }
      },
      {
        name: 'limpiar_completadas',
        description: 'Limpia u oculta todas las tareas ya completadas/tachadas de una lista de Google Tasks.',
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
        description: 'Crea una tarea (o subtarea) en el Google Tasks oficial del usuario con título, categoría, fecha opcional y descripción opcional.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título claro de la tarea o subtarea' },
            category: { type: Type.STRING, description: 'Nombre de la lista o categoría (ej: Pecera, Project OBSCURA, Uni, General)' },
            description: { type: Type.STRING, description: 'Descripción, notas o detalles adicionales' },
            due_date: { type: Type.STRING, description: 'Fecha de vencimiento en formato YYYY-MM-DD' },
            parent_title: { type: Type.STRING, description: 'Si es una subtarea, nombre de la tarea principal dentro de la cual debe meterse' }
          },
          required: ['title', 'category']
        }
      },
      {
        name: 'editar_tarea',
        description: 'Modifica una tarea existente en Google Tasks: cambia su título, descripción, fecha, la mueve a otra lista/cajón, la marca como completada (true) o la desmarca como pendiente (false).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            search_title: { type: Type.STRING, description: 'Nombre actual de la tarea que se quiere buscar para editar' },
            new_title: { type: Type.STRING, description: 'Nuevo título si se quiere renombrar la tarea' },
            new_category: { type: Type.STRING, description: 'Nombre de la nueva lista/cajón si el usuario pide mover la tarea de una lista a otra' },
            description: { type: Type.STRING, description: 'Nueva descripción o detalles' },
            due_date: { type: Type.STRING, description: 'Nueva fecha en formato YYYY-MM-DD' },
            completed: { type: Type.BOOLEAN, description: 'true para marcar como hecha/completada, false para desmarcarla y volver a ponerla como pendiente' }
          },
          required: ['search_title']
        }
      },
      {
        name: 'borrar_tarea',
        description: 'Elimina por completo una tarea individual de Google Tasks buscándola por su título.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Nombre de la tarea que se quiere borrar' }
          },
          required: ['title']
        }
      },

      // --- NUTRICIÓN Y ESTADO GLOBAL ---
      {
        name: 'registrar_comida',
        description: 'Registra una comida y sus macronutrientes en la base de datos de nutrición.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: 'Descripción de la comida' },
            calories: { type: Type.NUMBER, description: 'Calorías estimadas' },
            protein_g: { type: Type.NUMBER, description: 'Gramos de proteína estimados' }
          },
          required: ['description', 'calories', 'protein_g']
        }
      },
      {
        name: 'consultar_estado_dia',
        description: 'Lee en tiempo real TODAS las listas de Google Tasks, TODOS los calendarios (Principal, Deporte, Cumpleaños) y las comidas de hoy.',
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      }
    ]
  }
];