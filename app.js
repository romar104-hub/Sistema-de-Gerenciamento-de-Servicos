/* ==========================================================================
   CRIATÓRIO MARQUES - SISTEMA DE GESTÃO DE SERVIÇOS
   ========================================================================== */

const STORAGE_KEY = 'criatorio_marques_servicos';
const STORAGE_KEY_AREAS = 'criatorio_marques_areas';

let servicoPendentePausaId = null;
let servicoConclusaoId = null;
let servicoEdicaoConclusaoId = null;
let servicoReagendarId = null;
let imagensTempConclusao = [];
let fotoTempAreaBase64 = '';
let filtroStatusAtual = null;
let logoTempBase64 = '';

// Recupera dados salvos da propriedade ou define o padrão
let dadosFazenda = {};
try {
  dadosFazenda = JSON.parse(localStorage.getItem('dadosFazenda')) || {
    nome: 'CRIATÓRIO MARQUES',
    slogan: 'Excelência em Genética e Manejo no Sertão',
    cidade: 'Belém do São Francisco - PE',
    logoBase64: ''
  };
} catch (e) {
  dadosFazenda = {
    nome: 'CRIATÓRIO MARQUES',
    slogan: 'Excelência em Genética e Manejo no Sertão',
    cidade: 'Belém do São Francisco - PE',
    logoBase64: ''
  };
}

// Recupera o perfil do usuário (padrão: 'usuario')
let perfilAtual = localStorage.getItem('perfil_usuario') || 'usuario';

document.addEventListener('DOMContentLoaded', () => {
  carregarDadosFazendaNaTela();
  if (!localStorage.getItem('dadosFazenda')) {
    abrirModalPerfilFazenda(true);
  }
  buscarClimaBelem();
  atualizarDashboard();
  filtrarServicos();
  atualizarStatusConexao();
  atualizarLabelPerfil();
});

window.addEventListener('online', atualizarStatusConexao);
window.addEventListener('offline', atualizarStatusConexao);

function solicitarAcessoAdmin() {
  if (perfilAtual === 'usuario') {
    const senha = prompt("Digite a senha de Administrador:");
    if (senha === "1234") { // Altere '1234' para a senha de sua preferência
      perfilAtual = 'admin';
      localStorage.setItem('perfil_usuario', 'admin');
      alert("Modo Administrador ativado!");
    } else if (senha !== null) {
      alert("Senha incorreta!");
    }
  } else {
    perfilAtual = 'usuario';
    localStorage.setItem('perfil_usuario', 'usuario');
    alert("Alternado para Modo Usuário.");
  }
  atualizarLabelPerfil();
  filtrarServicos();
}

function atualizarLabelPerfil() {
  const label = document.getElementById('label-perfil');
  if (label) {
    label.innerText = perfilAtual === 'admin' ? 'Modo: Admin (Sair)' : 'Entrar como Admin';
  }
}

/* ==========================================================================
   GERENCIAMENTO DE DADOS E PERSISTÊNCIA
   ========================================================================== */
function carregarServicos() {
  try {
    const dados = localStorage.getItem(STORAGE_KEY);
    return dados ? JSON.parse(dados) : [];
  } catch (e) {
    console.error("Erro ao carregar serviços do localStorage:", e);
    return [];
  }
}

function salvarServicos(servicos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(servicos));
    atualizarDashboard();
    filtrarServicos();
  } catch (e) {
    alert("Atenção: Limite de armazenamento local excedido! Tente remover serviços antigos ou fotos.");
  }
}

function obterDataHoraAtual() {
  const agora = new Date();
  return agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/* ==========================================================================
   MODAIS E FORMULÁRIOS DE SERVIÇOS
   ========================================================================== */
function abrirModal() {
  if (typeof atualizarSelectAreasServico === 'function') {
    atualizarSelectAreasServico();
  }
  document.getElementById('modal-servico').style.display = 'flex';
}

function fecharModal() {
  document.getElementById('modal-servico').style.display = 'none';
  const form = document.getElementById('form-servico');
  if (form) form.reset();
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
      (s.nome && s.nome.toLowerCase().includes(termo)) ||
      (s.local && s.local.toLowerCase().includes(termo)) ||
      (s.responsavel && s.responsavel.toLowerCase().includes(termo))
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
    container.innerHTML = '<p class="empty-msg" style="text-align: center; color: #7f8c8d; margin-top: 20px;">Nenhum serviço encontrado.</p>';
    return;
  }

  container.innerHTML = lista.map(s => {
    const historico = s.historicoExecucao || [];
    const jaIniciouAlgo = historico.length > 0;
    const rotuloIniciar = jaIniciouAlgo ? '▶️ Retomar' : '🚀 Iniciar';

    const statusAtual = (s.status || '').toString().toLowerCase().trim();
    const isConcluido = statusAtual === 'concluído' || statusAtual === 'concluido';

    const emAtraso = (statusAtual === 'agendado') && verificarAtrasoAgendamento(s.agendamento);

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
      if (statusAtual === 'pendente' || statusAtual === 'agendado') {
        acoesHTML += `<button onclick="iniciarServico(${s.id})" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: #2e5a3c; color: white; border: none; border-radius: 6px; cursor: pointer;">${rotuloIniciar}</button>`;
      }
      if (statusAtual === 'em execução' || statusAtual === 'em execucao') {
        acoesHTML += `<button onclick="solicitarPausaServico(${s.id})" class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem; background: #e67e22; color: white; border: none; border-radius: 6px; cursor: pointer;">⏸️ Pausar</button>`;
      }
      acoesHTML += `<button onclick="solicitarConclusaoServico(${s.id})" style="padding: 6px 12px; font-size: 0.8rem; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer;">✅ Concluir</button>`;

      if (perfilAtual === 'admin') {
        acoesHTML += `<button onclick="excluirServico(${s.id})" class="btn-delete" style="padding: 6px 12px; font-size: 0.8rem; background: #ff4d4d; color: white; border: none; border-radius: 6px; cursor: pointer; margin-left: auto;">Excluir</button>`;
      }
    }
    acoesHTML += '</div>';

    return `
    <div class="service-card" style="background: #fff; padding: 14px; border-radius: 10px; margin-bottom: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
      <div class="service-main" style="display: flex; justify-content: space-between; align-items: center;">
        <h4 style="margin: 0; color: #1b3b22;">${(s.nome || 'Serviço').toUpperCase()}</h4>
        <span class="badge ${(s.status || '').toLowerCase().replace(' ', '-').replace('ú', 'u')}" style="padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; background: #e2e8f0; color: #334155;">${s.status}</span>
      </div>
      <p class="service-info" style="font-size: 0.85rem; color: #64748b; margin: 6px 0;">📍 ${s.local} | 👤 ${s.responsavel} | 📅 Criado: ${s.data}</p>
      <p class="service-priority" style="font-size: 0.85rem; margin: 4px 0;">Prioridade: <strong>${s.prioridade}</strong></p>

      ${s.agendamento ? `
        <div style="font-size: 0.85rem; margin-top: 6px; padding: 8px; border-radius: 6px; background: ${emAtraso ? '#fde8e8' : '#ebf5fb'}; border-left: 4px solid ${emAtraso ? '#e74c3c' : '#2980b9'}; color: ${emAtraso ? '#c0392b' : '#2980b9'}; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
          <div>
            📅 <strong>Agendado para:</strong> ${s.agendamento}${emAtraso ? '<br><strong style="color: #e74c3c;">⚠️ SERVIÇO EM ATRASO!</strong>' : ''}
          </div>
          ${emAtraso ? `<button onclick="solicitarReagendamento(${s.id})" style="padding: 4px 8px; font-size: 0.75rem; background: #e67e22; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">⏰ Reagendar</button>` : ''}
        </div>
      ` : ''}

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

/* ==========================================================================
   AÇÕES DOS SERVIÇOS (INICIAR, PAUSAR, REAGENDAR)
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
  const txt = document.getElementById('texto-justificativa');
  if (txt) txt.value = '';
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
  document.getElementById('justificativa-atraso').value = '';
  document.getElementById('nova-data-agendada').value = '';
  document.getElementById('novo-horario-agendado').value = '';
  document.getElementById('modal-reagendar').style.display = 'flex';
}

function fecharModalReagendar() {
  servicoReagendarId = null;
  document.getElementById('modal-reagendar').style.display = 'none';
}

function confirmarReagendamento(event) {
  event.preventDefault();
  const justificativa = document.getElementById('justificativa-atraso').value.trim();
  const novaData = document.getElementById('nova-data-agendada').value;
  const novoHorario = document.getElementById('novo-horario-agendado').value;

  if (!justificativa || !novaData) {
    return alert('Preencha a justificativa e a nova data.');
  }

  const partesData = novaData.split('-');
  const dataFormatada = `${partesData[2]}/${partesData[1]}/${partesData[0]}`;
  const novoAgendamentoTexto = `${dataFormatada}${novoHorario ? ' às ' + novoHorario : ''}`;

  let servicos = carregarServicos();
  const item = servicos.find(s => s.id === servicoReagendarId);

  if (item) {
    item.status = 'Agendado';
    item.agendamento = novoAgendamentoTexto;

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
  document.getElementById('preview-imagens').innerHTML = '';
  document.getElementById('modal-conclusao').style.display = 'flex';
}

function fecharModalConclusao() {
  servicoConclusaoId = null;
  imagensTempConclusao = [];
  const form = document.getElementById('form-conclusao');
  if (form) form.reset();
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
   EDIÇÃO DE CONCLUSÃO (ADMIN)
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
      <h4 style="margin: 0 0 6px 0; color: #2e5a3c;">${(s.nome || 'Serviço').toUpperCase()}</h4>
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
   PERFIL DA FAZENDA E CLIMA (BELÉM DO SÃO FRANCISCO - PE)
   ========================================================================== */
function carregarDadosFazendaNaTela() {
  if (document.getElementById('header-nome-fazenda')) {
    document.getElementById('header-nome-fazenda').innerText = (dadosFazenda.nome || 'CRIATÓRIO MARQUES').toUpperCase();
  }
  if (document.getElementById('header-slogan')) {
    document.getElementById('header-slogan').innerText = `"${dadosFazenda.slogan || ''}"`;
  }
  if (document.getElementById('header-cidade')) {
    document.getElementById('header-cidade').innerText = `📍 ${dadosFazenda.cidade || 'Belém do São Francisco - PE'}`;
  }
  const logoContainer = document.getElementById('header-logo');
  if (logoContainer) {
    if (dadosFazenda.logoBase64) {
      logoContainer.innerHTML = `<img src="${dadosFazenda.logoBase64}" alt="Logo">`;
    } else {
      logoContainer.innerText = dadosFazenda.nome ? dadosFazenda.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'CM';
    }
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
  comprimirImagem(file, 300, 300, 0.8, function(base64Otimizado) {
    logoTempBase64 = base64Otimizado;
    const box = document.getElementById('preview-logo-box');
    if (box) box.innerHTML = `<img src="${logoTempBase64}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
  });
}

function salvarPerfilFazenda(event) {
  event.preventDefault();
  dadosFazenda.nome = document.getElementById('input-nome-fazenda').value.trim() || 'CRIATÓRIO MARQUES';
  dadosFazenda.slogan = document.getElementById('input-slogan-fazenda').value.trim();
  dadosFazenda.cidade = document.getElementById('input-cidade-fazenda').value.trim() || 'Belém do São Francisco - PE';
  dadosFazenda.logoBase64 = logoTempBase64;

  localStorage.setItem('dadosFazenda', JSON.stringify(dadosFazenda));
  carregarDadosFazendaNaTela();
  fecharModalPerfilFazenda();
}

/* ==========================================================================
   SERVIÇO DE CLIMA (BELÉM DO SÃO FRANCISCO - PE)
   ========================================================================== */
function buscarClimaBelem() {
  const container = document.getElementById('info-clima');
  if (!container) return;

  // Coordenadas aproximadas de Belém do São Francisco - PE (-8.7533, -38.9697)
  const lat = -8.7533;
  const lon = -38.9697;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data && data.current_weather) {
        const temp = Math.round(data.current_weather.temperature);
        const vento = Math.round(data.current_weather.windspeed);
        container.innerHTML = `🌡️ <strong>${temp}°C</strong> | 💨 ${vento} km/h`;
      } else {
        container.innerText = 'Clima indisponível';
      }
    })
    .catch(() => {
      container.innerText = 'Clima offline';
    });
}

function atualizarStatusConexao() {
  const statusEl = document.getElementById('status-conexao');
  if (statusEl) {
    if (navigator.onLine) {
      statusEl.innerHTML = '<span style="color: #27ae60;">🟢 Online</span>';
    } else {
      statusEl.innerHTML = '<span style="color: #e74c3c;">🔴 Offline</span>';
    }
  }
}
