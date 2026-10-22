/**
 * Storage Service using LocalForage (IndexedDB)
 * Manages 4 simultaneous engine folders + archive history + app settings
 */
import localforage from 'localforage';

const FOLDERS_KEY = 'retifica_folders_v1';
const ARCHIVE_KEY = 'retifica_archive_v1';
const SETTINGS_KEY = 'retifica_settings_v1';

// Configure localForage
localforage.config({
  name: 'RetificaVisionApp',
  storeName: 'engine_records',
  description: 'Armazenamento offline de registros e fotos de retífica de motores'
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

export async function loadFolders() {
  try {
    const data = await localforage.getItem(FOLDERS_KEY);
    if (data && Array.isArray(data) && data.length === 4) {
      // Ensure new fields exist on existing saved folders
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
    console.error('Erro ao carregar pastas:', err);
    return JSON.parse(JSON.stringify(INITIAL_FOLDERS));
  }
}

export async function saveFolders(folders) {
  try {
    await localforage.setItem(FOLDERS_KEY, folders);
  } catch (err) {
    console.error('Erro ao salvar pastas:', err);
  }
}

export async function loadSettings() {
  try {
    const data = await localforage.getItem(SETTINGS_KEY);
    return data ? { ...INITIAL_SETTINGS, ...data } : { ...INITIAL_SETTINGS };
  } catch (err) {
    return { ...INITIAL_SETTINGS };
  }
}

export async function saveSettings(settings) {
  try {
    await localforage.setItem(SETTINGS_KEY, settings);
  } catch (err) {
    console.error('Erro ao salvar configurações:', err);
  }
}

export async function loadArchive() {
  try {
    const data = await localforage.getItem(ARCHIVE_KEY);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

export async function archiveFolder(folder) {
  try {
    const history = await loadArchive();
    const entry = {
      ...folder,
      archivedAt: new Date().toISOString(),
      idRegistro: 'REG-' + Date.now().toString().slice(-6)
    };
    history.unshift(entry);
    // keep up to 100 historical records safely
    if (history.length > 100) history.pop();
    await localforage.setItem(ARCHIVE_KEY, history);
    return entry;
  } catch (err) {
    console.error('Erro ao arquivar pasta:', err);
    return null;
  }
}
