import { supabase } from '../config/clients.js';

const STRAVA_API = 'https://www.strava.com/api/v3';

function formatearRitmo(metros, segundos, tipo) {
  if (!metros || !segundos || metros <= 0) return 'N/A';
  const km = metros / 1000;
  // Para ciclismo mostramos km/h
  if (/ride|bike|cycling/i.test(tipo)) {
    const horas = segundos / 3600;
    return `${(km / horas).toFixed(1)} km/h`;
  }
  // Para correr/caminar mostramos min/km (ej: 5:12 /km)
  const minPorKm = (segundos / 60) / km;
  const min = Math.floor(minPorKm);
  const seg = Math.round((minPorKm - min) * 60);
  return `${min}:${String(seg === 60 ? 0 : seg).padStart(2, '0')} /km`;
}

function formatearDuracion(segundos) {
  const s = Number(segundos) || 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec}s`;
}

// Obtiene un access_token válido de Strava (renovándolo automáticamente si ha caducado)
export async function obtenerTokenStravaValido(userId) {
  const { data: fila, error } = await supabase
    .from('user_strava_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !fila) return null;

  const ahoraSegundos = Math.floor(Date.now() / 1000);
  // Si aún le quedan más de 5 minutos de vida, lo usamos directamente
  if (fila.expires_at && fila.expires_at > ahoraSegundos + 300) {
    return fila.access_token;
  }

  // Si ha caducado, lo renovamos en segundo plano con el refresh_token
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: (process.env.STRAVA_CLIENT_ID || '').trim(),
      client_secret: (process.env.STRAVA_CLIENT_SECRET || '').trim(),
      grant_type: 'refresh_token',
      refresh_token: fila.refresh_token
    })
  });

  const nuevo = await res.json().catch(() => ({}));
  if (!res.ok || !nuevo.access_token) {
    console.error('❌ Error renovando token de Strava:', nuevo);
    return null;
  }

  await supabase
    .from('user_strava_tokens')
    .update({
      access_token: nuevo.access_token,
      refresh_token: nuevo.refresh_token || fila.refresh_token,
      expires_at: nuevo.expires_at,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  return nuevo.access_token;
}

// Intercambia el código temporal del login de Strava por los tokens definitivos
export async function intercambiarCodigoStrava(userId, code) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: (process.env.STRAVA_CLIENT_ID || '').trim(),
      client_secret: (process.env.STRAVA_CLIENT_SECRET || '').trim(),
      code: code.trim(),
      grant_type: 'authorization_code'
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.message || 'Error al vincular con Strava');
  }

  const { error } = await supabase
    .from('user_strava_tokens')
    .upsert({
      user_id: userId,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete_id: data.athlete?.id || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) throw new Error(error.message);
  return true;
}

// Consulta las actividades recientes de Strava del usuario
export async function consultarEntrenosStrava(userId, args = {}) {
  try {
    const token = await obtenerTokenStravaValido(userId);
    if (!token) {
      return {
        conectado: false,
        mensaje: 'Strava aún no está conectado. El usuario puede vincularlo pulsando el icono de Strava arriba a la derecha en la app.'
      };
    }

    const cantidad = Math.min(Number(args.limit) || 10, 30);
    const res = await fetch(`${STRAVA_API}/athlete/activities?per_page=${cantidad}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      return { conectado: false, error: `Error Strava API (${res.status})` };
    }

    const lista = await res.json();

    // Si pide el detalle profundo de la última actividad (para leer notas/ejercicios de gym o calorías exactas)
    let detalleUltima = null;
    if (args.include_latest_details && lista.length > 0) {
      const detRes = await fetch(`${STRAVA_API}/activities/${lista[0].id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (detRes.ok) detalleUltima = await detRes.json();
    }

    const actividadesFormateadas = lista.map((act, idx) => {
      const esPrimeraConDetalle = idx === 0 && detalleUltima;
      const fuente = esPrimeraConDetalle ? detalleUltima : act;
      const km = fuente.distance ? Number((fuente.distance / 1000).toFixed(2)) : 0;

      return {
        id: fuente.id,
        titulo: fuente.name,
        deporte: fuente.sport_type || fuente.type,
        fecha: (fuente.start_date_local || '').replace('T', ' ').replace('Z', ''),
        distancia_km: km,
        tiempo_movimiento: formatearDuracion(fuente.moving_time),
        ritmo_o_velocidad: formatearRitmo(fuente.distance, fuente.moving_time, fuente.sport_type || fuente.type),
        desnivel_m: Math.round(fuente.total_elevation_gain || 0),
        pulsaciones_medias: fuente.average_heartrate ? Math.round(fuente.average_heartrate) : null,
        pulsaciones_maximas: fuente.max_heartrate ? Math.round(fuente.max_heartrate) : null,
        esfuerzo_relativo: fuente.suffer_score || null,
        calorias_quemadas: fuente.calories || (fuente.kilojoules ? Math.round(fuente.kilojoules) : null),
        notas_descripcion: fuente.description || null
      };
    });

    return {
      conectado: true,
      total_actividades_devueltas: actividadesFormateadas.length,
      entrenos: actividadesFormateadas
    };
  } catch (err) {
    console.error('❌ Error en consultarEntrenosStrava:', err.message);
    return { conectado: false, error: err.message };
  }
}