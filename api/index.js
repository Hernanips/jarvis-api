import { supabase, ai } from '../src/config/clients.js';
import { assistantTools } from '../src/tools/declarations.js';
import { ejecutarHerramienta } from '../src/services/executor.js';
import { intercambiarCodigoStrava } from '../src/services/stravaApi.js';

// Modelo único fijo para todo el servidor (chat y voz)
const MODELO_GEMINI = 'gemini-3.5-flash-lite';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      supabaseUrl: (process.env.SUPABASE_URL || '').trim(),
      supabaseAnonKey: (process.env.SUPABASE_KEY || '').trim(),
      stravaClientId: (process.env.STRAVA_CLIENT_ID || '').trim()
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

      if (googleRefreshToken) {
        await supabase
          .from('user_google_tokens')
          .upsert(
            {
              user_id: userId,
              refresh_token: googleRefreshToken,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'user_id' }
          );
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

      // 1. Ping exclusivo para sincronizar el refresh_token y comprobar estado de Strava
      if (body.syncTokenOnly) {
        const { data: st } = await supabase
          .from('user_strava_tokens')
          .select('user_id')
          .eq('user_id', userId)
          .single();
        return res.status(200).json({ ok: true, stravaConnected: Boolean(st) });
      }

      // 1b. Canjear código OAuth de Strava al volver de autorizar
      if (body.mode === 'strava_exchange' && body.code) {
        await intercambiarCodigoStrava(userId, body.code);
        return res.status(200).json({ ok: true, stravaConnected: true });
      }

      // 2. Gestión directa del panel visual de Memorias
      if (body.mode === 'list_memories') {
        const { data: mems } = await supabase
          .from('user_memories')
          .select('id, category, fact, updated_at')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });
        return res.status(200).json({ memories: mems || [] });
      }

      if (body.mode === 'delete_memory' && body.memoryId) {
        await supabase
          .from('user_memories')
          .delete()
          .eq('id', body.memoryId)
          .eq('user_id', userId);
        return res.status(200).json({ ok: true });
      }

      // 3. Transcripción de voz usando el mismo modelo fijo que ya funciona
      if (body.mode === 'transcribe' && body.audioBase64) {
        const cleanMime = (body.mimeType || 'audio/webm').split(';')[0];
        const transResponse = await ai.models.generateContent({
          model: MODELO_GEMINI,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: cleanMime,
                    data: body.audioBase64
                  }
                },
                {
                  text: 'Transcribe exactamente en español lo que dice este audio. Pon puntuación perfecta y natural: comas, puntos y signos de interrogación (¿?) o exclamación (¡!) según la entonación y el sentido de la frase. NO respondas a la pregunta ni añadas texto extra ni comillas: devuelve ÚNICAMENTE la transcripción limpia. Si solo hay silencio o ruido sin palabras, devuelve exactamente una cadena vacía.'
                }
              ]
            }
          ]
        });

        return res.status(200).json({
          transcript: (transResponse.text || '').trim()
        });
      }

      // 4. Cargamos la Memoria a Largo Plazo del usuario
      const { data: memoriasUsuario } = await supabase
        .from('user_memories')
        .select('category, fact')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(40);

      const bloqueMemoriaTexto = (memoriasUsuario && memoriasUsuario.length > 0)
        ? memoriasUsuario.map(m => `- [${m.category}] ${m.fact}`).join('\n')
        : 'Aún no hay recuerdos registrados sobre el usuario.';

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

        === MEMORIA A LARGO PLAZO DEL USUARIO (ESTILO CLAUDE) ===
        Estos son los objetivos, carreras, contexto personal, metas y datos que ya conoces del usuario de conversaciones pasadas. Úsalos de forma natural cuando tengan relación con lo que te pregunta (sin decir "según mi base de datos"):
        ${bloqueMemoriaTexto}
        =========================================================

        - MEMORIA PROACTIVA AUTOMÁTICA: Cuando el usuario mencione en la conversación cualquier dato nuevo relevante sobre su vida, metas deportivas (ej. próximas carreras 5K/8K/Media Maratón, tiempos objetivo, pulsaciones), objetivos físicos/nutricionales, estudios, proyectos o preferencias, llama SIEMPRE por iniciativa propia a 'guardar_memoria' (o a 'actualizar_memoria' si cambia un objetivo que ya estaba en la lista de arriba) ANTES de darle tu respuesta final. Convierte referencias relativas de tiempo ("en dos semanas", "en enero") a fechas concretas sabiendo que hoy es ${fechaLegible}. No hace falta que el usuario te pida "guarda esto".
        - ENTRENAMIENTOS Y STRAVA: Tienes conexión directa con el perfil de Strava del usuario mediante 'consultar_entrenos_strava'. Úsala cuando pregunte por sus entrenamientos, carreras, gimnasio, bici, ritmos, pulsaciones o cómo va para sus objetivos deportivos. Analiza sus pulsaciones, ritmos y notas con criterio de entrenador exigente.
        - REGLA DE ORO DE TAREAS/EVENTOS: NUNCA crees tareas en Google Tasks ni eventos en Google Calendar automáticamente a menos que el usuario te lo pida de forma explícita.
        - LECTURA DE TAREAS Y CALENDARIO: Siempre que el usuario pregunte por sus tareas, eventos, qué tiene hoy/mañana o cómo lleva el día, llama a 'consultar_estado_dia' o 'consultar_calendario'. Si el resultado devuelve 'google_conectado: false', dile exactamente el mensaje de 'error_google'.
        - DETALLES Y DESCRIPCIONES: Cuando el usuario pida crear o editar una tarea/evento incluyendo una descripción, nota o detalles adicionales, pasa SIEMPRE ese texto en el parámetro 'description'.
        - NUTRICIÓN: Si menciona algo que ha comido, estima calorías y proteínas y llama a 'registrar_comida'. Si se equivoca o quiere corregir/borrar una comida, usa 'editar_comida' o 'borrar_comida'.
        - Sé directo, breve (2-4 frases máximo) y exigente.
      `;

      let contents = [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ];

      let response = await ai.models.generateContent({
        model: MODELO_GEMINI,
        contents,
        config: { systemInstruction, tools: assistantTools }
      });

      let refreshedGoogleToken = null;
      let memorySavedCount = 0;

      while (response.functionCalls && response.functionCalls.length > 0) {
        contents.push(response.candidates[0].content);

        const functionResponseParts = [];
        for (const call of response.functionCalls) {
          if (call.name === 'guardar_memoria' || call.name === 'actualizar_memoria') {
            memorySavedCount++;
          }

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
          model: MODELO_GEMINI,
          contents,
          config: { systemInstruction, tools: assistantTools }
        });
      }

      return res.status(200).json({
        reply: response.text,
        newGoogleToken: refreshedGoogleToken || null,
        memoryUpdated: memorySavedCount > 0
      });
    } catch (error) {
      console.error("❌ Error crítico en el servidor:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}