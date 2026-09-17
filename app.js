const STORAGE_KEY = 'criatorio_marques_servicos';

// Carregar serviços do LocalStorage
function carregarServicos() {
  const dados = localStorage.getItem(STORAGE_KEY);
  return dados ? JSON.parse(dados) : [];
}

// Salvar serviços no LocalStorage e atualizar tela
function salvarServicos(servicos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(servicos));
  atualizarDashboard();
  renderizarServicos();
}

// Criar novo serviço
function adicionarServico(nome, local, responsavel, prioridade) {
  const servicos = carregarServicos();
  const novoServico = {
    id: Date.now(),
    nome: nome,
    local: local,
    responsavel: responsavel,
    prioridade: prioridade,
    data: new Date().toLocaleDateString('pt-BR'),
    status: 'Pendente'
  };
  
  servicos.unshift(novoServico);
  salvarServicos(servicos);
}

// Função chamada pelo botão + Novo
function abrirModal() {
  const nome = prompt("Nome do Serviço (ex: Vacinação, Conserto de Cerca):");
  if (!nome || nome.trim() === "") return;

  const local = prompt("Local da Propriedade (ex: Galinheiro, Pasto 1):") || "Geral";
  const responsavel = prompt("Responsável pelo Serviço:") || "Não atribuído";
  const prioridade = prompt("Prioridade (Baixa, Normal, Alta):") || "Normal";

  adicionarServico(nome, local, responsavel, prioridade);
}

// Exibir lista de serviços na interface
function renderizarServicos(lista = null) {
  const servicos = lista || carregarServicos();
  const container = document.getElementById('lista-servicos');
  if (!container) return;

  if (servicos.length === 0) {
    container.innerHTML = '<p class="empty-msg">Nenhum serviço encontrado.</p>';
    return;
  }

  container.innerHTML = servicos.map(s => `
    <div class="service-card">
      <div class="service-main">
        <h4>${s.nome.toUpperCase()}</h4>
        <span class="badge ${s.status.toLowerCase().replace(' ', '-')}">${s.status}</span>
      </div>
      <p class="service-info">📍 ${s.local} | 👤 ${s.responsavel} | 📅 ${s.data}</p>
      <p class="service-priority">Prioridade: <strong>${s.prioridade}</strong></p>
      <div class="service-actions" style="margin-top: 10px; display: flex; gap: 8px;">
        <button onclick="alternarStatus(${s.id})" class="btn-secondary" style="padding: 4px 8px;">Mudar Status</button>
        <button onclick="excluirServico(${s.id})" class="btn-delete" style="padding: 4px 8px; background: #ff4d4d; color: white; border: none; border-radius: 6px;">Excluir</button>
      </div>
    </div>
  `).join('');
}

// Alternar status da tarefa (Pendente -> Em execução -> Concluído)
function alternarStatus(id) {
  let servicos = carregarServicos();
  const index = servicos.findIndex(s => s.id === id);
  if (index !== -1) {
    const statusOrdem = ['Pendente', 'Em execução', 'Concluído'];
    const proximo = (statusOrdem.indexOf(servicos[index].status) + 1) % statusOrdem.length;
    servicos[index].status = statusOrdem[proximo];
    salvarServicos(servicos);
  }
}

// Filtrar serviços na busca
function filtrarServicos() {
  const termo = document.getElementById('search-input').value.toLowerCase();
  const servicos = carregarServicos();
  const filtrados = servicos.filter(s => 
    s.nome.toLowerCase().includes(termo) ||
    s.local.toLowerCase().includes(termo) ||
    s.responsavel.toLowerCase().includes(termo)
  );
  renderizarServicos(filtrados);
}

// Excluir serviço
function excluirServico(id) {
  if (confirm('Deseja realmente excluir este serviço?')) {
    let servicos = carregarServicos();
    servicos = servicos.filter(s => s.id !== id);
    salvarServicos(servicos);
  }
}

// Backup (Exportar)
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

// Backup (Importar)
function importarBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const dados = JSON.parse(e.target.result);
      if (Array.isArray(dados)) {
        salvarServicos(dados);
        alert('Backup importado com sucesso!');
      }
    } catch (err) {
      alert('Arquivo inválido.');
    }
  };
  reader.readAsText(file);
}

// Métricas do Dashboard
function atualizarDashboard() {
  const servicos = carregarServicos();
  if (document.getElementById('count-pendentes')) {
    document.getElementById('count-pendentes').innerText = servicos.filter(s => s.status === 'Pendente').length;
    document.getElementById('count-execucao').innerText = servicos.filter(s => s.status === 'Em execução').length;
    document.getElementById('count-concluidos').innerText = servicos.filter(s => s.status === 'Concluído').length;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  atualizarDashboard();
  renderizarServicos();
});