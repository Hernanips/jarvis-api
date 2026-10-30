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
      // --- NUTRICIÓN, MACROS Y PESO CORPORAL (Supabase) ---
      {
        name: 'registrar_comida',
        description: 'Registra una comida estimando sus calorías y macronutrientes (proteínas, carbohidratos y grasas).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: 'Descripción clara de la comida y cantidades' },
            calories: { type: Type.NUMBER, description: 'Calorías totales estimadas' },
            protein_g: { type: Type.NUMBER, description: 'Gramos de proteína estimados' },
            carbs_g: { type: Type.NUMBER, description: 'Gramos de carbohidratos estimados' },
            fat_g: { type: Type.NUMBER, description: 'Gramos de grasas estimados' }
          },
          required: ['description', 'calories', 'protein_g', 'carbs_g', 'fat_g']
        }
      },
      {
        name: 'editar_comida',
        description: 'Modifica una comida ya registrada (por si hubo un error en cantidades, nombre o macros).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            search_description: { type: Type.STRING, description: 'Nombre o texto de la comida que se quiere modificar' },
            new_description: { type: Type.STRING, description: 'Nueva descripción corregida' },
            calories: { type: Type.NUMBER, description: 'Nuevas calorías' },
            protein_g: { type: Type.NUMBER, description: 'Nuevos gramos de proteína' },
            carbs_g: { type: Type.NUMBER, description: 'Nuevos gramos de carbohidratos' },
            fat_g: { type: Type.NUMBER, description: 'Nuevos gramos de grasa' }
          },
          required: ['search_description']
        }
      },
      {
        name: 'borrar_comida',
        description: 'Elimina una comida registrada en la base de datos.',
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
        description: 'Consulta las comidas y el total de calorías y macronutrientes de una fecha específica (YYYY-MM-DD).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: 'Fecha en formato YYYY-MM-DD (si no se envía, consulta hoy)' }
          }
        }
      },
      {
        name: 'registrar_peso',
        description: 'Registra el peso corporal del usuario y opcionalmente su porcentaje de grasa, masa muscular o notas.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            weight_kg: { type: Type.NUMBER, description: 'Peso en kilogramos (ej: 74.5)' },
            body_fat_pct: { type: Type.NUMBER, description: 'Porcentaje de grasa corporal opcional (ej: 14.2)' },
            muscle_mass_kg: { type: Type.NUMBER, description: 'Masa muscular en kg opcional' },
            notes: { type: Type.STRING, description: 'Notas adicionales (ej: "En ayunas", "Báscula gimnasio")' }
          },
          required: ['weight_kg']
        }
      },
      {
        name: 'consultar_peso',
        description: 'Consulta el historial reciente de peso corporal y evolución física del usuario.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            limit: { type: Type.NUMBER, description: 'Número de registros recientes a consultar (por defecto 10)' }
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
      },

      // --- MEMORIA DE LARGO PLAZO ESTILO CLAUDE (Supabase) ---
      {
        name: 'guardar_memoria',
        description: 'Guarda de forma proactiva y automática en la memoria a largo plazo cualquier hecho relevante sobre el usuario que acabe de mencionar en la conversación (ej: carreras futuras como 8K/5K/Media Maratón, tiempos objetivo, metas de calorías/peso, lesiones, estudios, proyectos, equipamiento o preferencias personales). Úsala por iniciativa propia sin que el usuario tenga que pedirte "guarda esto".',
        parameters: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: 'Categoría corta: "objetivos_deporte", "nutricion_salud", "academico_proyectos", "preferencias" o "personal"'
            },
            fact: {
              type: Type.STRING,
              description: 'Hecho claro, conciso y con fechas absolutas si aplica (ej: "Tiene una carrera de 8K a mediados de noviembre de 2026, busca bajar de 30 min en 5K en enero de 2027 y correr la Media Maratón de Valencia en octubre de 2027")'
            }
          },
          required: ['category', 'fact']
        }
      },
      {
        name: 'actualizar_memoria',
        description: 'Modifica un recuerdo o dato existente en la memoria a largo plazo cuando la situación, marca u objetivo del usuario cambia o progresa.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            search_text: {
              type: Type.STRING,
              description: 'Palabra clave o fragmento del recuerdo actual que se quiere actualizar (ej: "5K", "Media Maratón", "calorías")'
            },
            new_fact: {
              type: Type.STRING,
              description: 'Nuevo texto actualizado del recuerdo'
            }
          },
          required: ['search_text', 'new_fact']
        }
      },
      {
        name: 'olvidar_memoria',
        description: 'Elimina un recuerdo de la memoria a largo plazo si ya no es válido o el usuario pide que lo olvides.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            search_text: {
              type: Type.STRING,
              description: 'Palabra clave del recuerdo a borrar'
            }
          },
          required: ['search_text']
        }
      }
    ]
  }
];