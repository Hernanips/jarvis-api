import { Type } from '@google/genai';

export const assistantTools = [
  {
    functionDeclarations: [
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
        description: 'Lee en tiempo real TODAS las listas, tareas y subtareas de Google Tasks del usuario (completadas y pendientes) y las comidas de hoy.',
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      }
    ]
  }
];