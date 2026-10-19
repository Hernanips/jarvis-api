import express from 'express';
import { ai } from './src/config/clients.js';
import { assistantTools } from './src/tools/declarations.js';
import { ejecutarHerramienta } from './src/services/executor.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.post('/api/assistant', async (req, res) => {
  try {
    // 🔒 CERROJO DE SEGURIDAD
    const clientPin = req.headers['x-jarvis-pin'];
    if (process.env.JARVIS_PIN && clientPin !== process.env.JARVIS_PIN) {
      return res.status(401).json({ error: '🔒 Acceso denegado. Clave incorrecta.' });
    }

    const { message, history = [], userId = 'usuario_principal' } = req.body;

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
      - Si pide agendar algo con hora específica (ej: "mañana de 17:00 a 19:00", "el viernes a las 10") o pregunta por su agenda/calendario, usa las herramientas de Google Calendar ('crear_evento', 'editar_evento', 'borrar_evento', 'consultar_calendario').
      - Si pide apuntar una tarea sin hora, modificarla, completarla o MOVERLA de una lista/cajón a otro (ej: "muévela a Pecera"), usa SIEMPRE 'editar_tarea' pasando 'search_title' y 'new_category'.
      - Si menciona algo que ha comido, estima las calorías y proteínas reales y llama a 'registrar_comida'.
      - Si pregunta qué tiene pendiente o cómo lleva el día, llama a 'consultar_estado_dia'.
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
  console.log(`🚀 Servidor Jarvis V2 escuchando en http://localhost:${PORT}`);
});