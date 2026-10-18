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
        name: 'crear_tarea_google',
        description: 'Crea una tarea oficial en Google Tasks del usuario.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título de la tarea' },
            due_date: { type: Type.STRING, description: 'Fecha de vencimiento en formato YYYY-MM-DD si se conoce' }
          },
          required: ['title']
        }
      },
      {
        name: 'registrar_comida',
        description: 'Registra una comida calculando una estimación de calorías y proteínas.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: 'Qué ha comido el usuario' },
            calories: { type: Type.INTEGER, description: 'Calorías totales estimadas (kcal)' },
            protein_g: { type: Type.INTEGER, description: 'Gramos de proteína estimados' }
          },
          required: ['description', 'calories', 'protein_g']
        }
      },
      {
        name: 'consultar_estado_dia',
        description: 'Consulta las tareas pendientes y las calorías acumuladas hoy por el usuario.',
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
  // 1. CREAR TAREA -> Va directo a tu Google Tasks oficial (y copia en Supabase)
  if (nombre === 'crear_tarea') {
    try {
      // Llamamos al puente de Google Apps Script
      const respuestaGoogle = await fetch(process.env.GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'crear_tarea',
          title: args.title,
          category: args.category || 'general'
        })
      });
      const datosGoogle = await respuestaGoogle.json();
      console.log("✅ Tarea enviada a Google Tasks:", datosGoogle);

      // Opcional: la seguimos guardando en Supabase por si quieres histórico
      await supabase
        .from('tasks')
        .insert([{ user_id: userId, title: args.title, category: args.category, due_date: args.due_date }]);

      return { ok: true, mensaje: "Tarea creada en Google Tasks correctamente", google_id: datosGoogle.id };
    } catch (err) {
      console.error("❌ Error conectando con Google Tasks:", err);
      return { error: "No se pudo sincronizar con Google Tasks" };
    }
  }

  // 2. REGISTRAR COMIDA -> Se queda en Supabase (donde Google no llega)
  if (nombre === 'registrar_comida') {
    const { data, error } = await supabase
      .from('meals')
      .insert([{ user_id: userId, description: args.description, calories: args.calories, protein_g: args.protein_g }])
      .select();

    if (error) console.error("❌ Error en Supabase (meals):", error);
    else console.log("✅ Guardado en Supabase (meals):", data);

    return error ? { error: error.message } : { ok: true, comida_registrada: data[0] };
  }

  // 3. CONSULTAR ESTADO DEL DÍA -> Une las tareas de Google Tasks + Calorías de Supabase
  if (nombre === 'consultar_estado_dia') {
    // A) Leemos tus tareas reales de Google Tasks
    let tareasGoogle = [];
    try {
      const resG = await fetch(process.env.GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'leer_tareas' })
      });
      const dataG = await resG.json();
      tareasGoogle = dataG.tareas || [];
    } catch (e) {
      console.error("❌ Error leyendo Google Tasks:", e);
    }

    // B) Leemos tus comidas de hoy desde Supabase
    const { data: comidas } = await supabase
      .from('meals')
      .select('description, calories, protein_g')
      .eq('user_id', userId);

    return {
      tareas_pendientes_google_tasks: tareasGoogle,
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