const STORAGE_KEY = 'criatorio_marques_servicos';
let servicoPendentePausaId = null;
let servicoConclusaoId = null;
let imagensTempConclusao = [];

function carregarServicos() {
  const dados = localStorage.getItem(STORAGE_KEY);
  return dados ? JSON.parse(dados) : [];
}

function salvarServicos(servicos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(servicos));
  atualizarDashboard();
  renderizarServicos();
}

function abrirModal() {
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

  const servicos = carregarServicos();
  const novoServico = {
    id: Date.now(),
    nome: nome,
    local: local,
    responsavel: responsavel,
    prioridade: prioridade,
    observacoes: observacoes,
    status: 'Pendente',
    justificativas: [],
    conclusaoInfo: null,
    fotos: [],
    data: new Date().toLocaleDateString('pt-BR')
  };

  servicos.unshift(novoServico);
  salvarServicos(servicos);
  fecharModal();
}

function renderizarServicos(lista = null) {
  const servicos = lista || carregarServicos();
  const container = document.getElementById('lista-servicos');
  if (!container) return;

  if (servicos.length === 0) {
    container.innerHTML = '<p class="empty-msg">Nenhum serviço encontrado.</p>';
    return;
  }

  container.innerHTML = servicos.map(s => {
    const jaFoiPausado = s.justificativas && s.justificativas.length > 0;
    const rotuloIniciar = jaFoiPausado ? '▶️ Retomar' : '▶️ Iniciar';

    return `
    <div class="service-card">
      <div class="service-main">
        <h4>${s.nome.toUpperCase()}</h4>
        <span class="badge ${s.status.toLowerCase().replace(' ', '-')}">${s.status}</span>
      </div>
      <p class="service-info">📍 ${s.local} | 👤 ${s.responsavel} | 📅 ${s.data}</p>
      <p class="service-priority">Prioridade: <strong>${s.prioridade}</strong></p>
      
      ${s.observacoes ? `<p style="font-size: 0.85rem; margin-top: 6px; color: #444; background: #f9f9f9; padding: 6px; border-radius: 6px;">📝 <strong>Obs:</strong> ${s.observacoes}</p>` : ''}
      
      ${jaFoiPausado ? `
        <div style="font-size: 0.8rem; margin-top: 6px; color: #c0392b; background: #fdf0ed; padding: 6px; border-radius: 6px;">
          <strong>⚠️ Histórico de Pausas:</strong>
          ${s.justificativas.map(j => `<div>• ${j.data}: ${j.motivo}</div>`).join('')}
        </div>
      ` : ''}

      ${s.conclusaoInfo ? `
        <div style="font-size: 0.8rem; margin-top: 6px; color: #1e7e34; background: #eafaf1; padding: 6px; border-radius: 6px;">
          <strong>✅ Relatório de Conclusão (${s.dataConclusao || ''}):</strong>
          <div>${s.conclusaoInfo}</div>${s.fotos && s.fotos.length > 0 ? `
            <div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
              ${s.fotos.map(f => `<img src="${f}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #27ae60;">`).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div class="service-actions" style="margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap;">
        ${s.status === 'Pendente' ? `<button onclick="iniciarServico(${s.id})" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem;">${rotuloIniciar}</button>` : ''}
        ${s.status === 'Em execução' ? `<button onclick="solicitarPausaServico(${s.id})" class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;">⏸️ Pausar (Pendente)</button>` : ''}
        ${s.status !== 'Concluído' ? `<button onclick="solicitarConclusaoServico(${s.id})" style="padding: 6px 12px; font-size: 0.8rem; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer;">✅ Concluir</button>` : ''}
        <button onclick="excluirServico(${s.id})" class="btn-delete" style="padding: 6px 12px; font-size: 0.8rem; background: #ff4d4d; color: white; border: none; border-radius: 6px; cursor: pointer; margin-left: auto;">Excluir</button>
      </div>
    </div>
  `}).join('');
}

function iniciarServico(id) {
  let servicos = carregarServicos();
  const item = servicos.find(s => s.id === id);
  if (item) {
    item.status = 'Em execução';
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
  if (!motivo) {
    alert('Por favor, informe a justificativa.');
    return;
  }

  let servicos = carregarServicos();
  const item = servicos.find(s => s.id === servicoPendentePausaId);
  if (item) {
    item.status = 'Pendente';
    if (!item.justificativas) item.justificativas = [];
    item.justificativas.push({
      data: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
      motivo: motivo
    });
    salvarServicos(servicos);
  }
  fecharModalJustificativa();
}

/* FLUXO DE CONCLUSÃO COM RELATÓRIO E FOTOS */
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
  document.getElementById('preview-imagens').innerHTML = '';
  document.getElementById('modal-conclusao').style.display = 'none';
}

function carregarImagensConclusao(event) {
  const files = Array.from(event.target.files);
  const preview = document.getElementById('preview-imagens');
  preview.innerHTML = '';
  imagensTempConclusao = [];

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      imagensTempConclusao.push(e.target.result);
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.width = '60px';
      img.style.height = '60px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '60px';
      img.style.border = '1px solid #ccc';
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

function confirmarConclusaoServico(event) {
  event.preventDefault();
  const relatorio = document.getElementById('relatorio-conclusao').value.trim();

  if (!relatorio) {
    alert('Por favor, informe as observações de conclusão.');
    return;
  }

  let servicos = carregarServicos();
  const item = servicos.find(s => s.id === servicoConclusaoId);

  if (item) {
    item.status = 'Concluído';
    item.conclusaoInfo = relatorio;
    item.fotos = imagensTempConclusao;
    item.dataConclusao = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    salvarServicos(servicos);
  }

  fecharModalConclusao();
}

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

function excluirServico(id) {
  if (confirm('Deseja realmente excluir este serviço?')) {
    let servicos = carregarServicos();
    servicos = servicos.filter(s => s.id !== id);
    salvarServicos(servicos);
  }
}

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
