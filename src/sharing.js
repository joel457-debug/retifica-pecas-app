/**
 * Sharing Service: WhatsApp, E-mail, Web Share API, Clipboard & Visual Image Drafts
 * Updated for Retífica de Motores Nova Opção
 * 
 * Includes:
 * 1. Ultra-concise, essential WhatsApp/Email text summary
 * 2. High-resolution Visual Receipt Image Generator (Canvas)
 * 3. Native multi-file sharing (Photos + Summary Card) for WhatsApp
 * 4. Image download / clipboard copy fallback
 */

const DEFAULT_WORKSHOP = 'Retífica de Motores Nova Opção';

/**
 * Generates concise, essential text summary of the engine record
 * Formatted cleanly for WhatsApp and E-mail
 * @param {Object} folder Current active folder
 * @param {Object} settings Company and contact settings
 * @returns {string} Formatted text
 */
export function buildTextSummary(folder, settings = {}) {
  const empresa = (folder.oficinaNome || settings.empresaNome || DEFAULT_WORKSHOP).toUpperCase();
  const dataFormatada = folder.updatedAt 
    ? new Date(folder.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) 
    : new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const placa = folder.placa ? folder.placa.trim().toUpperCase() : 'SEM PLACA';
  const motor = folder.motorNum ? folder.motorNum.trim().toUpperCase() : 'NÃO INFORMADO';
  const pecas = folder.pecasIdentificadas || [];
  const procs = folder.procedimentos || [];
  const procsTexto = (folder.procedimentosTexto || '').trim();
  const obs = (folder.observacoes || '').trim();

  const lines = [
    `*${empresa}*`,
    `🚗 Placa: *${placa}* | Motor: *${motor}*`,
    `📅 ${dataFormatada}`
  ];

  // Serviços / Procedimentos essenciais
  if (procs.length > 0 || procsTexto) {
    lines.push(``);
    lines.push(`🛠️ *SERVIÇOS A FAZER:*`);
    procs.forEach(p => lines.push(`• ${p}`));
    if (procsTexto) lines.push(`  _${procsTexto}_`);
  }

  // Situação do cabeçote (se relevante)
  if (folder.estadoCabecote && !folder.estadoCabecote.toLowerCase().includes('sem cabeçote')) {
    lines.push(``);
    lines.push(`⚙️ *CABEÇOTE:* ${folder.estadoCabecote}`);
  }

  // Peças conferidas com quantidade
  if (pecas.length > 0) {
    lines.push(``);
    lines.push(`📦 *PEÇAS CONFERIDAS:*`);
    pecas.forEach(p => {
      const qtd = p.quantidade && p.quantidade > 1 ? `${p.quantidade}x ` : (p.quantidade === 1 ? '1x ' : '• ');
      lines.push(`• ${qtd}${p.nome}`);
    });
  }

  // Observações (se houver)
  if (obs) {
    lines.push(``);
    lines.push(`📝 *OBS:* ${obs}`);
  }

  return lines.join('\n');
}

/**
 * Check if Web Share API supports file sharing
 */
export function canShareFiles() {
  return typeof navigator !== 'undefined' && 
         Boolean(navigator.share) && 
         Boolean(navigator.canShare) && 
         typeof File !== 'undefined';
}

/**
 * Convert base64 photos to File objects for native sharing
 */
export async function prepareFilesForShare(folder) {
  const files = [];
  try {
    if (folder.fotoPlaca && folder.fotoPlaca.startsWith('data:image')) {
      const blob = await fetch(folder.fotoPlaca).then(r => r.blob());
      files.push(new File([blob], `placa_${folder.placa || 'motor'}.jpg`, { type: 'image/jpeg' }));
    }
    if (folder.fotosPeca && Array.isArray(folder.fotosPeca)) {
      for (let i = 0; i < Math.min(folder.fotosPeca.length, 6); i++) {
        const foto = folder.fotosPeca[i];
        if (typeof foto === 'string' && foto.startsWith('data:image')) {
          const blob = await fetch(foto).then(r => r.blob());
          files.push(new File([blob], `peca_${i + 1}.jpg`, { type: 'image/jpeg' }));
        }
      }
    }
  } catch (e) {
    console.warn('Erro ao preparar fotos para compartilhamento:', e);
  }
  return files;
}

/**
 * Standard WhatsApp Share (Text link or Web Share fallback)
 */
export async function shareViaWhatsApp(folder, settings = {}) {
  const summaryText = buildTextSummary(folder, settings);
  const encodedText = encodeURIComponent(summaryText);
  const phone = (settings.telefoneWhatsApp || '').replace(/\D/g, '');

  const url = phone 
    ? `https://wa.me/${phone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  window.open(url, '_blank');
  return { success: true, method: 'direct-link' };
}

/**
 * Share Draft With Images (Web Share API with Photos or download + text fallback)
 */
export async function shareDraftWithPhotos(folder, settings = {}) {
  const summaryText = buildTextSummary(folder, settings);
  const empresa = folder.oficinaNome || settings.empresaNome || DEFAULT_WORKSHOP;
  const placa = folder.placa || 'MOTOR';

  // 1. Generate visual card of the draft
  let cardBlob = null;
  try {
    cardBlob = await generateReceiptImageBlob(folder, settings);
  } catch (err) {
    console.warn('Não foi possível gerar card composto, usando fotos originais:', err);
  }

  // 2. Prepare files to share
  const filesToShare = [];
  if (cardBlob) {
    filesToShare.push(new File([cardBlob], `ordem_${placa}_resumo.png`, { type: 'image/png' }));
  }

  const rawPhotos = await prepareFilesForShare(folder);
  filesToShare.push(...rawPhotos);

  // 3. Try native Web Share API with files (Android Chrome, iOS Safari, etc.)
  if (canShareFiles() && filesToShare.length > 0) {
    try {
      if (navigator.canShare({ files: filesToShare })) {
        await navigator.share({
          title: `${empresa} - Placa ${placa}`,
          text: summaryText,
          files: filesToShare
        });
        return { success: true, method: 'native-share' };
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, aborted: true };
      }
      console.warn('Web Share de arquivos falhou, acionando fallback:', err);
    }
  }

  // 4. Fallback for Desktop or unsupported browsers:
  // Download the card image, copy text to clipboard, and open WhatsApp
  if (cardBlob) {
    downloadBlob(cardBlob, `Ordem_${placa}_${empresa.replace(/\s+/g, '_')}.png`);
  }
  await copyToClipboard(summaryText);

  const phone = (settings.telefoneWhatsApp || '').replace(/\D/g, '');
  const encodedText = encodeURIComponent(summaryText);
  const waUrl = phone ? `https://wa.me/${phone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;
  window.open(waUrl, '_blank');

  return { success: true, method: 'download-and-wa' };
}

/**
 * Share via E-mail
 */
export function shareViaEmail(folder, settings = {}) {
  const empresa = folder.oficinaNome || settings.empresaNome || DEFAULT_WORKSHOP;
  const placa = folder.placa || 'Sem placa';
  const motor = folder.motorNum || 'S/N';
  const subject = encodeURIComponent(`[${empresa}] Registro de Motor - Placa: ${placa} | Motor: ${motor}`);
  const summaryText = buildTextSummary(folder, settings);
  const body = encodeURIComponent(summaryText + '\n\n*Fotos salvas e registradas no sistema da oficina.');
  const to = settings.emailDestino || '';

  const mailtoUrl = `mailto:${to}?subject=${subject}&body=${body}`;
  window.location.href = mailtoUrl;
  return { success: true };
}

/**
 * Copy formatted text to clipboard
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch (err) {
    console.error('Falha ao copiar:', err);
    return false;
  }
}

/**
 * Helper to download a Blob as a file
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}

/**
 * Helper to load an image safely into an Image element
 */
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Generates a high-resolution, printable visual card image of the engine record
 * Includes header, vehicle details, procedures, checked parts list, and attached photos
 * @param {Object} folder Current active folder
 * @param {Object} settings App settings
 * @returns {Promise<Blob>} PNG Blob of the visual card
 */
export async function generateReceiptImageBlob(folder, settings = {}) {
  const WIDTH = 920;
  const PADDING = 36;
  const empresa = (folder.oficinaNome || settings.empresaNome || DEFAULT_WORKSHOP).toUpperCase();
  const placa = folder.placa ? folder.placa.trim().toUpperCase() : 'SEM PLACA';
  const motor = folder.motorNum ? folder.motorNum.trim().toUpperCase() : 'NÃO INFORMADO';
  const dataFormatada = folder.updatedAt 
    ? new Date(folder.updatedAt).toLocaleString('pt-BR') 
    : new Date().toLocaleString('pt-BR');

  const pecas = folder.pecasIdentificadas || [];
  const procs = folder.procedimentos || [];
  const procsTexto = (folder.procedimentosTexto || '').trim();
  const obs = (folder.observacoes || '').trim();

  // Load photos
  const photoPlateImg = await loadImage(folder.fotoPlaca);
  const partsImgs = [];
  if (Array.isArray(folder.fotosPeca)) {
    for (const p of folder.fotosPeca.slice(0, 4)) {
      const img = await loadImage(p);
      if (img) partsImgs.push(img);
    }
  }

  // Pre-calculate height
  let estimatedHeight = 320; // header + meta
  if (procs.length > 0 || procsTexto) estimatedHeight += 40 + (procs.length * 28) + (procsTexto ? 36 : 0);
  if (folder.estadoCabecote) estimatedHeight += 50;
  estimatedHeight += 40 + Math.max(pecas.length, 1) * 32;
  if (obs) estimatedHeight += 60;
  if (photoPlateImg || partsImgs.length > 0) estimatedHeight += 210;
  estimatedHeight += 60; // footer

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = Math.max(700, estimatedHeight);
  const ctx = canvas.getContext('2d');

  // Background - Crisp Clean Dark Industrial Card
  ctx.fillStyle = '#0c1017';
  ctx.fillRect(0, 0, WIDTH, canvas.height);

  // Outer border & Accent Top Bar
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, WIDTH, 8);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, WIDTH - 2, canvas.height - 2);

  let currentY = PADDING + 10;

  // Header
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(empresa, PADDING, currentY);
  currentY += 28;

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('ORDEM DE REGISTRO, DIAGNÓSTICO & CONFERÊNCIA DE PEÇAS', PADDING, currentY);
  currentY += 25;

  // Header Divider
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PADDING, currentY);
  ctx.lineTo(WIDTH - PADDING, currentY);
  ctx.stroke();
  currentY += 22;

  // Meta Box (Placa / Motor / Data)
  const metaBoxHeight = 82;
  ctx.fillStyle = '#131924';
  ctx.fillRect(PADDING, currentY, WIDTH - (PADDING * 2), metaBoxHeight);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.strokeRect(PADDING, currentY, WIDTH - (PADDING * 2), metaBoxHeight);

  // Placa
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('PLACA DO VEÍCULO', PADDING + 16, currentY + 28);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px "JetBrains Mono", monospace';
  ctx.fillText(placa, PADDING + 16, currentY + 60);

  // Motor
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Nº DO MOTOR', PADDING + 290, currentY + 28);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.fillText(motor, PADDING + 290, currentY + 60);

  // Data / Hora
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('DATA & HORA', PADDING + 580, currentY + 28);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(dataFormatada, PADDING + 580, currentY + 58);

  currentY += metaBoxHeight + 24;

  // Procedimentos
  if (procs.length > 0 || procsTexto) {
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('🛠️ SERVIÇOS & PROCEDIMENTOS A EXECUTAR:', PADDING, currentY);
    currentY += 24;

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
    procs.forEach(p => {
      ctx.fillText(`  ▪ ${p}`, PADDING + 10, currentY);
      currentY += 24;
    });

    if (procsTexto) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'italic 14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`  Instruções: "${procsTexto}"`, PADDING + 10, currentY);
      currentY += 24;
    }
    currentY += 10;
  }

  // Situação do cabeçote
  if (folder.estadoCabecote) {
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`⚙️ SITUAÇÃO DO CABEÇOTE: ${folder.estadoCabecote}`, PADDING, currentY);
    currentY += 28;
  }

  // Peças conferidas
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`📦 PEÇAS CONFERIDAS E RECEBIDAS (${pecas.length}):`, PADDING, currentY);
  currentY += 24;

  if (pecas.length > 0) {
    ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
    pecas.forEach(p => {
      const qtdText = p.quantidade && p.quantidade > 1 ? `[${p.quantidade} un.] ` : (p.quantidade === 1 ? '[1 un.] ' : '');
      ctx.fillStyle = '#34d399';
      ctx.fillText('✓', PADDING + 12, currentY);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`${qtdText}${p.nome}`, PADDING + 32, currentY);
      currentY += 26;
    });
  } else {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('(Nenhuma peça registrada na conferência)', PADDING + 12, currentY);
    currentY += 24;
  }
  currentY += 8;

  // Observações
  if (obs) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`📝 OBSERVAÇÕES: "${obs}"`, PADDING, currentY);
    currentY += 28;
  }

  // Embedded Photos Strip
  const allRenderPhotos = [];
  if (photoPlateImg) allRenderPhotos.push({ img: photoPlateImg, label: 'Placa' });
  partsImgs.forEach((img, i) => allRenderPhotos.push({ img, label: `Peça ${i + 1}` }));

  if (allRenderPhotos.length > 0) {
    currentY += 8;
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('FOTOS DO REGISTRO (CONFERÊNCIA VISUAL):', PADDING, currentY);
    currentY += 16;

    const thumbW = 150;
    const thumbH = 110;
    allRenderPhotos.forEach((item, index) => {
      const posX = PADDING + (index * (thumbW + 16));
      if (posX + thumbW <= WIDTH - PADDING) {
        ctx.save();
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(posX, currentY, thumbW, thumbH);
        ctx.drawImage(item.img, posX, currentY, thumbW, thumbH);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(posX, currentY, thumbW, thumbH);

        // Tag
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(posX + 4, currentY + thumbH - 22, thumbW - 8, 18);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.label, posX + (thumbW / 2), currentY + thumbH - 8);
        ctx.textAlign = 'start';
        ctx.restore();
      }
    });
    currentY += thumbH + 20;
  }

  // Footer
  ctx.fillStyle = '#475569';
  ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`Documento oficial de conferência e entrada de peças • Gerado por Retífica Vision AI • ${empresa}`, PADDING, canvas.height - 18);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Falha ao gerar blob de imagem do card'));
    }, 'image/png', 0.95);
  });
}

/**
 * Direct download of the generated visual card image
 */
export async function downloadDraftImage(folder, settings = {}) {
  const placa = folder.placa ? folder.placa.trim().toUpperCase() : 'MOTOR';
  const empresa = (folder.oficinaNome || settings.empresaNome || DEFAULT_WORKSHOP).replace(/\s+/g, '_');
  const blob = await generateReceiptImageBlob(folder, settings);
  downloadBlob(blob, `Rascunho_${placa}_${empresa}.png`);
  return true;
}
