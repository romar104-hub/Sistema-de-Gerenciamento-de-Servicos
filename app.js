/* ESTADO E VARIÁVEIS */
let filtroStatusAtual = null;

/* FUNÇÃO PARA CARREGAR DADOS */
function carregarServicos() {
  const dados = localStorage.getItem('servicos_db');
  return dados ? JSON.parse(dados) : [];
}

/* FUNÇÃO PARA SALVAR DADOS */
function salvarServicos(servicos) {
  localStorage.setItem('servicos_db', JSON.stringify(servicos));
  atualizarContadoresCards();
  filtrarServicos();
}

/* NORMALIZAR TEXTO */
function normalizarTexto(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/* ATUALIZAR NÚMEROS DOS CARDS */
function atualizarContadoresCards() {
  const servicos = carregarServicos();

  let agendados = 0;
  let pendentes = 0;
  let execucao = 0;
  let concluidos = 0;

  servicos.forEach(s => {
    const st = normalizarTexto(s.status);
    if (st.includes('agendad')) agendados++;
    else if (st.includes('pendent')) pendentes++;
    else if (st.includes('execuc') || st.includes('andament')) execucao++;
    else if (st.includes('conclu')) concluidos++;
  });

  document.getElementById('cnt-agendados').innerText = agendados;
  document.getElementById('cnt-pendentes').innerText = pendentes;
  document.getElementById('cnt-execucao').innerText = execucao;
  document.getElementById('cnt-concluidos').innerText = concluidos;
}

/* FILTRAR POR STATUS (CLIQUE NO CARD) */
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
  const norm = normalizarTexto(filtroStatusAtual);

  document.getElementById('card-agendados').classList.toggle('ativo', norm.includes('agendad'));
  document.getElementById('card-pendentes').classList.toggle('ativo', norm.includes('pendent'));
  document.getElementById('card-execucao').classList.toggle('ativo', norm.includes('execuc'));
  document.getElementById('card-concluidos').classList.toggle('ativo', norm.includes('conclu'));

  const titulo = document.getElementById('titulo-lista');
  if (titulo) {
    titulo.innerText = filtroStatusAtual ? `Serviços (${filtroStatusAtual})` : 'Serviços recentes';
  }
}

/* FILTRAR SERVIÇOS (PESQUISA + CARDS) */
function filtrarServicos() {
  const input = document.getElementById('search-input');
  const termo = input ? normalizarTexto(input.value) : '';
  let servicos = carregarServicos();

  if (filtroStatusAtual) {
    const filtroNorm = normalizarTexto(filtroStatusAtual);
    servicos = servicos.filter(s => normalizarTexto(s.status).includes(filtroNorm.slice(0, 4)));
  }

  if (termo) {
    servicos = servicos.filter(s =>
      normalizarTexto(s.nome).includes(termo) ||
      normalizarTexto(s.local).includes(termo) ||
      normalizarTexto(s.responsavel).includes(termo)
    );
  }

  renderizarServicos(servicos);
}

/* RENDERIZAR LISTA OU MENSAGEM VAZIA */
function renderizarServicos(servicos) {
  const container = document.getElementById('lista-servicos');
  if (!container) return;

  if (!servicos || servicos.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px dashed rgba(255, 255, 255, 0.15);">
        <p style="font-size: 1rem; color: #a0aec0; margin: 0;">📋 Nenhum serviço cadastrado ou encontrado.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = servicos.map(s => `
    <div style="background: #ffffff; color: #1a202c; padding: 16px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 style="font-size: 1.05rem; margin: 0;">${(s.nome || 'Serviço').toUpperCase()}</h3>
        <span style="background: #edf2f7; color: #2d3748; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: bold;">${s.status || 'Pendente'}</span>
      </div>
      <p style="font-size: 0.85rem; color: #718096; margin: 8px 0;">📍 ${s.local || 'N/A'} | 👤 ${s.responsavel || 'N/A'}</p>
    </div>
  `).join('');
}

/* BOTOES DE AÇÃO COMPLEMENTARES */
function abrirModalNovoServico() {
  const nome = prompt("Nome do Novo Serviço:");
  if (!nome) return;
  const local = prompt("Local:");
  const responsavel = prompt("Responsável:");

  const novo = {
    id: Date.now(),
    nome: nome,
    local: local || 'Propriedade',
    responsavel: responsavel || 'Operador',
    status: 'Pendente'
  };

  const servicos = carregarServicos();
  servicos.push(novo);
  salvarServicos(servicos);
}

function fazerBackup() {
  const dados = localStorage.getItem('servicos_db') || '[]';
  const blob = new Blob([dados], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `backup_criatorio_marques_${Date.now()}.json`;
  a.click();
}

function importarDados() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const JSONdados = JSON.parse(event.target.result);
        localStorage.setItem('servicos_db', JSON.stringify(JSONdados));
        atualizarContadoresCards();
        filtrarServicos();
        alert('Dados importados com sucesso!');
      } catch (err) {
        alert('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/* INICIALIZAÇÃO */
document.addEventListener('DOMContentLoaded', () => {
  atualizarContadoresCards();
  filtrarServicos();
});
