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
  verificarServicosAtrasados(); 
  renderizarServicos();
  
  if (!localStorage.getItem('dadosFazenda')) {
    abrirModalPerfilFazenda(true);
  }

  buscarClimaBelem();
  atualizarDashboard();
  filtrarServicos();

  if (typeof atualizarStatusConexao === 'function') atualizarStatusConexao();
  atualizarLabelPerfil();

  if (typeof atualizarStatusConexao === 'function') {
    window.addEventListener('online', atualizarStatusConexao);
    window.addEventListener('offline', atualizarStatusConexao);
  }
});

/* ==========================================================================
   SISTEMA DE AUTENTICAÇÃO E PERFIL
   ========================================================================== */
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
   INTEGRAÇÃO DE CLIMA (BELÉM DO SÃO FRANCISCO - PE)
   ========================================================================== */
async function buscarClimaBelem() {
  const elemTemp = document.getElementById('clima-temp');
  const elemDesc = document.getElementById('clima-desc');
  const elemIcon = document.getElementById('weather-icon');

  // Coordenadas de Belém do São Francisco - PE (Lat: -8.7531, Lon: -38.9667)
  const urlApi = 'https://api.open-meteo.com/v1/forecast?latitude=-8.7531&longitude=-38.9667&current_weather=true';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const resposta = await fetch(urlApi, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!resposta.ok) throw new Error(`HTTP error! status: ${resposta.status}`);

    const dados = await resposta.json();

    if (dados && dados.current_weather) {
      const temp = Math.round(dados.current_weather.temperature);
      const code = dados.current_weather.weathercode;
      const climaInfo = interpretarCodigoClima(code);

      if (elemTemp) elemTemp.innerText = `${temp}°C`;
      if (elemDesc) elemDesc.innerText = climaInfo.texto;
      if (elemIcon) elemIcon.innerText = climaInfo.icone;
    } else {
      throw new Error('Formato de resposta inválido');
    }

  } catch (erro) {
    console.error('Erro ao obter clima de Belém do São Francisco:', erro);
    if (elemTemp) elemTemp.innerText = '--°C';
    if (elemDesc) elemDesc.innerText = 'Indisponível';
    if (elemIcon) elemIcon.innerText = '⚠️';
  }
}

function interpretarCodigoClima(code) {
  switch (code) {
    case 0:
      return { texto: 'Céu Limpo', icone: '☀️' };
    case 1:
      return { texto: 'Predominantemente Limpo', icone: '🌤️' };
    case 2:
      return { texto: 'Parcialmente Nublado', icone: '⛅' };
    case 3:
      return { texto: 'Nublado', icone: '☁️' };
    case 45:
    case 48:
      return { texto: 'Névoa / Nevoeiro', icone: '🌫️' };
    case 51:
    case 53:
    case 55:
      return { texto: 'Garoa Leve', icone: '🌦️' };
    case 61:
    case 63:
    case 65:
      return { texto: 'Chuva', icone: '🌧️' };
    case 80:
    case 81:
    case 82:
      return { texto: 'Pancadas de Chuva', icone: '🌦️' };
    case 95:
    case 96:
    case 99:
      return { texto: 'Trovoadas / Tempestade', icone: '⛈️' };
    default:
      return { texto: 'Ensolarado', icone: '☀️' };
  }
}

setInterval(buscarClimaBelem, 15 * 60 * 1000);

/* ==========================================================================
   GERENCIAMENTO DE ÁREAS DA PROPRIEDADE
   ========================================================================== */
function carregarAreas() {
  try {
    const dados = localStorage.getItem(STORAGE_KEY_AREAS);
    return dados ? JSON.parse(dados) : [
      { id: 1, nome: 'Sede / Escritório' },
      { id: 2, nome: 'Baia dos Reprodutores Boer' },
      { id: 3, nome: 'Piquete 01' },
      { id: 4, nome: 'Piquete 02' },
      { id: 5, nome: 'Área de Matrizes / Maternidade' }
    ];
  } catch (e) {
    return [];
  }
}

function salvarAreas(areas) {
  localStorage.setItem(STORAGE_KEY_AREAS, JSON.stringify(areas));
  atualizarSelectAreasServico();
}

function abrirModalAreas() {
  renderizarListaAreas();
  const modal = document.getElementById('modal-areas');
  if (modal) modal.style.display = 'flex';
}

function fecharModalAreas() {
  const modal = document.getElementById('modal-areas');
  if (modal) modal.style.display = 'none';
}

function adicionarNovaArea(event) {
  if (event) event.preventDefault();
  const input = document.getElementById('nome-nova-area');
  if (!input) return;
  const nome = input.value.trim();
  if (!nome) return alert('Informe o nome da área.');

  const areas = carregarAreas();
  areas.push({ id: Date.now(), nome: nome });
  salvarAreas(areas);
  input.value = '';
  renderizarListaAreas();
}

function removerArea(id) {
  if (confirm('Deseja remover esta área?')) {
    let areas = carregarAreas();
    areas = areas.filter(a => Number(a.id) !== Number(id));
    salvarAreas(areas);
    renderizarListaAreas();
  }
}

function renderizarListaAreas() {
  const container = document.getElementById('lista-areas-container');
  if (!container) return;
  const areas = carregarAreas();

  if (areas.length === 0) {
    container.innerHTML = '<p style="color: #7f8c8d; font-size: 0.85rem;">Nenhuma área cadastrada.</p>';
    return;
  }

  container.innerHTML = areas.map(a => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #e2e8f0;">
      <span style="font-size: 0.9rem; font-weight: 500; color: #1e293b;">📍 ${a.nome}</span>
      ${perfilAtual === 'admin' ? `<button onclick="removerArea(${a.id})" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; cursor: pointer;">Excluir</button>` : ''}
    </div>
  `).join('');
}

function atualizarSelectAreasServico() {
  const select = document.getElementById('local-servico');
  if (!select) return;
  const areas = carregarAreas();
  select.innerHTML = '<option value="">Selecione o local...</option>' + 
    areas.map(a => `<option value="${a.nome}">${a.nome}</option>`).join('');
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

function verificarServicosAtrasados() {
  const hojeStr = new Date().toISOString().split('T')[0];
  const lista = carregarServicos();

  lista.forEach(s => {
    const statusAtual = (s.status || '').toLowerCase().trim();
    const dataAgendada = s.dataAgendada || s.agendamento;
    if ((statusAtual === 'agendado' || statusAtual === 'pendente') && dataAgendada && dataAgendada < hojeStr) {
      s.isAtrasado = true;
    } else {
      s.isAtrasado = false;
    }
  });
}

function atualizarDashboard() {
  const servicos = carregarServicos();
  const total = servicos.length;

  let pendentes = 0;
  let agendados = 0;
  let emExecucao = 0;
  let concluidos = 0;

  servicos.forEach(s => {
    const st = (s.status || '').toLowerCase().trim();
    if (st === 'pendente') pendentes++;
    else if (st === 'agendado') agendados++;
    else if (st === 'em execução' || st === 'em execucao') emExecucao++;
    else if (st === 'concluído' || st === 'concluido') concluidos++;
  });

  const elemAg = document.getElementById('qtd-agendados');
  const elemPe = document.getElementById('qtd-pendentes');
  const elemEx = document.getElementById('qtd-execucao');
  const elemCo = document.getElementById('qtd-concluidos');

  if (elemAg) elemAg.innerText = agendados;
  if (elemPe) elemPe.innerText = pendentes;
  if (elemEx) elemEx.innerText = emExecucao;
  if (elemCo) elemCo.innerText = concluidos;
}

/* ==========================================================================
   MODAIS E FORMULÁRIOS DE SERVIÇOS
   ========================================================================== */
function abrirModal() {
  atualizarSelectAreasServico();
  const modal = document.getElementById('modal-servico');
  if (modal) modal.style.display = 'flex';
}

function fecharModal() {
  const modal = document.getElementById('modal-servico');
  if (modal) modal.style.display = 'none';
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
    dataAgendada: dataAgendadaVal,
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

    const hojeStr = new Date().toISOString().split('T')[0];
    const emAtraso = (!isConcluido) && (
      s.isAtrasado || 
      ((statusAtual === 'agendado' || statusAtual === 'pendente') && (
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
  event.preventDefault();
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
  const item = servicos.find(s => Number(s.id) === Number(servicoEdicaoConclusaoId));
  if (item) {
    item.conclusaoInfo = relatorio;
    item.fotos = imagensTempConclusao;
    salvarServicos(servicos);
  }
  fecharModalEditarConclusao();
}

/* ==========================================================================
   VISUALIZAÇÃO DE IMAGENS E RELATÓRIOS (WHATSAPP / RESUMO)
   ========================================================================== */
function ampliarImagem(src) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; box-sizing: border-box;';
  modal.innerHTML = `
    <div style="position: relative; max-width: 90%; max-height: 90%;">
      <img src="${src}" style="max-width: 100%; max-height: 80vh; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
      <button onclick="this.parentElement.parentElement.remove()" style="position: absolute; top: -10px; right: -10px; background: #e74c3c; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; font-weight: bold; cursor: pointer; font-size: 16px;">✕</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function abrirRelatorioCompleto(id) {
  const servicos = carregarServicos();
  const s = servicos.find(item => Number(item.id) === Number(id));
  if (!s) return;

  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 15px; box-sizing: border-box;';
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 12px; padding: 20px; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 5px 20px rgba(0,0,0,0.2);">
      <h3 style="margin-top: 0; color: #1b3b22; border-bottom: 2px solid #2e5a3c; padding-bottom: 8px;">📋 RELATÓRIO DE SERVIÇO</h3>
      <p><strong>Serviço:</strong> ${s.nome}</p>
      <p><strong>Local:</strong> ${s.local}</p>
      <p><strong>Responsável:</strong> ${s.responsavel}</p>
      <p><strong>Prioridade:</strong> ${s.prioridade || 'Normal'}</p>
      <p><strong>Data de Criação:</strong> ${s.data || 'N/A'}</p>
      ${s.observacoes ? `<p><strong>Observações:</strong> ${s.observacoes}</p>` : ''}
      <hr style="border: 0; border-top: 1px solid #eee; margin: 12px 0;">
      <p><strong>Relatório de Conclusão:</strong></p>
      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border-left: 4px solid #27ae60; font-size: 0.9rem;">${s.conclusaoInfo || 'Sem descrição.'}</div>
      ${s.fotos && s.fotos.length > 0 ? `
        <p style="margin-top: 12px;"><strong>Fotos Registradas:</strong></p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${s.fotos.map(f => `<img src="${f}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px; cursor: pointer;" onclick="ampliarImagem('${f}')">`).join('')}
        </div>
      ` : ''}
      <div style="margin-top: 20px; text-align: right;">
        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: #64748b; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Fechar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function enviarRelatorioWhatsApp(id) {
  const servicos = carregarServicos();
  const s = servicos.find(item => Number(item.id) === Number(id));
  if (!s) return;

  let texto = `*${dadosFazenda.nome || 'CRIATÓRIO MARQUES'}*\n`;
  texto += `*Relatório de Serviço Concluído*\n\n`;
  texto += `📌 *Serviço:* ${s.nome}\n`;
  texto += `📍 *Local:* ${s.local}\n`;
  texto += `👤 *Responsável:* ${s.responsavel}\n`;
  texto += `📅 *Data:* ${s.data || 'N/A'}\n\n`;
  texto += `📝 *Relatório de Execução:*\n${s.conclusaoInfo || 'Atividade finalizada com sucesso.'}\n`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank');
}

/* ==========================================================================
   CONFIGURAÇÕES DA FAZENDA E LOGO
   ========================================================================== */
function abrirModalPerfilFazenda(primeiraVez = false) {
  const modal = document.getElementById('modal-perfil-fazenda');
  if (!modal) return;

  document.getElementById('input-nome-fazenda').value = dadosFazenda.nome || '';
  document.getElementById('input-slogan-fazenda').value = dadosFazenda.slogan || '';
  document.getElementById('input-cidade-fazenda').value = dadosFazenda.cidade || '';

  const preview = document.getElementById('preview-logo-fazenda');
  if (preview && dadosFazenda.logoBase64) {
    preview.src = dadosFazenda.logoBase64;
    preview.style.display = 'block';
  } else if (preview) {
    preview.style.display = 'none';
  }

  modal.style.display = 'flex';
}

function abrirModalPerfilFazenda(primeiraVez = false) {
  const modal = document.getElementById('modal-perfil-fazenda');
  if (!modal) return;

  // Carrega os dados salvos nos inputs
  document.getElementById('input-nome-fazenda').value = dadosFazenda.nome || '';
  document.getElementById('input-slogan-fazenda').value = dadosFazenda.slogan || '';
  document.getElementById('input-cidade-fazenda').value = dadosFazenda.cidade || '';

  // Reseta a variável temporária com a logo atual salva
  logoTempBase64 = dadosFazenda.logoBase64 || '';

  const preview = document.getElementById('preview-logo-fazenda');
  if (preview) {
    if (dadosFazenda.logoBase64) {
      preview.src = dadosFazenda.logoBase64;
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
      preview.src = '';
    }
  }

  modal.style.display = 'flex';
}

function fecharModalPerfilFazenda() {
  const modal = document.getElementById('modal-perfil-fazenda');
  if (modal) modal.style.display = 'none';
  logoTempBase64 = ''; // Limpa a temporária ao fechar
}

function carregarLogoFazenda(event) {
  const file = event.target.files[0];
  if (!file) return;

  comprimirImagem(file, 400, 400, 0.85, function(base64) {
    logoTempBase64 = base64;
    const preview = document.getElementById('preview-logo-fazenda');
    if (preview) {
      preview.src = base64;
      preview.style.display = 'block';
    }
  });
}

function salvarPerfilFazenda(event) {
  if (event) event.preventDefault();
  
  // Atualiza a estrutura global dadosFazenda
  dadosFazenda = {
    nome: document.getElementById('input-nome-fazenda').value.trim() || 'CRIATÓRIO MARQUES',
    slogan: document.getElementById('input-slogan-fazenda').value.trim(),
    cidade: document.getElementById('input-cidade-fazenda').value.trim(),
    logoBase64: logoTempBase64 || dadosFazenda.logoBase64 || ''
  };

  // Salva no localStorage
  localStorage.setItem('dadosFazenda', JSON.stringify(dadosFazenda));
  
  // Renderiza imediatamente na tela principal
  carregarDadosFazendaNaTela();
  fecharModalPerfilFazenda();
}

function carregarDadosFazendaNaTela() {
  // Garante que pega os dados mais recentes do localStorage caso a variável esteja desatualizada
  try {
    const salvos = localStorage.getItem('dadosFazenda');
    if (salvos) dadosFazenda = JSON.parse(salvos);
  } catch(e) {}

  const titulo = document.getElementById('header-nome-fazenda');
  const slogan = document.getElementById('header-slogan-fazenda');
  const logo = document.getElementById('header-logo-fazenda');

  if (titulo) titulo.innerText = dadosFazenda.nome || 'CRIATÓRIO MARQUES';
  if (slogan) slogan.innerText = dadosFazenda.slogan || '';
  
  if (logo) {
    if (dadosFazenda.logoBase64) {
      logo.src = dadosFazenda.logoBase64;
      logo.style.display = 'block'; // Força a exibição da imagem na tela principal
    } else {
      logo.style.display = 'none';
    }
  }
}
/* ==========================================================================
   BACKUP E IMPORTAÇÃO DE DADOS
   ========================================================================== */
function fazerBackup() {
  const dados = {
    servicos: carregarServicos(),
    areas: carregarAreas(),
    fazenda: dadosFazenda
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dados));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `backup_criatorio_marques_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importarBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const dados = JSON.parse(e.target.result);
      if (dados.servicos) localStorage.setItem(STORAGE_KEY, JSON.stringify(dados.servicos));
      if (dados.areas) localStorage.setItem(STORAGE_KEY_AREAS, JSON.stringify(dados.areas));
      if (dados.fazenda) localStorage.setItem('dadosFazenda', JSON.stringify(dados.fazenda));

      alert("Dados importados com sucesso!");
      location.reload();
    } catch (err) {
      alert("Erro ao ler o arquivo de backup. Verifique se o arquivo JSON é válido.");
    }
  };
  reader.readAsText(file);
}
