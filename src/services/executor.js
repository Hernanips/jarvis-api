import { supabase } from '../config/clients.js';

export async function ejecutarHerramienta(nombre, args, userId) {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;

  // 1. ACCIONES DIRECTAS EN GOOGLE APPS SCRIPT (Listas de Tasks y Eventos de Calendar)
  const accionesDirectas = [
    'crear_lista', 'editar_lista', 'borrar_lista', 'limpiar_completadas',
    'crear_calendario', 'editar_calendario', 'borrar_calendario',
    'crear_evento', 'editar_evento', 'borrar_evento', 'consultar_calendario',
    'editar_tarea', 'borrar_tarea'
  ];

  if (accionesDirectas.includes(nombre)) {
    try {
      const url = new URL(scriptUrl);
      url.searchParams.append('accion', nombre);
      for (const [key, val] of Object.entries(args)) {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, String(val));
        }
      }
      const res = await fetch(url.toString());
      const datos = await res.json();
      console.log(`⚡ Google Bridge (${nombre}):`, datos);
      return datos;
    } catch (err) {
      console.error(`❌ Error en ${nombre}:`, err);
      return { error: `No se pudo ejecutar ${nombre}` };
    }
  }

  // 2. CREAR TAREA (Google Tasks + Copia en Supabase)
  if (nombre === 'crear_tarea') {
    try {
      const url = new URL(scriptUrl);
      url.searchParams.append('accion', 'crear_tarea');
      url.searchParams.append('title', args.title);
      url.searchParams.append('category', args.category || 'General');
      if (args.description) url.searchParams.append('description', args.description);
      if (args.due_date) url.searchParams.append('due_date', args.due_date);
      if (args.parent_title) url.searchParams.append('parent_title', args.parent_title);

      const respuestaGoogle = await fetch(url.toString());
      const datosGoogle = await respuestaGoogle.json();

      await supabase
        .from('tasks')
        .insert([{ user_id: userId, title: args.title, category: args.category, due_date: args.due_date }]);

      return datosGoogle;
    } catch (err) {
      return { error: "No se pudo sincronizar con Google Tasks" };
    }
  }

  // 3. REGISTRAR COMIDA EN SUPABASE
  if (nombre === 'registrar_comida') {
    const { data, error } = await supabase
      .from('meals')
      .insert([{ user_id: userId, description: args.description, calories: args.calories, protein_g: args.protein_g }])
      .select();

    return error ? { error: error.message } : { ok: true, comida_registrada: data[0] };
  }

  // 4. CONSULTAR ESTADO DEL DÍA (Tasks + Todos los Calendarios + Comidas de hoy)
  if (nombre === 'consultar_estado_dia') {
    let tareasGoogle = {};
    let eventosCalendario = {};
    try {
      const url = new URL(scriptUrl);
      url.searchParams.append('accion', 'leer_tareas');

      const resG = await fetch(url.toString());
      const dataG = await resG.json();
      tareasGoogle = dataG.tareas || {};
      eventosCalendario = dataG.eventos_calendario || {};
    } catch (e) {
      console.error("❌ Error leyendo Google Bridge:", e);
    }

    const hoy = new Date().toISOString().split('T')[0];
    const { data: comidas } = await supabase
      .from('meals')
      .select('description, calories, protein_g, created_at')
      .eq('user_id', userId)
      .gte('created_at', `${hoy}T00:00:00.000Z`);

    return {
      hoy_es: hoy,
      eventos_en_todos_los_calendarios: eventosCalendario,
      listas_google_tasks: tareasGoogle,
      comidas_registradas_hoy: comidas || []
    };
  }
}