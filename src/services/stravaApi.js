import { supabase } from '../config/clients.js';

const STRAVA_API = 'https://www.strava.com/api/v3';

function formatearRitmo(metros, segundos, tipo) {
  if (!metros || !segundos || metros <= 0) return 'N/A';
  const km = metros / 1000;
  if (/ride|bike|cycling/i.test(tipo)) {
    const horas = segundos / 3600;
    return `${(km / horas).toFixed(1)} km/h`;
  }
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
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

export async function obtenerDatosStravaValidos(userId) {
  const { data: fila, error } = await supabase
    .from('user_strava_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !fila) return null;

  const ahoraSegundos = Math.floor(Date.now() / 1000);
  if (fila.expires_at && fila.expires_at > ahoraSegundos + 300) {
    return { token: fila.access_token, athleteId: fila.athlete_id };
  }

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

  return { token: nuevo.access_token, athleteId: fila.athlete_id };
}

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

export async function consultarEntrenosStrava(userId, args = {}) {
  try {
    const authData = await obtenerDatosStravaValidos(userId);
    if (!authData?.token) {
      return {
        conectado: false,
        mensaje: 'Strava aún no está conectado. El usuario puede vincularlo pulsando el icono de Strava arriba a la derecha.'
      };
    }

    const { token, athleteId } = authData;
    // Permitimos traer hasta 200 actividades de golpe para analizar TODO el historial
    const cantidad = Math.min(Number(args.limit) || 60, 200);

    const promesas = [
      fetch(`${STRAVA_API}/athlete/activities?per_page=${cantidad}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ];

    // Descargamos también las estadísticas globales históricas del atleta (totales de carrera y bici)
    if (athleteId) {
      promesas.push(
        fetch(`${STRAVA_API}/athletes/${athleteId}/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );
    }

    const [resAct, resStats] = await Promise.all(promesas);
    if (!resAct.ok) {
      return { conectado: false, error: `Error Strava API (${resAct.status})` };
    }

    let lista = await resAct.json();
    const statsRaw = resStats && resStats.ok ? await resStats.json() : null;

    // Filtro opcional por deporte (ej: "Run", "Ride", "WeightTraining")
    if (args.sport_filter && args.sport_filter !== 'ALL') {
      const f = args.sport_filter.toLowerCase();
      lista = lista.filter(a => {
        const tipo = `${a.sport_type || ''} ${a.type || ''}`.toLowerCase();
        return tipo.includes(f);
      });
    }

    // Descargamos el detalle profundo (parciales por km, mejores esfuerzos, descripción, calorías) de las últimas 3 actividades
    const numDetalles = args.include_latest_details ? Math.min(3, lista.length) : 0;
    const detallesMap = {};

    if (numDetalles > 0) {
      await Promise.all(
        lista.slice(0, numDetalles).map(async (act) => {
          try {
            const detRes = await fetch(`${STRAVA_API}/activities/${act.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (detRes.ok) {
              detallesMap[act.id] = await detRes.json();
            }
          } catch (e) {}
        })
      );
    }

    const actividadesFormateadas = lista.map((act) => {
      const fuente = detallesMap[act.id] || act;
      const km = fuente.distance ? Number((fuente.distance / 1000).toFixed(2)) : 0;
      const cadenciaPasosPorMin = fuente.average_cadence
        ? (/run/i.test(fuente.sport_type || fuente.type) ? Math.round(fuente.average_cadence * 2) : Math.round(fuente.average_cadence))
        : null;

      const item = {
        id: fuente.id,
        titulo: fuente.name,
        deporte: fuente.sport_type || fuente.type,
        fecha: (fuente.start_date_local || '').replace('T', ' ').replace('Z', ''),
        distancia_km: km,
        tiempo_movimiento: formatearDuracion(fuente.moving_time),
        tiempo_total_con_pausas: formatearDuracion(fuente.elapsed_time),
        ritmo_medio: formatearRitmo(fuente.distance, fuente.moving_time, fuente.sport_type || fuente.type),
        ritmo_maximo: fuente.max_speed ? formatearRitmo(fuente.max_speed, 1, fuente.sport_type || fuente.type) : null,
        desnivel_positivo_m: Math.round(fuente.total_elevation_gain || 0),
        pulsaciones_medias: fuente.average_heartrate ? Math.round(fuente.average_heartrate) : null,
        pulsaciones_maximas: fuente.max_heartrate ? Math.round(fuente.max_heartrate) : null,
        cadencia_media: cadenciaPasosPorMin,
        watts_medios: fuente.average_watts ? Math.round(fuente.average_watts) : null,
        watts_maximos: fuente.max_watts || null,
        esfuerzo_relativo_suffer_score: fuente.suffer_score || null,
        records_personales_pr_count: fuente.pr_count || 0,
        calorias_quemadas: fuente.calories || (fuente.kilojoules ? Math.round(fuente.kilojoules) : null),
        notas_descripcion: fuente.description || null
      };

      // Si tenemos el detalle profundo, añadimos parciales por km (splits_metric) y mejores marcas de la sesión (best_efforts)
      if (detallesMap[act.id]) {
        if (Array.isArray(fuente.splits_metric) && fuente.splits_metric.length > 0) {
          item.parciales_por_km = fuente.splits_metric.map(sp => ({
            km: sp.split,
            ritmo: formatearRitmo(sp.distance, sp.moving_time, fuente.sport_type || fuente.type),
            fc_media: sp.average_heartrate ? Math.round(sp.average_heartrate) : null,
            desnivel_m: Math.round(sp.elevation_difference || 0)
          }));
        }
        if (Array.isArray(fuente.best_efforts) && fuente.best_efforts.length > 0) {
          item.mejores_esfuerzos_sesion = fuente.best_efforts.map(be => ({
            distancia: be.name,
            tiempo: formatearDuracion(be.elapsed_time)
          }));
        }
      }

      return item;
    });

    // Calculamos analítica automática de progresión en carreras (Run) para responder preguntas sobre mejora de pulsaciones/ritmos
    const soloCarreras = actividadesFormateadas.filter(a => /run/i.test(a.deporte) && a.distancia_km > 0.5);
    let analisisEvolucionCarreras = null;

    if (soloCarreras.length >= 2) {
      const mitad = Math.ceil(soloCarreras.length / 2);
      const recientes = soloCarreras.slice(0, mitad); // Más recientes
      const antiguas = soloCarreras.slice(mitad);    // Más antiguas

      const mediaFC = (arr, campo) => {
        const validos = arr.filter(x => x[campo]);
        if (!validos.length) return null;
        return Math.round(validos.reduce((acc, x) => acc + x[campo], 0) / validos.length);
      };

      const maxFCHistorica = Math.max(...soloCarreras.map(x => x.pulsaciones_maximas || 0));

      analisisEvolucionCarreras = {
        total_carreras_analizadas: soloCarreras.length,
        pulsaciones_maximas_pico_historico: maxFCHistorica > 0 ? maxFCHistorica : null,
        comparativa_recientes_vs_antiguas: {
          fc_media_ultimas_carreras: mediaFC(recientes, 'pulsaciones_medias'),
          fc_media_carreras_antiguas: mediaFC(antiguas, 'pulsaciones_medias'),
          fc_maxima_promedio_recientes: mediaFC(recientes, 'pulsaciones_maximas'),
          fc_maxima_promedio_antiguas: mediaFC(antiguas, 'pulsaciones_maximas')
        }
      };
    }

    const resumenEstadisticasHistoricas = statsRaw ? {
      ultimas_4_semanas_corriendo: {
        carreras: statsRaw.recent_run_totals?.count || 0,
        km_totales: Number(((statsRaw.recent_run_totals?.distance || 0) / 1000).toFixed(1)),
        desnivel_m: Math.round(statsRaw.recent_run_totals?.elevation_gain || 0)
      },
      historico_total_corriendo: {
        carreras: statsRaw.all_run_totals?.count || 0,
        km_totales: Number(((statsRaw.all_run_totals?.distance || 0) / 1000).toFixed(1))
      },
      historico_total_bici: {
        salidas: statsRaw.all_ride_totals?.count || 0,
        km_totales: Number(((statsRaw.all_ride_totals?.distance || 0) / 1000).toFixed(1))
      }
    } : null;

    return {
      conectado: true,
      total_actividades_analizadas: actividadesFormateadas.length,
      estadisticas_globales_atleta: resumenEstadisticasHistoricas,
      evolucion_pulsaciones_carreras: analisisEvolucionCarreras,
      entrenos: actividadesFormateadas
    };
  } catch (err) {
    console.error('❌ Error en consultarEntrenosStrava:', err.message);
    return { conectado: false, error: err.message };
  }
}