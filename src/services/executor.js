import { supabase } from '../config/clients.js';

export async function ejecutarHerramienta(nombre, args, userId) {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;

  // 1. ACCIONES DIRECTAS EN GOOGLE APPS SCRIPT (Tasks y Calendar)
  const accionesDirectas = [
    'crear_lista', 'editar_lista', 'borrar_lista', 'limpiar_completadas',
    'crear_calendario', 'editar_calendario', 'borrar_calendario',
    'crear_evento', 'editar_evento', 'borrar_evento', 'consultar_calendario',
    'crear_tarea', 'editar_tarea', 'borrar_tarea'
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

  // 2. REGISTRAR COMIDA EN SUPABASE
  if (nombre === 'registrar_comida') {
    const { data, error } = await supabase
      .from('meals')
      .insert([{
        user_id: userId,
        description: args.description,
        calories: Math.round(Number(args.calories) || 0),
        protein_g: Math.round(Number(args.protein_g) || 0)
      }])
      .select();

    return error ? { error: error.message } : { ok: true, comida_registrada: data[0] };
  }

  // 3. EDITAR COMIDA EN SUPABASE
  if (nombre === 'editar_comida') {
    const { data: encontradas, error: errBusq } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', userId)
      .ilike('description', `%${args.search_description}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (errBusq || !encontradas || encontradas.length === 0) {
      return { ok: false, error: `No se encontró ninguna comida que coincida con "${args.search_description}"` };
    }

    const comidaActual = encontradas[0];
    const cambios = {};
    if (args.new_description) cambios.description = args.new_description;
    if (args.calories !== undefined) cambios.calories = Math.round(Number(args.calories));
    if (args.protein_g !== undefined) cambios.protein_g = Math.round(Number(args.protein_g));

    const { data: actualizada, error: errUpd } = await supabase
      .from('meals')
      .update(cambios)
      .eq('id', comidaActual.id)
      .eq('user_id', userId)
      .select();

    return errUpd ? { error: errUpd.message } : { ok: true, comida_actualizada: actualizada[0] };
  }

  // 4. BORRAR COMIDA EN SUPABASE
  if (nombre === 'borrar_comida') {
    const { data: encontradas } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', userId)
      .ilike('description', `%${args.search_description}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!encontradas || encontradas.length === 0) {
      return { ok: false, error: `No se encontró ninguna comida que coincida con "${args.search_description}"` };
    }

    const { error } = await supabase
      .from('meals')
      .delete()
      .eq('id', encontradas[0].id)
      .eq('user_id', userId);

    return error ? { error: error.message } : { ok: true, comida_eliminada: encontradas[0].description };
  }

  // 5. CONSULTAR COMIDAS POR FECHA
  if (nombre === 'consultar_comidas') {
    const fecha = args.date || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
    const inicioDia = `${fecha}T00:00:00.000Z`;
    const finDia = `${fecha}T23:59:59.999Z`;

    const { data: comidas, error } = await supabase
      .from('meals')
      .select('id, description, calories, protein_g, created_at')
      .eq('user_id', userId)
      .gte('created_at', inicioDia)
      .lte('created_at', finDia)
      .order('created_at', { ascending: true });

    if (error) return { error: error.message };

    const totalCalorias = (comidas || []).reduce((acc, c) => acc + (Number(c.calories) || 0), 0);
    const totalProteinas = (comidas || []).reduce((acc, c) => acc + (Number(c.protein_g) || 0), 0);

    return {
      fecha_consultada: fecha,
      comidas: comidas || [],
      resumen_nutricional: { total_calorias: totalCalorias, total_proteina_g: totalProteinas }
    };
  }

  // 6. CONSULTAR ESTADO DEL DÍA (Tasks + Todos los Calendarios + Comidas de hoy)
  if (nombre === 'consultar_estado_dia') {
    let dataG = {};
    try {
      const url = new URL(scriptUrl);
      url.searchParams.append('accion', 'leer_tareas');
      const resG = await fetch(url.toString());
      dataG = await resG.json();
    } catch (e) {
      console.error("❌ Error leyendo Google Bridge:", e);
    }

    const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
    const { data: comidas } = await supabase
      .from('meals')
      .select('id, description, calories, protein_g, created_at')
      .eq('user_id', userId)
      .gte('created_at', `${hoy}T00:00:00.000Z`);

    const listaComidas = comidas || [];
    const totalCalorias = listaComidas.reduce((acc, c) => acc + (Number(c.calories) || 0), 0);
    const totalProteinas = listaComidas.reduce((acc, c) => acc + (Number(c.protein_g) || 0), 0);

    return {
      hoy_es: hoy,
      calendarios_disponibles_del_usuario: dataG.calendarios_disponibles || [],
      listas_tasks_disponibles_del_usuario: dataG.listas_disponibles || [],
      eventos_en_calendarios: dataG.eventos_calendario || {},
      tareas_en_listas: dataG.tareas || {},
      nutricion_hoy: {
        comidas: listaComidas,
        total_calorias: totalCalorias,
        total_proteina_g: totalProteinas
      }
    };
  }
}