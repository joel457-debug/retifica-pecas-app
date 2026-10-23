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
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
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
    oficina_nome: f.oficinaNome || 'Retífica de Motores Nova Opção',
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
    oficinaNome: row.oficina_nome || 'Retífica de Motores Nova Opção',
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
    oficina_nome: a.oficinaNome || 'Retífica de Motores Nova Opção',
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
    oficinaNome: row.oficina_nome || 'Retífica de Motores Nova Opção',
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
      empresaNome: data.empresa_nome || 'Retífica de Motores Nova Opção',
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
        empresa_nome: settings.empresaNome || 'Retífica de Motores Nova Opção',
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

/**
 * Strict Email validation helper
 * @param {string} email
 * @returns {boolean}
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

/**
 * Strong Password Strength Evaluation
 * Evaluates length, uppercase, lowercase, numbers, and special characters.
 * @param {string} password
 * @returns {{ score: number, label: string, color: string, isValid: boolean, requirements: { length: boolean, upper: boolean, lower: boolean, number: boolean, special: boolean } }}
 */
export function checkPasswordStrength(password) {
  const pwd = password || '';
  const requirements = {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd)
  };

  let score = 0;
  if (requirements.length) score++;
  if (requirements.upper && requirements.lower) score++;
  if (requirements.number) score++;
  if (requirements.special) score++;

  let label = 'Muito Fraca';
  let color = '#ef4444'; // Red

  if (score === 1) {
    label = 'Fraca';
    color = '#f87171';
  } else if (score === 2) {
    label = 'Média';
    color = '#fbbf24'; // Yellow
  } else if (score === 3) {
    label = 'Forte';
    color = '#10b981'; // Green
  } else if (score === 4) {
    label = 'Excelente';
    color = '#06b6d4'; // Cyan
  }

  // Strong password requires length >= 8 and score >= 3
  const isValid = requirements.length && score >= 3;

  return {
    score,
    label,
    color,
    isValid,
    requirements
  };
}

/**
 * Supabase Auth: Sign In with Email & Password
 */
export async function signInUser(email, password) {
  if (!supabase) {
    throw new Error('Cliente Supabase não configurado');
  }
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password
  });
  if (error) throw error;
  return data;
}

/**
 * Supabase Auth: Sign Up new User
 */
export async function signUpUser(email, password, metadata = {}) {
  if (!supabase) {
    throw new Error('Cliente Supabase não configurado');
  }
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: metadata
    }
  });
  if (error) throw error;
  return data;
}

/**
 * Supabase Auth: Reset Password via Email
 */
export async function resetPasswordForEmail(email) {
  if (!supabase) {
    throw new Error('Cliente Supabase não configurado');
  }
  const cleanEmail = email.trim().toLowerCase();
  const redirectUrl = window.location.origin;
  const { data, error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: redirectUrl
  });
  if (error) throw error;
  return data;
}

/**
 * Supabase Auth: Sign Out
 */
export async function signOutUser() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/**
 * Get current authenticated session
 */
export async function getCurrentSession() {
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch (err) {
    return null;
  }
}
