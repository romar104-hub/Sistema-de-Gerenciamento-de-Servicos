// Armazenamento Local (LocalStorage)
let servicos = JSON.parse(localStorage.getItem('cm_servicos')) || [
  { id: 1, nome: 'Manejo Reprodutivo Matrizes', local: 'Curral Principal', responsavel: 'Romerio', status: 'Em execução' },
  { id: 2, nome: 'Manutenção da Cerca Perimetral', local: 'Piquete Boer 01', responsavel: 'Equipe', status: 'Pendente' }
];

let filtroAtual = 'Todos';

function salvarDados() {
  localStorage.setItem('cm_servicos', JSON.stringify(servicos));
  atualizarContadores();
  renderizarServicos();
}

function atualizarContadores() {
  document.getElementById('cnt-todos').innerText = servicos.length;
  document.getElementById('cnt-pendentes').innerText = servicos.filter(s => s.status === 'Pendente').length;
  document.getElementById('cnt-execucao').innerText = servicos.filter(s => s.status === 'Em execução').length;
  document.getElementById('cnt-concluidos').innerText = servicos.filter(s => s.status === 'Concluído').length;
}

function adicionarServico(event) {
  event.preventDefault();
  const nome = document.getElementById('nome-servico').value;
  const local = document.getElementById('local-servico').value;
  const responsavel = document.getElementById('responsavel-servico').value;
  const status = document.getElementById('status-servico').value;

  const novoServico = {
    id: Date.now(),
    nome,
    local,
    responsavel,
    status
  };

  servicos.unshift(novoServico);
  salvarDados();
  document.getElementById('form-servico').reset();
}

function removerServico(id) {
  servicos = servicos.filter(s => s.id !== id);
  salvarDados();
}

function alterarStatus(id, novoStatus) {
  const servico = servicos.find(s => s.id === id);
  if (servico) {
    servico.status = novoStatus;
    salvarDados();
  }
}

function filtrarStatus(status) {
  filtroAtual = status;
  document.getElementById('titulo-lista').innerText = status === 'Todos' ? 'Serviços Cadastrados' : `Serviços: ${status}`;
  renderizarServicos();
}

function renderizarServicos() {
  const container = document.getElementById('lista-servicos');
  const busca = document.getElementById('search-input').value.toLowerCase();
  
  container.innerHTML = '';

  const filtrados = servicos.filter(s => {
    const atendeFiltro = filtroAtual === 'Todos' || s.status === filtroAtual;
    const atendeBusca = s.nome.toLowerCase().includes(busca) || 
                         s.local.toLowerCase().includes(busca) || 
                         s.responsavel.toLowerCase().includes(busca);
    return atendeFiltro && atendeBusca;
  });

  if (filtrados.length === 0) {
    container.innerHTML = `<p style="color: #a0aec0; font-size: 0.85rem; text-align: center; padding: 10px;">Nenhum serviço encontrado.</p>`;
    return;
  }

  filtrados.forEach(s => {
    const classStatus = s.status === 'Em execução' ? 'status-Execucao' : `status-${s.status}`;
    
    const div = document.createElement('div');
    div.className = 'service-item';
    div.innerHTML = `
      <div class="service-info">
        <h3>${s.nome}</h3>
        <p>📍 ${s.local} • 👤 ${s.responsavel}</p>
      </div>
      <div class="service-actions">
        <select onchange="alterarStatus(${s.id}, this.value)" class="badge-status ${classStatus}">
          <option value="Pendente" ${s.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
          <option value="Em execução" ${s.status === 'Em execução' ? 'selected' : ''}>Em execução</option>
          <option value="Concluído" ${s.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
        </select>
        <button class="btn-del" onclick="removerServico(${s.id})">Excluir</button>
      </div>
    `;
    container.appendChild(div);
  });
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  salvarDados();
});
