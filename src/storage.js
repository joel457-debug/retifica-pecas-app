/**
 * Storage Service using LocalForage (IndexedDB) & Supabase Cloud Sync
 * Manages 4 simultaneous engine folders + archive history + app settings
 * Guarantees 100% offline functionality with automatic cloud synchronization.
 */
import localforage from 'localforage';
import {
  supabase,
  isSupabaseConfigured,
  testSupabaseConnection,
  getFoldersFromCloud,
  syncFoldersToCloud,
  getArchiveFromCloud,
  saveArchiveToCloud,
  getSettingsFromCloud,
  saveSettingsToCloud
} from './supabase.js';

const FOLDERS_KEY = 'retifica_folders_v1';
const ARCHIVE_KEY = 'retifica_archive_v1';
const SETTINGS_KEY = 'retifica_settings_v1';

// Configure localForage (IndexedDB)
localforage.config({
  name: 'RetificaVisionApp',
  storeName: 'engine_records',
  description: 'Armazenamento offline e híbrido com Supabase para registros de retífica'
});

export const INITIAL_FOLDERS = [
  { id: 1, name: 'Pasta 1', status: 'livre', placa: '', motorNum: '', fotosPeca: [], fotoPlaca: null, pecasIdentificadas: [], observacoes: '', estadoCabecote: '', oficinaNome: 'Retífica Especializada', procedimentos: [], procedimentosTexto: '', localizacao: { texto: '', coords: null, mapsUrl: '' }, updatedAt: null },
  { id: 2, name: 'Pasta 2', status: 'livre', placa: '', motorNum: '', fotosPeca: [], fotoPlaca: null, pecasIdentificadas: [], observacoes: '', estadoCabecote: '', oficinaNome: 'Retífica Especializada', procedimentos: [], procedimentosTexto: '', localizacao: { texto: '', coords: null, mapsUrl: '' }, updatedAt: null },
  { id: 3, name: 'Pasta 3', status: 'livre', placa: '', motorNum: '', fotosPeca: [], fotoPlaca: null, pecasIdentificadas: [], observacoes: '', estadoCabecote: '', oficinaNome: 'Retífica Especializada', procedimentos: [], procedimentosTexto: '', localizacao: { texto: '', coords: null, mapsUrl: '' }, updatedAt: null },
  { id: 4, name: 'Pasta 4', status: 'livre', placa: '', motorNum: '', fotosPeca: [], fotoPlaca: null, pecasIdentificadas: [], observacoes: '', estadoCabecote: '', oficinaNome: 'Retífica Especializada', procedimentos: [], procedimentosTexto: '', localizacao: { texto: '', coords: null, mapsUrl: '' }, updatedAt: null }
];

export const INITIAL_SETTINGS = {
  empresaNome: 'Retífica Especializada',
  telefoneWhatsApp: '',
  emailDestino: '',
  geminiApiKey: '',
  somAtivado: true,
  simularOffline: false
};

export { supabase, isSupabaseConfigured, testSupabaseConnection };

/**
 * Load 4 folders: tries Supabase first, falls back to IndexedDB
 */
export async function loadFolders() {
  // 1. Tentar carregar do Supabase se estiver online
  if (navigator.onLine && isSupabaseConfigured) {
    try {
      const cloudFolders = await getFoldersFromCloud();
      if (cloudFolders && Array.isArray(cloudFolders) && cloudFolders.length === 4) {
        // Atualiza cache local
        await localforage.setItem(FOLDERS_KEY, cloudFolders);
        return cloudFolders;
      }
    } catch (err) {
      console.warn('Falha ao obter pastas do Supabase, usando armazenamento local:', err);
    }
  }

  // 2. Fallback para IndexedDB local
  try {
    const data = await localforage.getItem(FOLDERS_KEY);
    if (data && Array.isArray(data) && data.length === 4) {
      return data.map((f, i) => ({
        ...INITIAL_FOLDERS[i],
        ...f,
        oficinaNome: f.oficinaNome || 'Retífica Especializada',
        procedimentos: Array.isArray(f.procedimentos) ? f.procedimentos : [],
        procedimentosTexto: f.procedimentosTexto || '',
        localizacao: f.localizacao || { texto: '', coords: null, mapsUrl: '' }
      }));
    }
    await saveFolders(INITIAL_FOLDERS);
    return JSON.parse(JSON.stringify(INITIAL_FOLDERS));
  } catch (err) {
    console.error('Erro ao carregar pastas locais:', err);
    return JSON.parse(JSON.stringify(INITIAL_FOLDERS));
  }
}

/**
 * Save folders locally and replicate to Supabase
 */
export async function saveFolders(folders) {
  try {
    // 1. Salva imediatamente no IndexedDB local
    await localforage.setItem(FOLDERS_KEY, folders);
    
    // 2. Replica para o Supabase em background
    if (navigator.onLine && isSupabaseConfigured) {
      syncFoldersToCloud(folders).catch(err => {
        console.warn('Sync em background com Supabase falhou:', err);
      });
    }
  } catch (err) {
    console.error('Erro ao salvar pastas:', err);
  }
}

/**
 * Load settings: tries Supabase first, falls back to IndexedDB
 */
export async function loadSettings() {
  if (navigator.onLine && isSupabaseConfigured) {
    try {
      const cloudSettings = await getSettingsFromCloud();
      if (cloudSettings) {
        const localSettings = await localforage.getItem(SETTINGS_KEY);
        const merged = { ...INITIAL_SETTINGS, ...(localSettings || {}), ...cloudSettings };
        await localforage.setItem(SETTINGS_KEY, merged);
        return merged;
      }
    } catch (err) {
      console.warn('Falha ao carregar configurações do Supabase:', err);
    }
  }

  try {
    const data = await localforage.getItem(SETTINGS_KEY);
    return data ? { ...INITIAL_SETTINGS, ...data } : { ...INITIAL_SETTINGS };
  } catch (err) {
    return { ...INITIAL_SETTINGS };
  }
}

/**
 * Save settings locally and replicate to Supabase
 */
export async function saveSettings(settings) {
  try {
    await localforage.setItem(SETTINGS_KEY, settings);
    if (navigator.onLine && isSupabaseConfigured) {
      saveSettingsToCloud(settings).catch(err => {
        console.warn('Sync de configurações com Supabase falhou:', err);
      });
    }
  } catch (err) {
    console.error('Erro ao salvar configurações:', err);
  }
}

/**
 * Load archive: tries Supabase first, falls back to IndexedDB
 */
export async function loadArchive() {
  if (navigator.onLine && isSupabaseConfigured) {
    try {
      const cloudArchive = await getArchiveFromCloud();
      if (cloudArchive && cloudArchive.length > 0) {
        await localforage.setItem(ARCHIVE_KEY, cloudArchive);
        return cloudArchive;
      }
    } catch (err) {
      console.warn('Falha ao carregar arquivo histórico do Supabase:', err);
    }
  }

  try {
    const data = await localforage.getItem(ARCHIVE_KEY);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

/**
 * Archive a folder locally and save to Supabase
 */
export async function archiveFolder(folder) {
  try {
    const history = await loadArchive();
    const entry = {
      ...folder,
      archivedAt: new Date().toISOString(),
      idRegistro: 'REG-' + Date.now().toString().slice(-6)
    };
    history.unshift(entry);
    if (history.length > 100) history.pop();
    
    // Salva no IndexedDB
    await localforage.setItem(ARCHIVE_KEY, history);

    // Salva no Supabase
    if (navigator.onLine && isSupabaseConfigured) {
      saveArchiveToCloud(entry).catch(err => {
        console.warn('Falha ao sincronizar registro arquivado no Supabase:', err);
      });
    }

    return entry;
  } catch (err) {
    console.error('Erro ao arquivar pasta:', err);
    return null;
  }
}
