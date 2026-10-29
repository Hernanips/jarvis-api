import express from 'express';
import { supabase, ai } from '../src/config/clients.js';
import { assistantTools } from '../src/tools/declarations.js';
import { ejecutarHerramienta } from '../src/services/executor.js';

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
    const googleToken = req.headers['x-google-token'] || null;

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
      Eres el asistente y tutor estricto del usuario (estilo Jarvis / mentor exigente).
      Hoy es ${fechaLegible} y son las ${horaLegible}.
      - REGLA DE ORO: NUNCA crees tareas ni eventos automáticamente a menos que el usuario te lo pida de forma explícita.
      - CLASIFICACIÓN INTELIGENTE MULTIUSUARIO: Cada usuario tiene sus propios calendarios y listas de tareas. Antes de usar 'crear_evento' o 'crear_tarea', si en esta conversación aún no conoces los nombres exactos de los calendarios o listas del usuario, llama PRIMERO a 'consultar_estado_dia' para ver 'calendarios_disponibles_del_usuario' y 'listas_tasks_disponibles_del_usuario'. Analiza la naturaleza de lo que pide (ej. un examen, entrega o exposición va al calendario académico/estudios/uni; entrenar o partido va a deporte; etc.) y asigna SIEMPRE el calendario o lista existente que mejor encaje. Nunca lo metas en el general/personal si existe uno temático más específico.
      - DETALLES Y DESCRIPCIONES: Cuando el usuario pida crear o editar una tarea/evento incluyendo una descripción, nota o detalles adicionales, pasa SIEMPRE ese texto en el parámetro 'description'.
      - NUTRICIÓN: Si menciona algo que ha comido, estima calorías y proteínas y llama a 'registrar_comida'. Si se equivoca o quiere corregir/borrar una comida, usa 'editar_comida' o 'borrar_comida'.
      - Sé directo, breve (2-4 frases máximo) y exigente.
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
        const resultadoBD = await ejecutarHerramienta(call.name, call.args, userId, googleToken);

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

export default app;