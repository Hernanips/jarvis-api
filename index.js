import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Inicializamos Supabase y Gemini
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ============================================================================
// 1. CAJA DE HERRAMIENTAS
// ============================================================================
const assistantTools = [
  {
    functionDeclarations: [
      {
        name: 'crear_tarea',
        description: 'Crea una tarea en el Google Tasks oficial del usuario con título, categoría, fecha opcional y descripción/detalles opcionales.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título claro de la tarea' },
            category: { type: Type.STRING, description: 'Nombre de la lista o categoría (ej: Pecera, Project OBSCURA, Uni, General)' },
            description: { type: Type.STRING, description: 'Descripción, notas o detalles adicionales de la tarea' },
            due_date: { type: Type.STRING, description: 'Fecha de vencimiento en formato YYYY-MM-DD (calculada a partir de hoy si dice "mañana", "el viernes", etc.)' }
          },
          required: ['title', 'category']
        }
      },
      {
        name: 'editar_tarea',
        description: 'Modifica una tarea existente en Google Tasks (cambia su título, añade o cambia su descripción/detalles, cambia la fecha o la marca como completada/hecha).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            search_title: { type: Type.STRING, description: 'Nombre actual (o parte del nombre) de la tarea que se quiere buscar para editar' },
            new_title: { type: Type.STRING, description: 'Nuevo título si se quiere renombrar' },
            description: { type: Type.STRING, description: 'Nueva descripción o detalles para añadir a la tarea' },
            due_date: { type: Type.STRING, description: 'Nueva fecha en formato YYYY-MM-DD' },
            completed: { type: Type.BOOLEAN, description: 'Pon true si el usuario dice que ya ha completado o terminado esta tarea' }
          },
          required: ['search_title']
        }
      },
      {
        name: 'borrar_tarea',
        description: 'Elimina por completo una tarea de Google Tasks buscándola por su título.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Nombre o palabras clave de la tarea que se quiere borrar' }
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
        description: 'Lee en tiempo real TODAS las listas y cajones de Google Tasks del usuario (incluyendo tareas completadas, pendientes, fechas y descripciones) y las comidas de hoy.',
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      }
    ]
  }
];

// ============================================================================
// 2. LAS MANOS (Base de datos Supabase)
// ============================================================================
async function ejecutarHerramienta(nombre, args, userId) {
  // 1. CREAR TAREA EN GOOGLE TASKS
  if (nombre === 'crear_tarea') {
    try {
      const url = new URL(process.env.GOOGLE_SCRIPT_URL);
      url.searchParams.append('accion', 'crear_tarea');
      url.searchParams.append('title', args.title);
      url.searchParams.append('category', args.category || 'General');
      if (args.description) url.searchParams.append('description', args.description);
      if (args.due_date) url.searchParams.append('due_date', args.due_date);

      const respuestaGoogle = await fetch(url.toString());
      const datosGoogle = await respuestaGoogle.json();
      console.log("✅ Google Tasks (Crear):", datosGoogle);

      await supabase
        .from('tasks')
        .insert([{ user_id: userId, title: args.title, category: args.category, due_date: args.due_date }]);

      return datosGoogle;
    } catch (err) {
      console.error("❌ Error conectando con Google Tasks:", err);
      return { error: "No se pudo sincronizar con Google Tasks" };
    }
  }

  // 2. EDITAR O COMPLETAR TAREA EN GOOGLE TASKS
  if (nombre === 'editar_tarea') {
    try {
      const url = new URL(process.env.GOOGLE_SCRIPT_URL);
      url.searchParams.append('accion', 'editar_tarea');
      url.searchParams.append('search_title', args.search_title);
      if (args.new_title) url.searchParams.append('new_title', args.new_title);
      if (args.description) url.searchParams.append('description', args.description);
      if (args.due_date) url.searchParams.append('due_date', args.due_date);
      if (args.completed) url.searchParams.append('completed', 'true');

      const res = await fetch(url.toString());
      const datos = await res.json();
      console.log("✏️ Google Tasks (Editar):", datos);
      return datos;
    } catch (err) {
      return { error: "No se pudo editar la tarea" };
    }
  }

  // 3. BORRAR TAREA EN GOOGLE TASKS
  if (nombre === 'borrar_tarea') {
    try {
      const url = new URL(process.env.GOOGLE_SCRIPT_URL);
      url.searchParams.append('accion', 'borrar_tarea');
      url.searchParams.append('title', args.title);

      const res = await fetch(url.toString());
      const datos = await res.json();
      console.log("🗑️ Google Tasks (Borrar):", datos);
      return datos;
    } catch (err) {
      return { error: "No se pudo borrar la tarea" };
    }
  }

  // 4. REGISTRAR COMIDA EN SUPABASE
  if (nombre === 'registrar_comida') {
    const { data, error } = await supabase
      .from('meals')
      .insert([{ user_id: userId, description: args.description, calories: args.calories, protein_g: args.protein_g }])
      .select();

    return error ? { error: error.message } : { ok: true, comida_registrada: data[0] };
  }

  // 5. CONSULTAR GOOGLE TASKS + SUPABASE
  if (nombre === 'consultar_estado_dia') {
    let tareasGoogle = {};
    try {
      const url = new URL(process.env.GOOGLE_SCRIPT_URL);
      url.searchParams.append('accion', 'leer_tareas');

      const resG = await fetch(url.toString());
      const dataG = await resG.json();
      tareasGoogle = dataG.tareas || {};
    } catch (e) {
      console.error("❌ Error leyendo Google Tasks:", e);
    }

    const { data: comidas } = await supabase
      .from('meals')
      .select('description, calories, protein_g')
      .eq('user_id', userId);

    return {
      hoy_es: new Date().toISOString().split('T')[0],
      listas_google_tasks: tareasGoogle,
      comidas_registradas_hoy: comidas || []
    };
  }
}

// ============================================================================
// 3. EL ENDPOINT CENTRAL (Control manual robusto de contenidos)
// ============================================================================
app.post('/api/assistant', async (req, res) => {
  try {
    const { message, history = [], userId = 'usuario_principal' } = req.body;

    const systemInstruction = `
      Eres el asistente y tutor estricto del usuario (estilo Jarvis / mentor exigente).
      Hoy es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
      - Si el usuario menciona algo que ha comido, estima tú mismo las calorías y proteínas reales y llama a 'registrar_comida'.
      - Si pide explícitamente apuntar o crear una tarea, llama a 'crear_tarea'.
      - Si pide modificar, añadir descripción, cambiar fecha o marcar como hecha una tarea, llama a 'editar_tarea'.
      - Si pide borrar o eliminar una tarea (incluso diciendo "bórrala" refiriéndose a la anterior), llama a 'borrar_tarea'.
      - Si pregunta qué tiene pendiente o cómo lleva el día, llama a 'consultar_estado_dia'.
      - Sé directo, breve (2-4 frases máximo, pensado para ser leído o escuchado en el móvil) y exigente con las tareas pendientes.
    `;

    // Historial de contenidos de la petición (AQUÍ ESTABA EL TRUCO: añadimos ...history)
    let contents = [
      ...history,
      { role: 'user', parts: [{ text: message }] }
    ];

    let response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents,
      config: { systemInstruction, tools: assistantTools }
    });

    // Bucle de Tool Calling
    while (response.functionCalls && response.functionCalls.length > 0) {
      contents.push(response.candidates[0].content);

      const functionResponseParts = [];
      for (const call of response.functionCalls) {
        console.log(`🔧 Ejecutando herramienta: ${call.name}`, call.args);
        const resultadoBD = await ejecutarHerramienta(call.name, call.args, userId);

        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: { result: resultadoBD }
          }
        });
      }

      contents.push({ role: 'user', parts: functionResponseParts });

      response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents,
        config: { systemInstruction, tools: assistantTools }
      });
    }

    res.json({ reply: response.text });

  } catch (error) {
    console.error("❌ Error crítico en el servidor:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Jarvis V1 escuchando en http://localhost:${PORT}/api/assistant`);
});