/**
 * Supabase Client & Data Synchronization Service
 * Provides centralized connection and seamless offline-first synchronization.
 */
import { createClient } from '@supabase/supabase-js';

// Environment variables with fallback to user-provided project credentials
const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL)) ||
  'https://wnjevjbzgqiqtootttfo.supabase.co';

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY)) ||
  'sb_publishable_At--GZF_KeL2Yv-QV1s2YQ_To6KYtpr';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Centralized Supabase Client Instance
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

// Track connection health
let isSupabaseAvailable = false;
let lastCheckTime = 0;

/**
 * Checks if Supabase database and tables are accessible
 * @param {boolean} forceCheck 
 * @returns {Promise<boolean>}
 */
export async function testSupabaseConnection(forceCheck = false) {
  const now = Date.now();
  if (!forceCheck && now - lastCheckTime < 15000) {
    return isSupabaseAvailable;
  }
  
  if (!supabase || !navigator.onLine) {
    isSupabaseAvailable = false;
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('pastas_trabalho')
      .select('id')
      .limit(1);

    if (error) {
      // Table might not be created yet in schema
      isSupabaseAvailable = false;
      return false;
    }
    
    isSupabaseAvailable = true;
    lastCheckTime = now;
    return true;
  } catch (err) {
    isSupabaseAvailable = false;
    return false;
  }
}

/**
 * Converts a JS Folder object into a DB snake_case row
 */
export function folderToDb(f) {
  return {
    id: f.id,
    nome: f.name || `Pasta ${f.id}`,
    status: f.status || 'livre',
    placa: f.placa || '',
    motor_num: f.motorNum || '',
    fotos_peca: Array.isArray(f.fotosPeca) ? f.fotosPeca : [],
    foto_placa: f.fotoPlaca || null,
    pecas_identificadas: Array.isArray(f.pecasIdentificadas) ? f.pecasIdentificadas : [],
    observacoes: f.observacoes || '',
    estado_cabecote: f.estadoCabecote || '',
    oficina_nome: f.oficinaNome || 'Retífica Especializada',
    procedimentos: Array.isArray(f.procedimentos) ? f.procedimentos : [],
    procedimentos_texto: f.procedimentosTexto || '',
    localizacao: f.localizacao || { texto: '', coords: null, mapsUrl: '' },
    updated_at: new Date().toISOString()
  };
}

/**
 * Converts a DB snake_case row into a JS Folder object
 */
export function folderFromDb(row) {
  return {
    id: row.id,
    name: row.nome || `Pasta ${row.id}`,
    status: row.status || 'livre',
    placa: row.placa || '',
    motorNum: row.motor_num || '',
    fotosPeca: Array.isArray(row.fotos_peca) ? row.fotos_peca : [],
    fotoPlaca: row.foto_placa || null,
    pecasIdentificadas: Array.isArray(row.pecas_identificadas) ? row.pecas_identificadas : [],
    observacoes: row.observacoes || '',
    estadoCabecote: row.estado_cabecote || '',
    oficinaNome: row.oficina_nome || 'Retífica Especializada',
    procedimentos: Array.isArray(row.procedimentos) ? row.procedimentos : [],
    procedimentosTexto: row.procedimentos_texto || '',
    localizacao: row.localizacao || { texto: '', coords: null, mapsUrl: '' },
    updatedAt: row.updated_at || null
  };
}

/**
 * Converts an Archive record into DB row
 */
export function archiveToDb(a) {
  return {
    id_registro: a.idRegistro || 'REG-' + Date.now().toString().slice(-6),
    pasta_id: a.id || null,
    nome: a.name || 'Pasta',
    status: a.status || 'concluido',
    placa: a.placa || '',
    motor_num: a.motorNum || '',
    oficina_nome: a.oficinaNome || 'Retífica Especializada',
    estado_cabecote: a.estadoCabecote || '',
    observacoes: a.observacoes || '',
    procedimentos: Array.isArray(a.procedimentos) ? a.procedimentos : [],
    procedimentos_texto: a.procedimentosTexto || '',
    pecas_identificadas: Array.isArray(a.pecasIdentificadas) ? a.pecasIdentificadas : [],
    localizacao: a.localizacao || { texto: '', coords: null, mapsUrl: '' },
    fotos_peca: Array.isArray(a.fotosPeca) ? a.fotosPeca : [],
    foto_placa: a.fotoPlaca || null,
    archived_at: a.archivedAt || new Date().toISOString()
  };
}

/**
 * Converts a DB row into an Archive record
 */
export function archiveFromDb(row) {
  return {
    id: row.pasta_id || 1,
    idRegistro: row.id_registro,
    name: row.nome || 'Pasta',
    status: row.status || 'concluido',
    placa: row.placa || '',
    motorNum: row.motor_num || '',
    oficinaNome: row.oficina_nome || 'Retífica Especializada',
    estadoCabecote: row.estado_cabecote || '',
    observacoes: row.observacoes || '',
    procedimentos: Array.isArray(row.procedimentos) ? row.procedimentos : [],
    procedimentosTexto: row.procedimentos_texto || '',
    pecasIdentificadas: Array.isArray(row.pecas_identificadas) ? row.pecas_identificadas : [],
    localizacao: row.localizacao || { texto: '', coords: null, mapsUrl: '' },
    fotosPeca: Array.isArray(row.fotos_peca) ? row.fotos_peca : [],
    fotoPlaca: row.foto_placa || null,
    archivedAt: row.archived_at || row.created_at
  };
}

/**
 * Fetch all 4 folders from Supabase
 */
export async function getFoldersFromCloud() {
  if (!supabase || !navigator.onLine) return null;
  try {
    const { data, error } = await supabase
      .from('pastas_trabalho')
      .select('*')
      .order('id', { ascending: true });

    if (error || !data || data.length === 0) return null;
    return data.map(folderFromDb);
  } catch (err) {
    console.warn('Erro ao carregar pastas do Supabase:', err);
    return null;
  }
}

/**
 * Upsert all folders to Supabase
 */
export async function syncFoldersToCloud(folders) {
  if (!supabase || !navigator.onLine || !Array.isArray(folders)) return;
  try {
    const rows = folders.map(folderToDb);
    const { error } = await supabase
      .from('pastas_trabalho')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase sync error (pastas_trabalho):', error.message);
    }
  } catch (err) {
    console.warn('Falha ao sincronizar pastas com Supabase:', err);
  }
}

/**
 * Fetch archived records from Supabase
 */
export async function getArchiveFromCloud() {
  if (!supabase || !navigator.onLine) return null;
  try {
    const { data, error } = await supabase
      .from('registros')
      .select('*')
      .order('archived_at', { ascending: false })
      .limit(100);

    if (error || !data) return null;
    return data.map(archiveFromDb);
  } catch (err) {
    console.warn('Erro ao carregar histórico do Supabase:', err);
    return null;
  }
}

/**
 * Insert archived record into Supabase
 */
export async function saveArchiveToCloud(entry) {
  if (!supabase || !navigator.onLine || !entry) return;
  try {
    const row = archiveToDb(entry);
    const { error } = await supabase
      .from('registros')
      .insert([row]);

    if (error) {
      console.warn('Supabase insert error (registros):', error.message);
    }
  } catch (err) {
    console.warn('Falha ao salvar histórico no Supabase:', err);
  }
}

/**
 * Fetch settings from Supabase
 */
export async function getSettingsFromCloud() {
  if (!supabase || !navigator.onLine) return null;
  try {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) return null;
    return {
      empresaNome: data.empresa_nome || 'Retífica Especializada',
      telefoneWhatsApp: data.telefone_whatsapp || '',
      emailDestino: data.email_destino || '',
      geminiApiKey: data.gemini_api_key || '',
      somAtivado: data.som_ativado ?? true
    };
  } catch (err) {
    console.warn('Erro ao buscar configurações no Supabase:', err);
    return null;
  }
}

/**
 * Save settings to Supabase
 */
export async function saveSettingsToCloud(settings) {
  if (!supabase || !navigator.onLine || !settings) return;
  try {
    const { error } = await supabase
      .from('configuracoes')
      .upsert({
        id: 1,
        empresa_nome: settings.empresaNome || 'Retífica Especializada',
        telefone_whatsapp: settings.telefoneWhatsApp || '',
        email_destino: settings.emailDestino || '',
        gemini_api_key: settings.geminiApiKey || '',
        som_ativado: settings.somAtivado ?? true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase upsert error (configuracoes):', error.message);
    }
  } catch (err) {
    console.warn('Falha ao salvar configurações no Supabase:', err);
  }
}
