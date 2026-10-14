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
        description: 'Guarda una nueva tarea pendiente de la universidad, proyectos o personal.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Nombre claro de la tarea (ej: Terminar lámina de color)' },
            category: { type: Type.STRING, description: 'Categoría: uni, proyecto o personal' },
            due_date: { type: Type.STRING, description: 'Fecha límite o día (ej: mañana, viernes, 2026-10-16)' }
          },
          required: ['title', 'category']
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
  if (nombre === 'crear_tarea') {
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ user_id: userId, title: args.title, category: args.category, due_date: args.due_date }])
      .select();
      
    // 🔍 AÑADE ESTO AQUÍ
    if (error) console.error("❌ Error en Supabase (tasks):", error);
    else console.log("✅ Guardado en Supabase (tasks):", data);

    return error ? { error: error.message } : { ok: true, tarea_creada: data[0] };
  }

  if (nombre === 'registrar_comida') {
    const { data, error } = await supabase
      .from('meals')
      .insert([{ user_id: userId, description: args.description, calories: args.calories, protein_g: args.protein_g }])
      .select();
      
    // 🔍 Y AÑADE ESTO AQUÍ TAMBIÉN
    if (error) console.error("❌ Error en Supabase (meals):", error);
    else console.log("✅ Guardado en Supabase (meals):", data);

    return error ? { error: error.message } : { ok: true, comida_registrada: data[0] };
  }

  if (nombre === 'consultar_estado_dia') {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('title, category, due_date')
      .eq('user_id', userId)
      .eq('completed', false);

    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);

    const { data: meals } = await supabase
      .from('meals')
      .select('description, calories, protein_g')
      .eq('user_id', userId)
      .gte('created_at', hoyInicio.toISOString());

    const totalKcal = (meals || []).reduce((sum, m) => sum + m.calories, 0);
    const totalProt = (meals || []).reduce((sum, m) => sum + m.protein_g, 0);

    return {
      tareas_pendientes: tasks || [],
      comidas_hoy: meals || [],
      resumen_nutricional_hoy: { calorias_totales: totalKcal, proteina_total_g: totalProt }
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