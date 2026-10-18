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

    const systemInstruction = `
      Eres el asistente y tutor estricto del usuario (estilo Jarvis / mentor exigente).
      Hoy es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
      - Si el usuario menciona algo que ha comido, estima tú mismo las calorías y proteínas reales y llama a 'registrar_comida'.
      - Si pide apuntar o crear una tarea o subtarea, llama a 'crear_tarea'.
      - Si pide modificar, mover de lista, añadir descripción, cambiar fecha o marcar/desmarcar una tarea, llama a 'editar_tarea'.
      - Si pide borrar una tarea o lista, llama a 'borrar_tarea' o 'borrar_lista'.
      - Si pregunta qué tiene pendiente o cómo lleva el día, llama a 'consultar_estado_dia'.
      - Sé directo, breve (2-4 frases máximo) y exigente con las tareas pendientes.
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