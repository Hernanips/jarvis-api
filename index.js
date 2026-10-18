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
        description: 'Crea una tarea directamente en el Google Tasks oficial del usuario. Úsala SIEMPRE que el usuario pida apuntar, recordar o añadir una tarea.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título claro de la tarea' },
            category: { type: Type.STRING, description: 'Nombre de la lista o categoría (ej: Pecera, Project OBSCURA, Uni, General)' },
            due_date: { type: Type.STRING, description: 'Fecha en formato YYYY-MM-DD (si se menciona)' }
          },
          required: ['title', 'category']
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
        description: 'Lee en tiempo real TODAS las listas y cajones de Google Tasks del usuario (incluyendo tareas completadas hoy, pendientes, fechas programadas de la pecera, proyectos y uni) y las comidas de hoy.',
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
      if (args.due_date) url.searchParams.append('due_date', args.due_date);

      const respuestaGoogle = await fetch(url.toString());
      const datosGoogle = await respuestaGoogle.json();
      console.log("✅ Respuesta de Google Tasks (Crear):", datosGoogle);

      // Guardamos copia en Supabase
      await supabase
        .from('tasks')
        .insert([{ user_id: userId, title: args.title, category: args.category, due_date: args.due_date }]);

      return datosGoogle;
    } catch (err) {
      console.error("❌ Error conectando con Google Tasks:", err);
      return { error: "No se pudo sincronizar con Google Tasks" };
    }
  }

  // 2. REGISTRAR COMIDA EN SUPABASE
  if (nombre === 'registrar_comida') {
    const { data, error } = await supabase
      .from('meals')
      .insert([{ user_id: userId, description: args.description, calories: args.calories, protein_g: args.protein_g }])
      .select();

    if (error) console.error("❌ Error en Supabase (meals):", error);
    else console.log("✅ Guardado en Supabase (meals):", data);

    return error ? { error: error.message } : { ok: true, comida_registrada: data[0] };
  }

  // 3. CONSULTAR GOOGLE TASKS + SUPABASE
  if (nombre === 'consultar_estado_dia') {
    let tareasGoogle = {};
    try {
      const url = new URL(process.env.GOOGLE_SCRIPT_URL);
      url.searchParams.append('accion', 'leer_tareas');

      const resG = await fetch(url.toString());
      const dataG = await resG.json();
      console.log("📋 Tareas leídas de Google Tasks:", JSON.stringify(dataG));
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
    const { message, userId = 'user_admin' } = req.body;

    const systemInstruction = `
      Eres el asistente y tutor estricto del usuario (estilo Jarvis / mentor exigente).
      Hoy es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
      - Si el usuario menciona algo que ha comido, estima tú mismo las calorías y proteínas reales y llama a 'registrar_comida'.
      - Si menciona deberes de la universidad, dibujos o proyectos que tiene que hacer, llama a 'crear_tarea'.
      - Si pregunta qué tiene pendiente o cómo lleva el día, llama a 'consultar_estado_dia'.
      - Sé directo, breve (2-4 frases máximo, pensado para ser leído o escuchado en el móvil) y exigente con las tareas pendientes.
    `;

    // Historial de contenidos de la petición
    let contents = [
      { role: 'user', parts: [{ text: message }] }
    ];

    let response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents,
      config: { systemInstruction, tools: assistantTools }
    });

    // Bucle de Tool Calling
    while (response.functionCalls && response.functionCalls.length > 0) {
      // 1. Añadimos la respuesta del modelo que contiene la petición de función
      contents.push(response.candidates[0].content);

      // 2. Ejecutamos cada herramienta y guardamos los resultados en el formato exacto de partes
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

      // 3. Añadimos el bloque de respuesta de la función al historial
      contents.push({ role: 'user', parts: functionResponseParts });

      // 4. Volvemos a llamar al modelo para que genere la respuesta final en texto
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