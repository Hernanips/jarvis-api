const CAL_BASE = 'https://www.googleapis.com/calendar/v3';
const TASKS_BASE = 'https://www.googleapis.com/tasks/v1';

// Normalizador para ignorar tildes y mayúsculas ("Académico" == "academico")
function normalizar(texto) {
  return (texto || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

async function gFetch(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (res.status === 204) return {};
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    throw new Error('GOOGLE_TOKEN_EXPIRED');
  }
  if (!res.ok) {
    throw new Error(data.error?.message || `Error Google API (${res.status})`);
  }
  return data;
}

export async function ejecutarAccionGoogle(accion, args, googleToken) {
  if (!googleToken) {
    return {
      ok: false,
      error: 'Tu sesión de Google ha expirado o no tiene permisos. Pulsa en "Cerrar sesión" arriba a la derecha y vuelve a entrar con Google.'
    };
  }

  try {
    // Cargamos listas de Tasks y Calendarios del usuario autenticado
    const [listasRes, calsRes] = await Promise.all([
      gFetch(`${TASKS_BASE}/users/@me/lists?maxResults=100`, googleToken),
      gFetch(`${CAL_BASE}/users/me/calendarList`, googleToken)
    ]);

    const todasLasListas = listasRes.items || [];
    // Filtramos calendarios donde el usuario tiene permiso de escritura
    const misCalendarios = (calsRes.items || []).filter(
      c => c.accessRole === 'owner' || c.accessRole === 'writer'
    );

    // --- HELPERS INTERNOS ---
    function buscarCalendarioPorNombre(nombreCal) {
      if (!nombreCal) return misCalendarios.find(c => c.primary) || misCalendarios[0];
      const q = normalizar(nombreCal);
      if (['personal', 'principal', 'general', 'default', 'mio'].includes(q)) {
        return misCalendarios.find(c => c.primary) || misCalendarios[0];
      }
      for (const cal of misCalendarios) {
        const nombreActual = normalizar(cal.summaryOverride || cal.summary);
        if (nombreActual.includes(q) || q.includes(nombreActual)) {
          return cal;
        }
      }
      return null;
    }

    function buscarListaPorNombre(nombreCategoria) {
      const cat = normalizar(nombreCategoria);
      if (!cat || ['general', 'mis tareas', 'principal', 'default', 'my tasks'].includes(cat)) {
        return todasLasListas[0];
      }
      for (const lista of todasLasListas) {
        const tituloLista = normalizar(lista.title);
        if (tituloLista.includes(cat) || cat.includes(tituloLista)) {
          return lista;
        }
      }
      return null;
    }

    async function buscarTareaPorNombre(nombreBuscado) {
      const query = normalizar(nombreBuscado);
      let respaldoCompletada = null;

      for (const lista of todasLasListas) {
        const resT = await gFetch(
          `${TASKS_BASE}/lists/${encodeURIComponent(lista.id)}/tasks?showCompleted=true&showHidden=true&maxResults=100`,
          googleToken
        );
        const tareas = resT.items || [];
        for (const t of tareas) {
          if (normalizar(t.title).includes(query)) {
            if (t.status !== 'completed') {
              return { tarea: t, listaId: lista.id, listaNombre: lista.title };
            }
            if (!respaldoCompletada) {
              respaldoCompletada = { tarea: t, listaId: lista.id, listaNombre: lista.title };
            }
          }
        }
      }
      return respaldoCompletada;
    }

    async function buscarEventoEnTodos(nombreBuscado) {
      const query = normalizar(nombreBuscado);
      const timeMin = new Date(Date.now() - 365 * 86400000).toISOString();
      const timeMax = new Date(Date.now() + 365 * 86400000).toISOString();

      for (const cal of misCalendarios) {
        const url = `${CAL_BASE}/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true`;
        const resEv = await gFetch(url, googleToken);
        const eventos = resEv.items || [];
        for (const ev of eventos) {
          if (normalizar(ev.summary).includes(query)) {
            return { evento: ev, calendario: cal };
          }
        }
      }
      return null;
    }

    function construirRRULE(tipo, intervalo, diasSemanaStr) {
      const t = (tipo || '').toUpperCase().trim();
      if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(t)) return null;
      const intVal = Number(intervalo) || 1;
      let rrule = `RRULE:FREQ=${t};INTERVAL=${intVal}`;
      if (t === 'WEEKLY' && diasSemanaStr) {
        const mapa = {
          MONDAY: 'MO', TUESDAY: 'TU', WEDNESDAY: 'WE',
          THURSDAY: 'TH', FRIDAY: 'FR', SATURDAY: 'SA', SUNDAY: 'SU'
        };
        const dias = String(diasSemanaStr)
          .split(',')
          .map(d => mapa[d.trim().toUpperCase()])
          .filter(Boolean);
        if (dias.length > 0) rrule += `;BYDAY=${dias.join(',')}`;
      }
      return [rrule];
    }

    function formatearFechaHoraEvento(str, sumarUnaHora = false, refInicio = null) {
      if (!str && refInicio) {
        const d = new Date(new Date(refInicio).getTime() + 3600000);
        return { dateTime: d.toISOString(), timeZone: 'Europe/Madrid' };
      }
      const limpio = String(str).trim();
      if (!limpio.includes('T')) {
        if (sumarUnaHora) {
          // En Google Calendar REST API el end.date de todo el día es exclusivo (+1 día)
          const [y, m, d] = limpio.split('-').map(Number);
          const nextDay = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().substring(0, 10);
          return { date: nextDay };
        }
        return { date: limpio.substring(0, 10) };
      }
      // Si viene YYYY-MM-DDTHH:mm le añadimos segundos
      const isoLocal = limpio.length === 16 ? `${limpio}:00` : limpio.replace('Z', '');
      return { dateTime: isoLocal, timeZone: 'Europe/Madrid' };
    }

    async function obtenerEventosTodosLosCalendarios(startStr, endStr) {
      let inicio = startStr
        ? new Date(`${startStr.substring(0, 10)}T00:00:00`)
        : new Date(Date.now() - 7 * 86400000);
      let limite = endStr
        ? new Date(`${endStr.substring(0, 10)}T23:59:59`)
        : new Date(inicio.getTime() + (startStr ? 7 : 37) * 86400000);

      const resumenCalendarios = {};

      await Promise.all(
        misCalendarios.map(async (cal) => {
          const etiquetaCal = cal.primary ? `Personal (${cal.summary})` : (cal.summaryOverride || cal.summary);
          const url = `${CAL_BASE}/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${encodeURIComponent(inicio.toISOString())}&timeMax=${encodeURIComponent(limite.toISOString())}&singleEvents=true&orderBy=startTime`;
          const resEv = await gFetch(url, googleToken);
          const eventos = resEv.items || [];

          resumenCalendarios[etiquetaCal] = eventos.map(ev => {
            const esTodoElDia = Boolean(ev.start?.date);
            let horario = '';
            if (esTodoElDia) {
              horario = `${ev.start.date} (Todo el día)`;
            } else {
              const ini = new Date(ev.start.dateTime);
              const fin = new Date(ev.end.dateTime);
              const fIni = ini.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 16);
              const fFin = fin.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });
              horario = `${fIni} a ${fFin}`;
            }
            const recTag = ev.recurringEventId ? ' 🔄(Recurrente)' : '';
            const desc = ev.description ? ` [Notas: ${ev.description}]` : '';
            return `${ev.summary || 'Sin título'}${recTag} -> ${horario}${desc}`;
          });
        })
      );

      return resumenCalendarios;
    }

    // ==========================================
    // 1. GESTIÓN DE CALENDARIOS
    // ==========================================
    if (accion === 'crear_calendario') {
      const nuevo = await gFetch(`${CAL_BASE}/calendars`, googleToken, {
        method: 'POST',
        body: JSON.stringify({
          summary: (args.title || '').trim(),
          description: args.description || '',
          timeZone: 'Europe/Madrid'
        })
      });
      return { ok: true, mensaje: `Calendario "${nuevo.summary}" creado` };
    }

    if (accion === 'editar_calendario') {
      const cal = buscarCalendarioPorNombre(args.search_title);
      if (!cal) return { ok: false, error: 'Calendario no encontrado' };
      const body = {};
      if (args.new_title) body.summary = args.new_title;
      if (args.description !== undefined) body.description = args.description;
      await gFetch(`${CAL_BASE}/calendars/${encodeURIComponent(cal.id)}`, googleToken, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      return { ok: true, mensaje: 'Calendario actualizado' };
    }

    if (accion === 'borrar_calendario') {
      const cal = buscarCalendarioPorNombre(args.title);
      if (!cal || cal.primary) return { ok: false, error: 'No se encontró o es el calendario principal' };
      await gFetch(`${CAL_BASE}/calendars/${encodeURIComponent(cal.id)}`, googleToken, {
        method: 'DELETE'
      });
      return { ok: true, mensaje: 'Calendario eliminado' };
    }

    // ==========================================
    // 2. EVENTOS DE CALENDARIO
    // ==========================================
    if (accion === 'crear_evento') {
      const calDestino = buscarCalendarioPorNombre(args.calendar_name);
      const esTodoElDia = args.start_time && !String(args.start_time).includes('T');

      const startObj = formatearFechaHoraEvento(args.start_time, false);
      let endObj;
      if (esTodoElDia) {
        endObj = formatearFechaHoraEvento(args.start_time, true);
      } else if (args.end_time) {
        endObj = formatearFechaHoraEvento(args.end_time, false);
      } else {
        // Por defecto +1 hora si no especifica hora de fin
        const [fechaP, horaP] = String(args.start_time).split('T');
        const [hh, mm] = (horaP || '09:00').split(':').map(Number);
        const hFin = String((hh + 1) % 24).padStart(2, '0');
        endObj = formatearFechaHoraEvento(`${fechaP}T${hFin}:${String(mm || 0).padStart(2, '0')}`, false);
      }

      const payload = {
        summary: args.title || 'Nuevo evento',
        description: args.description || '',
        location: args.location || '',
        start: startObj,
        end: endObj
      };

      const rrule = construirRRULE(args.recurrence_type, args.recurrence_interval, args.days_of_week);
      if (rrule) payload.recurrence = rrule;

      if (args.reminders) {
        const mins = String(args.reminders)
          .split(',')
          .map(m => Number(m.trim()))
          .filter(m => !isNaN(m) && m > 0);
        if (mins.length > 0) {
          payload.reminders = {
            useDefault: false,
            overrides: mins.map(m => ({ method: 'popup', minutes: m }))
          };
        }
      }

      await gFetch(`${CAL_BASE}/calendars/${encodeURIComponent(calDestino.id)}/events`, googleToken, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      return {
        ok: true,
        mensaje: `Evento "${payload.summary}" creado en el calendario "${calDestino.summaryOverride || calDestino.summary}"`
      };
    }

    if (accion === 'editar_evento') {
      const encontrado = await buscarEventoEnTodos(args.search_title);
      if (!encontrado) return { ok: false, error: 'Evento no encontrado' };

      let { evento: ev, calendario: calActual } = encontrado;
      const patch = {};

      if (args.new_title) patch.summary = args.new_title;
      if (args.description !== undefined) patch.description = args.description;
      if (args.location !== undefined) patch.location = args.location;

      if (args.start_time) {
        const esTodoElDia = !String(args.start_time).includes('T');
        patch.start = formatearFechaHoraEvento(args.start_time, false);
        if (esTodoElDia) {
          patch.end = formatearFechaHoraEvento(args.start_time, true);
        } else if (args.end_time) {
          patch.end = formatearFechaHoraEvento(args.end_time, false);
        } else {
          const [fechaP, horaP] = String(args.start_time).split('T');
          const [hh, mm] = (horaP || '09:00').split(':').map(Number);
          const hFin = String((hh + 1) % 24).padStart(2, '0');
          patch.end = formatearFechaHoraEvento(`${fechaP}T${hFin}:${String(mm || 0).padStart(2, '0')}`, false);
        }
      }

      if (args.reminder_minutes !== undefined) {
        const min = Number(args.reminder_minutes);
        if (!isNaN(min) && min > 0) {
          patch.reminders = {
            useDefault: false,
            overrides: [{ method: 'popup', minutes: min }]
          };
        }
      }

      const actualizado = await gFetch(
        `${CAL_BASE}/calendars/${encodeURIComponent(calActual.id)}/events/${encodeURIComponent(ev.id)}`,
        googleToken,
        { method: 'PATCH', body: JSON.stringify(patch) }
      );

      // Si pide moverlo a otro calendario
      if (args.calendar_name) {
        const nuevoCal = buscarCalendarioPorNombre(args.calendar_name);
        if (nuevoCal && nuevoCal.id !== calActual.id) {
          await gFetch(
            `${CAL_BASE}/calendars/${encodeURIComponent(calActual.id)}/events/${encodeURIComponent(ev.id)}/move?destination=${encodeURIComponent(nuevoCal.id)}`,
            googleToken,
            { method: 'POST' }
          );
          calActual = nuevoCal;
        }
      }

      return {
        ok: true,
        mensaje: `Evento "${actualizado.summary}" actualizado en "${calActual.summaryOverride || calActual.summary}"`
      };
    }

    if (accion === 'borrar_evento') {
      const encontrado = await buscarEventoEnTodos(args.title);
      if (!encontrado) return { ok: false, error: 'Evento no encontrado' };
      const { evento: ev, calendario: cal } = encontrado;
      const targetId = args.delete_series && ev.recurringEventId ? ev.recurringEventId : ev.id;

      await gFetch(
        `${CAL_BASE}/calendars/${encodeURIComponent(cal.id)}/events/${encodeURIComponent(targetId)}`,
        googleToken,
        { method: 'DELETE' }
      );
      return { ok: true, mensaje: `Evento "${ev.summary}" eliminado` };
    }

    if (accion === 'consultar_calendario') {
      return {
        ok: true,
        calendarios_disponibles: misCalendarios.map(c => c.primary ? `Personal (${c.summary})` : (c.summaryOverride || c.summary)),
        eventos_por_calendario: await obtenerEventosTodosLosCalendarios(args.start_date, args.end_date)
      };
    }

    // ==========================================
    // 3. GOOGLE TASKS
    // ==========================================
    if (accion === 'crear_lista') {
      const nueva = await gFetch(`${TASKS_BASE}/users/@me/lists`, googleToken, {
        method: 'POST',
        body: JSON.stringify({ title: (args.title || '').trim() })
      });
      return { ok: true, mensaje: `Lista "${nueva.title}" creada` };
    }

    if (accion === 'editar_lista') {
      const lista = buscarListaPorNombre(args.search_title);
      if (!lista) return { ok: false, error: 'Lista no encontrada' };
      await gFetch(`${TASKS_BASE}/users/@me/lists/${encodeURIComponent(lista.id)}`, googleToken, {
        method: 'PATCH',
        body: JSON.stringify({ title: (args.new_title || '').trim() })
      });
      return { ok: true, mensaje: 'Lista actualizada' };
    }

    if (accion === 'borrar_lista') {
      const lista = buscarListaPorNombre(args.title);
      if (!lista) return { ok: false, error: 'Lista no encontrada' };
      await gFetch(`${TASKS_BASE}/users/@me/lists/${encodeURIComponent(lista.id)}`, googleToken, {
        method: 'DELETE'
      });
      return { ok: true, mensaje: 'Lista eliminada' };
    }

    if (accion === 'limpiar_completadas') {
      const lista = buscarListaPorNombre(args.category) || todasLasListas[0];
      await gFetch(`${TASKS_BASE}/lists/${encodeURIComponent(lista.id)}/clear`, googleToken, {
        method: 'POST'
      });
      return { ok: true, mensaje: 'Tareas completadas limpiadas' };
    }

    if (accion === 'crear_tarea') {
      let listaDestino = todasLasListas[0];
      let parentId = null;

      if (args.parent_title) {
        const padre = await buscarTareaPorNombre(args.parent_title);
        if (padre) {
          listaDestino = { id: padre.listaId, title: padre.listaNombre };
          parentId = padre.tarea.id;
        }
      } else {
        const encontrada = buscarListaPorNombre(args.category);
        if (encontrada) listaDestino = encontrada;
      }

      const body = {
        title: args.title || 'Nueva tarea',
        notes: args.description || ''
      };
      if (args.due_date && /^\d{4}-\d{2}-\d{2}/.test(args.due_date)) {
        body.due = `${args.due_date.substring(0, 10)}T09:00:00.000Z`;
      }

      const queryParams = parentId ? `?parent=${encodeURIComponent(parentId)}` : '';
      const creada = await gFetch(
        `${TASKS_BASE}/lists/${encodeURIComponent(listaDestino.id)}/tasks${queryParams}`,
        googleToken,
        { method: 'POST', body: JSON.stringify(body) }
      );

      return {
        ok: true,
        mensaje: `Tarea "${creada.title}" creada en la lista "${listaDestino.title}"`,
        detalles_guardados: body.notes,
        id: creada.id
      };
    }

    if (accion === 'editar_tarea') {
      const encontrada = await buscarTareaPorNombre(args.search_title);
      if (!encontrada) return { ok: false, error: 'No se encontró la tarea' };

      const { tarea: t, listaId, listaNombre } = encontrada;
      const nuevoTitulo = (args.new_title || t.title).replace(/^\[.*?\]\s*/, '');
      const nuevasNotas = args.description !== undefined ? args.description : (t.notes || '');
      const nuevaFecha = (args.due_date && /^\d{4}-\d{2}-\d{2}/.test(args.due_date))
        ? `${args.due_date.substring(0, 10)}T09:00:00.000Z`
        : t.due;

      let nuevoEstado = t.status || 'needsAction';
      if (args.completed === true || args.completed === 'true') nuevoEstado = 'completed';
      if (args.completed === false || args.completed === 'false') nuevoEstado = 'needsAction';

      if (args.new_category) {
        const nuevaLista = buscarListaPorNombre(args.new_category);
        if (!nuevaLista) return { ok: false, error: `No existe la lista "${args.new_category}"` };

        if (nuevaLista.id !== listaId) {
          const payload = { title: nuevoTitulo, notes: nuevasNotas, status: nuevoEstado };
          if (nuevaFecha) payload.due = nuevaFecha;
          await gFetch(`${TASKS_BASE}/lists/${encodeURIComponent(nuevaLista.id)}/tasks`, googleToken, {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          await gFetch(`${TASKS_BASE}/lists/${encodeURIComponent(listaId)}/tasks/${encodeURIComponent(t.id)}`, googleToken, {
            method: 'DELETE'
          });
          return {
            ok: true,
            mensaje: `Tarea "${nuevoTitulo}" movida de "${listaNombre}" a "${nuevaLista.title}"`
          };
        }
      }

      const patch = {
        title: nuevoTitulo,
        notes: nuevasNotas,
        status: nuevoEstado,
        completed: nuevoEstado === 'needsAction' ? null : t.completed
      };
      if (nuevaFecha) patch.due = nuevaFecha;

      await gFetch(`${TASKS_BASE}/lists/${encodeURIComponent(listaId)}/tasks/${encodeURIComponent(t.id)}`, googleToken, {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });

      return { ok: true, mensaje: `Tarea "${nuevoTitulo}" actualizada en "${listaNombre}"` };
    }

    if (accion === 'borrar_tarea') {
      const encontrada = await buscarTareaPorNombre(args.title);
      if (!encontrada) return { ok: false, error: 'Tarea no encontrada' };
      await gFetch(
        `${TASKS_BASE}/lists/${encodeURIComponent(encontrada.listaId)}/tasks/${encodeURIComponent(encontrada.tarea.id)}`,
        googleToken,
        { method: 'DELETE' }
      );
      return { ok: true, mensaje: 'Tarea eliminada' };
    }

    if (accion === 'leer_tareas') {
      const resumenPorCajon = {};
      await Promise.all(
        todasLasListas.map(async (lista) => {
          const resT = await gFetch(
            `${TASKS_BASE}/lists/${encodeURIComponent(lista.id)}/tasks?showCompleted=true&showHidden=true&maxResults=100`,
            googleToken
          );
          const tareasLista = resT.items || [];
          resumenPorCajon[lista.title] = tareasLista.map(t => {
            const estado = t.status === 'completed' ? '[HECHA]' : '[PENDIENTE]';
            const esSubtarea = t.parent ? '  ↳ (Subtarea) ' : '';
            const fecha = t.due ? ` (Fecha: ${t.due.substring(0, 10)})` : '';
            const notas = t.notes ? ` [Detalles: ${t.notes}]` : '';
            return `${esSubtarea}${estado} ${t.title}${fecha}${notas}`;
          });
        })
      );

      return {
        ok: true,
        listas_disponibles: todasLasListas.map(l => l.title),
        calendarios_disponibles: misCalendarios.map(c => c.primary ? `Personal (${c.summary})` : (c.summaryOverride || c.summary)),
        tareas: resumenPorCajon,
        eventos_calendario: await obtenerEventosTodosLosCalendarios()
      };
    }

    return { ok: false, error: 'Acción no reconocida' };
  } catch (err) {
    console.error(`❌ Error Google API (${accion}):`, err.message);
    if (err.message === 'GOOGLE_TOKEN_EXPIRED') {
      return {
        ok: false,
        google_expired: true,
        error: 'GOOGLE_TOKEN_EXPIRED: El token de Google ha caducado (dura 1h).'
      };
    }
    return { ok: false, error: err.message };
  }
}