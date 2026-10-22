/**
 * Sharing Service: WhatsApp, E-mail, Web Share API, Clipboard & Print
 * Updated with Workshop Name, Requested Procedures & GPS Location / Maps Link
 */

/**
 * Generates formatted text summary of the engine record
 * @param {Object} folder Current active folder
 * @param {Object} settings Company and contact settings
 * @returns {string} Formatted text
 */
export function buildTextSummary(folder, settings = {}) {
  const empresa = (folder.oficinaNome || settings.empresaNome || 'Retífica Especializada').toUpperCase();
  const dataFormatada = folder.updatedAt 
    ? new Date(folder.updatedAt).toLocaleString('pt-BR') 
    : new Date().toLocaleString('pt-BR');

  const lines = [
    `🏢 *${empresa}*`,
    `📋 *ORDEM DE REGISTRO & PROCEDIMENTOS DE MOTOR*`,
    `📅 *Data/Hora:* ${dataFormatada}`,
    `🚗 *Placa do Veículo:* ${folder.placa || 'NÃO INFORMADA'}`,
    `⚙️ *Nº do Motor:* ${folder.motorNum || 'NÃO INFORMADO'}`
  ];

  // Location / GPS
  if (folder.localizacao && (folder.localizacao.texto || folder.localizacao.mapsUrl)) {
    lines.push(`----------------------------------------`);
    lines.push(`📍 *LOCALIZAÇÃO / PONTO DE COLETA:*`);
    if (folder.localizacao.texto) {
      lines.push(`  ${folder.localizacao.texto}`);
    }
    if (folder.localizacao.mapsUrl) {
      lines.push(`  🔗 Mapa: ${folder.localizacao.mapsUrl}`);
    }
  }

  // Procedures & Services to be done
  const procs = folder.procedimentos || [];
  const procsTexto = (folder.procedimentosTexto || '').trim();
  if (procs.length > 0 || procsTexto) {
    lines.push(`----------------------------------------`);
    lines.push(`🛠️ *PROCEDIMENTOS & SERVIÇOS A FAZER:*`);
    if (procs.length > 0) {
      procs.forEach(p => lines.push(`  ▪️ ${p}`));
    }
    if (procsTexto) {
      lines.push(`  📝 *Instruções específicas dos procedimentos:*`);
      lines.push(`  _${procsTexto}_`);
    }
  }

  lines.push(`----------------------------------------`);
  lines.push(`📋 *SITUAÇÃO DO CABEÇOTE:*`);
  lines.push(`  ${folder.estadoCabecote || 'Não informado / Sem cabeçote'}`);
  lines.push(``);
  lines.push(`📦 *PEÇAS CONFERIDAS E RECEBIDAS/ENVIADAS:*`);

  if (folder.pecasIdentificadas && folder.pecasIdentificadas.length > 0) {
    folder.pecasIdentificadas.forEach((p, idx) => {
      const conf = p.confianca ? ` [${p.confianca}% conf.]` : '';
      lines.push(`  ${idx + 1}. ✔️ ${p.nome}${conf}`);
      if (p.detalhe) {
        lines.push(`     ↳ _${p.detalhe}_`);
      }
    });
  } else {
    lines.push(`  (Nenhuma peça registrada)`);
  }

  if (folder.observacoes && folder.observacoes.trim()) {
    lines.push(``);
    lines.push(`📝 *OBSERVAÇÕES GERAIS:*`);
    lines.push(`  ${folder.observacoes.trim()}`);
  }

  const qtdFotos = (folder.fotoPlaca ? 1 : 0) + (folder.fotosPeca ? folder.fotosPeca.length : 0);
  lines.push(``);
  lines.push(`📷 *Fotos Vinculadas:* ${qtdFotos} foto(s) salvas no sistema local da ${empresa}.`);
  lines.push(`----------------------------------------`);
  lines.push(`_Registro gerado pelo Retífica Vision AI_`);

  return lines.join('\n');
}

/**
 * Share via WhatsApp
 */
export async function shareViaWhatsApp(folder, settings) {
  const summaryText = buildTextSummary(folder, settings);
  const encodedText = encodeURIComponent(summaryText);
  const phone = (settings.telefoneWhatsApp || '').replace(/\D/g, '');

  // If mobile supports Web Share API with files, try sharing with images
  if (navigator.share && canShareFiles()) {
    try {
      const files = await prepareFilesForShare(folder);
      if (files.length > 0) {
        await navigator.share({
          title: `Registro de Motor - Placa ${folder.placa || 'Sem placa'} - ${folder.oficinaNome || 'Oficina'}`,
          text: summaryText,
          files: files
        });
        return { success: true, method: 'web-share' };
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Web Share falhou, usando link direto wa.me:', err);
      } else {
        return { success: false, aborted: true };
      }
    }
  }

  // Direct WhatsApp Web / App link
  const url = phone 
    ? `https://wa.me/${phone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  window.open(url, '_blank');
  return { success: true, method: 'direct-link' };
}

/**
 * Share via E-mail
 */
export function shareViaEmail(folder, settings) {
  const empresa = folder.oficinaNome || settings.empresaNome || 'Retífica';
  const subject = encodeURIComponent(`[${empresa}] Registro de Motor - Placa: ${folder.placa || 'Sem placa'} | Motor: ${folder.motorNum || 'S/N'}`);
  const summaryText = buildTextSummary(folder, settings);
  const body = encodeURIComponent(summaryText + '\n\n*Nota: Fotos originais salvas no sistema da oficina.');
  const to = settings.emailDestino || '';

  const mailtoUrl = `mailto:${to}?subject=${subject}&body=${body}`;
  window.location.href = mailtoUrl;
  return { success: true };
}

/**
 * Check if Web Share API supports file sharing
 */
function canShareFiles() {
  return navigator.canShare && typeof File !== 'undefined';
}

/**
 * Convert base64 photos to File objects for native sharing
 */
async function prepareFilesForShare(folder) {
  const files = [];
  try {
    if (folder.fotoPlaca && folder.fotoPlaca.startsWith('data:image')) {
      const blob = await fetch(folder.fotoPlaca).then(r => r.blob());
      files.push(new File([blob], `placa_${folder.placa || 'motor'}.jpg`, { type: 'image/jpeg' }));
    }
    if (folder.fotosPeca && Array.isArray(folder.fotosPeca)) {
      for (let i = 0; i < Math.min(folder.fotosPeca.length, 5); i++) {
        const foto = folder.fotosPeca[i];
        if (typeof foto === 'string' && foto.startsWith('data:image')) {
          const blob = await fetch(foto).then(r => r.blob());
          files.push(new File([blob], `peca_${i + 1}.jpg`, { type: 'image/jpeg' }));
        }
      }
    }
  } catch (e) {
    console.warn('Erro ao preparar arquivos para compartilhamento:', e);
  }
  return files;
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
