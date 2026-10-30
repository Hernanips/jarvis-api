import { supabase, ai } from '../src/config/clients.js';
import { assistantTools } from '../src/tools/declarations.js';
import { ejecutarHerramienta } from '../src/services/executor.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      supabaseUrl: (process.env.SUPABASE_URL || '').trim(),
      supabaseAnonKey: (process.env.SUPABASE_KEY || '').trim()
    });
  }

  if (req.method === 'POST') {
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '🔒 No autorizado. Inicia sesión.' });
      }

      const token = authHeader.split(' ')[1];
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return res.status(401).json({ error: '🔒 Sesión inválida o caducada.' });
      }

      const userId = user.id;
      const googleToken = req.headers['x-google-token'] || null;
      const googleRefreshToken = req.headers['x-google-refresh-token'] || null;

      // Guardamos siempre el refresh_token de Google en Supabase cuando llega
      if (googleRefreshToken) {
        const { error: upsertErr } = await supabase
          .from('user_google_tokens')
          .upsert(
            {
              user_id: userId,
              refresh_token: googleRefreshToken,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'user_id' }
          );
        if (upsertErr) {
          console.error('❌ Error guardando en user_google_tokens:', upsertErr.message);
        }
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

      // 1. Ping exclusivo para sincronizar el refresh_token al iniciar sesión
      if (body.syncTokenOnly) {
        return res.status(200).json({ ok: true });
      }

      // 2. Transcripción de voz con puntuación, comas e interrogaciones reales por entonación
      if (body.mode === 'transcribe' && body.audioBase64) {
        const cleanMime = (body.mimeType || 'audio/webm').split(';')[0];
        const transResponse = await ai.models.generateContent({
          model: 'gemini-3.5-flash-lite',
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: cleanMime, data: body.audioBase64 } },
                {
                  text: 'Transcribe exactamente en español este audio con comas, puntos y signos de interrogación (¿?) o exclamación (¡!) según la entonación. Devuelve SOLO la transcripción limpia, sin comillas ni texto adicional. Si no hay voz, devuelve cadena vacía.'
                }
              ]
            }
          ],
          config: {
            temperature: 0,
            thinkingConfig: { thinkingBudget: 0 }
          }
        });

        return res.status(200).json({
          transcript: (transResponse.text || '').trim()
        });
      }

      // 3. Flujo normal de conversación con Jarvis
      const { message, history = [] } = body;

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
        - CLASIFICACIÓN INTELIGENTE MULTIUSUARIO: Cada usuario tiene sus propios calendarios y listas de tareas. Antes de usar 'crear_evento' o 'crear_tarea', si en esta conversación aún no conoces los nombres exactos de los calendarios o listas del usuario, llama PRIMERO a 'consultar_estado_dia' para ver 'calendarios_disponibles_del_usuario' y 'listas_tasks_disponibles_del_usuario'. Analiza la naturaleza de lo que pide y asigna SIEMPRE el calendario o lista existente que mejor encaje.
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

      let refreshedGoogleToken = null;

      while (response.functionCalls && response.functionCalls.length > 0) {
        contents.push(response.candidates[0].content);

        const functionResponseParts = [];
        for (const call of response.functionCalls) {
          const resultadoBD = await ejecutarHerramienta(
            call.name,
            call.args,
            userId,
            refreshedGoogleToken || googleToken,
            googleRefreshToken
          );

          if (resultadoBD && resultadoBD._newGoogleAccessToken) {
            refreshedGoogleToken = resultadoBD._newGoogleAccessToken;
          }

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

      return res.status(200).json({
        reply: response.text,
        newGoogleToken: refreshedGoogleToken || null
      });
    } catch (error) {
      console.error("❌ Error crítico en el servidor:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}