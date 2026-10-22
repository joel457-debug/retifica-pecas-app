/**
 * Retífica Vision AI — Main Application Controller
 * Handles 4 simultaneous folders, in-app live camera, IA recognition, 
 * workshop procedures, GPS location, review, sharing & offline storage.
 */

import { loadFolders, saveFolders, loadSettings, saveSettings, loadArchive, archiveFolder, INITIAL_FOLDERS } from './storage.js';
import { analyzeEnginePhotos, COMMON_EXTRA_PARTS } from './ai-service.js';
import { shareViaWhatsApp, shareViaEmail, copyToClipboard, buildTextSummary } from './sharing.js';
import { playSound } from './audio-feedback.js';
import confetti from 'canvas-confetti';

export const STANDARD_PROCEDURES = [
  'Banho químico desengraxante',
  'Plainar cabeçote',
  'Retífica de virabrequim',
  'Brunimento / Abertura de cilindros',
  'Troca de guias e sedes de válvulas',
  'Assentamento de válvulas',
  'Ajustar folga de bielas e bronzinas',
  'Alinhamento de mancais do bloco',
  'Teste de trinca / Estanqueidade',
  'Troca de selos d’água',
  'Montagem completa do conjunto'
];

// State
let folders = [];
let activeFolderId = 1;
let activeStep = 1; // 1: Placa, 2: Peças, 3: IA, 4: Procedimentos/Motor, 5: Resumo
let appSettings = {};
let isNetworkOffline = !navigator.onLine;

// Live Camera State
let liveMediaStream = null;
let currentFacingMode = 'environment';
let cameraCaptureTarget = 'placa'; // 'placa' or 'pecas'

// Elements
const foldersTabContainer = document.getElementById('folders-tab-container');
const activeFolderContent = document.getElementById('active-folder-content');
const networkStatusBtn = document.getElementById('btn-toggle-network');
const networkStatusText = document.getElementById('network-status-text');
const archiveCountBadge = document.getElementById('archive-count-badge');
const toastContainer = document.getElementById('toast-container');

// Modals
const modalSettings = document.getElementById('modal-settings');
const modalArchive = document.getElementById('modal-archive');
const modalPhotoZoom = document.getElementById('modal-photo-zoom');
const modalLiveCamera = document.getElementById('modal-live-camera');
const zoomImageElement = document.getElementById('zoom-image-element');
const zoomImageCaption = document.getElementById('zoom-image-caption');

// Hidden File Inputs
const fileInputPlaca = document.getElementById('file-input-placa');
const fileInputPecas = document.getElementById('file-input-pecas');

// Initialize
async function initApp() {
  folders = await loadFolders();
  appSettings = await loadSettings();

  if (appSettings.simularOffline) {
    isNetworkOffline = true;
  }
  updateNetworkUI();

  // Network listeners
  window.addEventListener('online', () => {
    if (!appSettings.simularOffline) {
      isNetworkOffline = false;
      updateNetworkUI();
      showToast('Conexão com a internet restabelecida!', 'success');
      checkPendingUploads();
    }
  });

  window.addEventListener('offline', () => {
    isNetworkOffline = true;
    updateNetworkUI();
    showToast('Você está offline. O aplicativo continua funcionando normalmente.', 'warning');
  });

  setupHeaderEvents();
  setupLiveCameraEvents();
  updateArchiveBadge();
  renderApp();
}

/**
 * Toast Notification Helper
 */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Network indicator toggle
 */
function updateNetworkUI() {
  if (isNetworkOffline) {
    networkStatusBtn.className = 'status-pill status-offline';
    networkStatusText.textContent = 'OFFLINE';
  } else {
    networkStatusBtn.className = 'status-pill status-online';
    networkStatusText.textContent = 'ONLINE';
  }
}

function setupHeaderEvents() {
  // Toggle network simulation on click
  networkStatusBtn.addEventListener('click', () => {
    isNetworkOffline = !isNetworkOffline;
    appSettings.simularOffline = isNetworkOffline;
    saveSettings(appSettings);
    updateNetworkUI();
    playSound('click', appSettings.somAtivado);
    showToast(isNetworkOffline ? 'Modo OFFLINE ativado para testes!' : 'Modo ONLINE ativado!', isNetworkOffline ? 'warning' : 'success');
    renderApp();
  });

  // Settings Modal
  document.getElementById('btn-open-settings').addEventListener('click', () => {
    playSound('click', appSettings.somAtivado);
    document.getElementById('cfg-empresa').value = appSettings.empresaNome || '';
    document.getElementById('cfg-whatsapp').value = appSettings.telefoneWhatsApp || '';
    document.getElementById('cfg-email').value = appSettings.emailDestino || '';
    document.getElementById('cfg-gemini-key').value = appSettings.geminiApiKey || '';
    document.getElementById('cfg-sound-toggle').checked = appSettings.somAtivado !== false;
    modalSettings.classList.add('open');
  });

  document.getElementById('btn-close-settings').addEventListener('click', () => modalSettings.classList.remove('open'));
  document.getElementById('btn-cancel-settings').addEventListener('click', () => modalSettings.classList.remove('open'));

  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    appSettings.empresaNome = document.getElementById('cfg-empresa').value.trim();
    appSettings.telefoneWhatsApp = document.getElementById('cfg-whatsapp').value.trim();
    appSettings.emailDestino = document.getElementById('cfg-email').value.trim();
    appSettings.geminiApiKey = document.getElementById('cfg-gemini-key').value.trim();
    appSettings.somAtivado = document.getElementById('cfg-sound-toggle').checked;
    await saveSettings(appSettings);
    modalSettings.classList.remove('open');
    showToast('Configurações salvas com sucesso!', 'success');
    playSound('success', appSettings.somAtivado);
    renderApp();
  });

  // Archive Modal
  document.getElementById('btn-open-archive').addEventListener('click', async () => {
    playSound('click', appSettings.somAtivado);
    await openArchiveModal();
  });

  document.getElementById('btn-close-archive').addEventListener('click', () => modalArchive.classList.remove('open'));
  document.getElementById('btn-dismiss-archive').addEventListener('click', () => modalArchive.classList.remove('open'));

  // Photo Zoom Modal Close
  document.getElementById('btn-close-zoom').addEventListener('click', () => modalPhotoZoom.classList.remove('open'));
  modalPhotoZoom.addEventListener('click', (e) => {
    if (e.target === modalPhotoZoom) modalPhotoZoom.classList.remove('open');
  });

  // Global inputs for camera capture fallback
  fileInputPlaca.addEventListener('change', handlePlacaFileSelect);
  fileInputPecas.addEventListener('change', handlePecasFileSelect);
}

/**
 * Live Camera Viewfinder Controller
 */
function setupLiveCameraEvents() {
  document.getElementById('btn-close-live-camera').addEventListener('click', closeLiveCamera);

  document.getElementById('btn-camera-shutter').addEventListener('click', captureLivePhoto);

  document.getElementById('btn-camera-switch-lens').addEventListener('click', async () => {
    currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
    playSound('click', appSettings.somAtivado);
    await startCameraStream();
  });

  document.getElementById('btn-camera-toggle-flash').addEventListener('click', async () => {
    if (!liveMediaStream) return;
    const track = liveMediaStream.getVideoTracks()[0];
    if (track && track.getCapabilities) {
      const caps = track.getCapabilities();
      if (caps.torch) {
        const currentSetting = track.getSettings().torch || false;
        try {
          await track.applyConstraints({ advanced: [{ torch: !currentSetting }] });
          showToast(!currentSetting ? 'Lanterna ligada' : 'Lanterna desligada', 'success');
          return;
        } catch (e) {
          // ignore
        }
      }
    }
    showToast('Lanterna não suportada neste dispositivo', 'warning');
  });
}

async function openLiveCamera(targetType) {
  cameraCaptureTarget = targetType;
  const targetLabel = document.getElementById('camera-target-label');
  const guideReticle = document.getElementById('camera-guide-reticle');
  const guideHint = document.getElementById('camera-guide-hint');

  if (targetType === 'placa') {
    targetLabel.textContent = '📸 CÂMERA — PLACA DO MOTOR';
    guideReticle.classList.add('reticle-plate');
    guideHint.textContent = 'Posicione a placa do motor dentro das guias';
  } else {
    targetLabel.textContent = '📸 CÂMERA — PEÇAS DO MOTOR';
    guideReticle.classList.remove('reticle-plate');
    guideHint.textContent = 'Centralize a peça (cabeçote, bloco, bielas...) no quadro';
  }

  modalLiveCamera.classList.add('open');
  playSound('click', appSettings.somAtivado);

  await startCameraStream();
}

async function startCameraStream() {
  const videoElem = document.getElementById('camera-video-stream');
  if (liveMediaStream) {
    liveMediaStream.getTracks().forEach(t => t.stop());
    liveMediaStream = null;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Câmera ao vivo não suportada neste navegador. Usando seletor.', 'warning');
    closeLiveCamera();
    triggerFileFallback();
    return;
  }

  try {
    liveMediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: currentFacingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });
    videoElem.srcObject = liveMediaStream;
  } catch (err) {
    console.warn('Erro ao abrir câmera ao vivo:', err);
    showToast('Acesso à câmera bloqueado ou indisponível. Usando seletor do aparelho.', 'warning');
    closeLiveCamera();
    triggerFileFallback();
  }
}

function closeLiveCamera() {
  if (liveMediaStream) {
    liveMediaStream.getTracks().forEach(t => t.stop());
    liveMediaStream = null;
  }
  modalLiveCamera.classList.remove('open');
}

function triggerFileFallback() {
  if (cameraCaptureTarget === 'placa') {
    fileInputPlaca.click();
  } else {
    fileInputPecas.click();
  }
}

function captureLivePhoto() {
  const videoElem = document.getElementById('camera-video-stream');
  const canvas = document.getElementById('camera-hidden-canvas');
  if (!videoElem || !videoElem.videoWidth) {
    showToast('Aguarde o vídeo carregar para capturar a foto.', 'warning');
    return;
  }

  canvas.width = videoElem.videoWidth;
  canvas.height = videoElem.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  playSound('shutter', appSettings.somAtivado);

  const currentFolder = folders.find(f => f.id === activeFolderId);
  if (cameraCaptureTarget === 'placa') {
    currentFolder.fotoPlaca = dataUrl;
    if (currentFolder.status === 'livre') currentFolder.status = 'em_preenchimento';
    currentFolder.updatedAt = new Date().toISOString();
    showToast('Foto da placa capturada!', 'success');
  } else {
    if (!currentFolder.fotosPeca) currentFolder.fotosPeca = [];
    currentFolder.fotosPeca.push(dataUrl);
    if (currentFolder.status === 'livre') currentFolder.status = 'em_preenchimento';
    currentFolder.updatedAt = new Date().toISOString();
    showToast('Foto de peça adicionada!', 'success');
  }

  saveFolders(folders);
  closeLiveCamera();
  renderApp();
}

/**
 * GPS Location Helper
 */
function fetchGPSLocation(folder) {
  if (!navigator.geolocation) {
    showToast('Geolocalização não suportada no aparelho.', 'warning');
    return;
  }

  showToast('Obtendo coordenadas GPS da oficina/coleta...', 'success');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude.toFixed(6);
      const lng = position.coords.longitude.toFixed(6);
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      
      folder.localizacao = {
        texto: folder.localizacao?.texto || `Oficina Coleta GPS (${lat}, ${lng})`,
        coords: { lat, lng },
        mapsUrl: mapsUrl
      };
      folder.updatedAt = new Date().toISOString();
      saveFolders(folders);
      playSound('success', appSettings.somAtivado);
      showToast('Localização GPS capturada com sucesso!', 'success');
      renderApp();
    },
    (err) => {
      console.warn('Erro GPS:', err);
      showToast('Permissão de GPS indisponível. Você pode digitar o local manualmente.', 'warning');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function updateArchiveBadge() {
  const archive = await loadArchive();
  archiveCountBadge.textContent = archive.length;
}

function checkPendingUploads() {
  const pending = folders.filter(f => f.status === 'aguardando_conexao');
  if (pending.length > 0) {
    showToast(`Você tem ${pending.length} pasta(s) aguardando conexão prontas para envio!`, 'warning');
  }
}

function renderApp() {
  renderFoldersTabs();
  renderActiveFolder();
}

/**
 * Render the 4 Folders tabs (RF15)
 */
function renderFoldersTabs() {
  foldersTabContainer.innerHTML = '';

  folders.forEach(f => {
    const tab = document.createElement('button');
    tab.className = `folder-tab ${f.id === activeFolderId ? 'active' : ''}`;
    tab.id = `tab-folder-${f.id}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', f.id === activeFolderId);

    const plateText = f.placa ? f.placa.toUpperCase() : 'Vazia';
    const photosCount = (f.fotoPlaca ? 1 : 0) + (f.fotosPeca ? f.fotosPeca.length : 0);
    const badgeClass = `badge-${f.status}`;
    const statusLabel = formatStatusLabel(f.status);

    tab.innerHTML = `
      <div class="folder-tab-top">
        <span class="folder-tab-name">${f.name}</span>
        <span class="folder-badge-status ${badgeClass}">${statusLabel}</span>
      </div>
      <div class="folder-tab-plate">${plateText}</div>
      <div class="folder-tab-meta">📷 ${photosCount} fotos | ⚙️ ${f.motorNum || 'S/N'}</div>
    `;

    tab.addEventListener('click', () => {
      if (activeFolderId !== f.id) {
        playSound('click', appSettings.somAtivado);
        activeFolderId = f.id;
        renderApp();
      }
    });

    foldersTabContainer.appendChild(tab);
  });
}

function formatStatusLabel(status) {
  switch (status) {
    case 'livre': return 'Livre';
    case 'em_preenchimento': return 'Em Preenchimento';
    case 'aguardando_analise': return 'Aguard. Análise';
    case 'pronta_envio': return 'Pronta p/ Envio';
    case 'aguardando_conexao': return 'Aguard. Conexão';
    case 'enviada': return 'Enviada';
    default: return status;
  }
}

/**
 * Render Active Folder View and Steps
 */
function renderActiveFolder() {
  const currentFolder = folders.find(f => f.id === activeFolderId) || folders[0];
  const oficina = currentFolder.oficinaNome || appSettings.empresaNome || 'Retífica Especializada';

  activeFolderContent.innerHTML = `
    <div class="folder-hero">
      <div class="folder-hero-header">
        <div class="folder-hero-title">
          <div>
            <h2>${currentFolder.name} ${currentFolder.placa ? `— Placa ${currentFolder.placa}` : ''}</h2>
            <small style="color: var(--text-secondary); font-size: 0.8rem;">
              Oficina: <strong style="color: var(--accent-amber);">${oficina}</strong>
              ${currentFolder.localizacao?.texto ? ` | 📍 ${currentFolder.localizacao.texto}` : ''}
            </small>
          </div>
          <span class="folder-badge-status badge-${currentFolder.status}">${formatStatusLabel(currentFolder.status)}</span>
        </div>
        <div class="folder-hero-actions">
          <button class="btn btn-secondary" id="btn-save-draft" title="Salvar rascunho localmente">
            💾 Salvar Rascunho
          </button>
          <button class="btn btn-danger-outline" id="btn-reset-folder" title="Limpar dados desta pasta">
            🗑️ Limpar
          </button>
        </div>
      </div>

      <!-- Step Stepper -->
      <nav class="steps-stepper" aria-label="Etapas do registro do motor">
        <button class="step-btn ${activeStep === 1 ? 'active' : ''} ${currentFolder.fotoPlaca ? 'completed' : ''}" data-step="1">
          <span class="step-number">1</span>
          <span>Placa</span>
        </button>
        <button class="step-btn ${activeStep === 2 ? 'active' : ''} ${currentFolder.fotosPeca?.length ? 'completed' : ''}" data-step="2">
          <span class="step-number">2</span>
          <span>Peças</span>
        </button>
        <button class="step-btn ${activeStep === 3 ? 'active' : ''} ${currentFolder.pecasIdentificadas?.length ? 'completed' : ''}" data-step="3">
          <span class="step-number">3</span>
          <span>IA & Conferência</span>
        </button>
        <button class="step-btn ${activeStep === 4 ? 'active' : ''} ${(currentFolder.motorNum || currentFolder.procedimentos?.length) ? 'completed' : ''}" data-step="4">
          <span class="step-number">4</span>
          <span>Procedimentos & Motor</span>
        </button>
        <button class="step-btn ${activeStep === 5 ? 'active' : ''}" data-step="5">
          <span class="step-number">5</span>
          <span>Resumo & Envio</span>
        </button>
      </nav>
    </div>

    <!-- Step Panels Container -->
    <div class="steps-container">
      ${renderStep1Placa(currentFolder)}
      ${renderStep2Pecas(currentFolder)}
      ${renderStep3IA(currentFolder)}
      ${renderStep4ProcedimentosMotor(currentFolder)}
      ${renderStep5Resumo(currentFolder)}
    </div>
  `;

  attachFolderEvents(currentFolder);
}

/**
 * Step 1: Placa do Motor (RF02)
 */
function renderStep1Placa(folder) {
  const hasPhoto = Boolean(folder.fotoPlaca);

  return `
    <section class="step-panel ${activeStep === 1 ? 'active' : ''}" id="step-panel-1">
      <div class="panel-card">
        <div class="panel-header">
          <h3>📷 1. Foto da Placa do Motor</h3>
          <p>Fotografe a placa do veículo/motor com a câmera inteligente para identificação oficial.</p>
        </div>

        <div class="plate-widget-container">
          <!-- Brazilian Mercosul Visual Plate -->
          <div class="mercosul-plate">
            <div class="mercosul-header">
              <span class="mercosul-country">BRASIL</span>
              <div class="mercosul-flag"><div class="mercosul-flag-diamond"></div></div>
            </div>
            <div class="mercosul-body">
              <span class="mercosul-text" id="display-mercosul-plate">${folder.placa || 'ABC-4E78'}</span>
            </div>
          </div>

          ${hasPhoto ? `
            <img src="${folder.fotoPlaca}" class="plate-photo-preview" alt="Foto da Placa" id="img-placa-preview" />
          ` : `
            <p class="form-hint">Nenhuma foto da placa capturada ainda.</p>
          `}
        </div>

        <div class="form-group">
          <label for="input-placa-text">Placa do Motor / Veículo</label>
          <input type="text" id="input-placa-text" class="input-huge" maxlength="8" placeholder="ABC-4E78" value="${folder.placa || ''}" />
          <small class="form-hint">Digite a placa Mercosul (ex: ABC4E78) ou padrão antigo (ex: ABC-1234).</small>
        </div>

        <div class="action-row">
          <button class="btn btn-primary" id="btn-live-camera-placa">
            📸 Abrir Câmera ao Vivo (Viewfinder)
          </button>
          <button class="btn btn-secondary" id="btn-upload-placa">
            📁 Arquivo do Aparelho
          </button>
          <button class="btn btn-secondary" id="btn-sample-placa" title="Usar foto de placa real da oficina">
            🧪 Usar Foto de Exemplo (Mercosul)
          </button>
        </div>

        <div class="action-row" style="margin-top: 1.5rem; justify-content: flex-end;">
          <button class="btn btn-success" id="btn-next-step-1">
            Avançar para Fotos das Peças ➔
          </button>
        </div>
      </div>
    </section>
  `;
}

/**
 * Step 2: Fotos das Peças (RF03)
 */
function renderStep2Pecas(folder) {
  const fotos = folder.fotosPeca || [];

  return `
    <section class="step-panel ${activeStep === 2 ? 'active' : ''}" id="step-panel-2">
      <div class="panel-card">
        <div class="panel-header">
          <h3>📦 2. Fotos das Peças do Motor</h3>
          <p>Tire fotos dos componentes com o visor da câmera (cabeçote, bloco, bielas, virabrequim, etc.).</p>
        </div>

        <div class="action-row">
          <button class="btn btn-primary" id="btn-live-camera-pecas">
            📸 Tirar Foto de Peça (Câmera ao Vivo)
          </button>
          <button class="btn btn-secondary" id="btn-upload-pecas">
            📁 Adicionar Fotos do Aparelho
          </button>
          <button class="btn btn-secondary" id="btn-sample-pecas">
            🧪 Carregar Peças de Exemplo da Oficina
          </button>
        </div>

        ${fotos.length > 0 ? `
          <div class="photos-grid">
            ${fotos.map((src, idx) => `
              <div class="photo-card" data-idx="${idx}">
                <img src="${src}" alt="Foto da Peça ${idx + 1}" />
                <span class="photo-card-tag">Foto ${idx + 1}</span>
                <button class="photo-card-remove" data-idx="${idx}" title="Remover esta foto">✕</button>
              </div>
            `).join('')}
          </div>
        ` : `
          <div style="padding: 2.5rem; text-align: center; border: 2px dashed var(--border-subtle); border-radius: var(--radius-md); margin-top: 1rem;">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">Nenhuma foto de peças adicionada nesta pasta.</p>
            <small style="color: var(--text-muted);">Use a câmera da oficina ou carregue fotos para a IA identificar.</small>
          </div>
        `}

        <div class="action-row" style="margin-top: 1.5rem; justify-content: space-between;">
          <button class="btn btn-secondary" id="btn-prev-step-2">
            ⬅ Voltar para Placa
          </button>
          <button class="btn btn-success" id="btn-next-step-2" ${fotos.length === 0 ? 'disabled style="opacity: 0.5;"' : ''}>
            Avançar para Identificação IA ➔
          </button>
        </div>
      </div>
    </section>
  `;
}

/**
 * Step 3: Identificação por IA & Conferência (RF04, RF05, RF06, RF16)
 */
function renderStep3IA(folder) {
  const items = folder.pecasIdentificadas || [];
  const estadoCabecote = folder.estadoCabecote || '';

  return `
    <section class="step-panel ${activeStep === 3 ? 'active' : ''}" id="step-panel-3">
      <div class="panel-card">
        <div class="panel-header">
          <h3>🤖 3. Identificação por IA & Conferência Manual</h3>
          <p>A IA analisa as fotos e sugere os componentes. O retificador tem a palavra final para conferir e corrigir.</p>
        </div>

        <!-- Trigger Button -->
        <div class="action-row" style="margin-bottom: 1.25rem;">
          <button class="btn btn-primary" id="btn-run-ai-scan" style="flex: 1;">
            ✨ Executar Análise Inteligente de Peças
          </button>
          ${isNetworkOffline ? `
            <span class="status-pill status-offline" style="align-self: center;" title="Motor offline inteligente ativo">
              OFFLINE ATIVO
            </span>
          ` : `
            <span class="status-pill status-online" style="align-self: center;" title="Online com IA">
              ONLINE
            </span>
          `}
        </div>

        <div class="ai-results-wrapper">

          <!-- Specific Cylinder Head Status Selector (RF05, RF16) -->
          <div class="head-status-box">
            <div class="head-status-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
              </svg>
              SITUAÇÃO DO CABEÇOTE (DIAGNÓSTICO OBRIGATÓRIO)
            </div>
            <div class="head-options-grid">
              <button class="head-option-btn ${estadoCabecote === 'Cabeçote com tampa de válvula montado' ? 'selected' : ''}" data-head="Cabeçote com tampa de válvula montado">
                🔩 Cabeçote c/ tampa montado
              </button>
              <button class="head-option-btn ${estadoCabecote === 'Cabeçote desmontado' ? 'selected' : ''}" data-head="Cabeçote desmontado">
                ⚙️ Cabeçote desmontado
              </button>
              <button class="head-option-btn ${estadoCabecote === 'Somente cabeçote' ? 'selected' : ''}" data-head="Somente cabeçote">
                📦 Somente cabeçote
              </button>
              <button class="head-option-btn ${estadoCabecote === 'Tampa de válvula separada' ? 'selected' : ''}" data-head="Tampa de válvula separada">
                🏷️ Tampa de válvula separada
              </button>
              <button class="head-option-btn ${estadoCabecote === 'Sem cabeçote / Não identificado' ? 'selected' : ''}" data-head="Sem cabeçote / Não identificado">
                🚫 Sem cabeçote / Não identif.
              </button>
            </div>
          </div>

          <!-- Identified Items List -->
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem;">
              Itens Identificados nas Fotos (${items.length}):
            </h4>

            <div class="parts-list-container" id="parts-list-container">
              ${items.length > 0 ? items.map((p, idx) => `
                <div class="part-item-row" data-idx="${idx}">
                  <div class="part-item-left">
                    <input type="checkbox" class="part-checkbox" data-idx="${idx}" checked />
                    <div>
                      <div class="part-name">${p.nome}</div>
                      ${p.detalhe ? `<div class="part-detail">${p.detalhe}</div>` : ''}
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="part-badge-confidence conf-${p.status || 'alta'}">${p.confianca || 90}% Confiança</span>
                    <button class="part-remove-btn" data-idx="${idx}" title="Remover item">🗑️</button>
                  </div>
                </div>
              `).join('') : `
                <div style="padding: 1.5rem; text-align: center; background: var(--bg-darker); border-radius: var(--radius-md); color: var(--text-secondary);">
                  Clique em "Executar Análise Inteligente de Peças" ou adicione itens manualmente abaixo.
                </div>
              `}
            </div>
          </div>

          <!-- Quick Extra Workshop Chips -->
          <div class="quick-chips-box">
            <div class="quick-chips-title">+ ADICIONAR OUTRA PEÇA MANUALMENTE:</div>
            <div class="chips-wrapper">
              ${COMMON_EXTRA_PARTS.map(partName => `
                <button class="chip-btn" data-part="${partName}">+ ${partName}</button>
              `).join('')}
              <button class="chip-btn" id="btn-custom-part" style="border-color: var(--accent-cyan); color: var(--accent-cyan);">+ Digitar Outra Peça...</button>
            </div>
          </div>

        </div>

        <div class="action-row" style="margin-top: 1.5rem; justify-content: space-between;">
          <button class="btn btn-secondary" id="btn-prev-step-3">
            ⬅ Voltar para Fotos
          </button>
          <button class="btn btn-success" id="btn-next-step-3">
            Avançar para Procedimentos & Motor ➔
          </button>
        </div>
      </div>
    </section>
  `;
}

/**
 * Step 4: Procedimentos a Fazer, Localização & Número do Motor
 */
function renderStep4ProcedimentosMotor(folder) {
  const selectedProcs = folder.procedimentos || [];
  const loc = folder.localizacao || {};

  return `
    <section class="step-panel ${activeStep === 4 ? 'active' : ''}" id="step-panel-4">
      <div class="panel-card">
        <div class="panel-header">
          <h3>⚙️ 4. Procedimentos a Executar, Localização & Motor</h3>
          <p>Especifique o nome da oficina, localização da coleta, serviços técnicos e numeração do motor.</p>
        </div>

        <!-- 1. Nome da Oficina -->
        <div class="form-group">
          <label for="input-oficina-nome">🏢 Nome da Oficina / Retífica Responsável</label>
          <input type="text" id="input-oficina-nome" placeholder="Ex: Retífica Central de Motores" value="${folder.oficinaNome || appSettings.empresaNome || 'Retífica Especializada'}" />
          <small class="form-hint">Este nome aparecerá em todos os resumos, comprovantes e mensagens de WhatsApp.</small>
        </div>

        <!-- 2. Localização GPS & Ponto de Coleta -->
        <div class="location-box">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-weight: 700; font-size: 0.88rem; color: var(--accent-cyan);">
              📍 Localização da Retífica / Coleta do Motor
            </label>
            <button class="btn btn-secondary" id="btn-fetch-gps" style="min-height: 38px; padding: 0.4rem 0.85rem; font-size: 0.8rem;">
              📡 Obter GPS Atual
            </button>
          </div>

          <div class="location-status-row">
            ${loc.coords ? `
              <span class="location-badge-gps">
                🌐 Lat: ${loc.coords.lat}, Lng: ${loc.coords.lng}
              </span>
              <a href="${loc.mapsUrl}" target="_blank" style="color: var(--accent-amber); font-size: 0.8rem; font-weight: 700; text-decoration: underline;">
                🔗 Abrir no Google Maps
              </a>
            ` : `
              <small style="color: var(--text-muted);">Coordenadas GPS não obtidas ainda. Clique em "Obter GPS Atual".</small>
            `}
          </div>

          <input type="text" id="input-localizacao-texto" placeholder="Ex: Oficina Matriz - Pátio de Entrada ou Cliente Auto Center..." value="${loc.texto || ''}" />
        </div>

        <!-- 3. Procedimentos a Executar (Chips + Observação detalhada) -->
        <div class="form-group" style="margin-top: 1.25rem;">
          <label style="font-weight: 700; font-size: 0.95rem;">
            🛠️ Procedimentos e Serviços a Fazer no Motor (Selecione):
          </label>
          <div class="procedure-chips-grid">
            ${STANDARD_PROCEDURES.map(proc => {
              const isSel = selectedProcs.includes(proc);
              return `
                <button class="proc-chip ${isSel ? 'selected' : ''}" data-proc="${proc}">
                  ${isSel ? '✔️' : '➕'} ${proc}
                </button>
              `;
            }).join('')}
          </div>

          <label for="input-procedimentos-texto" style="margin-top: 0.85rem;">
            📝 Explicação Detalhada dos Procedimentos / Ordens Técnicas:
          </label>
          <textarea id="input-procedimentos-texto" rows="3" placeholder="Explique os procedimentos que devem ser feitos (ex: Plainar cabeçote tirando no máximo 0,15mm; fazer teste hidrostático de trinca; trocar retentores; brunir cilindros para pistões 0,50...)" style="margin-top: 0.35rem;">${folder.procedimentosTexto || ''}</textarea>
        </div>

        <!-- 4. Número do Motor -->
        <div class="form-group" style="margin-top: 1.25rem;">
          <label for="input-motor-num">⚙️ Número do Motor (Gravação do Bloco)</label>
          <input type="text" id="input-motor-num" class="input-huge" placeholder="EA111-987654" value="${folder.motorNum || ''}" />
          <small class="form-hint">Atalhos rápidos de prefixos:</small>
          <div class="chips-wrapper" style="margin-top: 0.5rem;">
            <button class="chip-btn chip-prefix" data-prefix="EA111-">EA111 (VW)</button>
            <button class="chip-btn chip-prefix" data-prefix="AP1.8-">AP 1.8 (VW)</button>
            <button class="chip-btn chip-prefix" data-prefix="MWM-6.10-">MWM 6.10</button>
            <button class="chip-btn chip-prefix" data-prefix="FIRE-1.0-">FIRE 1.0 (Fiat)</button>
            <button class="chip-btn chip-prefix" data-prefix="ZETEC-ROCAM-">Zetec RoCam</button>
          </div>
        </div>

        <!-- 5. Outras Observações Gerais -->
        <div class="form-group">
          <label for="input-observacoes">Observações Adicionais</label>
          <textarea id="input-observacoes" rows="2" placeholder="Outras notas gerais...">${folder.observacoes || ''}</textarea>
        </div>

        <div class="action-row" style="margin-top: 1.5rem; justify-content: space-between;">
          <button class="btn btn-secondary" id="btn-prev-step-4">
            ⬅ Voltar para IA
          </button>
          <button class="btn btn-success" id="btn-next-step-4">
            Revisar e Finalizar Resumo ➔
          </button>
        </div>
      </div>
    </section>
  `;
}

/**
 * Step 5: Resumo & Envio (RF08, RF09, RF10, RF11, RF12)
 */
function renderStep5Resumo(folder) {
  const summaryText = buildTextSummary(folder, appSettings);
  const pecas = folder.pecasIdentificadas || [];
  const fotos = folder.fotosPeca || [];
  const procs = folder.procedimentos || [];
  const oficina = folder.oficinaNome || appSettings.empresaNome || 'RETÍFICA ESPECIALIZADA';

  return `
    <section class="step-panel ${activeStep === 5 ? 'active' : ''}" id="step-panel-5">
      <div class="panel-card">
        <div class="panel-header">
          <h3>📋 5. Resumo Oficial & Compartilhamento</h3>
          <p>Revise todos os dados e envie por WhatsApp ou E-mail com a identificação completa da oficina.</p>
        </div>

        <!-- Printable White Receipt Card -->
        <div class="receipt-card" id="receipt-preview-card">
          <div class="receipt-header">
            <h4>${oficina}</h4>
            <p>ORDEM DE REGISTRO & PROCEDIMENTOS DE RETÍFICA</p>
            ${folder.localizacao?.texto ? `<small style="color: #475569; font-weight: 600;">📍 ${folder.localizacao.texto}</small>` : ''}
          </div>

          <div class="receipt-meta-grid">
            <div class="receipt-meta-item">
              <strong>Placa do Veículo:</strong>
              <span>${folder.placa || 'NÃO INFORMADA'}</span>
            </div>
            <div class="receipt-meta-item">
              <strong>Nº do Motor:</strong>
              <span>${folder.motorNum || 'NÃO INFORMADO'}</span>
            </div>
            <div class="receipt-meta-item">
              <strong>Data / Hora:</strong>
              <span style="font-size: 0.9rem;">${folder.updatedAt ? new Date(folder.updatedAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}</span>
            </div>
            <div class="receipt-meta-item">
              <strong>Oficina Responsável:</strong>
              <span style="font-size: 0.9rem;">${oficina}</span>
            </div>
          </div>

          <!-- Procedures Box on Receipt -->
          ${(procs.length > 0 || folder.procedimentosTexto) ? `
            <div style="background: #f8fafc; border-left: 4px solid #f59e0b; padding: 0.75rem; margin-bottom: 0.85rem; border-radius: 4px;">
              <div class="receipt-section-title" style="color: #b45309;">🛠️ Procedimentos a Executar:</div>
              ${procs.length > 0 ? `
                <ul style="margin-left: 1.25rem; font-size: 0.88rem; color: #1e293b; margin-bottom: 0.4rem;">
                  ${procs.map(p => `<li>${p}</li>`).join('')}
                </ul>
              ` : ''}
              ${folder.procedimentosTexto ? `
                <p style="font-size: 0.85rem; color: #334155; font-style: italic;">
                  <strong>Instruções dos Procedimentos:</strong> "${folder.procedimentosTexto}"
                </p>
              ` : ''}
            </div>
          ` : ''}

          <div style="margin-bottom: 0.85rem;">
            <div class="receipt-section-title">Situação do Cabeçote:</div>
            <p style="font-weight: 700; color: #0284c7;">${folder.estadoCabecote || 'Não informado / Sem cabeçote'}</p>
          </div>

          <div>
            <div class="receipt-section-title">Peças Conferidas (${pecas.length}):</div>
            <ul class="receipt-parts-list">
              ${pecas.length > 0 ? pecas.map((p, i) => `
                <li>✔️ <strong>${p.nome}</strong> ${p.detalhe ? `— <small style="color: #64748b;">${p.detalhe}</small>` : ''}</li>
              `).join('') : `
                <li style="color: #94a3b8;">Nenhuma peça registrada</li>
              `}
            </ul>
          </div>

          ${folder.observacoes ? `
            <div style="margin-top: 0.75rem;">
              <div class="receipt-section-title">Outras Observações:</div>
              <p style="font-size: 0.85rem; color: #334155; font-style: italic;">"${folder.observacoes}"</p>
            </div>
          ` : ''}

          <!-- Attached Photo Strip -->
          ${(folder.fotoPlaca || fotos.length > 0) ? `
            <div style="margin-top: 1rem;">
              <div class="receipt-section-title">Fotos do Registro:</div>
              <div class="receipt-photos-strip">
                ${folder.fotoPlaca ? `<img src="${folder.fotoPlaca}" class="receipt-photo-thumb" alt="Placa" />` : ''}
                ${fotos.map(f => `<img src="${f}" class="receipt-photo-thumb" alt="Peça" />`).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Sharing Actions Row -->
        <div class="action-row">
          <button class="btn btn-whatsapp" id="btn-share-whatsapp" style="flex: 1;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/>
            </svg>
            Enviar por WhatsApp
          </button>
          <button class="btn btn-secondary" id="btn-share-email" style="flex: 1;">
            ✉️ Enviar por E-mail
          </button>
        </div>

        <div class="action-row">
          <button class="btn btn-secondary" id="btn-copy-summary">
            📋 Copiar Texto do Resumo
          </button>
          <button class="btn btn-secondary" id="btn-print-receipt">
            🖨️ Imprimir Comprovante
          </button>
          <button class="btn btn-success" id="btn-archive-finish" style="flex: 1;">
            🎉 Concluir & Liberar Esta Pasta
          </button>
        </div>

        <div class="action-row" style="margin-top: 1.5rem; justify-content: flex-start;">
          <button class="btn btn-secondary" id="btn-prev-step-5">
            ⬅ Voltar para Edição
          </button>
        </div>
      </div>
    </section>
  `;
}

/**
 * Event Listeners for Current Active Folder
 */
function attachFolderEvents(folder) {
  // Navigation between steps
  document.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const step = parseInt(e.currentTarget.getAttribute('data-step'), 10);
      playSound('click', appSettings.somAtivado);
      activeStep = step;
      renderApp();
    });
  });

  // Save draft
  document.getElementById('btn-save-draft').addEventListener('click', async () => {
    folder.updatedAt = new Date().toISOString();
    if (folder.status === 'livre' && (folder.placa || folder.fotoPlaca)) {
      folder.status = 'em_preenchimento';
    }
    await saveFolders(folders);
    playSound('success', appSettings.somAtivado);
    showToast('Pasta salva localmente com sucesso!', 'success');
    renderFoldersTabs();
  });

  // Reset / Clear folder
  document.getElementById('btn-reset-folder').addEventListener('click', async () => {
    if (confirm(`Tem certeza que deseja limpar a ${folder.name}? Todas as fotos e dados serão apagados.`)) {
      folder.status = 'livre';
      folder.placa = '';
      folder.motorNum = '';
      folder.fotoPlaca = null;
      folder.fotosPeca = [];
      folder.pecasIdentificadas = [];
      folder.observacoes = '';
      folder.estadoCabecote = '';
      folder.procedimentos = [];
      folder.procedimentosTexto = '';
      folder.localizacao = { texto: '', coords: null, mapsUrl: '' };
      folder.updatedAt = null;
      activeStep = 1;
      await saveFolders(folders);
      playSound('click', appSettings.somAtivado);
      showToast(`${folder.name} foi liberada!`, 'success');
      renderApp();
    }
  });

  // STEP 1 EVENTS
  const inputPlaca = document.getElementById('input-placa-text');
  if (inputPlaca) {
    inputPlaca.addEventListener('input', (e) => {
      let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (val.length === 7 && !val.includes('-')) {
        if (/^[A-Z]{3}[0-9]{4}$/.test(val)) {
          val = val.slice(0, 3) + '-' + val.slice(3);
        }
      }
      folder.placa = val;
      if (folder.status === 'livre' && val) folder.status = 'em_preenchimento';
      const displayElem = document.getElementById('display-mercosul-plate');
      if (displayElem) displayElem.textContent = val || 'ABC-4E78';
      saveFolders(folders);
      renderFoldersTabs();
    });

    document.getElementById('btn-live-camera-placa').addEventListener('click', () => {
      openLiveCamera('placa');
    });

    document.getElementById('btn-upload-placa').addEventListener('click', () => {
      playSound('click', appSettings.somAtivado);
      fileInputPlaca.removeAttribute('capture');
      fileInputPlaca.click();
      setTimeout(() => fileInputPlaca.setAttribute('capture', 'environment'), 1000);
    });

    document.getElementById('btn-sample-placa').addEventListener('click', async () => {
      playSound('shutter', appSettings.somAtivado);
      folder.fotoPlaca = '/samples/placa.jpg';
      folder.placa = 'ABC4E78';
      folder.status = 'em_preenchimento';
      folder.updatedAt = new Date().toISOString();
      await saveFolders(folders);
      showToast('Foto de placa Mercosul carregada!', 'success');
      renderApp();
    });

    document.getElementById('btn-next-step-1').addEventListener('click', () => {
      playSound('click', appSettings.somAtivado);
      activeStep = 2;
      renderApp();
    });
  }

  // STEP 2 EVENTS
  const btnLiveCameraPecas = document.getElementById('btn-live-camera-pecas');
  if (btnLiveCameraPecas) {
    btnLiveCameraPecas.addEventListener('click', () => {
      openLiveCamera('pecas');
    });

    document.getElementById('btn-upload-pecas').addEventListener('click', () => {
      playSound('click', appSettings.somAtivado);
      fileInputPecas.removeAttribute('capture');
      fileInputPecas.click();
      setTimeout(() => fileInputPecas.setAttribute('capture', 'environment'), 1000);
    });

    document.getElementById('btn-sample-pecas').addEventListener('click', async () => {
      playSound('shutter', appSettings.somAtivado);
      folder.fotosPeca = [
        '/samples/cabecote.jpg',
        '/samples/bloco.jpg',
        '/samples/bielas_pistoes.jpg'
      ];
      folder.status = 'em_preenchimento';
      folder.updatedAt = new Date().toISOString();
      await saveFolders(folders);
      showToast('3 fotos reais de oficina adicionadas!', 'success');
      renderApp();
    });

    // Remove photo
    document.querySelectorAll('.photo-card-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        folder.fotosPeca.splice(idx, 1);
        await saveFolders(folders);
        playSound('click', appSettings.somAtivado);
        showToast('Foto removida.', 'warning');
        renderApp();
      });
    });

    // Zoom photo
    document.querySelectorAll('.photo-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('photo-card-remove')) return;
        const img = card.querySelector('img');
        if (img) {
          zoomImageElement.src = img.src;
          zoomImageCaption.textContent = card.querySelector('.photo-card-tag')?.textContent || 'Foto de Peça';
          modalPhotoZoom.classList.add('open');
          playSound('click', appSettings.somAtivado);
        }
      });
    });

    document.getElementById('btn-prev-step-2').addEventListener('click', () => {
      activeStep = 1;
      renderApp();
    });

    document.getElementById('btn-next-step-2').addEventListener('click', () => {
      playSound('click', appSettings.somAtivado);
      activeStep = 3;
      renderApp();
    });
  }

  // STEP 3 EVENTS (IA Identification)
  const btnRunAI = document.getElementById('btn-run-ai-scan');
  if (btnRunAI) {
    btnRunAI.addEventListener('click', async () => {
      const allPhotos = [];
      if (folder.fotosPeca && folder.fotosPeca.length > 0) {
        allPhotos.push(...folder.fotosPeca);
      }
      if (folder.fotoPlaca) {
        allPhotos.push(folder.fotoPlaca);
      }

      if (allPhotos.length === 0) {
        showToast('Adicione fotos das peças na Etapa 2 antes de analisar!', 'warning');
        activeStep = 2;
        renderApp();
        return;
      }

      btnRunAI.disabled = true;
      btnRunAI.innerHTML = '⚡ Analisando Peças com Visão Computacional...';
      playSound('scan', appSettings.somAtivado);

      try {
        const result = await analyzeEnginePhotos(allPhotos, appSettings.geminiApiKey, isNetworkOffline);
        folder.pecasIdentificadas = result.items || [];
        folder.estadoCabecote = result.estadoCabecote || folder.estadoCabecote;
        folder.status = 'pronta_envio';
        folder.updatedAt = new Date().toISOString();
        await saveFolders(folders);
        playSound('success', appSettings.somAtivado);
        showToast(`IA identificou ${result.items.length} componentes!`, 'success');
      } catch (err) {
        console.error('Erro na análise:', err);
        showToast('Falha na análise. Verifique imagem ou conexão.', 'danger');
      } finally {
        renderApp();
      }
    });

    // Cylinder head state buttons
    document.querySelectorAll('.head-option-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const val = btn.getAttribute('data-head');
        folder.estadoCabecote = val;
        await saveFolders(folders);
        playSound('click', appSettings.somAtivado);
        renderApp();
      });
    });

    // Toggle part checkbox
    document.querySelectorAll('.part-checkbox').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        if (!e.target.checked) {
          folder.pecasIdentificadas.splice(idx, 1);
          await saveFolders(folders);
          renderApp();
        }
      });
    });

    // Remove part
    document.querySelectorAll('.part-remove-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        folder.pecasIdentificadas.splice(idx, 1);
        await saveFolders(folders);
        playSound('click', appSettings.somAtivado);
        renderApp();
      });
    });

    // Quick chips add
    document.querySelectorAll('.chip-btn[data-part]').forEach(chip => {
      chip.addEventListener('click', async () => {
        const partName = chip.getAttribute('data-part');
        folder.pecasIdentificadas.push({
          id: 'manual_' + Date.now(),
          nome: partName,
          confianca: 100,
          status: 'alta',
          categoria: 'acessorio',
          detalhe: 'Adicionado pelo retificador'
        });
        await saveFolders(folders);
        playSound('click', appSettings.somAtivado);
        showToast(`${partName} adicionado!`, 'success');
        renderApp();
      });
    });

    document.getElementById('btn-custom-part')?.addEventListener('click', async () => {
      const nome = prompt('Digite o nome da peça para adicionar:');
      if (nome && nome.trim()) {
        folder.pecasIdentificadas.push({
          id: 'manual_' + Date.now(),
          nome: nome.trim(),
          confianca: 100,
          status: 'alta',
          categoria: 'acessorio',
          detalhe: 'Adicionado pelo retificador'
        });
        await saveFolders(folders);
        playSound('click', appSettings.somAtivado);
        renderApp();
      }
    });

    document.getElementById('btn-prev-step-3').addEventListener('click', () => {
      activeStep = 2;
      renderApp();
    });

    document.getElementById('btn-next-step-3').addEventListener('click', () => {
      playSound('click', appSettings.somAtivado);
      activeStep = 4;
      renderApp();
    });
  }

  // STEP 4 EVENTS (Procedimentos, Localização & Motor)
  const inputOficinaNome = document.getElementById('input-oficina-nome');
  if (inputOficinaNome) {
    inputOficinaNome.addEventListener('input', (e) => {
      folder.oficinaNome = e.target.value.trim();
      saveFolders(folders);
    });

    document.getElementById('btn-fetch-gps').addEventListener('click', () => {
      playSound('click', appSettings.somAtivado);
      fetchGPSLocation(folder);
    });

    document.getElementById('input-localizacao-texto').addEventListener('input', (e) => {
      if (!folder.localizacao) folder.localizacao = {};
      folder.localizacao.texto = e.target.value;
      saveFolders(folders);
    });

    // Procedure chips toggle
    document.querySelectorAll('.proc-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        const procName = chip.getAttribute('data-proc');
        if (!folder.procedimentos) folder.procedimentos = [];
        const index = folder.procedimentos.indexOf(procName);
        if (index > -1) {
          folder.procedimentos.splice(index, 1);
        } else {
          folder.procedimentos.push(procName);
        }
        await saveFolders(folders);
        playSound('click', appSettings.somAtivado);
        renderApp();
      });
    });

    document.getElementById('input-procedimentos-texto').addEventListener('input', (e) => {
      folder.procedimentosTexto = e.target.value;
      saveFolders(folders);
    });

    const inputMotorNum = document.getElementById('input-motor-num');
    inputMotorNum.addEventListener('input', (e) => {
      folder.motorNum = e.target.value.toUpperCase();
      folder.updatedAt = new Date().toISOString();
      saveFolders(folders);
      renderFoldersTabs();
    });

    document.querySelectorAll('.chip-prefix').forEach(chip => {
      chip.addEventListener('click', () => {
        const prefix = chip.getAttribute('data-prefix');
        inputMotorNum.value = prefix;
        folder.motorNum = prefix;
        inputMotorNum.focus();
        saveFolders(folders);
      });
    });

    document.getElementById('input-observacoes')?.addEventListener('input', (e) => {
      folder.observacoes = e.target.value;
      saveFolders(folders);
    });

    document.getElementById('btn-prev-step-4').addEventListener('click', () => {
      activeStep = 3;
      renderApp();
    });

    document.getElementById('btn-next-step-4').addEventListener('click', () => {
      playSound('click', appSettings.somAtivado);
      activeStep = 5;
      renderApp();
    });
  }

  // STEP 5 EVENTS (Resumo & Envio)
  const btnShareWhatsApp = document.getElementById('btn-share-whatsapp');
  if (btnShareWhatsApp) {
    btnShareWhatsApp.addEventListener('click', async () => {
      playSound('click', appSettings.somAtivado);

      if (isNetworkOffline) {
        folder.status = 'aguardando_conexao';
        folder.updatedAt = new Date().toISOString();
        await saveFolders(folders);
        renderFoldersTabs();
        alert('⚠️ ATENÇÃO (OFFLINE):\nVocê está sem conexão com a internet neste momento.\n\nEsta pasta foi salva localmente como "Aguardando Conexão". Assim que a internet voltar, clique para enviar!');
        return;
      }

      await shareViaWhatsApp(folder, appSettings);
      folder.status = 'enviada';
      folder.updatedAt = new Date().toISOString();
      await saveFolders(folders);
      renderFoldersTabs();
    });

    document.getElementById('btn-share-email').addEventListener('click', async () => {
      playSound('click', appSettings.somAtivado);

      if (isNetworkOffline) {
        folder.status = 'aguardando_conexao';
        await saveFolders(folders);
        renderFoldersTabs();
        alert('⚠️ ATENÇÃO (OFFLINE):\nSem conexão no momento. Registro salvo como "Aguardando Conexão".');
        return;
      }

      shareViaEmail(folder, appSettings);
      folder.status = 'enviada';
      await saveFolders(folders);
      renderFoldersTabs();
    });

    document.getElementById('btn-copy-summary').addEventListener('click', async () => {
      const summary = buildTextSummary(folder, appSettings);
      const ok = await copyToClipboard(summary);
      if (ok) {
        playSound('success', appSettings.somAtivado);
        showToast('Resumo oficial copiado!', 'success');
      }
    });

    document.getElementById('btn-print-receipt').addEventListener('click', () => {
      window.print();
    });

    document.getElementById('btn-archive-finish').addEventListener('click', async () => {
      playSound('success', appSettings.somAtivado);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });

      const archived = await archiveFolder(folder);
      showToast(`Registro concluído e arquivado na ${folder.oficinaNome || 'oficina'}! Código: ${archived?.idRegistro || 'OK'}`, 'success');

      // Free slot
      folder.status = 'livre';
      folder.placa = '';
      folder.motorNum = '';
      folder.fotoPlaca = null;
      folder.fotosPeca = [];
      folder.pecasIdentificadas = [];
      folder.observacoes = '';
      folder.estadoCabecote = '';
      folder.procedimentos = [];
      folder.procedimentosTexto = '';
      folder.localizacao = { texto: '', coords: null, mapsUrl: '' };
      folder.updatedAt = null;
      activeStep = 1;

      await saveFolders(folders);
      await updateArchiveBadge();
      renderApp();
    });

    document.getElementById('btn-prev-step-5').addEventListener('click', () => {
      activeStep = 4;
      renderApp();
    });
  }
}

/**
 * Handle plate photo file fallback
 */
function handlePlacaFileSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    playSound('shutter', appSettings.somAtivado);
    const currentFolder = folders.find(f => f.id === activeFolderId);
    currentFolder.fotoPlaca = evt.target.result;
    if (currentFolder.status === 'livre') currentFolder.status = 'em_preenchimento';
    currentFolder.updatedAt = new Date().toISOString();
    await saveFolders(folders);
    showToast('Foto da placa salva!', 'success');
    renderApp();
  };
  reader.readAsDataURL(file);
}

/**
 * Handle parts photos selection fallback (multiple)
 */
function handlePecasFileSelect(e) {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  let loaded = 0;
  const currentFolder = folders.find(f => f.id === activeFolderId);
  if (!currentFolder.fotosPeca) currentFolder.fotosPeca = [];

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      currentFolder.fotosPeca.push(evt.target.result);
      loaded++;
      if (loaded === files.length) {
        playSound('shutter', appSettings.somAtivado);
        if (currentFolder.status === 'livre') currentFolder.status = 'em_preenchimento';
        currentFolder.updatedAt = new Date().toISOString();
        await saveFolders(folders);
        showToast(`${files.length} foto(s) de peças adicionada(s)!`, 'success');
        renderApp();
      }
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Open and Render Archive Modal
 */
async function openArchiveModal() {
  const archive = await loadArchive();
  const archiveList = document.getElementById('archive-list');
  const searchInput = document.getElementById('archive-search-input');

  function renderList(items) {
    if (items.length === 0) {
      archiveList.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-secondary);">Nenhum registro histórico arquivado ainda.</div>`;
      return;
    }

    archiveList.innerHTML = items.map((rec, i) => `
      <div style="background: var(--bg-darker); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 0.75rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
          <strong style="color: var(--accent-amber); font-family: 'JetBrains Mono', monospace;">${rec.idRegistro || `REG-#${i+1}`}</strong>
          <small style="color: var(--text-muted);">${rec.archivedAt ? new Date(rec.archivedAt).toLocaleString('pt-BR') : ''}</small>
        </div>
        <div style="font-size: 0.85rem; color: var(--accent-cyan); font-weight: 700; margin-bottom: 0.25rem;">
          🏢 ${rec.oficinaNome || 'Retífica'} ${rec.localizacao?.texto ? `| 📍 ${rec.localizacao.texto}` : ''}
        </div>
        <div style="font-size: 0.95rem; font-weight: 700;">
          Placa: <span style="font-family:'JetBrains Mono';">${rec.placa || 'S/N'}</span> | Motor: <span style="font-family:'JetBrains Mono';">${rec.motorNum || 'S/N'}</span>
        </div>
        ${rec.procedimentos?.length ? `
          <div style="font-size: 0.8rem; color: #fbbf24; margin-top: 0.25rem;">
            🛠️ Serviços: ${rec.procedimentos.join(', ')}
          </div>
        ` : ''}
        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">
          Peças (${rec.pecasIdentificadas?.length || 0}): ${rec.pecasIdentificadas?.map(p => p.nome).join(', ') || 'Sem peças'}
        </div>
        <div style="margin-top: 0.6rem; display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary btn-copy-rec" data-idx="${i}" style="min-height:36px; padding: 0.35rem 0.75rem; font-size: 0.78rem;">
            📋 Copiar Resumo
          </button>
        </div>
      </div>
    `).join('');

    archiveList.querySelectorAll('.btn-copy-rec').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const rec = items[idx];
        const txt = buildTextSummary(rec, appSettings);
        await copyToClipboard(txt);
        showToast('Resumo histórico copiado!', 'success');
      });
    });
  }

  renderList(archive);

  searchInput.oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = archive.filter(r => 
      (r.placa && r.placa.toLowerCase().includes(term)) ||
      (r.motorNum && r.motorNum.toLowerCase().includes(term)) ||
      (r.idRegistro && r.idRegistro.toLowerCase().includes(term)) ||
      (r.oficinaNome && r.oficinaNome.toLowerCase().includes(term))
    );
    renderList(filtered);
  };

  modalArchive.classList.add('open');
}

// Start App
initApp();
