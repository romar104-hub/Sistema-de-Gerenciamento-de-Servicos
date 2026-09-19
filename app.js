const STORAGE_KEY = 'criatorio_marques_servicos';
const STORAGE_KEY_AREAS = 'criatorio_marques_areas';

let servicoPendentePausaId = null;
let servicoConclusaoId = null;
let servicoEdicaoConclusaoId = null;
let imagensTempConclusao = [];
let fotoTempAreaBase64 = '';
let filtroStatusAtual = null;

let dadosFazenda = JSON.parse(localStorage.getItem('dadosFazenda')) || {
  nome: 'CRIATÓRIO MARQUES',
  slogan: 'Excelência em Genética e Manejo no Sertão',
  cidade: 'Belém do São Francisco - PE',
  logoBase64: ''
};

let logoTempBase64 = '';

document.addEventListener('DOMContentLoaded', () => {
  carregarDadosFazendaNaTela();
  if (!localStorage.getItem('dadosFazenda')) {
    abrirModalPerfilFazenda(true);
  }
  buscarClimaBelem();
  atualizarDashboard();
  filtrarServicos();
  atualizarStatusConexao();
});

// ESCUTADORES DE REDE
window.addEventListener('online', atualizarStatusConexao);
window.addEventListener('offline', atualizarStatusConexao);

/* ==========================================================================
   GERENCIAMENTO DE DADOS E PERSISTÊNCIA
   ========================================================================== */
function carregarServicos() {
  const dados = localStorage.getItem(STORAGE_KEY);
  return dados ? JSON.parse(dados) : [];
}

function salvarServicos(servicos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(servicos));
  atualizarDashboard();
  filtrarServicos();
}

function obterDataHoraAtual() {
  const agora = new Date();
  return agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/* ==========================================================================
   MODAIS E FORMULÁRIOS DE SERVIÇOS
   ========================================================================== */
function abrirModal() {
  atualizarSelectAreasServico();
  document.getElementById('modal-servico').style.display = 'flex';
}

function fecharModal() {
  document.getElementById('modal-servico').style.display = 'none';
  document.getElementById('form-servico').reset();
}

function salvarServicoFormulario(event) {
  event.preventDefault();

  const nome = document.getElementById('nome-servico').value;
  const local = document.getElementById('local-servico').value || 'Geral';
  const responsavel = document.getElementById('responsavel-servico').value || 'Não atribuído';
  const prioridade = document.getElementById('prioridade-servico').value;
  const observacoes = document.getElementById('obs-servico').value;

  const dataAgendadaVal = document.getElementById('data-agendada') ? document.getElementById('data-agendada').value : '';
  const horaAgendadaVal = document.getElementById('hora-agendada') ? document.getElementById('hora-agendada').value : '';

  let statusInicial = 'Pendente';
  let informacaoAgendamento = null;

  if (dataAgendadaVal) {
    statusInicial = 'Agendado';
    const partesData = dataAgendadaVal.split('-');
    const dataFormatada = `${partesData[2]}/${partesData[1]}/${partesData[0]}`;
    informacaoAgendamento = `${dataFormatada}${horaAgendadaVal ? ' às ' + horaAgendadaVal : ''}`;
  }

  const servicos = carregarServicos();
  const novoServico = {
    id: Date.now(),
    nome: nome,
    local: local,
    responsavel: responsavel,
    prioridade: prioridade,
    observacoes: observacoes,
    status: statusInicial,
    agendamento: informacaoAgendamento,
    historicoExecucao: [],
    conclusaoInfo: null,
    fotos: [],
    data: new Date().toLocaleDateString('pt-BR')
  };

  servicos.unshift(novoServico);
  salvarServicos(servicos);
  fecharModal();
}

/* ==========================================================================
   FILTROS E RENDERIZAÇÃO
   ========================================================================== */
function filtrarPorStatus(status) {
  if (filtroStatusAtual === status) {
    filtroStatusAtual = null;
  } else {
    filtroStatusAtual = status;
  }
  atualizarEstiloCards();
  filtrarServicos();
}

function atualizarEstiloCards() {
  if (document.getElementById('card-agendados')) document.getElementById('card-agendados').classList.toggle('ativo', filtroStatusAtual === 'Agendado');
  if (document.getElementById('card-pendentes')) document.getElementById('card-pendentes').classList.toggle('ativo', filtroStatusAtual === 'Pendente');
  if (document.getElementById('card-execucao')) document.getElementById('card-execucao').classList.toggle('ativo', filtroStatusAtual === 'Em execução');
  if (document.getElementById('card-concluidos')) document.getElementById('card-concluidos').classList.toggle('ativo', filtroStatusAtual === 'Concluído');

  const titulo = document.getElementById('titulo-lista');
  if (titulo) {
    titulo.innerText = filtroStatusAtual ? `Serviços (${filtroStatusAtual})` : 'Serviços recentes';
  }
}

function filtrarServicos() {
  const termoInput = document.getElementById('search-input');
  const termo = termoInput ? termoInput.value.toLowerCase() : '';
  let servicos = carregarServicos();

  if (filtroStatusAtual) {
    servicos = servicos.filter(s => s.status === filtroStatusAtual);
  }

  if (termo) {
    servicos = servicos.filter(s =>
      s.nome.toLowerCase().includes(termo) ||
      s.local.toLowerCase().includes(termo) ||
      s.responsavel.toLowerCase().includes(termo)
    );
  }

  renderizarServicos(servicos);
}

function renderizarServicos(servicos) {
  const container = document.getElementById('lista-servicos');
  if (!container) return;

  if (servicos.length === 0) {
    container.innerHTML = '<p class="empty-msg" style="text-align: center; color: #7f8c8d; margin-top: 20px;">Nenhum serviço encontrado.</p>';
    return;
  }

  container.innerHTML = servicos.map(s => {
    const historico = s.historicoExecucao || [];
    const jaIniciouAlgo = historico.length > 0;
    const rotuloIniciar = jaIniciouAlgo ? '▶️ Retomar' : '🚀 Iniciar';

    const statusAtual = (s.status || '').toString().toLowerCase().trim();
    const isConcluido = statusAtual === 'concluído' || statusAtual === 'concluido';

    let acoesHTML = '<div class="service-actions" style="margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">';

    if (isConcluido) {
      // Quando concluído: Apenas botões de gestão da conclusão (SEM o botão de Excluir)
      acoesHTML += `
        <button onclick="abrirRelatorioCompleto(${s.id})" style="padding: 6px 12px; font-size: 0.8rem; background: #2980b9; color: white; border: none; border-radius: 6px; cursor: pointer;">📄 Resumo</button>
        <button onclick="enviarRelatorioWhatsApp(${s.id})" style="padding: 6px 12px; font-size: 0.8rem; background: #25d366; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">📲 WhatsApp</button>
        <button onclick="abrirModalEditarConclusao(${s.id})" style="padding: 6px 12px; font-size: 0.8rem; background: #f39c12; color: white; border: none; border-radius: 6px; cursor: pointer;">📷 Editar Fotos / Obs</button>
      `;
    } else {
      // Quando pendente / em execução: Botões de ação normal + Botão Excluir
      if (statusAtual === 'pendente' || statusAtual === 'agendado') {
        acoesHTML += `<button onclick="iniciarServico(${s.id})" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: #2e5a3c; color: white; border: none; border-radius: 6px; cursor: pointer;">${rotuloIniciar}</button>`;
      }
      if (statusAtual === 'em execução' || statusAtual === 'em execucao') {
        acoesHTML += `<button onclick="solicitarPausaServico(${s.id})" class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem; background: #e67e22; color: white; border: none; border-radius: 6px; cursor: pointer;">⏸️ Pausar</button>`;
      }
      acoesHTML += `<button onclick="solicitarConclusaoServico(${s.id})" style="padding: 6px 12px; font-size: 0.8rem; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer;">✅ Concluir</button>`;
      
      // O botão Excluir só é renderizado para serviços NÃO concluídos
      acoesHTML += `<button onclick="excluirServico(${s.id})" class="btn-delete" style="padding: 6px 12px; font-size: 0.8rem; background: #ff4d4d; color: white; border: none; border-radius: 6px; cursor: pointer; margin-left: auto;">Excluir</button>`;
    }

    acoesHTML += '</div>';

    return `
    <div class="service-card" style="background: #fff; padding: 14px; border-radius: 10px; margin-bottom: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
      <div class="service-main" style="display: flex; justify-content: space-between; align-items: center;">
        <h4 style="margin: 0; color: #1b3b22;">${s.nome.toUpperCase()}</h4>
        <span class="badge ${s.status.toLowerCase().replace(' ', '-').replace('ú', 'u')}" style="padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; background: #e2e8f0; color: #334155;">${s.status}</span>
      </div>
      <p class="service-info" style="font-size: 0.85rem; color: #64748b; margin: 6px 0;">📍 ${s.local} | 👤 ${s.responsavel} | 📅 Criado: ${s.data}</p>
      <p class="service-priority" style="font-size: 0.85rem; margin: 4px 0;">Prioridade: <strong>${s.prioridade}</strong></p>

      ${s.agendamento ? `<p style="font-size: 0.85rem; margin-top: 6px; color: #2980b9; background: #ebf5fb; padding: 6px; border-radius: 6px;">📅 <strong>Agendado para:</strong> ${s.agendamento}</p>` : ''}
      ${s.observacoes ? `<p style="font-size: 0.85rem; margin-top: 6px; color: #444; background: #f9f9f9; padding: 6px; border-radius: 6px;">📝 <strong>Obs:</strong> ${s.observacoes}</p>` : ''}

      ${historico.length > 0 ? `
        <div style="font-size: 0.8rem; margin-top: 8px; color: #2c3e50; background: #f1f5f9; padding: 8px; border-radius: 6px; border-left: 3px solid #2e5a3c;">
          <strong>⏱️ Registros de Execução:</strong>
          <div style="margin-top: 4px; display: flex; flex-direction: column; gap: 3px;">
            ${historico.map(h => `
              <div>
                <strong>${h.icone} ${h.acao}:</strong> ${h.dataHora}
                ${h.detalhes ? `<span style="color: #c0392b;"> (${h.detalhes})</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${s.conclusaoInfo ? `
        <div style="font-size: 0.8rem; margin-top: 8px; color: #1e7e34; background: #eafaf1; padding: 8px; border-radius: 6px; border-left: 3px solid #27ae60;">
          <strong>✅ Relatório de Conclusão:</strong>
          <div>${s.conclusaoInfo}</div>${s.fotos && s.fotos.length > 0 ? `
            <div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
              ${s.fotos.map(f => `<img src="${f}" class="img-zoom" onclick="ampliarImagem('${f}')" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #27ae60; cursor: pointer;">`).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${acoesHTML}
    </div>
  `;
  }).join('');
}

      ${s.conclusaoInfo ? `
        <div style="font-size: 0.8rem; margin-top: 8px; color: #1e7e34; background: #eafaf1; padding: 8px; border-radius: 6px; border-left: 3px solid #27ae60;">
          <strong>✅ Relatório de Conclusão:</strong>
          <div>${s.conclusaoInfo}</div>${s.fotos && s.fotos.length > 0 ? `
            <div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
              ${s.fotos.map(f => `<img src="${f}" class="img-zoom" onclick="ampliarImagem('${f}')" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #27ae60; cursor: pointer;">`).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${acoesHTML}
    </div>
  `;
  }).join('');
}

/* ==========================================================================
   AÇÕES DE EXECUÇÃO E PAUSA
   ========================================================================== */
function iniciarServico(id) {
  let servicos = carregarServicos();
  const item = servicos.find(s => s.id === id);
  if (item) {
    if (!item.historicoExecucao) item.historicoExecucao = [];
    const ehRetomada = item.historicoExecucao.length > 0;

    item.status = 'Em execução';
    item.historicoExecucao.push({
      acao: ehRetomada ? 'Retomou atividade' : 'Iniciou atividade',
      icone: ehRetomada ? '▶️' : '🚀',
      dataHora: obterDataHoraAtual()
    });

    salvarServicos(servicos);
  }
}

function solicitarPausaServico(id) {
  servicoPendentePausaId = id;
  document.getElementById('modal-justificativa').style.display = 'flex';
}

function fecharModalJustificativa() {
  servicoPendentePausaId = null;
  document.getElementById('texto-justificativa').value = '';
  document.getElementById('modal-justificativa').style.display = 'none';
}

function confirmarPausaServico() {
  const motivo = document.getElementById('texto-justificativa').value.trim();
  if (!motivo) return alert('Por favor, informe a justificativa.');

  let servicos = carregarServicos();
  const item = servicos.find(s => s.id === servicoPendentePausaId);
  if (item) {
    item.status = 'Pendente';
    if (!item.historicoExecucao) item.historicoExecucao = [];
    item.historicoExecucao.push({
      acao: 'Pausou atividade',
      icone: '⏸️',
      dataHora: obterDataHoraAtual(),
      detalhes: motivo
    });
    salvarServicos(servicos);
  }
  fecharModalJustificativa();
}

/* ==========================================================================
   PROCESSAMENTO DE IMAGENS E CONCLUSÃO
   ========================================================================== */
function solicitarConclusaoServico(id) {
  servicoConclusaoId = id;
  imagensTempConclusao = [];
  document.getElementById('preview-imagens').innerHTML = '';
  document.getElementById('modal-conclusao').style.display = 'flex';
}

function fecharModalConclusao() {
  servicoConclusaoId = null;
  imagensTempConclusao = [];
  document.getElementById('form-conclusao').reset();
  document.getElementById('modal-conclusao').style.display = 'none';
}

function comprimirImagem(file, maxWidth, maxHeight, quality, callback) {
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      callback(dataUrl);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function carregarImagensConclusao(event) {
  const files = Array.from(event.target.files);
  const preview = document.getElementById('preview-imagens');
  preview.innerHTML = '';
  imagensTempConclusao = [];

  if (files.length === 0) return;

  files.forEach(file => {
    comprimirImagem(file, 1000, 1000, 0.8, function(base64Otimizado) {
      imagensTempConclusao.push(base64Otimizado);

      const img = document.createElement('img');
      img.src = base64Otimizado;
      img.style.cssText = 'width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc;';
      preview.appendChild(img);
    });
  });
}

function confirmarConclusaoServico(event) {
  event.preventDefault();
  const relatorio = document.getElementById('relatorio-conclusao').value.trim();
  if (!relatorio) return alert('Informe o relatório de conclusão.');

  let servicos = carregarServicos();
  const item = servicos.find(s => s.id === servicoConclusaoId);
  if (item) {
    item.status = 'Concluído';
    item.conclusaoInfo = relatorio;
    item.fotos = imagensTempConclusao;
    if (!item.historicoExecucao) item.historicoExecucao = [];
    item.historicoExecucao.push({ acao: 'Concluiu atividade', icone: '🏁', dataHora: obterDataHoraAtual() });
    salvarServicos(servicos);
  }
  fecharModalConclusao();
}

/* ==========================================================================
   EDIÇÃO DE CONCLUSÃO (FOTOS / OBSERVAÇÕES)
   ========================================================================== */
function abrirModalEditarConclusao(id) {
  servicoEdicaoConclusaoId = id;
  const servicos = carregarServicos();
  const s = servicos.find(item => item.id === id);
  if (!s) return;

  document.getElementById('relatorio-conclusao-editar').value = s.conclusaoInfo || '';
  imagensTempConclusao = s.fotos ? [...s.fotos] : [];

  renderizarPreviewFotosEdicao();
  document.getElementById('modal-editar-conclusao').style.display = 'flex';
}

function fecharModalEditarConclusao() {
  servicoEdicaoConclusaoId = null;
  imagensTempConclusao = [];
  document.getElementById('modal-editar-conclusao').style.display = 'none';
}

function renderizarPreviewFotosEdicao() {
  const preview = document.getElementById('preview-imagens-editar');
  if (!preview) return;
  preview.innerHTML = '';
  imagensTempConclusao.forEach((imgSrc, index) => {
    const div = document.createElement('div');
    div.style.cssText = 'position: relative; display: inline-block;';
    div.innerHTML = `
      <img src="${imgSrc}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc;">
      <button type="button" onclick="removerFotoEdicao(${index})" style="position: absolute; top: -5px; right: -5px; background: #e74c3c; color: white; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer;">✕</button>
    `;
    preview.appendChild(div);
  });
}

function carregarNovasImagensEdicao(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  files.forEach(file => {
    comprimirImagem(file, 1000, 1000, 0.8, function(base64Otimizado) {
      imagensTempConclusao.push(base64Otimizado);
      renderizarPreviewFotosEdicao();
    });
  });
}

function removerFotoEdicao(index) {
  imagensTempConclusao.splice(index, 1);
  renderizarPreviewFotosEdicao();
}

function confirmarEdicaoConclusao(event) {
  event.preventDefault();
  const relatorio = document.getElementById('relatorio-conclusao-editar').value.trim();

  let servicos = carregarServicos();
  const item = servicos.find(s => s.id === servicoEdicaoConclusaoId);

  if (item) {
    item.conclusaoInfo = relatorio;
    item.fotos = imagensTempConclusao;
    salvarServicos(servicos);
  }

  fecharModalEditarConclusao();
}

/* ==========================================================================
   RELATÓRIOS E COMPARTILHAMENTO
   ========================================================================== */
function enviarRelatorioWhatsApp(id) {
  const servicos = carregarServicos();
  const s = servicos.find(item => item.id === id);
  if (!s) return;

  const nomeFazenda = dadosFazenda.nome || 'CRIATÓRIO MARQUES';
  const historico = s.historicoExecucao || [];

  let mensagem = `*🟢 RELATÓRIO DE SERVIÇO CONCLUÍDO*\n`;
  mensagem += `*${nomeFazenda.toUpperCase()}*\n\n`;
  mensagem += `📋 *Serviço:* ${s.nome.toUpperCase()}\n`;
  mensagem += `📍 *Local:* ${s.local}\n`;
  mensagem += `👤 *Responsável:* ${s.responsavel}\n`;
  mensagem += `📅 *Criado em:* ${s.data}\n`;
  if (s.agendamento) mensagem += `🗓️ *Agendado para:* ${s.agendamento}\n`;

  if (s.observacoes) {
    mensagem += `\n📝 *Orientações:* ${s.observacoes}\n`;
  }

  if (historico.length > 0) {
    mensagem += `\n⏱️ *Linha do Tempo:*\n`;
    historico.forEach(h => {
      mensagem += `${h.icone} ${h.acao}: ${h.dataHora}${h.detalhes ? ' (' + h.detalhes + ')' : ''}\n`;
    });
  }

  if (s.conclusaoInfo) {
    mensagem += `\n✅ *Parecer de Conclusão:*\n${s.conclusaoInfo}\n`;
  }

  if (s.fotos && s.fotos.length > 0) {
    mensagem += `\n📸 *Comprovantes Anexados:* ${s.fotos.length} foto(s) registrada(s) no sistema.`;
  }

  const urlWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;
  window.open(urlWhatsApp, '_blank');
}

function abrirRelatorioCompleto(id) {
  const servicos = carregarServicos();
  const s = servicos.find(item => item.id === id);
  if (!s) return;

  const container = document.getElementById('conteudo-relatorio');
  const historico = s.historicoExecucao || [];

  container.innerHTML = `
    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
      <h4 style="margin: 0 0 6px 0; color: #2e5a3c;">${s.nome.toUpperCase()}</h4>
      <p style="margin: 0; font-size: 0.9rem; color: #64748b;">📍 Local: ${s.local} | 👤 Responsável: ${s.responsavel}</p>
      <p style="margin: 4px 0 0 0; font-size: 0.9rem; color: #64748b;">📅 Criado: ${s.data} ${s.agendamento ? '| 📅 Agendado: ' + s.agendamento : ''}</p>
    </div>
    <div style="background: #fff; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; margin-top: 10px;">
      <strong>⏱️ Histórico e Linha do Tempo:</strong>
      <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem;">
        ${historico.map(h => `<div style="border-bottom: 1px dashed #e2e8f0; padding: 4px 0;"><strong>${h.icone}${h.acao}:</strong> ${h.dataHora}${h.detalhes ? `<div style="color: #c0392b;">Motivo: ${h.detalhes}</div>` : ''}</div>`).join('')}
      </div>
    </div>
    <div style="background: #f0fdf4; padding: 10px; border-radius: 6px; border: 1px solid #bbf7d0; margin-top: 10px;">
      <strong style="color: #166534;">✅ Conclusão:</strong>
      <p style="margin: 4px 0 0 0; font-size: 0.9rem; color: #15803d;">${s.conclusaoInfo || 'Nenhuma informação detalhada.'}</p>
    </div>
    ${s.fotos && s.fotos.length > 0 ? `
      <div style="margin-top: 10px;">
        <strong>📸 Comprovantes:</strong>
        <div style="display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap;">
          ${s.fotos.map(f => `<img src="${f}" class="img-zoom" onclick="ampliarImagem('${f}')" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 2px solid #27ae60; cursor: pointer;">`).join('')}
        </div>
      </div>
    ` : ''}
  `;

  document.getElementById('modal-relatorio').style.display = 'flex';
}

function fecharModalRelatorio() { document.getElementById('modal-relatorio').style.display = 'none'; }
function ampliarImagem(src) { document.getElementById('img-ampliada').src = src; document.getElementById('modal-zoom-imagem').style.display = 'flex'; }
function fecharZoomImagem() { document.getElementById('modal-zoom-imagem').style.display = 'none'; }

function excluirServico(id) {
  if (confirm('Deseja realmente excluir este serviço?')) {
    let servicos = carregarServicos();
    salvarServicos(servicos.filter(s => s.id !== id));
  }
}

/* ==========================================================================
   BACKUP E RESTAURAÇÃO
   ========================================================================== */
function exportarBackup() {
  const dados = localStorage.getItem(STORAGE_KEY) || '[]';
  const blob = new Blob([dados], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_criatorio_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importarBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const dados = JSON.parse(e.target.result);
      if (Array.isArray(dados)) { salvarServicos(dados); alert('Backup importado com sucesso!'); }
    } catch (err) { alert('Arquivo inválido.'); }
  };
  reader.readAsText(file);
}

function atualizarDashboard() {
  const servicos = carregarServicos();
  if (document.getElementById('count-agendados')) {
    document.getElementById('count-agendados').innerText = servicos.filter(s => s.status === 'Agendado').length;
    document.getElementById('count-pendentes').innerText = servicos.filter(s => s.status === 'Pendente').length;
    document.getElementById('count-execucao').innerText = servicos.filter(s => s.status === 'Em execução').length;
    document.getElementById('count-concluidos').innerText = servicos.filter(s => s.status === 'Concluído').length;
  }
}

/* ==========================================================================
   PERFIL DA FAZENDA E CLIMA
   ========================================================================== */
function carregarDadosFazendaNaTela() {
  document.getElementById('header-nome-fazenda').innerText = dadosFazenda.nome.toUpperCase();
  document.getElementById('header-slogan').innerText = `"${dadosFazenda.slogan}"`;
  document.getElementById('header-cidade').innerText = `📍 ${dadosFazenda.cidade}`;
  const logoContainer = document.getElementById('header-logo');
  if (dadosFazenda.logoBase64) {
    logoContainer.innerHTML = `<img src="${dadosFazenda.logoBase64}" alt="Logo">`;
  } else {
    logoContainer.innerText = dadosFazenda.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'CM';
  }
}

function abrirModalPerfilFazenda(isPrimeiroAcesso = false) {
  document.getElementById('input-nome-fazenda').value = dadosFazenda.nome || '';
  document.getElementById('input-slogan-fazenda').value = dadosFazenda.slogan || '';
  document.getElementById('input-cidade-fazenda').value = dadosFazenda.cidade || '';
  logoTempBase64 = dadosFazenda.logoBase64 || '';
  document.getElementById('preview-logo-box').innerHTML = logoTempBase64 ? `<img src="${logoTempBase64}">` : `<span style="font-size:0.75rem; color:#888;">Sem logo</span>`;
  document.getElementById('titulo-modal-fazenda').innerText = isPrimeiroAcesso ? '👋 Configure sua Propriedade' : '🏡 Dados da Propriedade';
  document.getElementById('modal-perfil-fazenda').style.display = 'flex';
}

function fecharModalPerfilFazenda() { document.getElementById('modal-perfil-fazenda').style.display = 'none'; }

function carregarPreviewLogo(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    logoTempBase64 = e.target.result;
    document.getElementById('preview-logo-box').innerHTML = `<img src="${logoTempBase64}">`;
  };
  reader.readAsDataURL(file);
}

function salvarPerfilFazenda(event) {
  event.preventDefault();
  dadosFazenda = {
    nome: document.getElementById('input-nome-fazenda').value.trim(),
    slogan: document.getElementById('input-slogan-fazenda').value.trim(),
    cidade: document.getElementById('input-cidade-fazenda').value.trim(),
    logoBase64: logoTempBase64
  };
  localStorage.setItem('dadosFazenda', JSON.stringify(dadosFazenda));
  carregarDadosFazendaNaTela();
  fecharModalPerfilFazenda();
  buscarClimaBelem();
}

async function buscarClimaBelem() {
  try {
    const cidadeQuery = encodeURIComponent(dadosFazenda.cidade || 'Belém do São Francisco');
    const geoResp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${cidadeQuery}&count=1&language=pt`);
    const geoData = await geoResp.json();
    let lat = -8.7531, lon = -38.9667;
    if (geoData && geoData.results && geoData.results[0]) {
      lat = geoData.results[0].latitude; lon = geoData.results[0].longitude;
    }
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    const data = await response.json();
    if (data && data.current_weather) {
      const temp = Math.round(data.current_weather.temperature);
      const code = data.current_weather.weathercode;
      document.getElementById('weather-temp').innerText = `${temp}°C`;
      let desc = "Ensolarado", icon = "☀️";
      if (code === 0) { desc = "Céu Limpo"; icon = "☀️"; }
      else if (code >= 1 && code <= 3) { desc = "Parcialmente Nublado"; icon = "⛅"; }
      else if (code >= 45 && code <= 48) { desc = "Nevoeiro"; icon = "🌫️"; }
      else if (code >= 51 && code <= 67) { desc = "Chuva Leve"; icon = "🌧️"; }
      else if (code >= 80 && code <= 99) { desc = "Pancadas / Chuva"; icon = "⛈️"; }
      document.getElementById('weather-desc').innerText = desc;
      document.getElementById('weather-icon').innerText = icon;
    }
  } catch (error) {
    document.getElementById('weather-temp').innerText = "32°C";
    document.getElementById('weather-desc').innerText = "Ensolarado";
    document.getElementById('weather-icon').innerText = "☀️";
  }
}

function atualizarStatusConexao() {
  const badge = document.getElementById('status-conexao');
  const dot = document.getElementById('dot-conexao');
  const texto = document.getElementById('texto-conexao');

  if (!badge || !dot || !texto) return;

  if (navigator.onLine) {
    dot.style.background = '#27ae60';
    texto.innerText = 'Online';
    badge.style.background = '#eafaf1';
    badge.style.color = '#1e7e34';
  } else {
    dot.style.background = '#e74c3c';
    texto.innerText = 'Offline (Modo Campo)';
    badge.style.background = '#fadbd8';
    badge.style.color = '#78281f';
  }
}

/* ==========================================================================
   GERENCIAMENTO DE ÁREAS CADASTRADAS
   ========================================================================== */
function carregarAreas() {
  const dados = localStorage.getItem(STORAGE_KEY_AREAS);
  return dados ? JSON.parse(dados) : [
    { id: 1, nome: 'Entrada', foto: '' },
    { id: 2, nome: 'Curral', foto: '' },
    { id: 3, nome: 'Baia', foto: '' },
    { id: 4, nome: 'Piquete', foto: '' },
    { id: 5, nome: 'Maternidade', foto: '' },
    { id: 6, nome: 'Galinheiro', foto: '' },
    { id: 7, nome: 'Quarto da Ração', foto: '' }
  ];
}

function salvarAreas(areas) {
  localStorage.setItem(STORAGE_KEY_AREAS, JSON.stringify(areas));
  renderizarListaAreas();
  atualizarSelectAreasServico();
}

function abrirModalAreas() {
  renderizarListaAreas();
  document.getElementById('modal-areas').style.display = 'flex';
}

function fecharModalAreas() {
  fotoTempAreaBase64 = '';
  document.getElementById('nome-area').value = '';
  document.getElementById('preview-foto-area').innerHTML = '';
  document.getElementById('modal-areas').style.display = 'none';
}

function carregarFotoArea(event) {
  const file = event.target.files[0];
  if (!file) return;
  comprimirImagem(file, 800, 800, 0.8, function(base64Otimizado) {
    fotoTempAreaBase64 = base64Otimizado;
    document.getElementById('preview-foto-area').innerHTML = `<img src="${base64Otimizado}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px; border: 1px solid #27ae60;">`;
  });
}

function salvarNovaArea(event) {
  event.preventDefault();
  const nome = document.getElementById('nome-area').value.trim();
  if (!nome) return;

  const areas = carregarAreas();
  areas.push({
    id: Date.now(),
    nome: nome,
    foto: fotoTempAreaBase64
  });

  salvarAreas(areas);
  fecharModalAreas();
  abrirModalAreas();
}

function excluirArea(id) {
  if (confirm('Deseja realmente remover esta área?')) {
    let areas = carregarAreas();
    salvarAreas(areas.filter(a => a.id !== id));
  }
}

function renderizarListaAreas() {
  const container = document.getElementById('lista-areas-cadastradas');
  if (!container) return;
  const areas = carregarAreas();

  if (areas.length === 0) {
    container.innerHTML = '<p style="font-size: 0.85rem; color: #888;">Nenhuma área cadastrada.</p>';
    return;
  }

  container.innerHTML = areas.map(a => `
    <div style="display: flex; align-items: center; justify-content: space-between; background: #fff; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 6px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        ${a.foto ? `<img src="${a.foto}" onclick="ampliarImagem('${a.foto}')" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; cursor: pointer;">` : '<span style="font-size: 1.2rem;">📍</span>'}
        <strong style="font-size: 0.9rem; color: #1b3b22;">${a.nome}</strong>
      </div>
      <button onclick="excluirArea(${a.id})" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">Excluir</button>
    </div>
  `).join('');
}

function atualizarSelectAreasServico() {
  const datalist = document.getElementById('lista-areas-autocomplete');
  if (!datalist) return;

  const areas = carregarAreas();
  datalist.innerHTML = areas.map(a => `<option value="${a.nome}">`).join('');
}
