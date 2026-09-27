/* ==========================================================================
   ESTADO GLOBAL E VARIÁVEIS DE CONTROLE
   ========================================================================== */
let filtroStatusAtual = null;
let perfilAtual = 'admin'; // Defina o perfil conforme a autenticação ('admin' ou 'operador')
let servicoPendentePausaId = null;
let servicoReagendarId = null;
let servicoConclusaoId = null;
let servicoEdicaoConclusaoId = null;
let imagensTempConclusao = [];

/* ==========================================================================
   FUNÇÕES AUXILIARES E PERSISTÊNCIA
   ========================================================================== */
function normalizarStatus(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function obterDataHoraAtual() {
  const agora = new Date();
  return agora.toLocaleString('pt-BR');
}

function carregarServicos() {
  const dados = localStorage.getItem('servicos_db');
  return dados ? JSON.parse(dados) : [];
}

function salvarServicos(servicos) {
  localStorage.setItem('servicos_db', JSON.stringify(servicos));
  atualizarContadoresCards();
  filtrarServicos();
}

/* ==========================================================================
   ATUALIZAÇÃO DE CONTADORES DOS CARDS
   ========================================================================== */
function atualizarContadoresCards() {
  const servicos = carregarServicos();

  let agendados = 0;
  let pendentes = 0;
  let execucao = 0;
  let concluidos = 0;

  servicos.forEach(s => {
    const st = normalizarStatus(s.status);
    if (st.includes('agendad')) agendados++;
    else if (st.includes('pendent')) pendentes++;
    else if (st.includes('execuc') || st.includes('andament')) execucao++;
    else if (st.includes('conclu')) concluidos++;
  });

  const elAgendados = document.getElementById('cnt-agendados') || document.querySelector('#card-agendados .qtd');
  const elPendentes = document.getElementById('cnt-pendentes') || document.querySelector('#card-pendentes .qtd');
  const elExecucao = document.getElementById('cnt-execucao') || document.querySelector('#card-execucao .qtd');
  const elConcluidos = document.getElementById('cnt-concluidos') || document.querySelector('#card-concluidos .qtd');

  if (elAgendados) elAgendados.innerText = agendados;
  if (elPendentes) elPendentes.innerText = pendentes;
  if (elExecucao) elExecucao.innerText = execucao;
  if (elConcluidos) elConcluidos.innerText = concluidos;
}

/* ==========================================================================
   FILTROS E RENDERIZAÇÃO DE LISTAS
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
  const filtroNorm = normalizarStatus(filtroStatusAtual);

  if (document.getElementById('card-agendados')) 
    document.getElementById('card-agendados').classList.toggle('ativo', filtroNorm.includes('agendad'));
  if (document.getElementById('card-pendentes')) 
    document.getElementById('card-pendentes').classList.toggle('ativo', filtroNorm.includes('pendent'));
  if (document.getElementById('card-execucao')) 
    document.getElementById('card-execucao').classList.toggle('ativo', filtroNorm.includes('execuc') || filtroNorm.includes('andament'));
  if (document.getElementById('card-concluidos')) 
    document.getElementById('card-concluidos').classList.toggle('ativo', filtroNorm.includes('conclu'));

  const titulo = document.getElementById('titulo-lista');
  if (titulo) {
    titulo.innerText = filtroStatusAtual ? `Serviços (${filtroStatusAtual})` : 'Serviços recentes';
  }
}

function filtrarServicos() {
  const termoInput = document.getElementById('search-input');
  const termo = termoInput ? normalizarStatus(termoInput.value) : '';
  let servicos = carregarServicos();

  if (filtroStatusAtual) {
    const filtroNorm = normalizarStatus(filtroStatusAtual);
    servicos = servicos.filter(s => normalizarStatus(s.status).includes(filtroNorm.slice(0, 5)));
  }

  if (termo) {
    servicos = servicos.filter(s =>
      normalizarStatus(s.nome).includes(termo) ||
      normalizarStatus(s.local).includes(termo) ||
      normalizarStatus(s.responsavel).includes(termo)
    );
  }

  renderizarServicos(servicos);
}

function renderizarServicos(servicos) {
  const container = document.getElementById('lista-servicos');
  if (!container) return;

  const areaBackup = document.getElementById('btn-backup');
  const areaImportar = document.getElementById('btn-importar');
  if (areaBackup) areaBackup.style.display = (perfilAtual === 'admin') ? 'inline-block' : 'none';
  if (areaImportar) areaImportar.style.display = (perfilAtual === 'admin') ? 'inline-block' : 'none';

  const lista = servicos || carregarServicos();

  if (lista.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; background: rgba(255, 255, 255, 0.05); border-radius: 12px; border: 1px dashed rgba(255, 255, 255, 0.2); margin-top: 15px;">
        <p style="font-size: 1.1rem; color: #a0aec0; margin: 0;">📋 Nenhum serviço cadastrado ou encontrado no filtro atual.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = lista.map(s => {
    const historico = s.historicoExecucao || [];
    const jaIniciouAlgo = historico.length > 0;
    const rotuloIniciar = jaIniciouAlgo ? '▶️ Retomar' : '🚀 Iniciar';

    const statusNorm = normalizarStatus(s.status);
    const isConcluido = statusNorm.includes('conclu');

    const hojeStr = new Date().toISOString().split('T')[0];
    const emAtraso = (!isConcluido) && (
      s.isAtrasado || 
      ((statusNorm.includes('agendad') || statusNorm.includes('pendent')) && (
        (typeof verificarAtrasoAgendamento === 'function' && verificarAtrasoAgendamento(s.agendamento || s.dataAgendada)) ||
        (s.dataAgendada && s.dataAgendada < hojeStr)
      ))
    );

    let acoesHTML = '<div class="service-actions" style="margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">';

    if (isConcluido) {
      acoesHTML += `
        <button onclick="abrirRelatorioCompleto(${s.id})" style="padding: 6px 12px; font-size: 0.8rem; background: #2980b9; color: white; border: none; border-radius: 6px; cursor: pointer;">📄 Resumo</button>
        <button onclick="enviarRelatorioWhatsApp(${s.id})" style="padding: 6px 12px; font-size: 0.8rem; background: #25d366; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">📲 WhatsApp</button>
      `;
      if (perfilAtual === 'admin') {
        acoesHTML += `
          <button onclick="abrirModalEditarConclusao(${s.id})" style="padding: 6px 12px; font-size: 0.8rem; background: #f39c12; color: white; border: none; border-radius: 6px; cursor: pointer;">📷 Editar Fotos / Obs</button>
          <button onclick="excluirServico(${s.id})" class="btn-delete" style="padding: 6px 12px; font-size: 0.8rem; background: #ff4d4d; color: white; border: none; border-radius: 6px; cursor: pointer; margin-left: auto;">Excluir</button>
        `;
      }
    } else {
      if (statusNorm.includes('pendent') || statusNorm.includes('agendad')) {
        acoesHTML += `<button onclick="iniciarServico(${s.id})" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: #2e5a3c; color: white; border: none; border-radius: 6px; cursor: pointer;">${rotuloIniciar}</button>`;
      }
      if (statusNorm.includes('execuc') || statusNorm.includes('andament')) {
        acoesHTML += `<button onclick="solicitarPausaServico(${s.id})" class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem; background: #e67e22; color: white; border: none; border-radius: 6px; cursor: pointer;">⏸️ Pausar</button>`;
      }
      acoesHTML += `<button onclick="solicitarConclusaoServico(${s.id})" style="padding: 6px 12px; font-size: 0.8rem; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer;">✅ Concluir</button>`;

      if (perfilAtual === 'admin') {
        acoesHTML += `<button onclick="excluirServico(${s.id})" class="btn-delete" style="padding: 6px 12px; font-size: 0.8rem; background: #ff4d4d; color: white; border: none; border-radius: 6px; cursor: pointer; margin-left: auto;">Excluir</button>`;
      }
    }
    acoesHTML += '</div>';

    return `
    <div class="service-card" style="background: #fff; padding: 14px; border-radius: 10px; margin-bottom: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; color: #333;">
      <div class="service-main" style="display: flex; justify-content: space-between; align-items: center;">
        <h4 style="margin: 0; color: #1b3b22; font-size: 1rem;">${(s.nome || 'Serviço').toUpperCase()}</h4>
        <span class="badge ${statusNorm.replace(/\s+/g, '-')}" style="padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; background: #e2e8f0; color: #334155;">${s.status}</span>
      </div>
      <p class="service-info" style="font-size: 0.85rem; color: #64748b; margin: 6px 0;">📍 ${s.local} | 👤 ${s.responsavel} | 📅 Criado: ${s.data || s.dataCriacao || 'N/A'}</p>
      <p class="service-priority" style="font-size: 0.85rem; margin: 4px 0;">Prioridade: <strong>${s.prioridade || 'Normal'}</strong></p>

      ${emAtraso ? `
        <div style="background: #fff5f5; border: 1px solid #feb2b2; padding: 8px 12px; border-radius: 6px; margin: 8px 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; border-left: 4px solid #e74c3c;">
          <span style="color: #c0392b; font-size: 0.85rem; font-weight: bold;">⚠️ Serviço Atrasado!</span>
          <button type="button" onclick="abrirModalReagendar(${s.id})" style="padding: 5px 10px; font-size: 0.75rem; background: #e67e22; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
            🔄 Justificar & Reagendar
          </button>
        </div>
      ` : ''}

      ${s.agendamento || s.dataAgendada ? `
        <div style="font-size: 0.85rem; margin-top: 6px; padding: 8px; border-radius: 6px; background: ${emAtraso ? '#fde8e8' : '#ebf5fb'}; border-left: 4px solid ${emAtraso ? '#e74c3c' : '#2980b9'}; color: ${emAtraso ? '#c0392b' : '#2980b9'}; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
          <div>
            📅 <strong>Agendado para:</strong> ${s.agendamento || s.dataAgendada}
          </div>
        </div>
      ` : ''}

      ${s.observacoes ? `<p style="font-size: 0.85rem; margin-top: 6px; color: #444; background: #f9f9f9; padding: 6px; border-radius: 6px;">📝 <strong>Obs:</strong> ${s.observacoes}</p>` : ''}

      ${historico.length > 0 ? `
        <div style="font-size: 0.8rem; margin-top: 8px; color: #2c3e50; background: #f1f5f9; padding: 8px; border-radius: 6px; border-left: 3px solid #2e5a3c;">
          <strong>⏱️ Registros de Execução:</strong>
          <div style="margin-top: 4px; display: flex; flex-direction: column; gap: 3px;">
            ${historico.map(h => `
              <div>
                <strong>${h.icone || '•'} ${h.acao}:</strong> ${h.dataHora || h.data}
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

/* ==========================================================================
   AÇÕES DOS SERVIÇOS (INICIAR, PAUSAR, CONCLUIR, EXCLUIR)
   ========================================================================== */
function iniciarServico(id) {
  let servicos = carregarServicos();
  const item = servicos.find(s => Number(s.id) === Number(id));
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
  const modal = document.getElementById('modal-justificativa');
  if (modal) modal.style.display = 'flex';
}

function fecharModalJustificativa() {
  servicoPendentePausaId = null;
  const txt = document.getElementById('texto-justificativa');
  if (txt) txt.value = '';
  const modal = document.getElementById('modal-justificativa');
  if (modal) modal.style.display = 'none';
}

function confirmarPausaServico() {
  const motivo = document.getElementById('texto-justificativa').value.trim();
  if (!motivo) return alert('Por favor, informe a justificativa.');

  let servicos = carregarServicos();
  const item = servicos.find(s => Number(s.id) === Number(servicoPendentePausaId));
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

function excluirServico(id) {
  if (confirm("Tem certeza que deseja excluir este serviço permanentemente?")) {
    let servicos = carregarServicos();
    servicos = servicos.filter(s => Number(s.id) !== Number(id));
    salvarServicos(servicos);
  }
}

/* ==========================================================================
   SISTEMA DE REAGENDAMENTO E ATRASOS
   ========================================================================== */
function verificarAtrasoAgendamento(stringAgendamento) {
  if (!stringAgendamento) return false;

  const partes = stringAgendamento.split(' às ');
  const dataPartes = partes[0].split('/');
  if (dataPartes.length !== 3) return false;

  const dia = parseInt(dataPartes[0], 10);
  const mes = parseInt(dataPartes[1], 10) - 1;
  const ano = parseInt(dataPartes[2], 10);

  let hora = 23, minuto = 59;
  if (partes[1]) {
    const horaPartes = partes[1].split(':');
    if (horaPartes.length === 2) {
      hora = parseInt(horaPartes[0], 10);
      minuto = parseInt(horaPartes[1], 10);
    }
  }

  const dataAgendada = new Date(ano, mes, dia, hora, minuto);
  const agora = new Date();

  return agora > dataAgendada;
}

function solicitarReagendamento(id) {
  servicoReagendarId = id;
  const justif = document.getElementById('justificativa-atraso');
  if (justif) justif.value = '';
  
  const novaData = document.getElementById('nova-data-agendada');
  if (novaData) novaData.value = new Date().toISOString().split('T')[0];
  
  const novoHorario = document.getElementById('novo-horario-agendado');
  if (novoHorario) novoHorario.value = '';

  const lista = carregarServicos();
  const servico = lista.find(s => Number(s.id) === Number(id));
  
  const infoEl = document.getElementById('info-servico-atrasado');
  if (infoEl && servico) {
    infoEl.innerHTML = `<strong>Serviço:</strong> ${(servico.nome || 'Serviço').toUpperCase()}<br><strong>Local:</strong> ${servico.local || 'N/A'}<br><strong>Agendamento Anterior:</strong> ${servico.agendamento || servico.dataAgendada || 'N/A'}`;
  }

  const modal = document.getElementById('modal-reagendar');
  if (modal) modal.style.display = 'flex';
}

function abrirModalReagendar(id) {
  solicitarReagendamento(id);
}

function fecharModalReagendar() {
  servicoReagendarId = null;
  const modal = document.getElementById('modal-reagendar');
  if (modal) modal.style.display = 'none';
}

function confirmarReagendamento(event) {
  if (event) event.preventDefault();
  const justEl = document.getElementById('justificativa-atraso');
  const dataEl = document.getElementById('nova-data-agendada');
  const horaEl = document.getElementById('novo-horario-agendado');

  const justificativa = justEl ? justEl.value.trim() : '';
  const novaData = dataEl ? dataEl.value : '';
  const novoHorario = horaEl ? horaEl.value : '';

  if (!justificativa || !novaData) {
    return alert('Preencha a justificativa e a nova data.');
  }

  const partesData = novaData.split('-');
  const dataFormatada = `${partesData[2]}/${partesData[1]}/${partesData[0]}`;
  const novoAgendamentoTexto = `${dataFormatada}${novoHorario ? ' às ' + novoHorario : ''}`;

  let servicos = carregarServicos();
  const item = servicos.find(s => Number(s.id) === Number(servicoReagendarId));

  if (item) {
    item.status = 'Agendado';
    item.agendamento = novoAgendamentoTexto;
    item.dataAgendada = novaData;
    item.isAtrasado = false;

    if (!item.historicoExecucao) item.historicoExecucao = [];
    item.historicoExecucao.push({
      acao: 'Reagendado por Atraso',
      icone: '📅⚠️',
      dataHora: obterDataHoraAtual(),
      detalhes: `Nova data: ${novoAgendamentoTexto} | Motivo: ${justificativa}`
    });

    salvarServicos(servicos);
  }

  fecharModalReagendar();
}

/* ==========================================================================
   PROCESSAMENTO DE IMAGENS E CONCLUSÃO
   ========================================================================== */
function solicitarConclusaoServico(id) {
  servicoConclusaoId = id;
  imagensTempConclusao = [];
  const preview = document.getElementById('preview-imagens');
  if (preview) preview.innerHTML = '';
  const modal = document.getElementById('modal-conclusao');
  if (modal) modal.style.display = 'flex';
}

function fecharModalConclusao() {
  servicoConclusaoId = null;
  imagensTempConclusao = [];
  const form = document.getElementById('form-conclusao');
  if (form) form.reset();
  const modal = document.getElementById('modal-conclusao');
  if (modal) modal.style.display = 'none';
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
  if (preview) preview.innerHTML = '';
  imagensTempConclusao = [];

  if (files.length === 0) return;

  files.forEach(file => {
    comprimirImagem(file, 1000, 1000, 0.8, function(base64Otimizado) {
      imagensTempConclusao.push(base64Otimizado);

      if (preview) {
        const img = document.createElement('img');
        img.src = base64Otimizado;
        img.style.cssText = 'width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc;';
        preview.appendChild(img);
      }
    });
  });
}

function confirmarConclusaoServico(event) {
  if (event) event.preventDefault();
  const relatorio = document.getElementById('relatorio-conclusao').value.trim();
  if (!relatorio) return alert('Informe o relatório de conclusão.');

  let servicos = carregarServicos();
  const item = servicos.find(s => Number(s.id) === Number(servicoConclusaoId));
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
   EDIÇÃO DE CONCLUSÃO (ADMIN)
   ========================================================================== */
function abrirModalEditarConclusao(id) {
  servicoEdicaoConclusaoId = id;
  const servicos = carregarServicos();
  const s = servicos.find(item => Number(item.id) === Number(id));
  if (!s) return;

  const campoText = document.getElementById('relatorio-conclusao-editar');
  if (campoText) campoText.value = s.conclusaoInfo || '';
  imagensTempConclusao = s.fotos ? [...s.fotos] : [];

  renderizarPreviewFotosEdicao();
  const modal = document.getElementById('modal-editar-conclusao');
  if (modal) modal.style.display = 'flex';
}

function fecharModalEditarConclusao() {
  servicoEdicaoConclusaoId = null;
  imagensTempConclusao = [];
  const modal = document.getElementById('modal-editar-conclusao');
  if (modal) modal.style.display = 'none';
}

function renderizarPreviewFotosEdicao() {
  const preview = document.getElementById('preview-imagens-editar');
  if (!preview) return;
  preview.innerHTML = '';
  imagensTempConclusao.forEach((imgSrc, index) => {
    const div = document.createElement('div');
    div.style.cssText = 'position: relative; display: inline-block; margin: 4px;';
    div.innerHTML = `
      <img src="${imgSrc}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc;">
      <button onclick="removerFotoEdicao(${index})" style="position: absolute; top: -5px; right: -5px; background: #e74c3c; color: white; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer;">✕</button>
    `;
    preview.appendChild(div);
  });
}

function removerFotoEdicao(index) {
  imagensTempConclusao.splice(index, 1);
  renderizarPreviewFotosEdicao();
}

function confirmarEdicaoConclusao(event) {
  if (event) event.preventDefault();
  const campoText = document.getElementById('relatorio-conclusao-editar');
  const textoAtualizado = campoText ? campoText.value.trim() : '';

  let servicos = carregarServicos();
  const item = servicos.find(s => Number(s.id) === Number(servicoEdicaoConclusaoId));
  if (item) {
    item.conclusaoInfo = textoAtualizado;
    item.fotos = imagensTempConclusao;
    salvarServicos(servicos);
  }
  fecharModalEditarConclusao();
}

/* ==========================================================================
   INICIALIZAÇÃO DA PÁGINA
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  atualizarContadoresCards();
  filtrarServicos();

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', filtrarServicos);
  }
});
