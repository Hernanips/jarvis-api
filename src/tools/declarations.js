import { Type } from '@google/genai';

export const assistantTools = [
  {
    functionDeclarations: [
      // --- HERRAMIENTAS DE GOOGLE CALENDAR ---
      {
        name: 'crear_evento',
        description: 'Agenda un evento o bloque de tiempo con fecha y hora en Google Calendar. Úsala cuando el usuario mencione una hora específica (ej: "a las 17:00", "de 10 a 12"), citas, clases o entregas en el calendario.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título del evento' },
            start_time: { type: Type.STRING, description: 'Fecha y hora de inicio en formato YYYY-MM-DDTHH:mm (o solo YYYY-MM-DD si es un evento de todo el día)' },
            end_time: { type: Type.STRING, description: 'Fecha y hora de fin en formato YYYY-MM-DDTHH:mm (opcional, por defecto dura 1 hora)' },
            description: { type: Type.STRING, description: 'Descripción o notas del evento' },
            location: { type: Type.STRING, description: 'Ubicación o lugar del evento' }
          },
          required: ['title', 'start_time']
        }
      },
      {
        name: 'editar_evento',
        description: 'Modifica un evento existente en Google Calendar (cambia su título, hora de inicio/fin, descripción o lugar).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            search_title: { type: Type.STRING, description: 'Nombre actual del evento que se quiere modificar' },
            new_title: { type: Type.STRING, description: 'Nuevo título para el evento' },
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
        description: 'Elimina o cancela un evento de Google Calendar buscándolo por su título.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Nombre del evento a eliminar' }
          },
          required: ['title']
        }
      },
      {
        name: 'consultar_calendario',
        description: 'Consulta los eventos de Google Calendar para los próximos N días.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            days: { type: Type.NUMBER, description: 'Número de días hacia adelante que se quieren consultar (ej: 7 para una semana, 30 para un mes)' }
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

      // --- HERRAMIENTAS DE NUTRICIÓN Y RESUMEN GLOBAL ---
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
        description: 'Lee en tiempo real TODAS las listas de Google Tasks, los eventos próximos de Google Calendar y las comidas registradas hoy.',
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      }
    ]
  }
];