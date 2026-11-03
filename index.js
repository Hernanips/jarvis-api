import express from 'express';
import { supabase, ai } from './src/config/clients.js';
import { assistantTools } from './src/tools/declarations.js';
import { ejecutarHerramienta } from './src/services/executor.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.post('/api/assistant', async (req, res) => {
  try {
    // 🔒 VERIFICACIÓN DE AUTENTICACIÓN MEDIANTE TOKEN DE SUPABASE
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '🔒 No autorizado. Inicia sesión.' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: '🔒 Sesión inválida o caducada.' });
    }

    const userId = user.id; // <-- ID único y seguro del usuario autenticado

    const { message, history = [] } = req.body;

    const ahora = new Date();
    const fechaLegible = ahora.toLocaleDateString('es-ES', {
      timeZone: 'Europe/Madrid',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const horaLegible = ahora.toLocaleTimeString('es-ES', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      minute: '2-digit'
    });

    const systemInstruction = `
      Eres Jarvis, el asistente personal inteligente del usuario.
      Hoy es ${fechaLegible} y son las ${horaLegible}.

      === MEMORIA A LARGO PLAZO DEL USUARIO ===
      Contexto, objetivos, carreras y datos que ya conoces del usuario de conversaciones pasadas (úsalos con naturalidad cuando vengan al caso):
      ${bloqueMemoriaTexto}
      =========================================

      TONO Y ESTILO DE RESPUESTA:
      - Habla de forma natural, cercana, inteligente y resolutiva (como un compañero o segundo cerebro de confianza, NUNCA como un general militar ni dando órdenes tipo "sin excusas" o "ponte ya").
      - Adapta la longitud a lo que pida el usuario: sé directo y conciso en gestiones rápidas del día a día, pero explayate con todo el detalle, desglose y profundidad necesarios cuando te pida análisis de entrenamientos, explicaciones, comparativas o planificaciones.

      REGLAS DE ACCIÓN EN GOOGLE TASKS Y CALENDAR:
        - AUTONOMÍA TOTAL AL REORGANIZAR (CERO PREGUNTAS): Cuando el usuario te pida reorganizar, repartir o planificar sus tareas pendientes entre varios días, NUNCA le preguntes cómo quiere distribuirlas ni le pidas confirmación. Actúa con iniciativa propia:
          1. Si aún no has leído sus tareas y su calendario en este turno, llama primero a 'consultar_estado_dia'.
          2. Analiza sus eventos de Google Calendar de esos días (clases, entrenamientos, compromisos) para ver qué tardes o mañanas tiene más despejadas.
          3. Decide tú mismo la distribución más equilibrada y lógica (priorizando las tareas con numeración más baja, más antiguas o más urgentes para hoy/mañana y equilibrando la carga según los huecos de su horario).
          4. Llama inmediatamente a 'editar_tarea' para cada una de las tareas cambiando su 'due_date' en Google Tasks.
          5. Por último, preséntale el resultado final ya aplicado explicándole brevemente por qué las has colocado así según su agenda.
        - NO INVENTAR TAREAS NO PEDIDAS: No crees tareas nuevas ni eventos desde cero si el usuario solo te está contando su vida[cite: 2]; créalos o edítalos siempre que te pida agendar, anotar, cambiar o reorganizar algo.
        - LECTURA PREVIA: Siempre que pregunte por sus tareas, eventos, qué tiene hoy/mañana o pida reorganizarlos y aún no los hayas leído en este turno, llama primero a 'consultar_estado_dia' o 'consultar_calendario'[cite: 2, 4]. Si devuelve 'google_conectado: false', muéstrale el mensaje de 'error_google'[cite: 5].
        - DETALLES Y DESCRIPCIONES: Cuando pida crear o editar una tarea/evento con notas o detalles, pásalos siempre en el parámetro 'description'[cite: 2, 4].
        
      MEMORIA Y MÓDULOS:
      - MEMORIA AUTOMÁTICA: Cuando el usuario mencione datos nuevos relevantes sobre su vida, metas deportivas, tiempos objetivo, estudios, proyectos o preferencias, llama por iniciativa propia a 'guardar_memoria' o 'actualizar_memoria' convirtiendo fechas relativas ("en dos semanas") a fechas reales según hoy (${fechaLegible}).
      - ENTRENAMIENTOS (STRAVA): Usa 'consultar_entrenos_strava' cuando pregunte por sus entrenamientos, carreras, bici, gimnasio, pulsaciones o evolución física, y dale un análisis completo y bien razonado.
      - NUTRICIÓN: Si menciona algo que ha comido, estima calorías y macros y llama a 'registrar_comida' (o 'editar_comida' / 'borrar_comida' para correcciones).
    `;

    let contents = [
      ...history,
      { role: 'user', parts: [{ text: message }] }
    ];

    let response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents,
      config: { systemInstruction, tools: assistantTools }
    });

    while (response.functionCalls && response.functionCalls.length > 0) {
      contents.push(response.candidates[0].content);

      const functionResponseParts = [];
      for (const call of response.functionCalls) {
        console.log(`🔧 Ejecutando herramienta para [${userId}]: ${call.name}`, call.args);
        
        // Pasamos el userId real a las herramientas para aislar los datos en Supabase
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

// Ruta para inyectar las credenciales públicas de Supabase de forma segura al frontend
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_KEY
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Jarvis Multi-usuario escuchando en http://localhost:${PORT}`);
});