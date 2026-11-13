/* ==========================================================================
   CRIATÓRIO MARQUES - SISTEMA DE GESTÃO DE SERVIÇOS  (versão corrigida)
   ========================================================================== */

const STORAGE_KEY = 'criatorio_marques_servicos';
const STORAGE_KEY_AREAS = 'criatorio_marques_areas';
const STORAGE_KEY_FAZENDA = 'dadosFazenda';
const STORAGE_KEY_ULTIMO_BACKUP = 'criatorio_marques_ultimo_backup';
const STORAGE_KEY_BACKUP_ADIADO = 'criatorio_marques_backup_adiado_ate';
const DIAS_LEMBRETE_BACKUP = 7; // avisa quando o último backup tiver mais de X dias

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
   FOTOS (guardadas no IndexedDB, que comporta muito mais que o localStorage)
   ========================================================================== */
const DB_NOME = 'criatorio_marques_fotos';
const DB_STORE = 'fotos';
const FOTO_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const cacheFotos = new Map();
let dbPromise = null;
let idbOk = null;

// No JSON dos serviços a foto vira uma referência curta: "idb:<id>"
function ehRefFoto(valor) { return typeof valor === 'string' && valor.startsWith('idb:'); }
function ehFotoInline(valor) { return typeof valor === 'string' && valor.startsWith('data:image'); }
function novoIdFoto() { return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

function abrirDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB indisponível'));
      const req = indexedDB.open(DB_NOME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(DB_STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function idbOp(modo, fn) {
  return abrirDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, modo);
    let resultado;
    const req = fn(tx.objectStore(DB_STORE));
    if (req) req.onsuccess = () => { resultado = req.result; };
    tx.oncomplete = () => resolve(resultado);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

const idbSet = (id, valor) => idbOp('readwrite', st => st.put(valor, id));
const idbGet = id => idbOp('readonly', st => st.get(id));
const idbDel = id => idbOp('readwrite', st => st.delete(id));
const idbLimpar = () => idbOp('readwrite', st => st.clear());

function idbTodos() {
  return abrirDB().then(db => new Promise((resolve, reject) => {
    const saida = {};
    const cursor = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).openCursor();
    cursor.onsuccess = e => {
      const c = e.target.result;
      if (c) { saida[c.key] = c.value; c.continue(); } else { resolve(saida); }
    };
    cursor.onerror = () => reject(cursor.error);
  }));
}

async function idbDisponivel() {
  if (idbOk !== null) return idbOk;
  try {
    await abrirDB();
    idbOk = true;
  } catch (e) {
    console.warn('IndexedDB indisponível; as fotos ficarão no localStorage.', e);
    idbOk = false;
  }
  return idbOk;
}

async function obterFoto(ref) {
  if (!ehRefFoto(ref)) return ref;
  if (cacheFotos.has(ref)) return cacheFotos.get(ref);
  try {
    const dado = await idbGet(ref.slice(4));
    if (dado) cacheFotos.set(ref, dado);
    return dado || null;
  } catch (e) {
    return null;
  }
}

// <img> de uma foto: referência (carregada depois) ou imagem antiga embutida
function imgFotoHTML(ref, atributos) {
  if (ehRefFoto(ref)) return `<img src="${FOTO_PLACEHOLDER}" data-foto="${esc(ref)}" ${atributos}>`;
  return `<img src="${esc(ref)}" ${atributos}>`;
}

async function hidratarFotos(raiz) {
  const base = raiz || document;
  const imgs = Array.from(base.querySelectorAll('img[data-foto]'));
  await Promise.all(imgs.map(async img => {
    const dado = await obterFoto(img.getAttribute('data-foto'));
    if (dado) {
      img.src = dado;
      img.removeAttribute('data-foto');
    }
  }));
}

// Grava no IndexedDB as fotos novas (data:image...) e devolve a lista só com referências.
// Se o IndexedDB não existir, mantém a foto embutida (comportamento antigo).
async function persistirFotos(lista) {
  const usaIDB = await idbDisponivel();
  const refs = [];
  const novos = [];
  for (const f of lista) {
    if (usaIDB && ehFotoInline(f)) {
      const id = novoIdFoto();
      await idbSet(id, f);
      cacheFotos.set('idb:' + id, f);
      refs.push('idb:' + id);
      novos.push('idb:' + id);
    } else {
      refs.push(f);
    }
  }
  atualizarInfoArmazenamento();
  return { refs, novos };
}

async function removerFotosDoDB(refs) {
  for (const ref of refs || []) {
    if (!ehRefFoto(ref)) continue;
    cacheFotos.delete(ref);
    try { await idbDel(ref.slice(4)); } catch (e) { /* ignora */ }
  }
  atualizarInfoArmazenamento();
}

// Move para o IndexedDB as fotos que estavam dentro do localStorage (libera espaço)
async function migrarFotosParaIndexedDB() {
  if (!(await idbDisponivel())) return;

  const servicos = carregarServicos();
  const areas = carregarAreas();
  const precisaServicos = servicos.some(s => Array.isArray(s.fotos) && s.fotos.some(ehFotoInline));
  const precisaAreas = areas.some(a => ehFotoInline(a.foto));
  if (!precisaServicos && !precisaAreas) return;

  try {
    // 1) copia todas as fotos para o IndexedDB
    for (const s of servicos) {
      if (!Array.isArray(s.fotos)) continue;
      for (let i = 0; i < s.fotos.length; i++) {
        if (ehFotoInline(s.fotos[i])) {
          const id = novoIdFoto();
          await idbSet(id, s.fotos[i]);
          s.fotos[i] = 'idb:' + id;
        }
      }
    }
    for (const a of areas) {
      if (ehFotoInline(a.foto)) {
        const id = novoIdFoto();
        await idbSet(id, a.foto);
        a.foto = 'idb:' + id;
      }
    }
    // 2) só então troca os dados do localStorage (agora bem menores)
    if (precisaServicos) localStorage.setItem(STORAGE_KEY, JSON.stringify(servicos));
    if (precisaAreas) localStorage.setItem(STORAGE_KEY_AREAS, JSON.stringify(areas));
    filtrarServicos();
  } catch (e) {
    console.error('Falha ao migrar fotos para o IndexedDB:', e);
  }
}

async function atualizarInfoArmazenamento() {
  try {
    if (!navigator.storage || !navigator.storage.estimate) return;
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) return;

    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const mb = usage / (1024 * 1024);
    let texto = `💽 Armazenamento usado: ${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
    let cor = '#d8f3dc';
    if (quota) {
      const pct = Math.round((usage / quota) * 100);
      texto += ` (${pct}% do disponível)`;
      if (pct >= 80) cor = '#ffb703';
    }

    let el = document.getElementById('info-armazenamento');
    if (!el) {
      el = document.createElement('small');
      el.id = 'info-armazenamento';
      toolbar.appendChild(el);
    }
    el.style.cssText = `color: ${cor}; font-size: 0.75rem;`;
    el.textContent = texto;
  } catch (e) { /* ignora */ }
}

/* ==========================================================================
   INICIALIZAÇÃO
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  carregarDadosFazendaNaTela();
  atualizarLabelPerfil();
  atualizarSelectAreasServico();
  atualizarListaCategorias();
  atualizarEstiloCards();
  filtrarServicos(); // renderiza a lista e atualiza os contadores
  buscarClimaBelem();
  verificarLembreteBackup();

  // pede ao navegador para não apagar os dados do app por falta de espaço
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  migrarFotosParaIndexedDB().then(() => atualizarInfoArmazenamento()).catch(() => {});

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

  comprimirImagem(file, 800, 800, 0.7, function (base64) {
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

async function salvarNovaArea(event) {
  if (event) event.preventDefault();
  const formulario = event && event.target;
  const input = document.getElementById('nome-area') || document.getElementById('nome-nova-area');
  if (!input) return;

  const nome = input.value.trim();
  if (!nome) return alert('Informe o nome da área.');

  const areas = carregarAreas();
  if (areas.some(a => norm(a.nome) === norm(nome))) {
    return alert('Essa área já está cadastrada.');
  }

  let foto = '';
  let novos = [];
  if (fotoTempAreaBase64) {
    try {
      const resultado = await persistirFotos([fotoTempAreaBase64]);
      foto = resultado.refs[0];
      novos = resultado.novos;
    } catch (e) {
      return alert('Não foi possível guardar a foto neste aparelho.');
    }
  }

  areas.push({ id: Date.now(), nome, foto });
  if (!salvarAreas(areas)) {
    await removerFotosDoDB(novos);
    return;
  }

  input.value = '';
  fotoTempAreaBase64 = '';
  const prev = document.getElementById('preview-foto-area');
  if (prev) prev.innerHTML = '';
  if (formulario && formulario.querySelector) {
    const arquivo = formulario.querySelector('input[type="file"]');
    if (arquivo) arquivo.value = '';
  }
  renderizarListaAreas();
}

// Nome antigo, mantido por compatibilidade
const adicionarNovaArea = salvarNovaArea;

async function removerArea(id) {
  if (!exigirAdmin()) return;
  if (!confirm('Deseja remover esta área?')) return;

  const todas = carregarAreas();
  const alvo = todas.find(a => Number(a.id) === Number(id));
  const areas = todas.filter(a => Number(a.id) !== Number(id));
  if (salvarAreas(areas) && alvo) {
    await removerFotosDoDB([alvo.foto]);
  }
  renderizarListaAreas();
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
        ${a.foto ? imgFotoHTML(a.foto, 'onclick="ampliarImagem(this.src)" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; cursor: pointer;"') : ''}
        <span style="font-size: 0.9rem; font-weight: 500; color: #1e293b;">📍 ${esc(a.nome)}</span>
      </div>
      ${perfilAtual === 'admin' ? `<button onclick="removerArea(${Number(a.id)})" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; cursor: pointer;">Excluir</button>` : ''}
    </div>
  `).join('');
  hidratarFotos(container);
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
    alert('Atenção: o armazenamento do aparelho está cheio. Faça um backup e remova serviços antigos.');
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
  atualizarListaCategorias();
  mostrarModal('modal-servico');
}

function fecharModal() {
  esconderModal('modal-servico');
  const form = document.getElementById('form-servico');
  if (form) form.reset();
  alternarRecorrenciaPersonalizada();
}

function alternarRecorrenciaPersonalizada() {
  const sel = document.getElementById('recorrencia-servico');
  const campo = document.getElementById('recorrencia-personalizada');
  if (!sel || !campo) return;
  const personalizado = sel.value === 'custom';
  campo.style.display = personalizado ? 'block' : 'none';
  if (!personalizado) campo.value = '';
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
  const categoria = canonicalizarCategoria(valor('categoria-servico'));
  const dataAgendadaVal = valor('data-agendada');
  const horaAgendadaVal = valor('hora-agendada');

  // Repetição automática (0 = não repete)
  let recorrenciaDias = 0;
  const selRecorrencia = document.getElementById('recorrencia-servico');
  if (selRecorrencia) {
    if (selRecorrencia.value === 'custom') {
      recorrenciaDias = parseInt(valor('recorrencia-personalizada'), 10);
      if (!Number.isInteger(recorrenciaDias) || recorrenciaDias < 1 || recorrenciaDias > 3650) {
        return alert('Informe um intervalo de repetição entre 1 e 3650 dias.');
      }
    } else {
      recorrenciaDias = parseInt(selRecorrencia.value, 10) || 0;
    }
  }

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
    categoria,
    status: statusInicial,
    agendamento: informacaoAgendamento,
    dataAgendada: dataAgendadaVal,
    historicoExecucao: [],
    conclusaoInfo: null,
    fotos: [],
    recorrenciaDias,
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

  const painel = document.getElementById('painel-filtros-concluidos');
  if (painel) painel.style.display = filtrosConcluidosAtivos() ? 'block' : 'none';

  const titulo = document.getElementById('titulo-lista');
  if (titulo) {
    titulo.innerText = filtroStatusAtual ? `Serviços (${filtroStatusAtual})` : 'Serviços por urgência';
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
      norm(s.responsavel).includes(termo) ||
      norm(s.categoria).includes(termo)
    );
  }

  // Filtros de data/mês, categoria e tempo: só valem na visão de concluídos
  if (filtrosConcluidosAtivos()) {
    atualizarOpcoesFiltros();
    servicos = aplicarFiltrosConcluidos(servicos);
    resumoFiltroConcluidos(servicos);
  }

  renderizarServicos(ordenarServicos(servicos));
}

// Peso da prioridade: Alta primeiro, depois Normal, depois Baixa
function pesoPrioridade(prioridade) {
  const pesos = { alta: 0, normal: 1, baixa: 2 };
  const p = pesos[norm(prioridade)];
  return p === undefined ? 1 : p;
}

function timestampAgendamento(s) {
  if (!s.dataAgendada) return Number.MAX_SAFE_INTEGER;
  const hora = /(\d{2}):(\d{2})/.exec(s.agendamento || '');
  const t = new Date(`${s.dataAgendada}T${hora ? hora[0] : '23:59'}:00`).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

// Ordem: 1) atrasados  2) em execução  3) prioridade  4) data agendada  5) mais novos
// Concluídos vão para o fim, do mais recente para o mais antigo.
function ordenarServicos(lista) {
  return [...lista].sort((a, b) => {
    const concA = norm(a.status) === 'concluido';
    const concB = norm(b.status) === 'concluido';
    if (concA !== concB) return concA ? 1 : -1;
    if (concA && concB) {
      const fa = calcularTemposServico(a).fim;
      const fb = calcularTemposServico(b).fim;
      const ta = fa ? fa.getTime() : Number(a.id);
      const tb = fb ? fb.getTime() : Number(b.id);
      return tb - ta;
    }

    const atrA = servicoEstaAtrasado(a);
    const atrB = servicoEstaAtrasado(b);
    if (atrA !== atrB) return atrA ? -1 : 1;

    const execA = norm(a.status) === 'em execucao';
    const execB = norm(b.status) === 'em execucao';
    if (execA !== execB) return execA ? -1 : 1;

    const pa = pesoPrioridade(a.prioridade);
    const pb = pesoPrioridade(b.prioridade);
    if (pa !== pb) return pa - pb;

    const da = timestampAgendamento(a);
    const db = timestampAgendamento(b);
    if (da !== db) return da - db;

    return Number(b.id) - Number(a.id);
  });
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
    verificarAlertasDoDia();
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
      <p class="service-info" style="font-size: 0.85rem; color: #64748b; margin: 6px 0;">📍 ${esc(s.local)} | 👤 ${esc(s.responsavel)}${s.categoria ? ` | 🏷️ ${esc(s.categoria)}` : ''} | 📅 Criado: ${esc(s.data || s.dataCriacao || 'N/A')}</p>
      <p class="service-priority" style="font-size: 0.85rem; margin: 4px 0; color: ${corPrioridade};">Prioridade: <strong style="color: ${corPrioridade};">${esc(s.prioridade || 'Normal')}</strong></p>
      ${Number(s.recorrenciaDias) > 0 ? `<p style="font-size: 0.8rem; margin: 4px 0; color: #2e5a3c; font-weight: 600;">🔁 Repete a cada ${Number(s.recorrenciaDias)} ${Number(s.recorrenciaDias) === 1 ? 'dia' : 'dias'}</p>` : ''}

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
              ${s.fotos.map(f => imgFotoHTML(f, 'class="img-zoom" onclick="ampliarImagem(this.src)" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #27ae60; cursor: pointer;"')).join('')}
            </div>` : ''}
        </div>` : ''}

      ${acoesHTML}
    </div>`;
  }).join('');

  atualizarContadoresDashboard();
  verificarAlertasDoDia();
  hidratarFotos(container);
}

/* ==========================================================================
   FILTROS DOS SERVIÇOS CONCLUÍDOS (data/mês, categoria e tempo)
   ========================================================================== */
const CATEGORIAS_PADRAO = ['Sanidade', 'Manejo', 'Reprodução', 'Alimentação', 'Pesagem', 'Manutenção e Reparos', 'Limpeza', 'Administrativo', 'Outros'];

// Faixas de duração em minutos: [mínimo, máximo)
const FAIXAS_TEMPO = {
  ate30: [0, 30],
  de30a120: [30, 120],
  de2a4h: [120, 240],
  de4a8h: [240, 480],
  de8a24h: [480, 1440],
  de1a3d: [1440, 4320],
  mais3d: [4320, Infinity]
};

const ROTULOS_TEMPO = {
  execucao: 'Tempo em execução',
  total: 'Do início à conclusão',
  cadastro: 'Do cadastro à conclusão'
};

const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function filtrosConcluidosAtivos() {
  return norm(filtroStatusAtual) === 'concluido';
}

function dataISODe(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function rotuloMes(anoMes) {
  const [ano, mes] = anoMes.split('-');
  return `${NOMES_MESES[Number(mes) - 1]} de ${ano}`;
}

// Categorias conhecidas: as padrão + as que já foram usadas nos serviços
function categoriasConhecidas() {
  const mapa = new Map();
  CATEGORIAS_PADRAO.forEach(c => mapa.set(norm(c), c));
  carregarServicos().forEach(s => {
    const c = (s.categoria || '').trim();
    if (c && !mapa.has(norm(c))) mapa.set(norm(c), c);
  });
  return mapa;
}

// "sanidade" digitado vira "Sanidade" se essa categoria já existe (evita duplicar por maiúscula/acento)
function canonicalizarCategoria(texto) {
  const limpo = (texto || '').trim();
  if (!limpo) return '';
  return categoriasConhecidas().get(norm(limpo)) || limpo;
}

function atualizarListaCategorias() {
  const lista = document.getElementById('lista-categorias');
  if (!lista) return;
  lista.innerHTML = [...categoriasConhecidas().values()].map(c => `<option value="${esc(c)}"></option>`).join('');
}

// Monta as opções de mês e categoria a partir dos serviços concluídos
function atualizarOpcoesFiltros() {
  const concluidos = carregarServicos().filter(s => norm(s.status) === 'concluido');

  const selMes = document.getElementById('filtro-mes');
  if (selMes) {
    const atual = selMes.value;
    const meses = new Set();
    concluidos.forEach(s => {
      const fim = calcularTemposServico(s).fim;
      if (fim) meses.add(dataISODe(fim).slice(0, 7));
    });
    const ordenados = [...meses].sort().reverse();
    selMes.innerHTML = '<option value="">Todos os meses</option>' +
      ordenados.map(m => `<option value="${m}">${rotuloMes(m)}</option>`).join('');
    selMes.value = ordenados.includes(atual) ? atual : '';
  }

  const selCat = document.getElementById('filtro-categoria');
  if (selCat) {
    const atual = selCat.value;
    const contagem = new Map(); // chave normalizada -> { rotulo, qtd }
    let semCategoria = 0;
    concluidos.forEach(s => {
      const c = (s.categoria || '').trim();
      if (!c) { semCategoria++; return; }
      const chave = norm(c);
      const item = contagem.get(chave) || { rotulo: canonicalizarCategoria(c), qtd: 0 };
      item.qtd++;
      contagem.set(chave, item);
    });
    const opcoes = [...contagem.entries()].sort((a, b) => a[1].rotulo.localeCompare(b[1].rotulo, 'pt-BR'));
    selCat.innerHTML = '<option value="">Todas as categorias</option>' +
      opcoes.map(([chave, item]) => `<option value="${esc(chave)}">${esc(item.rotulo)} (${item.qtd})</option>`).join('') +
      (semCategoria ? `<option value="__sem__">Sem categoria (${semCategoria})</option>` : '');
    selCat.value = (atual === '__sem__' && semCategoria) || contagem.has(atual) ? atual : '';
  }
}

function valorTempoDoServico(s, tipo) {
  const t = calcularTemposServico(s);
  if (tipo === 'total') return t.totalMs;
  if (tipo === 'cadastro') return t.cadastroMs;
  return t.iniciou ? t.execucaoMs : null; // sem início registrado, não há tempo de execução
}

function aplicarFiltrosConcluidos(lista) {
  const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const mes = val('filtro-mes');
  const de = val('filtro-data-de');
  const ate = val('filtro-data-ate');
  const categoria = val('filtro-categoria');
  const tipo = val('filtro-tempo-tipo') || 'execucao';
  const faixa = FAIXAS_TEMPO[val('filtro-tempo-faixa')];

  return lista.filter(s => {
    if (mes || de || ate) {
      const fim = calcularTemposServico(s).fim;
      if (!fim) return false; // sem data de conclusão registrada
      const iso = dataISODe(fim);
      if (mes && iso.slice(0, 7) !== mes) return false;
      if (de && iso < de) return false;
      if (ate && iso > ate) return false;
    }

    if (categoria) {
      const cat = (s.categoria || '').trim();
      if (categoria === '__sem__') {
        if (cat) return false;
      } else if (norm(cat) !== categoria) {
        return false;
      }
    }

    if (faixa) {
      const ms = valorTempoDoServico(s, tipo);
      if (ms === null || ms === undefined) return false;
      const minutos = ms / 60000;
      if (minutos < faixa[0] || minutos >= faixa[1]) return false;
    }
    return true;
  });
}

function resumoFiltroConcluidos(lista) {
  const el = document.getElementById('resumo-filtro');
  if (!el) return;
  const tipoEl = document.getElementById('filtro-tempo-tipo');
  const tipo = (tipoEl && tipoEl.value) || 'execucao';

  const n = lista.length;
  let texto = `${n} ${n === 1 ? 'serviço encontrado' : 'serviços encontrados'}`;

  const valores = lista.map(s => valorTempoDoServico(s, tipo)).filter(v => v !== null && v !== undefined);
  if (valores.length) {
    const soma = valores.reduce((a, b) => a + b, 0);
    texto += ` • Média (${ROTULOS_TEMPO[tipo].toLowerCase()}): ${formatarDuracao(soma / valores.length)}`;
    if (tipo === 'execucao') texto += ` • Soma: ${formatarDuracao(soma)}`;
  }
  el.textContent = texto;
}

function limparFiltrosConcluidos() {
  ['filtro-mes', 'filtro-data-de', 'filtro-data-ate', 'filtro-categoria', 'filtro-tempo-faixa'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const tipo = document.getElementById('filtro-tempo-tipo');
  if (tipo) tipo.value = 'execucao';
  filtrarServicos();
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

async function excluirServico(id) {
  if (!exigirAdmin()) return;
  if (!confirm('Tem certeza que deseja excluir este serviço permanentemente?')) return;

  const todos = carregarServicos();
  const alvo = todos.find(s => Number(s.id) === Number(id));
  const servicos = todos.filter(s => Number(s.id) !== Number(id));
  if (salvarServicos(servicos) && alvo) {
    await removerFotosDoDB(alvo.fotos || []);
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
    comprimirImagem(file, 1024, 1024, 0.72, function (base64Otimizado) {
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

let salvandoConclusao = false;

async function confirmarConclusaoServico(event) {
  if (event) event.preventDefault();
  if (salvandoConclusao) return;

  const campo = document.getElementById('relatorio-conclusao');
  const relatorio = campo ? campo.value.trim() : '';
  if (!relatorio) return alert('Informe o relatório de conclusão.');

  salvandoConclusao = true;
  try {
    let resultado;
    try {
      resultado = await persistirFotos(imagensTempConclusao);
    } catch (e) {
      console.error('Erro ao guardar fotos:', e);
      return alert('Não foi possível guardar as fotos neste aparelho. Tente com menos fotos.');
    }

    const servicos = carregarServicos();
    const item = servicos.find(s => Number(s.id) === Number(servicoConclusaoId));
    if (item) {
      item.status = 'Concluído';
      item.conclusaoInfo = relatorio;
      item.fotos = resultado.refs;
      if (!item.historicoExecucao) item.historicoExecucao = [];
      item.historicoExecucao.push({ acao: 'Concluiu atividade', icone: '🏁', dataHora: obterDataHoraAtual() });

      const proximo = criarProximoServicoRecorrente(item);
      if (proximo) servicos.unshift(proximo);

      if (!salvarServicos(servicos)) { // mantém o modal aberto se falhar
        await removerFotosDoDB(resultado.novos);
        return;
      }
      if (proximo) alert(`🔁 Próximo serviço agendado para ${proximo.agendamento}.`);
    } else {
      await removerFotosDoDB(resultado.novos);
    }
    fecharModalConclusao();
  } finally {
    salvandoConclusao = false;
  }
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
  atualizarListaCategorias();
  const campoCategoria = document.getElementById('categoria-conclusao-editar');
  if (campoCategoria) campoCategoria.value = s.categoria || '';
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
  imagensTempConclusao.forEach((fonte, index) => {
    const div = document.createElement('div');
    div.style.cssText = 'position: relative; display: inline-block;';

    const img = document.createElement('img');
    img.style.cssText = 'width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc;';
    if (ehRefFoto(fonte)) {
      img.src = FOTO_PLACEHOLDER;
      obterFoto(fonte).then(dado => { if (dado) img.src = dado; });
    } else {
      img.src = fonte;
    }

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
    comprimirImagem(file, 1024, 1024, 0.72, function (base64Otimizado) {
      imagensTempConclusao.push(base64Otimizado);
      renderizarPreviewFotosEdicao();
    });
  });
}

function removerFotoEdicao(index) {
  imagensTempConclusao.splice(index, 1);
  renderizarPreviewFotosEdicao();
}

let salvandoEdicao = false;

async function confirmarEdicaoConclusao(event) {
  if (event) event.preventDefault();
  if (!exigirAdmin()) return;
  if (salvandoEdicao) return;

  const campo = document.getElementById('relatorio-conclusao-editar');
  const relatorio = campo ? campo.value.trim() : '';
  const campoCat = document.getElementById('categoria-conclusao-editar');
  const categoria = canonicalizarCategoria(campoCat ? campoCat.value : '');

  salvandoEdicao = true;
  try {
    let resultado;
    try {
      resultado = await persistirFotos(imagensTempConclusao);
    } catch (e) {
      console.error('Erro ao guardar fotos:', e);
      return alert('Não foi possível guardar as fotos neste aparelho. Tente com menos fotos.');
    }

    const servicos = carregarServicos();
    const item = servicos.find(s => Number(s.id) === Number(servicoEdicaoConclusaoId));
    if (item) {
      const antes = item.fotos || [];
      item.categoria = categoria;
      item.conclusaoInfo = relatorio;
      item.fotos = resultado.refs;
      if (!salvarServicos(servicos)) {
        await removerFotosDoDB(resultado.novos);
        return;
      }
      // apaga do aparelho as fotos que o admin retirou
      await removerFotosDoDB(antes.filter(f => ehRefFoto(f) && !resultado.refs.includes(f)));
    } else {
      await removerFotosDoDB(resultado.novos);
    }
    fecharModalEditarConclusao();
  } finally {
    salvandoEdicao = false;
  }
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

/* ---------- Tempo de execução do serviço ---------- */
// Lê "dd/mm/aaaa às hh:mm" (formato gravado no histórico)
function lerDataHoraRegistro(texto) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})\D+(\d{2}):(\d{2})/.exec(texto || '');
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatarDuracao(ms) {
  const min = Math.round(ms / 60000);
  if (min < 1) return 'menos de 1 minuto';
  const dias = Math.floor(min / 1440);
  const horas = Math.floor((min % 1440) / 60);
  const minutos = min % 60;
  const partes = [];
  if (dias) partes.push(`${dias} ${dias === 1 ? 'dia' : 'dias'}`);
  if (horas) partes.push(`${horas} h`);
  if (minutos && !dias) partes.push(`${minutos} min`); // com dias, os minutos só poluem
  return partes.join(' ');
}

// Percorre o histórico: soma só os períodos "em execução" (descontando as pausas)
function calcularTemposServico(s) {
  const historico = Array.isArray(s.historicoExecucao) ? s.historicoExecucao : [];
  let inicio = null, fim = null, fimTexto = null;
  let emExecucaoDesde = null, execucaoMs = 0, iniciou = false;

  historico.forEach(h => {
    const quando = lerDataHoraRegistro(h.dataHora || h.data);
    if (!quando) return;
    const acao = norm(h.acao);

    if (acao.startsWith('iniciou') || acao.startsWith('retomou')) {
      if (!inicio) inicio = quando;
      iniciou = true;
      emExecucaoDesde = quando;
    } else if (acao.startsWith('pausou') || acao.startsWith('concluiu')) {
      if (emExecucaoDesde) {
        execucaoMs += Math.max(0, quando - emExecucaoDesde);
        emExecucaoDesde = null;
      }
      if (acao.startsWith('concluiu')) {
        fim = quando;
        fimTexto = h.dataHora || h.data;
      }
    }
  });

  const criadoEm = Number(s.id) > 1e12 ? new Date(Number(s.id)) : null; // o id é a data/hora do cadastro
  return {
    iniciou,
    execucaoMs,
    fim,
    fimTexto,
    totalMs: inicio && fim ? Math.max(0, fim - inicio) : null,
    cadastroMs: criadoEm && fim ? Math.max(0, fim - criadoEm) : null
  };
}

// Linhas [rótulo, valor] para o resumo e para o WhatsApp
function linhasTempoServico(s) {
  const t = calcularTemposServico(s);
  const linhas = [];
  if (!t.fim) return linhas;

  if (t.iniciou) {
    linhas.push(['Tempo em execução', formatarDuracao(t.execucaoMs)]);
    // só mostra o intervalo total quando houve pausas
    if (t.totalMs !== null && t.totalMs - t.execucaoMs >= 60000) {
      linhas.push(['Do início à conclusão', formatarDuracao(t.totalMs)]);
    }
  }
  if (t.cadastroMs !== null) {
    linhas.push(['Do cadastro à conclusão', formatarDuracao(t.cadastroMs)]);
  }
  return linhas;
}

function abrirRelatorioCompleto(id) {
  const s = carregarServicos().find(item => Number(item.id) === Number(id));
  const conteudo = document.getElementById('conteudo-relatorio');
  if (!s || !conteudo) return;

  const historico = s.historicoExecucao || [];
  const tempos = linhasTempoServico(s);
  const concluidoEm = calcularTemposServico(s).fimTexto;

  conteudo.innerHTML = `
    <p><strong>Serviço:</strong> ${esc(s.nome)}</p>
    <p><strong>Local:</strong> ${esc(s.local)}</p>
    <p><strong>Responsável:</strong> ${esc(s.responsavel)}</p>
    <p><strong>Prioridade:</strong> ${esc(s.prioridade || 'Normal')}</p>
    ${s.categoria ? `<p><strong>Categoria:</strong> ${esc(s.categoria)}</p>` : ''}
    <p><strong>Data de Criação:</strong> ${esc(s.data || 'N/A')}</p>
    ${s.observacoes ? `<p><strong>Observações:</strong> ${esc(s.observacoes)}</p>` : ''}
    ${(tempos.length || concluidoEm) ? `
      <div style="background: rgba(255,255,255,0.08); padding: 10px; border-radius: 6px; border-left: 4px solid #2980b9;">
        <strong>⏱️ Tempo do serviço</strong>
        ${concluidoEm ? `<div style="font-size: 0.9rem; margin-top: 3px;">Concluído em: <strong>${esc(concluidoEm)}</strong></div>` : ''}
        ${tempos.map(([rotulo, valor]) => `<div style="font-size: 0.9rem; margin-top: 3px;">${esc(rotulo)}: <strong>${esc(valor)}</strong></div>`).join('')}
      </div>` : ''}
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
          ${s.fotos.map(f => imgFotoHTML(f, 'style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px; cursor: pointer;" onclick="ampliarImagem(this.src)"')).join('')}
        </div>
      </div>` : ''}
  `;
  hidratarFotos(conteudo);
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
  if (s.categoria) texto += `🏷️ *Categoria:* ${s.categoria}\n`;
  texto += `📅 *Data:* ${s.data || 'N/A'}\n`;
  linhasTempoServico(s).forEach(([rotulo, valor]) => { texto += `⏱️ *${rotulo}:* ${valor}\n`; });
  texto += '\n';
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
/* ---------- Serviços recorrentes ---------- */
function dataISOEmDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatarDataISO(iso) {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Cria o próximo serviço da série, contando a partir da data da conclusão
function criarProximoServicoRecorrente(item) {
  const dias = Number(item.recorrenciaDias) || 0;
  if (dias < 1 || item.proximoServicoId) return null; // não repete, ou já foi criado

  const dataISO = dataISOEmDias(dias);
  const hora = /às\s*(\d{2}:\d{2})/.exec(item.agendamento || '');
  const agendamento = `${formatarDataISO(dataISO)}${hora ? ' às ' + hora[1] : ''}`;

  const novo = {
    id: Date.now() + 1,
    nome: item.nome,
    local: item.local,
    responsavel: item.responsavel,
    prioridade: item.prioridade,
    observacoes: item.observacoes,
    categoria: item.categoria || '',
    status: 'Agendado',
    agendamento,
    dataAgendada: dataISO,
    historicoExecucao: [],
    conclusaoInfo: null,
    fotos: [],
    recorrenciaDias: dias,
    origemServicoId: item.id,
    data: new Date().toLocaleDateString('pt-BR')
  };

  item.proximoServicoId = novo.id;
  item.historicoExecucao.push({
    acao: 'Próximo serviço agendado',
    icone: '🔁',
    dataHora: obterDataHoraAtual(),
    detalhes: `Repetição a cada ${dias} ${dias === 1 ? 'dia' : 'dias'}: ${agendamento}`
  });
  return novo;
}

/* ---------- Aviso do dia (atrasados e para hoje) ---------- */
let alertasDispensados = false;

function verificarAlertasDoDia() {
  const antigo = document.getElementById('banner-alertas');
  if (antigo) antigo.remove();
  if (alertasDispensados) return;

  const abertos = carregarServicos().filter(s => norm(s.status) !== 'concluido');
  const atrasados = abertos.filter(servicoEstaAtrasado).length;
  const hoje = hojeISO();
  const paraHoje = abertos.filter(s => s.dataAgendada === hoje && !servicoEstaAtrasado(s)).length;
  if (!atrasados && !paraHoje) return;

  const partes = [];
  if (atrasados) partes.push(`⚠️ <strong>${atrasados}</strong> ${atrasados === 1 ? 'serviço atrasado' : 'serviços atrasados'}`);
  if (paraHoje) partes.push(`📅 <strong>${paraHoje}</strong> ${paraHoje === 1 ? 'serviço para hoje' : 'serviços para hoje'}`);

  const banner = document.createElement('div');
  banner.id = 'banner-alertas';
  banner.style.cssText = 'background: #fdecea; color: #000000; border: 1px solid #f5b7b1; border-left: 5px solid #e74c3c; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 0.9rem;';

  const texto = document.createElement('span');
  texto.innerHTML = partes.join(' &nbsp;•&nbsp; ');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Ok';
  btn.style.cssText = 'background: #64748b; color: #ffffff; border: none; border-radius: 6px; padding: 6px 14px; font-size: 0.8rem; cursor: pointer;';
  btn.onclick = () => { alertasDispensados = true; banner.remove(); };

  banner.appendChild(texto);
  banner.appendChild(btn);

  const grade = document.querySelector('.cards-grid');
  if (grade && grade.parentNode) {
    grade.parentNode.insertBefore(banner, grade);
  } else {
    const principal = document.querySelector('main');
    if (principal) principal.insertBefore(banner, principal.firstChild);
  }
}

/* ---------- Lembrete de backup ---------- */
function lerNumeroStorage(chave) {
  try {
    const n = Number(localStorage.getItem(chave));
    return Number.isFinite(n) ? n : 0;
  } catch (e) {
    return 0;
  }
}

function removerBannerBackup() {
  const antigo = document.getElementById('banner-backup');
  if (antigo) antigo.remove();
}

function registrarBackupFeito() {
  try {
    localStorage.setItem(STORAGE_KEY_ULTIMO_BACKUP, String(Date.now()));
    localStorage.removeItem(STORAGE_KEY_BACKUP_ADIADO);
  } catch (e) { /* sem espaço: ignora */ }
  removerBannerBackup();
}

function adiarLembreteBackup() {
  try {
    // some por 24 horas
    localStorage.setItem(STORAGE_KEY_BACKUP_ADIADO, String(Date.now() + 24 * 60 * 60 * 1000));
  } catch (e) { /* ignora */ }
  removerBannerBackup();
}

function verificarLembreteBackup() {
  removerBannerBackup();

  // Só avisa se existe algo a proteger
  if (carregarServicos().length === 0) return;

  const agora = Date.now();
  if (agora < lerNumeroStorage(STORAGE_KEY_BACKUP_ADIADO)) return;

  const ultimo = lerNumeroStorage(STORAGE_KEY_ULTIMO_BACKUP);
  const dias = ultimo ? Math.floor((agora - ultimo) / (24 * 60 * 60 * 1000)) : null;

  if (dias !== null && dias < DIAS_LEMBRETE_BACKUP) return;

  const mensagem = dias === null
    ? 'Você ainda não fez nenhum backup dos seus dados.'
    : `Seu último backup foi há ${dias} ${dias === 1 ? 'dia' : 'dias'}.`;

  mostrarBannerBackup(mensagem);
}

function mostrarBannerBackup(mensagem) {
  const principal = document.querySelector('main.container') || document.querySelector('main');
  if (!principal) return;

  const banner = document.createElement('div');
  banner.id = 'banner-backup';
  banner.style.cssText = 'background: #fff3cd; color: #000000; border: 1px solid #ffc107; border-left: 5px solid #e67e22; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 0.9rem;';

  const texto = document.createElement('span');
  texto.innerHTML = '💾 <strong>Lembrete de backup:</strong> ';
  texto.appendChild(document.createTextNode(mensagem + ' Proteja seus dados.'));

  const botoes = document.createElement('div');
  botoes.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';

  const btnFazer = document.createElement('button');
  btnFazer.type = 'button';
  btnFazer.textContent = '💾 Fazer backup agora';
  btnFazer.style.cssText = 'background: #27ae60; color: #ffffff; border: none; border-radius: 6px; padding: 7px 12px; font-weight: bold; font-size: 0.8rem; cursor: pointer;';
  btnFazer.onclick = () => fazerBackup();

  const btnDepois = document.createElement('button');
  btnDepois.type = 'button';
  btnDepois.textContent = 'Lembrar amanhã';
  btnDepois.style.cssText = 'background: #64748b; color: #ffffff; border: none; border-radius: 6px; padding: 7px 12px; font-size: 0.8rem; cursor: pointer;';
  btnDepois.onclick = adiarLembreteBackup;

  botoes.appendChild(btnFazer);
  botoes.appendChild(btnDepois);
  banner.appendChild(texto);
  banner.appendChild(botoes);
  principal.insertBefore(banner, principal.firstChild);
}

// Reúne tudo que vai no backup, inclusive as fotos guardadas no IndexedDB
async function montarDadosBackup() {
  const servicos = carregarServicos();
  const areas = carregarAreas();
  const fotos = {};

  if (await idbDisponivel()) {
    const todas = await idbTodos();
    const usadas = new Set();
    servicos.forEach(s => (s.fotos || []).forEach(f => { if (ehRefFoto(f)) usadas.add(f.slice(4)); }));
    areas.forEach(a => { if (ehRefFoto(a.foto)) usadas.add(a.foto.slice(4)); });
    usadas.forEach(id => { if (todas[id]) fotos[id] = todas[id]; });
  }
  return { versao: 2, servicos, areas, fazenda: dadosFazenda, fotos };
}

async function fazerBackup() {
  try {
    const dados = await montarDadosBackup();
    const json = JSON.stringify(dados);
    const nomeArquivo = `backup_criatorio_marques_${hojeISO()}.json`;
    const blob = new Blob([json], { type: 'application/json' });

    // iPhone/iPad: o atributo "download" costuma ser ignorado, então usa o menu de compartilhar
    const ehIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (ehIOS && navigator.canShare) {
      const arquivo = new File([blob], nomeArquivo, { type: 'application/json' });
      if (navigator.canShare({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: 'Backup Criatório Marques' });
        registrarBackupFeito();
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
    registrarBackupFeito();

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

// Grava um backup no aparelho (serviços, áreas, fazenda e fotos)
async function aplicarBackup(dados) {
  if (!dados || typeof dados !== 'object') throw new Error('Arquivo inválido');

  let servicos = Array.isArray(dados.servicos) ? dados.servicos : null;
  let areas = Array.isArray(dados.areas) ? dados.areas : null;
  const fotos = (dados.fotos && typeof dados.fotos === 'object') ? dados.fotos : {};

  if (await idbDisponivel()) {
    // só limpa as fotos antigas quando serviços e áreas são ambos substituídos
    if (servicos && areas) { await idbLimpar(); cacheFotos.clear(); }
    for (const [id, dado] of Object.entries(fotos)) await idbSet(id, dado);
  } else {
    // sem IndexedDB: devolve as fotos para dentro dos registros
    const volta = f => (ehRefFoto(f) && fotos[f.slice(4)]) ? fotos[f.slice(4)] : f;
    if (servicos) servicos = servicos.map(s => ({ ...s, fotos: (s.fotos || []).map(volta) }));
    if (areas) areas = areas.map(a => ({ ...a, foto: volta(a.foto) }));
  }

  if (servicos) localStorage.setItem(STORAGE_KEY, JSON.stringify(servicos));
  if (areas) localStorage.setItem(STORAGE_KEY_AREAS, JSON.stringify(areas));
  if (dados.fazenda && typeof dados.fazenda === 'object') {
    localStorage.setItem(STORAGE_KEY_FAZENDA, JSON.stringify(dados.fazenda));
  }
}

function importarBackup(event) {
  if (!exigirAdmin()) return;
  const file = event.target.files[0];
  if (!file) return;

  if (!confirm('A importação substituirá os dados atuais. Deseja continuar?')) {
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const dados = JSON.parse(e.target.result);
      await aplicarBackup(dados);
      alert('Dados importados com sucesso!');
      location.reload();
    } catch (err) {
      console.error('Erro ao importar backup:', err);
      alert('Erro ao ler o arquivo de backup. Verifique se o arquivo JSON é válido.');
    }
  };
  reader.readAsText(file);
}

/* ==========================================================================
   PWA (INSTALAÇÃO E FUNCIONAMENTO OFFLINE)
   ========================================================================== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(erro => {
      console.warn('Não foi possível ativar o modo offline:', erro);
    });
  });
}

let eventoInstalacaoPWA = null;

function removerBotaoInstalar() {
  const btn = document.getElementById('btn-instalar-pwa');
  if (btn) btn.remove();
}

// Android/Chrome: mostra um botão "Instalar app" quando a instalação está disponível
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  eventoInstalacaoPWA = event;
  if (document.getElementById('btn-instalar-pwa')) return;

  const btn = document.createElement('button');
  btn.id = 'btn-instalar-pwa';
  btn.type = 'button';
  btn.textContent = '📲 Instalar app';
  btn.style.cssText = 'position: fixed; right: 14px; bottom: 14px; z-index: 900; background: #52b788; color: #081c15; border: none; border-radius: 24px; padding: 12px 18px; font-weight: 800; font-size: 0.9rem; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.4);';
  btn.onclick = async () => {
    if (!eventoInstalacaoPWA) return;
    eventoInstalacaoPWA.prompt();
    await eventoInstalacaoPWA.userChoice;
    eventoInstalacaoPWA = null;
    removerBotaoInstalar();
  };
  document.body.appendChild(btn);
});

window.addEventListener('appinstalled', () => {
  eventoInstalacaoPWA = null;
  removerBotaoInstalar();
});
