/* ==========================================================================
   AGROGESTÃO MARQUES - JAVASCRIPT PRINCIPAL
   ========================================================================== */

let servicos = [];
let areasPropriedade = [];
let perfilFazenda = {
  nome: 'CRIATÓRIO MARQUES',
  slogan: '"Excelência em Genética e Manejo no Sertão"',
  cidade: 'Belém do São Francisco - PE',
  logo: ''
};

let filtroStatusAtual = 'Todos';
let idServicoEmAcao = null;
let imagensTempConclusao = [];
let fotoAreaTemp = '';
let logoFazendaTemp = '';
let idServicoReagendar = null;
let isAdmin = false;

/* --- MAPEAMENTO WMO DE CLIMA --- */
const wmoWeatherCodes = {
  0: { desc: 'Céu limpo', icon: '☀️' },
  1: { desc: 'Predominantemente limpo', icon: '🌤️' },
  2: { desc: 'Parcialmente nublado', icon: '⛅' },
  3: { desc: 'Nublado', icon: '☁️' },
  45: { desc: 'Névoa', icon: '🌫️' },
  48: { desc: 'Névoa com geada', icon: '🌫️' },
  51: { desc: 'Garoa leve', icon: '🌦️' },
  53: { desc: 'Garoa moderada', icon: '🌦️' },
  55: { desc: 'Garoa densa', icon: '🌧️' },
  61: { desc: 'Chuva leve', icon: '🌧️' },
  63: { desc: 'Chuva moderada', icon: '🌧️' },
  65: { desc: 'Chuva forte', icon: '🌧️' },
  80: { desc: 'Pancadas de chuva', icon: '🌦️' },
  81: { desc: 'Pancadas moderadas', icon: '🌧️' },
  82: { desc: 'Pancadas violentas', icon: '⛈️' },
  95: { desc: 'Trovoada', icon: '⚡' },
  96: { desc: 'Trovoada c/ granizo', icon: '⛈️' }
};

/* --- INICIALIZAÇÃO --- */
document.addEventListener('DOMContentLoaded', () => {
  carregarDadosLocais();
  atualizarInterfacePerfil();
  verificarServicosAtrasados();
  renderizarServicos();
  atualizarContadores();
  atualizarAutocompleteAreas();
  buscarClimaBelem();

  // Escutador para busca em tempo real
  const inputBusca = document.getElementById('search-input');
  if (inputBusca) {
    inputBusca.addEventListener('input', filtrarServicos);
  }

  // Atualização automática de clima a cada 15 min
  setInterval(buscarClimaBelem, 15 * 60 * 1000);
});

/* ==========================================================================
   SERVIÇO DE CLIMA EM TEMPO REAL
   ========================================================================== */
function buscarClimaBelem() {
  const tempEl = document.getElementById('weather-temp');
  const descEl = document.getElementById('weather-desc');
  const iconEl = document.getElementById('weather-icon');

  const url = 'https://wttr.in/Belem_do_Sao_Francisco,Pernambuco?format=j1';

  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error('Falha ao obter dados do clima');
      return response.json();
    })
    .then(data => {
      if (data && data.current_condition && data.current_condition[0]) {
        const clima = data.current_condition[0];
        const temp = clima.temp_C;
        const vento = clima.windspeedKmph;

        const descEn = clima.weatherDesc[0].value.toLowerCase();
        let descPt = 'Ensolarado';
        let icone = '☀️';

        if (descEn.includes('rain') || descEn.includes('shower')) {
          descPt = 'Chuva';
          icone = '🌧️';
        } else if (descEn.includes('cloud') || descEn.includes('overcast')) {
          descPt = 'Nublado';
          icone = '☁️';
        } else if (descEn.includes('clear') || descEn.includes('sunny')) {
          descPt = 'Céu Limpo';
          icone = '☀️';
        } else if (descEn.includes('thunder')) {
          descPt = 'Trovoada';
          icone = '⚡';
        }

        if (tempEl) tempEl.innerText = `${temp}°C`;
        if (descEl) descEl.innerText = `${descPt} • 💨 ${vento} km/h`;
        if (iconEl) iconEl.innerText = icone;
      }
    })
    .catch(err => {
      console.error("Erro na busca de clima:", err);
      if (tempEl) tempEl.innerText = '--°C';
      if (descEl) descEl.innerText = 'Sem conexão';
    });
}

/* ==========================================================================
   PERSISTÊNCIA E MIGRAÇÃO AUTOMÁTICA DE DADOS
   ========================================================================== */
function carregarDadosLocais() {
  // 1. Serviços (agro_servicos ou criatorio_marques_servicos)
  const s = localStorage.getItem('agro_servicos');
  if (s && JSON.parse(s).length > 0) {
    servicos = JSON.parse(s);
  } else {
    const sAntigos = localStorage.getItem('criatorio_marques_servicos');
    if (sAntigos) {
      servicos = JSON.parse(sAntigos);
      localStorage.setItem('agro_servicos', JSON.stringify(servicos));
    }
  }

  // 2. Áreas da Propriedade
  const a = localStorage.getItem('agro_areas');
  if (a) areasPropriedade = JSON.parse(a);

  // 3. Perfil da Fazenda
  const p = localStorage.getItem('agro_perfil') || localStorage.getItem('dadosFazenda');
  if (p) {
    perfilFazenda = JSON.parse(p);
    localStorage.setItem('agro_perfil', JSON.stringify(perfilFazenda));
  }
}

function salvarDadosLocais() {
  localStorage.setItem('agro_servicos', JSON.stringify(servicos));
  localStorage.setItem('agro_areas', JSON.stringify(areasPropriedade));
  localStorage.setItem('agro_perfil', JSON.stringify(perfilFazenda));
}

/* ==========================================================================
   ALERTAS E VERIFICAÇÃO DE ATRASOS
   ========================================================================== */
function verificarServicosAtrasados() {
  const hojeStr = new Date().toISOString().split('T')[0];
  let atrasoDetectado = false;

  servicos.forEach(s => {
    if (s.status === 'Agendado' && s.dataAgendada && s.dataAgendada < hojeStr) {
      if (!s.atrasadoNotificado) {
        s.atrasadoNotificado = true;
        atrasoDetectado = true;
      }
    }
  });

  if (atrasoDetectado) {
    salvarDadosLocais();
    const atrasado = servicos.find(s => s.status === 'Agendado' && s.dataAgendada < hojeStr);
    if (atrasado) {
      abrirModalReagendar(atrasado.id);
    }
  }
}

/* ==========================================================================
   GERENCIAMENTO DE SERVIÇOS
   ========================================================================== */
function salvarServicoFormulario(event) {
  event.preventDefault();

  const nome = document.getElementById('nome-servico').value;
  const local = document.getElementById('local-servico').value;
  const responsavel = document.getElementById('responsavel-servico').value;
  const prioridade = document.getElementById('prioridade-servico').value;
  const dataAgendada = document.getElementById('data-agendada').value;
  const horaAgendada = document.getElementById('hora-agendada').value;
  const obs = document.getElementById('obs-servico').value;

  const novoServico = {
    id: Date.now(),
    nome,
    local,
    responsavel,
    prioridade,
    dataAgendada: dataAgendada || null,
    horaAgendada: horaAgendada || null,
    obs,
    status: dataAgendada ? 'Agendado' : 'Pendente',
    dataCriacao: new Date().toLocaleString('pt-BR'),
    historico: [{ data: new Date().toLocaleString('pt-BR'), acao: 'Serviço Criado' }],
    fotosConclusao: [],
    relatorioConclusao: ''
  };

  servicos.unshift(novoServico);
  salvarDadosLocais();
  fecharModal();
  renderizarServicos();
  atualizarContadores();
}

function renderizarServicos() {
  const container = document.getElementById('lista-servicos');
  if (!container) return;

  const busca = document.getElementById('search-input')?.value.toLowerCase() || '';

  let filtrados = servicos.filter(s => {
    const combinaStatus = (filtroStatusAtual === 'Todos') || (s.status === filtroStatusAtual);
    const combinaBusca = (s.nome && s.nome.toLowerCase().includes(busca)) ||
                         (s.local && s.local.toLowerCase().includes(busca)) ||
                         (s.responsavel && s.responsavel.toLowerCase().includes(busca));
    return combinaStatus && combinaBusca;
  });

  if (filtrados.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: #7f8c8d; padding: 20px;">Nenhum serviço encontrado.</p>`;
    return;
  }

  const hojeStr = new Date().toISOString().split('T')[0];

  container.innerHTML = filtrados.map(s => {
    const isAtrasado = (s.status === 'Agendado' && s.dataAgendada && s.dataAgendada < hojeStr);

    return `
      <div class="card-servico" style="background: white; border-radius: 8px; padding: 12px; margin-bottom: 10px; border-left: 5px solid ${corPorStatus(s.status)}; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h4 style="margin: 0; font-size: 1rem; color: #2c3e50;">${s.nome}</h4>
          <span style="padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; background: ${corPorStatus(s.status)}; color: white; font-weight: bold;">
            ${s.status}
          </span>
        </div>

        <p style="margin: 6px 0; font-size: 0.85rem; color: #555;">
          📍 <strong>Local:</strong> ${s.local} | 👤 <strong>Resp:</strong> ${s.responsavel || 'Não definido'}
        </p>

        ${s.dataAgendada ? `
          <p style="margin: 4px 0; font-size: 0.8rem; color: ${isAtrasado ? '#c0392b' : '#2980b9'}; font-weight: bold;">
            📅 Agendado para: ${formatarData(s.dataAgendada)}${s.horaAgendada ? 'às ' + s.horaAgendada : ''}
            ${isAtrasado ? ' ⚠️ (Atrasado)' : ''}
          </p>
        ` : ''}

        ${isAtrasado ? `
          <button onclick="abrirModalReagendar(${s.id})" style="margin-top: 5px; padding: 4px 8px; font-size: 0.75rem; background: #e67e22; color: white; border: none; border-radius: 4px; cursor: pointer;">
            🔄 Reagendar
          </button>
        ` : ''}

        <div style="margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap;">
          ${s.status === 'Pendente' || s.status === 'Agendado' ? `
            <button onclick="alterarStatus(${s.id}, 'Em execução')" style="padding: 4px 10px; font-size: 0.75rem; background: #2980b9; color: white; border: none; border-radius: 4px; cursor: pointer;">▶️ Iniciar</button>
          ` : ''}
          ${s.status === 'Em execução' ? `
            <button onclick="abrirModalJustificativa(${s.id})" style="padding: 4px 10px; font-size: 0.75rem; background: #f39c12; color: white; border: none; border-radius: 4px; cursor: pointer;">⏸️ Pausar</button>
            <button onclick="abrirModalConclusao(${s.id})" style="padding: 4px 10px; font-size: 0.75rem; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer;">✅ Concluir</button>
          ` : ''}
          <button onclick="abrirModalRelatorio(${s.id})" style="padding: 4px 10px; font-size: 0.75rem; background: #7f8c8d; color: white; border: none; border-radius: 4px; cursor: pointer;">📄 Ver Detalhes</button>
          
          ${isAdmin ? `
            <button onclick="excluirServico(${s.id})" style="padding: 4px 10px; font-size: 0.75rem; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️ Excluir</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function alterarStatus(id, novoStatus) {
  const servico = servicos.find(s => s.id === id);
  if (servico) {
    servico.status = novoStatus;
    servico.historico.push({ data: new Date().toLocaleString('pt-BR'), acao: `Status alterado para ${novoStatus}` });
    salvarDadosLocais();
    renderizarServicos();
    atualizarContadores();
  }
}

function excluirServico(id) {
  if (confirm("Tem certeza que deseja excluir este serviço?")) {
    servicos = servicos.filter(s => s.id !== id);
    salvarDadosLocais();
    renderizarServicos();
    atualizarContadores();
  }
}

function corPorStatus(status) {
  switch(status) {
    case 'Agendado': return '#2980b9';
    case 'Pendente': return '#e67e22';
    case 'Em execução': return '#f39c12';
    case 'Concluído': return '#27ae60';
    default: return '#95a5a6';
  }
}

function formatarData(dataIso) {
  if (!dataIso) return '';
  const partes = dataIso.split('-');
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function atualizarContadores() {
  const elAg = document.getElementById('count-agendados');
  const elPen = document.getElementById('count-pendentes');
  const elEx = document.getElementById('count-execucao');
  const elConc = document.getElementById('count-concluidos');

  if (elAg) elAg.innerText = servicos.filter(s => s.status === 'Agendado').length;
  if (elPen) elPen.innerText = servicos.filter(s => s.status === 'Pendente').length;
  if (elEx) elEx.innerText = servicos.filter(s => s.status === 'Em execução').length;
  if (elConc) elConc.innerText = servicos.filter(s => s.status === 'Concluído').length;
}

function filtrarPorStatus(status) {
  filtroStatusAtual = (filtroStatusAtual === status) ? 'Todos' : status;
  renderizarServicos();
}

function filtrarServicos() {
  renderizarServicos();
}

/* ==========================================================================
   REAGENDAMENTO E ATRASOS
   ========================================================================== */
function abrirModalReagendar(id) {
  idServicoReagendar = id;
  const modal = document.getElementById('modal-reagendar');
  if (modal) modal.style.display = 'flex';
}

function fecharModalReagendar() {
  idServicoReagendar = null;
  const modal = document.getElementById('modal-reagendar');
  if (modal) modal.style.display = 'none';
}

function confirmarReagendamento(event) {
  event.preventDefault();
  const justificativa = document.getElementById('justificativa-atraso').value;
  const novaData = document.getElementById('nova-data-agendada').value;
  const novoHorario = document.getElementById('novo-horario-agendado').value;

  const servico = servicos.find(s => s.id === idServicoReagendar);
  if (servico) {
    servico.dataAgendada = novaData;
    servico.horaAgendada = novoHorario || null;
    servico.atrasadoNotificado = false;
    servico.historico.push({
      data: new Date().toLocaleString('pt-BR'),
      acao: `Reagendado. Motivo: ${justificativa}`
    });
    salvarDadosLocais();
    renderizarServicos();
    atualizarContadores();
  }
  fecharModalReagendar();
}

/* ==========================================================================
   MODAIS E UTILITÁRIOS
   ========================================================================== */
function abrirModal() {
  const form = document.getElementById('form-servico');
  if (form) form.reset();
  const modal = document.getElementById('modal-servico');
  if (modal) modal.style.display = 'flex';
}
function fecharModal() {
  const modal = document.getElementById('modal-servico');
  if (modal) modal.style.display = 'none';
}

function abrirModalPerfilFazenda() {
  document.getElementById('input-nome-fazenda').value = perfilFazenda.nome;
  document.getElementById('input-slogan-fazenda').value = perfilFazenda.slogan;
  document.getElementById('input-cidade-fazenda').value = perfilFazenda.cidade;
  document.getElementById('modal-perfil-fazenda').style.display = 'flex';
}
function fecharModalPerfilFazenda() {
  document.getElementById('modal-perfil-fazenda').style.display = 'none';
}

function salvarPerfilFazenda(e) {
  e.preventDefault();
  perfilFazenda.nome = document.getElementById('input-nome-fazenda').value;
  perfilFazenda.slogan = document.getElementById('input-slogan-fazenda').value;
  perfilFazenda.cidade = document.getElementById('input-cidade-fazenda').value;
  if (logoFazendaTemp) perfilFazenda.logo = logoFazendaTemp;

  salvarDadosLocais();
  atualizarInterfacePerfil();
  fecharModalPerfilFazenda();
}

function atualizarInterfacePerfil() {
  const elNome = document.getElementById('header-nome-fazenda');
  const elSlogan = document.getElementById('header-slogan');
  const elCidade = document.getElementById('header-cidade');
  const elLogo = document.getElementById('header-logo');

  if (elNome) elNome.innerText = perfilFazenda.nome;
  if (elSlogan) elSlogan.innerText = perfilFazenda.slogan;
  if (elCidade) elCidade.innerText = `📍 ${perfilFazenda.cidade}`;

  if (elLogo && perfilFazenda.logo) {
    elLogo.innerHTML = `<img src="${perfilFazenda.logo}" alt="Logo">`;
  }
}

function carregarPreviewLogo(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => { logoFazendaTemp = event.target.result; };
    reader.readAsDataURL(file);
  }
}

/* --- ÁREAS DA PROPRIEDADE --- */
function abrirModalAreas() {
  document.getElementById('modal-areas').style.display = 'flex';
  renderizarListaAreas();
}
function fecharModalAreas() {
  document.getElementById('modal-areas').style.display = 'none';
}

function salvarNovaArea(e) {
  e.preventDefault();
  const nome = document.getElementById('nome-area').value;
  areasPropriedade.push({ id: Date.now(), nome, foto: fotoAreaTemp });
  fotoAreaTemp = '';
  salvarDadosLocais();
  atualizarAutocompleteAreas();
  renderizarListaAreas();
  e.target.reset();
}

function renderizarListaAreas() {
  const container = document.getElementById('lista-areas-cadastradas');
  if (container) {
    container.innerHTML = areasPropriedade.map(a => `
      <div style="display: flex; justify-content: space-between; padding: 6px; background: white; border-radius: 4px; border: 1px solid #ccc; margin-bottom: 4px;">
        <span>📍 ${a.nome}</span>
        <button onclick="excluirArea(${a.id})" style="background:none; border:none; color:red; cursor:pointer;">❌</button>
      </div>
    `).join('');
  }
}

function excluirArea(id) {
  areasPropriedade = areasPropriedade.filter(a => a.id !== id);
  salvarDadosLocais();
  atualizarAutocompleteAreas();
  renderizarListaAreas();
}

function atualizarAutocompleteAreas() {
  const list = document.getElementById('lista-areas-autocomplete');
  if (list) {
    list.innerHTML = areasPropriedade.map(a => `<option value="${a.nome}">`).join('');
  }
}

function carregarFotoArea(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => { fotoAreaTemp = ev.target.result; };
    reader.readAsDataURL(file);
  }
}

/* --- JUSTIFICATIVA E PAUSA --- */
function abrirModalJustificativa(id) {
  idServicoEmAcao = id;
  document.getElementById('modal-justificativa').style.display = 'flex';
}
function fecharModalJustificativa() {
  idServicoEmAcao = null;
  document.getElementById('modal-justificativa').style.display = 'none';
}

function confirmarPausaServico() {
  const txt = document.getElementById('texto-justificativa').value;
  const servico = servicos.find(s => s.id === idServicoEmAcao);
  if (servico && txt) {
    servico.status = 'Pendente';
    servico.historico.push({ data: new Date().toLocaleString('pt-BR'), acao: `Pausado. Motivo: ${txt}` });
    salvarDadosLocais();
    renderizarServicos();
    atualizarContadores();
  }
  fecharModalJustificativa();
}

/* --- CONCLUSÃO DE SERVIÇO --- */
function abrirModalConclusao(id) {
  idServicoEmAcao = id;
  imagensTempConclusao = [];
  document.getElementById('modal-conclusao').style.display = 'flex';
}
function fecharModalConclusao() {
  idServicoEmAcao = null;
  document.getElementById('modal-conclusao').style.display = 'none';
}

function carregarImagensConclusao(e) {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => { imagensTempConclusao.push(ev.target.result); };
    reader.readAsDataURL(file);
  });
}

function confirmarConclusaoServico(e) {
  e.preventDefault();
  const relatorio = document.getElementById('relatorio-conclusao').value;
  const servico = servicos.find(s => s.id === idServicoEmAcao);
  if (servico) {
    servico.status = 'Concluído';
    servico.relatorioConclusao = relatorio;
    servico.fotosConclusao = [...imagensTempConclusao];
    servico.historico.push({ data: new Date().toLocaleString('pt-BR'), acao: 'Serviço Concluído' });
    salvarDadosLocais();
    renderizarServicos();
    atualizarContadores();
  }
  fecharModalConclusao();
}

/* --- RELATÓRIO GERAL --- */
function abrirModalRelatorio(id) {
  const s = servicos.find(item => item.id === id);
  if (!s) return;

  const container = document.getElementById('conteudo-relatorio');
  if (container) {
    container.innerHTML = `
      <h4>${s.nome}</h4>
      <p><strong>Status:</strong> ${s.status}</p>
      <p><strong>Local:</strong> ${s.local}</p>
      <p><strong>Responsável:</strong> ${s.responsavel || 'N/A'}</p>
      <p><strong>Observações:</strong> ${s.obs || 'Nenhuma'}</p>
      ${s.relatorioConclusao ? `<p><strong>Relatório de Conclusão:</strong> ${s.relatorioConclusao}</p>` : ''}
      
      ${s.fotosConclusao && s.fotosConclusao.length > 0 ? `
        <h5>Fotos da Conclusão:</h5>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${s.fotosConclusao.map(img => `<img src="${img}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="abrirZoomImagem('${img}')">`).join('')}
        </div>
      ` : ''}

      <h5>Histórico:</h5>
      <ul>
        ${s.historico ? s.historico.map(h => `<li><small>${h.data}</small>:${h.acao}</li>`).join('') : ''}
      </ul>
    `;
  }
  document.getElementById('modal-relatorio').style.display = 'flex';
}
function fecharModalRelatorio() {
  document.getElementById('modal-relatorio').style.display = 'none';
}

function abrirZoomImagem(src) {
  const modal = document.getElementById('modal-zoom-imagem');
  const img = document.getElementById('imagem-zoom');
  if (modal && img) {
    img.src = src;
    modal.style.display = 'flex';
  }
}

/* --- BACKUP E ADMIN --- */
function exportarBackup() {
  const data = JSON.stringify({ servicos, areasPropriedade, perfilFazenda });
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_agrogestao_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

function importarBackup(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);

        if (parsed.servicos) servicos = parsed.servicos;
        else if (parsed.criatorio_marques_servicos) servicos = parsed.criatorio_marques_servicos;

        if (parsed.areasPropriedade) areasPropriedade = parsed.areasPropriedade;

        if (parsed.perfilFazenda) perfilFazenda = parsed.perfilFazenda;
        else if (parsed.dadosFazenda) perfilFazenda = parsed.dadosFazenda;

        salvarDadosLocais();
        alert('Backup importado com sucesso!');
        location.reload();
      } catch(err) {
        alert('Arquivo de backup inválido.');
      }
    };
    reader.readAsText(file);
  }
}

function solicitarAcessoAdmin() {
  if (isAdmin) {
    isAdmin = false;
    const label = document.getElementById('label-perfil');
    if (label) label.innerText = "Modo: Utilizador";
    alert("Saiu do modo Admin.");
    renderizarServicos();
    return;
  }

  const pass = prompt("Digite a senha de Administrador:");
  if (pass === "1234" || pass === "admin") {
    isAdmin = true;
    const label = document.getElementById('label-perfil');
    if (label) label.innerText = "Modo: Admin (Sair)";
    alert("Acesso Admin concedido!");
    renderizarServicos();
  } else {
    alert("Senha incorreta.");
  }
}

function fecharZoomImagem() {
  const modal = document.getElementById('modal-zoom-imagem');
  if (modal) modal.style.display = 'none';
}
