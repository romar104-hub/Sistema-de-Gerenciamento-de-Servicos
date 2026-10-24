/* ==========================================================================
   CRIATÓRIO MARQUES - SISTEMA DE GESTÃO DE SERVIÇOS  (versão corrigida)
   ========================================================================== */

const STORAGE_KEY = 'criatorio_marques_servicos';
const STORAGE_KEY_AREAS = 'criatorio_marques_areas';
const STORAGE_KEY_FAZENDA = 'dadosFazenda';

// Senha de admin. ATENÇÃO: em app 100% front-end ela fica visível no código.
// Serve apenas para evitar cliques acidentais, não para segurança real.
const SENHA_ADMIN = '1234';

const FAZENDA_PADRAO = {
  nome: 'CRIATÓRIO MARQUES',
  slogan: 'Excelência em Genética e Manejo no Sertão',
  cidade: 'Belém do São Francisco - PE',
  logoBase64: ''
};

let servicoPendentePausaId = null;
let servicoConclusaoId = null;
let servicoEdicaoConclusaoId = null;
let servicoReagendarId = null;
let imagensTempConclusao = [];
let filtroStatusAtual = null;
let logoTempBase64 = '';
let fotoTempAreaBase64 = '';

let dadosFazenda = { ...FAZENDA_PADRAO };
try {
  const salvo = JSON.parse(localStorage.getItem(STORAGE_KEY_FAZENDA));
  if (salvo) dadosFazenda = salvo;
} catch (e) { /* mantém padrão */ }

let perfilAtual = localStorage.getItem('perfil_usuario') || 'usuario';

/* ==========================================================================
   UTILITÁRIOS
   ========================================================================== */
// Evita XSS ao inserir texto digitado pelo usuário em innerHTML
function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// minúsculas, sem acento, sem espaços nas pontas
function norm(valor) {
  return String(valor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Data local no formato YYYY-MM-DD (toISOString usa UTC e erra o dia à noite no Brasil)
function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function obterDataHoraAtual() {
  const agora = new Date();
  return agora.toLocaleDateString('pt-BR') + ' às ' +
    agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function exigirAdmin() {
  if (perfilAtual !== 'admin') {
    alert('Ação permitida apenas para o Administrador.');
    return false;
  }
  return true;
}

function mostrarModal(id) {
  const m = document.getElementById(id);
  if (m) m.style.display = 'flex';
}

function esconderModal(id) {
  const m = document.getElementById(id);
  if (m) m.style.display = 'none';
}

/* ==========================================================================
   INICIALIZAÇÃO
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  carregarDadosFazendaNaTela();
  atualizarLabelPerfil();
  atualizarSelectAreasServico();
  filtrarServicos(); // renderiza a lista e atualiza os contadores
  buscarClimaBelem();

  if (!localStorage.getItem(STORAGE_KEY_FAZENDA)) {
    abrirModalPerfilFazenda(true);
  }

  if (typeof atualizarStatusConexao === 'function') {
    atualizarStatusConexao();
    window.addEventListener('online', atualizarStatusConexao);
    window.addEventListener('offline', atualizarStatusConexao);
  }
});

/* ==========================================================================
   AUTENTICAÇÃO E PERFIL
   ========================================================================== */
function solicitarAcessoAdmin() {
  if (perfilAtual === 'usuario') {
    const senha = prompt('Digite a senha de Administrador:');
    if (senha === SENHA_ADMIN) {
      perfilAtual = 'admin';
      localStorage.setItem('perfil_usuario', 'admin');
      alert('Modo Administrador ativado!');
    } else if (senha !== null) {
      alert('Senha incorreta!');
    }
  } else {
    perfilAtual = 'usuario';
    localStorage.setItem('perfil_usuario', 'usuario');
    alert('Alternado para Modo Usuário.');
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
   CLIMA (BELÉM DO SÃO FRANCISCO - PE)
   ========================================================================== */
async function buscarClimaBelem() {
  const elemTemp = document.getElementById('clima-temp');
  const elemDesc = document.getElementById('clima-desc');
  const elemIcon = document.getElementById('weather-icon');

  const urlApi = 'https://api.open-meteo.com/v1/forecast?latitude=-8.7531&longitude=-38.9667&current_weather=true';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const resposta = await fetch(urlApi, { signal: controller.signal });
    if (!resposta.ok) throw new Error(`HTTP error! status: ${resposta.status}`);

    const dados = await resposta.json();
    if (!dados || !dados.current_weather) throw new Error('Formato de resposta inválido');

    const temp = Math.round(dados.current_weather.temperature);
    const climaInfo = interpretarCodigoClima(dados.current_weather.weathercode);

    if (elemTemp) elemTemp.innerText = `${temp}°C`;
    if (elemDesc) elemDesc.innerText = climaInfo.texto;
    if (elemIcon) elemIcon.innerText = climaInfo.icone;
  } catch (erro) {
    console.error('Erro ao obter clima:', erro);
    if (elemTemp) elemTemp.innerText = '--°C';
    if (elemDesc) elemDesc.innerText = 'Indisponível';
    if (elemIcon) elemIcon.innerText = '⚠️';
  } finally {
    clearTimeout(timeoutId);
  }
}

function interpretarCodigoClima(code) {
  const mapa = {
    0: ['Céu Limpo', '☀️'],
    1: ['Predominantemente Limpo', '🌤️'],
    2: ['Parcialmente Nublado', '⛅'],
    3: ['Nublado', '☁️'],
    45: ['Névoa / Nevoeiro', '🌫️'],
    48: ['Névoa / Nevoeiro', '🌫️'],
    51: ['Garoa Leve', '🌦️'],
    53: ['Garoa', '🌦️'],
    55: ['Garoa Intensa', '🌦️'],
    56: ['Garoa Congelante', '🌦️'],
    57: ['Garoa Congelante', '🌦️'],
    61: ['Chuva Fraca', '🌧️'],
    63: ['Chuva', '🌧️'],
    65: ['Chuva Forte', '🌧️'],
    66: ['Chuva Congelante', '🌧️'],
    67: ['Chuva Congelante', '🌧️'],
    80: ['Pancadas de Chuva', '🌦️'],
    81: ['Pancadas de Chuva', '🌦️'],
    82: ['Pancadas Fortes', '🌦️'],
    95: ['Trovoadas / Tempestade', '⛈️'],
    96: ['Trovoadas com Granizo', '⛈️'],
    99: ['Trovoadas com Granizo', '⛈️']
  };
  const item = mapa[code];
  return item ? { texto: item[0], icone: item[1] } : { texto: 'Condição variável', icone: '🌡️' };
}

setInterval(buscarClimaBelem, 15 * 60 * 1000);

/* ==========================================================================
   ÁREAS DA PROPRIEDADE
   ========================================================================== */
function carregarAreas() {
  const padrao = [
    { id: 1, nome: 'Sede / Escritório', foto: '' },
    { id: 2, nome: 'Baia dos Reprodutores Boer', foto: '' },
    { id: 3, nome: 'Piquete 01', foto: '' },
    { id: 4, nome: 'Piquete 02', foto: '' },
    { id: 5, nome: 'Área de Matrizes / Maternidade', foto: '' }
  ];
  try {
    const dados = localStorage.getItem(STORAGE_KEY_AREAS);
    return dados ? JSON.parse(dados) : padrao;
  } catch (e) {
    return padrao;
  }
}

function salvarAreas(areas) {
  try {
    localStorage.setItem(STORAGE_KEY_AREAS, JSON.stringify(areas));
  } catch (e) {
    alert('Não foi possível salvar as áreas (armazenamento cheio). Tente uma foto menor.');
    return false;
  }
  atualizarSelectAreasServico();
  return true;
}

function abrirModalAreas() {
  fotoTempAreaBase64 = '';
  const prev = document.getElementById('preview-foto-area');
  if (prev) prev.innerHTML = '';
  renderizarListaAreas();
  mostrarModal('modal-areas');
}

function fecharModalAreas() {
  esconderModal('modal-areas');
}

function carregarFotoArea(event) {
  const file = event.target.files[0];
  const prev = document.getElementById('preview-foto-area');
  fotoTempAreaBase64 = '';
  if (prev) prev.innerHTML = '';
  if (!file) return;

  comprimirImagem(file, 800, 800, 0.8, function (base64) {
    fotoTempAreaBase64 = base64;
    if (prev) {
      prev.innerHTML = '';
      const img = document.createElement('img');
      img.src = base64;
      img.style.cssText = 'width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #ccc;';
      prev.appendChild(img);
    }
  });
}

function salvarNovaArea(event) {
  if (event) event.preventDefault();
  const input = document.getElementById('nome-area') || document.getElementById('nome-nova-area');
  if (!input) return;

  const nome = input.value.trim();
  if (!nome) return alert('Informe o nome da área.');

  const areas = carregarAreas();
  if (areas.some(a => norm(a.nome) === norm(nome))) {
    return alert('Essa área já está cadastrada.');
  }

  areas.push({ id: Date.now(), nome, foto: fotoTempAreaBase64 || '' });
  if (!salvarAreas(areas)) return;

  input.value = '';
  fotoTempAreaBase64 = '';
  const prev = document.getElementById('preview-foto-area');
  if (prev) prev.innerHTML = '';
  if (event && event.target && event.target.querySelector) {
    const arquivo = event.target.querySelector('input[type="file"]');
    if (arquivo) arquivo.value = '';
  }
  renderizarListaAreas();
}

// Nome antigo, mantido por compatibilidade
const adicionarNovaArea = salvarNovaArea;

function removerArea(id) {
  if (!exigirAdmin()) return;
  if (confirm('Deseja remover esta área?')) {
    const areas = carregarAreas().filter(a => Number(a.id) !== Number(id));
    salvarAreas(areas);
    renderizarListaAreas();
  }
}

function renderizarListaAreas() {
  const container = document.getElementById('lista-areas-cadastradas') ||
                    document.getElementById('lista-areas-container');
  if (!container) return;
  const areas = carregarAreas();

  if (areas.length === 0) {
    container.innerHTML = '<p style="color: #d8f3dc; font-size: 0.85rem;">Nenhuma área cadastrada.</p>';
    return;
  }

  container.innerHTML = areas.map(a => `
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="display: flex; align-items: center; gap: 10px;">
        ${a.foto ? `<img src="${esc(a.foto)}" onclick="ampliarImagem(this.src)" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; cursor: pointer;">` : ''}
        <span style="font-size: 0.9rem; font-weight: 500; color: #1e293b;">📍 ${esc(a.nome)}</span>
      </div>
      ${perfilAtual === 'admin' ? `<button onclick="removerArea(${Number(a.id)})" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; cursor: pointer;">Excluir</button>` : ''}
    </div>
  `).join('');
}

// O campo "Local" do formulário é um <input> com <datalist>; preenchemos as sugestões
function atualizarSelectAreasServico() {
  const areas = carregarAreas();
  const lista = document.getElementById('lista-areas-autocomplete');
  if (lista) {
    lista.innerHTML = areas.map(a => `<option value="${esc(a.nome)}"></option>`).join('');
  }
}

/* ==========================================================================
   PERSISTÊNCIA DOS SERVIÇOS
   ========================================================================== */
function carregarServicos() {
  try {
    const dados = localStorage.getItem(STORAGE_KEY);
    const lista = dados ? JSON.parse(dados) : [];
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    console.error('Erro ao carregar serviços do localStorage:', e);
    return [];
  }
}

// Salva e atualiza a tela (lista + contadores)
function salvarServicos(servicos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(servicos));
  } catch (e) {
    alert('Atenção: limite de armazenamento local excedido! Remova serviços antigos ou fotos.');
    return false;
  }
  filtrarServicos();
  return true;
}

/* ==========================================================================
   DASHBOARD (CONTADORES)
   ========================================================================== */
function atualizarContadoresDashboard() {
  const servicos = carregarServicos();
  const cont = { agendado: 0, pendente: 0, execucao: 0, concluido: 0 };

  servicos.forEach(s => {
    const st = norm(s.status || s.estado);
    if (st.includes('agendad')) cont.agendado++;
    else if (st.includes('pendent')) cont.pendente++;
    else if (st.includes('execu') || st.includes('andament')) cont.execucao++;
    else if (st.includes('conclu') || st.includes('finaliz')) cont.concluido++;
  });

  // Aceita os dois padrões de ID que existiam no código (qtd-* e count-*)
  const setTxt = (ids, valor) => {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = valor;
    });
  };
  setTxt(['qtd-agendados', 'count-agendados'], cont.agendado);
  setTxt(['qtd-pendentes', 'count-pendentes'], cont.pendente);
  setTxt(['qtd-execucao', 'count-execucao'], cont.execucao);
  setTxt(['qtd-concluidos', 'count-concluidos'], cont.concluido);
}

// Compatibilidade com chamadas antigas
function atualizarDashboard() {
  atualizarContadoresDashboard();
}

/* ==========================================================================
   MODAL E FORMULÁRIO DE SERVIÇO
   ========================================================================== */
function abrirModal() {
  atualizarSelectAreasServico();
  mostrarModal('modal-servico');
}

function fecharModal() {
  esconderModal('modal-servico');
  const form = document.getElementById('form-servico');
  if (form) form.reset();
}

function salvarServicoFormulario(event) {
  if (event) event.preventDefault();

  const valor = id => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };

  const nome = valor('nome-servico').trim();
  if (!nome) return alert('Informe o nome do serviço.');

  const local = valor('local-servico') || 'Geral';
  const responsavel = valor('responsavel-servico').trim() || 'Não atribuído';
  const prioridade = valor('prioridade-servico');
  const observacoes = valor('obs-servico').trim();
  const dataAgendadaVal = valor('data-agendada');
  const horaAgendadaVal = valor('hora-agendada');

  let statusInicial = 'Pendente';
  let informacaoAgendamento = null;

  if (dataAgendadaVal) {
    statusInicial = 'Agendado';
    const [ano, mes, dia] = dataAgendadaVal.split('-');
    informacaoAgendamento = `${dia}/${mes}/${ano}${horaAgendadaVal ? ' às ' + horaAgendadaVal : ''}`;
  }

  const servicos = carregarServicos();
  servicos.unshift({
    id: Date.now(),
    nome,
    local,
    responsavel,
    prioridade,
    observacoes,
    status: statusInicial,
    agendamento: informacaoAgendamento,
    dataAgendada: dataAgendadaVal,
    historicoExecucao: [],
    conclusaoInfo: null,
    fotos: [],
    data: new Date().toLocaleDateString('pt-BR')
  });

  if (salvarServicos(servicos)) {
    fecharModal();
  }
}

/* ==========================================================================
   FILTROS E RENDERIZAÇÃO
   ========================================================================== */
function filtrarPorStatus(status) {
  filtroStatusAtual = (filtroStatusAtual === status) ? null : status;
  atualizarEstiloCards();
  filtrarServicos();
}

function atualizarEstiloCards() {
  const mapa = {
    'card-agendados': 'Agendado',
    'card-pendentes': 'Pendente',
    'card-execucao': 'Em execução',
    'card-concluidos': 'Concluído'
  };
  Object.entries(mapa).forEach(([id, status]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('ativo', filtroStatusAtual === status);
  });

  const titulo = document.getElementById('titulo-lista');
  if (titulo) {
    titulo.innerText = filtroStatusAtual ? `Serviços (${filtroStatusAtual})` : 'Serviços recentes';
  }
}

function filtrarServicos() {
  const termoInput = document.getElementById('search-input');
  const termo = termoInput ? norm(termoInput.value) : '';
  let servicos = carregarServicos();

  if (filtroStatusAtual) {
    const alvo = norm(filtroStatusAtual);
    servicos = servicos.filter(s => norm(s.status) === alvo);
  }

  if (termo) {
    servicos = servicos.filter(s =>
      norm(s.nome).includes(termo) ||
      norm(s.local).includes(termo) ||
      norm(s.responsavel).includes(termo)
    );
  }

  renderizarServicos(servicos);
}

function servicoEstaAtrasado(s) {
  const st = norm(s.status);
  if (st !== 'agendado' && st !== 'pendente') return false;
  if (s.agendamento) return verificarAtrasoAgendamento(s.agendamento);
  if (s.dataAgendada) return s.dataAgendada < hojeISO();
  return false;
}

// Função ÚNICA de renderização (antes existiam duas e a vazia sobrescrevia a correta)
function renderizarServicos(servicos) {
  const container = document.getElementById('lista-servicos');
  if (!container) return;

  const ehAdmin = perfilAtual === 'admin';
  const btnBackup = document.getElementById('btn-backup');
  const btnImportar = document.getElementById('btn-importar');
  if (btnBackup) btnBackup.style.display = ehAdmin ? 'inline-block' : 'none';
  if (btnImportar) btnImportar.style.display = ehAdmin ? 'inline-block' : 'none';

  const lista = Array.isArray(servicos) ? servicos : carregarServicos();

  if (lista.length === 0) {
    container.innerHTML = '<p class="empty-msg" style="text-align: center; color: #7f8c8d; margin-top: 20px;">Nenhum serviço encontrado.</p>';
    atualizarContadoresDashboard();
    return;
  }

  const estiloBtn = 'padding: 6px 12px; font-size: 0.8rem; color: white; border: none; border-radius: 6px; cursor: pointer;';

  container.innerHTML = lista.map(s => {
    const historico = s.historicoExecucao || [];
    const rotuloIniciar = historico.length > 0 ? '▶️ Retomar' : '🚀 Iniciar';

    const st = norm(s.status);
    const isConcluido = st === 'concluido';
    const isExecucao = st === 'em execucao';
    const emAtraso = !isConcluido && servicoEstaAtrasado(s);

    let acoesHTML = '<div class="service-actions" style="margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">';

    if (isConcluido) {
      acoesHTML += `
        <button onclick="abrirRelatorioCompleto(${s.id})" style="${estiloBtn} background: #2980b9;">📄 Resumo</button>
        <button onclick="enviarRelatorioWhatsApp(${s.id})" style="${estiloBtn} background: #25d366; font-weight: bold;">📲 WhatsApp</button>`;
      if (ehAdmin) {
        acoesHTML += `
          <button onclick="abrirModalEditarConclusao(${s.id})" style="${estiloBtn} background: #f39c12;">📷 Editar Fotos / Obs</button>
          <button onclick="excluirServico(${s.id})" class="btn-delete" style="${estiloBtn} background: #ff4d4d; margin-left: auto;">Excluir</button>`;
      }
    } else {
      if (st === 'pendente' || st === 'agendado') {
        acoesHTML += `<button onclick="iniciarServico(${s.id})" class="btn-primary" style="${estiloBtn} background: #2e5a3c;">${rotuloIniciar}</button>`;
      }
      if (isExecucao) {
        acoesHTML += `<button onclick="solicitarPausaServico(${s.id})" class="btn-secondary" style="${estiloBtn} background: #e67e22;">⏸️ Pausar</button>`;
      }
      acoesHTML += `<button onclick="solicitarConclusaoServico(${s.id})" style="${estiloBtn} background: #27ae60;">✅ Concluir</button>`;
      if (ehAdmin) {
        acoesHTML += `<button onclick="excluirServico(${s.id})" class="btn-delete" style="${estiloBtn} background: #ff4d4d; margin-left: auto;">Excluir</button>`;
      }
    }
    acoesHTML += '</div>';

    const classeBadge = (s.status || '').toLowerCase().replace(' ', '-').replace('ú', 'u');
    const corPrioridade = norm(s.prioridade) === 'alta' ? '#dc2626' : '#000000';

    return `
    <div class="service-card" style="background: #fff; padding: 14px; border-radius: 10px; margin-bottom: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
      <div class="service-main" style="display: flex; justify-content: space-between; align-items: center;">
        <h4 style="margin: 0; color: #1b3b22;">${esc((s.nome || 'Serviço').toUpperCase())}</h4>
        <span class="badge ${esc(classeBadge)}" style="padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; background: #e2e8f0; color: #334155;">${esc(s.status)}</span>
      </div>
      <p class="service-info" style="font-size: 0.85rem; color: #64748b; margin: 6px 0;">📍 ${esc(s.local)} | 👤 ${esc(s.responsavel)} | 📅 Criado: ${esc(s.data || s.dataCriacao || 'N/A')}</p>
      <p class="service-priority" style="font-size: 0.85rem; margin: 4px 0; color: ${corPrioridade};">Prioridade: <strong style="color: ${corPrioridade};">${esc(s.prioridade || 'Normal')}</strong></p>

      ${emAtraso ? `
        <div style="background: #fff5f5; border: 1px solid #feb2b2; padding: 8px 12px; border-radius: 6px; margin: 8px 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; border-left: 4px solid #e74c3c;">
          <span style="color: #c0392b; font-size: 0.85rem; font-weight: bold;">⚠️ Serviço Atrasado!</span>
          <button type="button" onclick="abrirModalReagendar(${s.id})" style="padding: 5px 10px; font-size: 0.75rem; background: #e67e22; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">🔄 Justificar &amp; Reagendar</button>
        </div>` : ''}

      ${(s.agendamento || s.dataAgendada) ? `
        <div style="font-size: 0.85rem; margin-top: 6px; padding: 8px; border-radius: 6px; background: ${emAtraso ? '#fde8e8' : '#ebf5fb'}; border-left: 4px solid ${emAtraso ? '#e74c3c' : '#2980b9'}; color: ${emAtraso ? '#c0392b' : '#2980b9'};">
          📅 <strong>Agendado para:</strong> ${esc(s.agendamento || s.dataAgendada)}
        </div>` : ''}

      ${s.observacoes ? `<p style="font-size: 0.85rem; margin-top: 6px; color: #444; background: #f9f9f9; padding: 6px; border-radius: 6px;">📝 <strong>Obs:</strong> ${esc(s.observacoes)}</p>` : ''}

      ${historico.length > 0 ? `
        <div style="font-size: 0.8rem; margin-top: 8px; color: #2c3e50; background: #f1f5f9; padding: 8px; border-radius: 6px; border-left: 3px solid #2e5a3c;">
          <strong>⏱️ Registros de Execução:</strong>
          <div style="margin-top: 4px; display: flex; flex-direction: column; gap: 3px;">
            ${historico.map(h => `
              <div>
                <strong>${esc(h.icone || '•')} ${esc(h.acao)}:</strong> ${esc(h.dataHora || h.data)}
                ${h.detalhes ? `<span style="color: #c0392b;"> (${esc(h.detalhes)})</span>` : ''}
              </div>`).join('')}
          </div>
        </div>` : ''}

      ${s.conclusaoInfo ? `
        <div style="font-size: 0.8rem; margin-top: 8px; color: #1e7e34; background: #eafaf1; padding: 8px; border-radius: 6px; border-left: 3px solid #27ae60;">
          <strong>✅ Relatório de Conclusão:</strong>
          <div>${esc(s.conclusaoInfo)}</div>
          ${s.fotos && s.fotos.length > 0 ? `
            <div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
              ${s.fotos.map(f => `<img src="${esc(f)}" class="img-zoom" onclick="ampliarImagem(this.src)" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #27ae60; cursor: pointer;">`).join('')}
            </div>` : ''}
        </div>` : ''}

      ${acoesHTML}
    </div>`;
  }).join('');

  atualizarContadoresDashboard();
}

/* ==========================================================================
   AÇÕES DOS SERVIÇOS
   ========================================================================== */
function iniciarServico(id) {
  const servicos = carregarServicos();
  const item = servicos.find(s => Number(s.id) === Number(id));
  if (!item) return;

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

function solicitarPausaServico(id) {
  servicoPendentePausaId = id;
  mostrarModal('modal-justificativa');
}

function fecharModalJustificativa() {
  servicoPendentePausaId = null;
  const txt = document.getElementById('texto-justificativa');
  if (txt) txt.value = '';
  esconderModal('modal-justificativa');
}

function confirmarPausaServico() {
  const campo = document.getElementById('texto-justificativa');
  const motivo = campo ? campo.value.trim() : '';
  if (!motivo) return alert('Por favor, informe a justificativa.');

  const servicos = carregarServicos();
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
  if (!exigirAdmin()) return;
  if (confirm('Tem certeza que deseja excluir este serviço permanentemente?')) {
    const servicos = carregarServicos().filter(s => Number(s.id) !== Number(id));
    salvarServicos(servicos);
  }
}

/* ==========================================================================
   REAGENDAMENTO E ATRASOS
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
  if (isNaN(dataAgendada.getTime())) return false;
  return new Date() > dataAgendada;
}

function solicitarReagendamento(id) {
  servicoReagendarId = id;

  const justif = document.getElementById('justificativa-atraso');
  if (justif) justif.value = '';

  const novaData = document.getElementById('nova-data-agendada');
  if (novaData) novaData.value = hojeISO();

  const novoHorario = document.getElementById('novo-horario-agendado');
  if (novoHorario) novoHorario.value = '';

  const servico = carregarServicos().find(s => Number(s.id) === Number(id));
  const infoEl = document.getElementById('info-servico-atrasado');
  if (infoEl && servico) {
    infoEl.innerHTML = `<strong>Serviço:</strong> ${esc((servico.nome || 'Serviço').toUpperCase())}<br><strong>Local:</strong> ${esc(servico.local || 'N/A')}<br><strong>Agendamento Anterior:</strong> ${esc(servico.agendamento || servico.dataAgendada || 'N/A')}`;
  }

  mostrarModal('modal-reagendar');
}

function abrirModalReagendar(id) {
  solicitarReagendamento(id);
}

function fecharModalReagendar() {
  servicoReagendarId = null;
  esconderModal('modal-reagendar');
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

  const [ano, mes, dia] = novaData.split('-');
  const novoAgendamentoTexto = `${dia}/${mes}/${ano}${novoHorario ? ' às ' + novoHorario : ''}`;

  const servicos = carregarServicos();
  const item = servicos.find(s => Number(s.id) === Number(servicoReagendarId));

  if (item) {
    item.status = 'Agendado';
    item.agendamento = novoAgendamentoTexto;
    item.dataAgendada = novaData;

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
   IMAGENS E CONCLUSÃO
   ========================================================================== */
function solicitarConclusaoServico(id) {
  servicoConclusaoId = id;
  imagensTempConclusao = [];
  const preview = document.getElementById('preview-imagens');
  if (preview) preview.innerHTML = '';
  mostrarModal('modal-conclusao');
}

function fecharModalConclusao() {
  servicoConclusaoId = null;
  imagensTempConclusao = [];
  const form = document.getElementById('form-conclusao');
  if (form) form.reset();
  const preview = document.getElementById('preview-imagens');
  if (preview) preview.innerHTML = '';
  esconderModal('modal-conclusao');
}

function comprimirImagem(file, maxWidth, maxHeight, quality, callback) {
  const reader = new FileReader();
  reader.onerror = () => alert('Não foi possível ler a imagem selecionada.');
  reader.onload = function (event) {
    const img = new Image();
    img.onerror = () => alert('Arquivo de imagem inválido.');
    img.onload = function () {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', quality));
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

  files.forEach(file => {
    comprimirImagem(file, 1000, 1000, 0.8, function (base64Otimizado) {
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
  const campo = document.getElementById('relatorio-conclusao');
  const relatorio = campo ? campo.value.trim() : '';
  if (!relatorio) return alert('Informe o relatório de conclusão.');

  const servicos = carregarServicos();
  const item = servicos.find(s => Number(s.id) === Number(servicoConclusaoId));
  if (item) {
    item.status = 'Concluído';
    item.conclusaoInfo = relatorio;
    item.fotos = [...imagensTempConclusao];
    if (!item.historicoExecucao) item.historicoExecucao = [];
    item.historicoExecucao.push({ acao: 'Concluiu atividade', icone: '🏁', dataHora: obterDataHoraAtual() });
    if (!salvarServicos(servicos)) return; // mantém o modal aberto se falhar
  }
  fecharModalConclusao();
}

/* ==========================================================================
   EDIÇÃO DE CONCLUSÃO (ADMIN)
   ========================================================================== */
function abrirModalEditarConclusao(id) {
  if (!exigirAdmin()) return;
  servicoEdicaoConclusaoId = id;
  const s = carregarServicos().find(item => Number(item.id) === Number(id));
  if (!s) return;

  const campoText = document.getElementById('relatorio-conclusao-editar');
  if (campoText) campoText.value = s.conclusaoInfo || '';
  imagensTempConclusao = s.fotos ? [...s.fotos] : [];

  renderizarPreviewFotosEdicao();
  mostrarModal('modal-editar-conclusao');
}

function fecharModalEditarConclusao() {
  servicoEdicaoConclusaoId = null;
  imagensTempConclusao = [];
  esconderModal('modal-editar-conclusao');
}

function renderizarPreviewFotosEdicao() {
  const preview = document.getElementById('preview-imagens-editar');
  if (!preview) return;
  preview.innerHTML = '';
  imagensTempConclusao.forEach((imgSrc, index) => {
    const div = document.createElement('div');
    div.style.cssText = 'position: relative; display: inline-block;';

    const img = document.createElement('img');
    img.src = imgSrc;
    img.style.cssText = 'width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc;';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '✕';
    btn.style.cssText = 'position: absolute; top: -5px; right: -5px; background: #e74c3c; color: white; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer;';
    btn.onclick = () => removerFotoEdicao(index);

    div.appendChild(img);
    div.appendChild(btn);
    preview.appendChild(div);
  });
}

function carregarNovasImagensEdicao(event) {
  const files = Array.from(event.target.files);
  event.target.value = ''; // permite selecionar a mesma foto novamente
  files.forEach(file => {
    comprimirImagem(file, 1000, 1000, 0.8, function (base64Otimizado) {
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
  if (event) event.preventDefault();
  if (!exigirAdmin()) return;
  const campo = document.getElementById('relatorio-conclusao-editar');
  const relatorio = campo ? campo.value.trim() : '';

  const servicos = carregarServicos();
  const item = servicos.find(s => Number(s.id) === Number(servicoEdicaoConclusaoId));
  if (item) {
    item.conclusaoInfo = relatorio;
    item.fotos = [...imagensTempConclusao];
    if (!salvarServicos(servicos)) return;
  }
  fecharModalEditarConclusao();
}

/* ==========================================================================
   IMAGENS AMPLIADAS, RELATÓRIO E WHATSAPP
   ========================================================================== */
function ampliarImagem(src) {
  const modal = document.getElementById('modal-zoom-imagem');
  const img = document.getElementById('img-ampliada');
  if (!modal || !img) return;
  img.src = src;
  modal.style.display = 'flex';
}

function fecharZoomImagem() {
  const modal = document.getElementById('modal-zoom-imagem');
  const img = document.getElementById('img-ampliada');
  if (modal) modal.style.display = 'none';
  if (img) img.removeAttribute('src');
}

function abrirRelatorioCompleto(id) {
  const s = carregarServicos().find(item => Number(item.id) === Number(id));
  const conteudo = document.getElementById('conteudo-relatorio');
  if (!s || !conteudo) return;

  const historico = s.historicoExecucao || [];

  conteudo.innerHTML = `
    <p><strong>Serviço:</strong> ${esc(s.nome)}</p>
    <p><strong>Local:</strong> ${esc(s.local)}</p>
    <p><strong>Responsável:</strong> ${esc(s.responsavel)}</p>
    <p><strong>Prioridade:</strong> ${esc(s.prioridade || 'Normal')}</p>
    <p><strong>Data de Criação:</strong> ${esc(s.data || 'N/A')}</p>
    ${s.observacoes ? `<p><strong>Observações:</strong> ${esc(s.observacoes)}</p>` : ''}
    ${historico.length ? `
      <div>
        <strong>Registros de Execução:</strong>
        ${historico.map(h => `<div style="font-size: 0.85rem; margin-top: 3px;">${esc(h.icone || '•')} ${esc(h.acao)}: ${esc(h.dataHora || h.data)}${h.detalhes ? ` <span style="color: #ffb703;">(${esc(h.detalhes)})</span>` : ''}</div>`).join('')}
      </div>` : ''}
    <div>
      <strong>Relatório de Conclusão:</strong>
      <div style="background: rgba(255,255,255,0.08); padding: 10px; border-radius: 6px; border-left: 4px solid #27ae60; font-size: 0.9rem; margin-top: 4px;">${esc(s.conclusaoInfo || 'Sem descrição.')}</div>
    </div>
    ${s.fotos && s.fotos.length > 0 ? `
      <div>
        <strong>Fotos Registradas:</strong>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
          ${s.fotos.map(f => `<img src="${esc(f)}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px; cursor: pointer;" onclick="ampliarImagem(this.src)">`).join('')}
        </div>
      </div>` : ''}
  `;
  mostrarModal('modal-relatorio');
}

function fecharModalRelatorio() {
  esconderModal('modal-relatorio');
}

function enviarRelatorioWhatsApp(id) {
  const s = carregarServicos().find(item => Number(item.id) === Number(id));
  if (!s) return;

  let texto = `*${dadosFazenda.nome || 'CRIATÓRIO MARQUES'}*\n`;
  texto += `*Relatório de Serviço Concluído*\n\n`;
  texto += `📌 *Serviço:* ${s.nome}\n`;
  texto += `📍 *Local:* ${s.local}\n`;
  texto += `👤 *Responsável:* ${s.responsavel}\n`;
  texto += `📅 *Data:* ${s.data || 'N/A'}\n\n`;
  texto += `📝 *Relatório de Execução:*\n${s.conclusaoInfo || 'Atividade finalizada com sucesso.'}\n`;

  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
}

/* ==========================================================================
   PERFIL DA FAZENDA E LOGO
   ========================================================================== */
function mostrarPreviewLogo(src) {
  const box = document.getElementById('preview-logo-box');
  if (!box) return;
  box.innerHTML = '';
  if (!src) return;
  const img = document.createElement('img');
  img.src = src;
  img.alt = 'Pré-visualização da logo';
  img.style.cssText = 'width: 80px; height: 80px; object-fit: cover; border-radius: 50%; border: 2px solid #d4af37; margin-top: 8px;';
  box.appendChild(img);
}

function abrirModalPerfilFazenda(primeiraVez = false) {
  const modal = document.getElementById('modal-perfil-fazenda');
  if (!modal) return;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('input-nome-fazenda', dadosFazenda.nome || '');
  set('input-slogan-fazenda', dadosFazenda.slogan || '');
  set('input-cidade-fazenda', dadosFazenda.cidade || '');
  set('input-logo-fazenda', '');

  logoTempBase64 = dadosFazenda.logoBase64 || '';
  mostrarPreviewLogo(logoTempBase64);

  modal.style.display = 'flex';
}

function fecharModalPerfilFazenda() {
  esconderModal('modal-perfil-fazenda');
  logoTempBase64 = '';
}

function carregarPreviewLogo(event) {
  const file = event.target.files[0];
  if (!file) return;

  comprimirImagem(file, 400, 400, 0.85, function (base64) {
    logoTempBase64 = base64;
    mostrarPreviewLogo(base64);
  });
}

// Nome antigo, mantido por compatibilidade
const carregarLogoFazenda = carregarPreviewLogo;

function salvarPerfilFazenda(event) {
  if (event) event.preventDefault();

  const get = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

  const novo = {
    nome: get('input-nome-fazenda') || FAZENDA_PADRAO.nome,
    slogan: get('input-slogan-fazenda'),
    cidade: get('input-cidade-fazenda'),
    logoBase64: logoTempBase64 || dadosFazenda.logoBase64 || ''
  };

  try {
    localStorage.setItem(STORAGE_KEY_FAZENDA, JSON.stringify(novo));
  } catch (e) {
    return alert('Não foi possível salvar: armazenamento cheio (tente uma logo menor).');
  }

  dadosFazenda = novo;
  carregarDadosFazendaNaTela();
  fecharModalPerfilFazenda();
}

function carregarDadosFazendaNaTela() {
  try {
    const salvos = localStorage.getItem(STORAGE_KEY_FAZENDA);
    if (salvos) dadosFazenda = JSON.parse(salvos);
  } catch (e) { /* mantém o que já está em memória */ }

  const titulo = document.getElementById('header-nome-fazenda');
  const slogan = document.getElementById('header-slogan');
  const logoContainer = document.getElementById('header-logo');

  if (titulo) titulo.innerText = dadosFazenda.nome || FAZENDA_PADRAO.nome;
  if (slogan) slogan.innerText = `"${dadosFazenda.slogan || FAZENDA_PADRAO.slogan}"`;

  const cidade = document.getElementById('header-cidade');
  if (cidade && dadosFazenda.cidade) cidade.innerText = `📍 ${dadosFazenda.cidade}`;

  if (logoContainer) {
    if (dadosFazenda.logoBase64 && dadosFazenda.logoBase64.startsWith('data:image')) {
      logoContainer.innerHTML = '';
      const img = document.createElement('img');
      img.src = dadosFazenda.logoBase64;
      img.alt = 'Logo';
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;';
      logoContainer.appendChild(img);
      logoContainer.style.padding = '0';
      logoContainer.style.overflow = 'hidden';
    }
    // sem logo salva: mantém a imagem logo.png (ou "CM") definida no HTML
  }
}

/* ==========================================================================
   BACKUP E IMPORTAÇÃO
   ========================================================================== */
async function fazerBackup() {
  try {
    const dados = {
      servicos: carregarServicos(),
      areas: carregarAreas(),
      fazenda: dadosFazenda
    };

    const json = JSON.stringify(dados);
    const nomeArquivo = `backup_criatorio_marques_${hojeISO()}.json`;
    const blob = new Blob([json], { type: 'application/json' });

    // iPhone/iPad: o atributo "download" costuma ser ignorado, então usa o menu de compartilhar
    const ehIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (ehIOS && navigator.canShare) {
      const arquivo = new File([blob], nomeArquivo, { type: 'application/json' });
      if (navigator.canShare({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: 'Backup Criatório Marques' });
        return;
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // Não revogar a URL na hora: em alguns navegadores isso cancela o download
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1500);
  } catch (erro) {
    if (erro && erro.name === 'AbortError') return; // usuário cancelou o compartilhamento
    console.error('Erro ao gerar backup:', erro);
    alert('Não foi possível gerar o backup: ' + (erro && erro.message ? erro.message : erro));
  }
}

// Nomes alternativos, caso o botão no HTML use outro nome de função
const exportarBackup = fazerBackup;
const baixarBackup = fazerBackup;
const gerarBackup = fazerBackup;

function importarBackup(event) {
  if (!exigirAdmin()) return;
  const file = event.target.files[0];
  if (!file) return;

  if (!confirm('A importação substituirá os dados atuais. Deseja continuar?')) {
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const dados = JSON.parse(e.target.result);
      if (!dados || typeof dados !== 'object') throw new Error('Arquivo inválido');

      if (Array.isArray(dados.servicos)) localStorage.setItem(STORAGE_KEY, JSON.stringify(dados.servicos));
      if (Array.isArray(dados.areas)) localStorage.setItem(STORAGE_KEY_AREAS, JSON.stringify(dados.areas));
      if (dados.fazenda && typeof dados.fazenda === 'object') {
        localStorage.setItem(STORAGE_KEY_FAZENDA, JSON.stringify(dados.fazenda));
      }

      alert('Dados importados com sucesso!');
      location.reload();
    } catch (err) {
      alert('Erro ao ler o arquivo de backup. Verifique se o arquivo JSON é válido.');
    }
  };
  reader.readAsText(file);
}
