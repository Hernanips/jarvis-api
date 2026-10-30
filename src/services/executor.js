import { supabase } from '../config/clients.js';
import { ejecutarAccionGoogle } from './googleApi.js';

// Calcula el inicio y fin del día en hora exacta de España (Europe/Madrid)
function obtenerRangoDiaMadrid(fechaStr) {
  const hoyMadrid = fechaStr || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  // Obtenemos el offset dinámico de Madrid (+01:00 en invierno, +02:00 en verano)
  const fechaRef = new Date(`${hoyMadrid}T12:00:00Z`);
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    timeZoneName: 'longOffset'
  }).formatToParts(fechaRef);
  const offsetTz = (partes.find(p => p.type === 'timeZoneName')?.value || 'GMT+01:00').replace('GMT', '') || '+01:00';

  return {
    fecha: hoyMadrid,
    inicioDia: new Date(`${hoyMadrid}T00:00:00.000${offsetTz}`).toISOString(),
    finDia: new Date(`${hoyMadrid}T23:59:59.999${offsetTz}`).toISOString()
  };
}

export async function ejecutarHerramienta(nombre, args, userId, googleToken, googleRefreshToken = null) {
  // 1. ACCIONES DIRECTAS EN GOOGLE API OFICIAL (Multiusuario real)
  const accionesDirectas = [
    'crear_lista', 'editar_lista', 'borrar_lista', 'limpiar_completadas',
    'crear_calendario', 'editar_calendario', 'borrar_calendario',
    'crear_evento', 'editar_evento', 'borrar_evento', 'consultar_calendario',
    'crear_tarea', 'editar_tarea', 'borrar_tarea'
  ];

  if (accionesDirectas.includes(nombre)) {
    return await ejecutarAccionGoogle(nombre, args, googleToken, userId, googleRefreshToken);
  }

  // 2. REGISTRAR COMIDA EN SUPABASE
  if (nombre === 'registrar_comida') {
    const { data, error } = await supabase
      .from('meals')
      .insert([{
        user_id: userId,
        description: args.description,
        calories: Math.round(Number(args.calories) || 0),
        protein_g: Math.round(Number(args.protein_g) || 0),
        carbs_g: Math.round(Number(args.carbs_g) || 0),
        fat_g: Math.round(Number(args.fat_g) || 0)
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
    if (args.carbs_g !== undefined) cambios.carbs_g = Math.round(Number(args.carbs_g));
    if (args.fat_g !== undefined) cambios.fat_g = Math.round(Number(args.fat_g));

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

  // 5. CONSULTAR COMIDAS POR FECHA (Con zona horaria Europe/Madrid corregida)
  if (nombre === 'consultar_comidas') {
    const { fecha, inicioDia, finDia } = obtenerRangoDiaMadrid(args.date);

    const { data: comidas, error } = await supabase
      .from('meals')
      .select('id, description, calories, protein_g, carbs_g, fat_g, created_at')
      .eq('user_id', userId)
      .gte('created_at', inicioDia)
      .lte('created_at', finDia)
      .order('created_at', { ascending: true });

    if (error) return { error: error.message };

    const lista = comidas || [];
    const resumen = lista.reduce((acc, c) => ({
      calorias: acc.calorias + (Number(c.calories) || 0),
      proteina_g: acc.proteina_g + (Number(c.protein_g) || 0),
      carbohidratos_g: acc.carbohidratos_g + (Number(c.carbs_g) || 0),
      grasas_g: acc.grasas_g + (Number(c.fat_g) || 0)
    }), { calorias: 0, proteina_g: 0, carbohidratos_g: 0, grasas_g: 0 });

    return {
      fecha_consultada: fecha,
      comidas: lista,
      totales_del_dia: resumen
    };
  }

  // 6. REGISTRAR PESO CORPORAL
  if (nombre === 'registrar_peso') {
    const { data, error } = await supabase
      .from('weight_logs')
      .insert([{
        user_id: userId,
        weight_kg: Number(args.weight_kg),
        body_fat_pct: args.body_fat_pct !== undefined ? Number(args.body_fat_pct) : null,
        muscle_mass_kg: args.muscle_mass_kg !== undefined ? Number(args.muscle_mass_kg) : null,
        notes: args.notes || null
      }])
      .select();

    return error ? { error: error.message } : { ok: true, registro_peso: data[0] };
  }

  // 7. CONSULTAR HISTORIAL DE PESO
  if (nombre === 'consultar_peso') {
    const limite = Number(args.limit) || 10;
    const { data, error } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limite);

    return error ? { error: error.message } : { historial_peso: data || [] };
  }

  // 8. CONSULTAR ESTADO DEL DÍA (Tasks + Calendarios + Nutrición + Último Peso)
  if (nombre === 'consultar_estado_dia') {
    const dataG = await ejecutarAccionGoogle('leer_tareas', {}, googleToken, userId, googleRefreshToken);
    const { fecha: hoy, inicioDia, finDia } = obtenerRangoDiaMadrid();

    const { data: comidas } = await supabase
      .from('meals')
      .select('id, description, calories, protein_g, carbs_g, fat_g, created_at')
      .eq('user_id', userId)
      .gte('created_at', inicioDia)
      .lte('created_at', finDia);

    const { data: ultimoPeso } = await supabase
      .from('weight_logs')
      .select('weight_kg, body_fat_pct, muscle_mass_kg, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    const listaComidas = comidas || [];
    const totalesNutricion = listaComidas.reduce((acc, c) => ({
      calorias: acc.calorias + (Number(c.calories) || 0),
      proteina_g: acc.proteina_g + (Number(c.protein_g) || 0),
      carbohidratos_g: acc.carbohidratos_g + (Number(c.carbs_g) || 0),
      grasas_g: acc.grasas_g + (Number(c.fat_g) || 0)
    }), { calorias: 0, proteina_g: 0, carbohidratos_g: 0, grasas_g: 0 });

    return {
      hoy_es: hoy,
      calendarios_disponibles_del_usuario: dataG.calendarios_disponibles || [],
      listas_tasks_disponibles_del_usuario: dataG.listas_disponibles || [],
      eventos_en_calendarios: dataG.eventos_calendario || {},
      tareas_en_listas: dataG.tareas || {},
      nutricion_hoy: {
        comidas: listaComidas,
        totales: totalesNutricion
      },
      ultimo_peso_registrado: ultimoPeso && ultimoPeso.length > 0 ? ultimoPeso[0] : null,
      aviso_google: dataG.error || null
    };
  }
}