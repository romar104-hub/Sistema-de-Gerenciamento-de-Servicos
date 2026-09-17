const KEY='criatorio-marques-servicos-v1';
let services=JSON.parse(localStorage.getItem(KEY)||'[]');
let currentFilter='Todos';

const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const save=()=>localStorage.setItem(KEY,JSON.stringify(services));
const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc=s=>(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function isLate(x){return x.status!=='Concluído' && x.deadline && new Date(x.deadline+'T23:59:59')<new Date()}
function statusClass(x){if(isLate(x))return'late';return x.status==='Concluído'?'done':x.status==='Em execução'?'doing':'pending'}
function statusText(x){return isLate(x)?'Atrasado':x.status}
function fmt(d){return d?new Date(d+'T12:00:00').toLocaleDateString('pt-BR'):''}

function card(x){
 return `<article class="card" data-id="${x.id}"><div class="card-top"><h3>${esc(x.title)}</h3><span class="status ${statusClass(x)}">${statusText(x)}</span></div>
 <div class="meta">${x.location?`📍 ${esc(x.location)}`:''}${x.assignee?`👷 ${esc(x.assignee)}`:''}${x.deadline?`📅 ${fmt(x.deadline)}`:''}</div>
 <div class="meta" style="margin-top:7px"><span class="priority">Prioridade: ${esc(x.priority)}</span></div></article>`
}
function render(){
 const pending=services.filter(x=>x.status==='Pendente'&&!isLate(x)).length;
 const doing=services.filter(x=>x.status==='Em execução').length;
 const late=services.filter(isLate).length;
 const done=services.filter(x=>x.status==='Concluído').length;
 $('#pendingCount').textContent=pending;$('#doingCount').textContent=doing;$('#lateCount').textContent=late;$('#doneCount').textContent=done;
 const recent=[...services].sort((a,b)=>b.created-a).slice(0,6);
 $('#homeList').innerHTML=recent.length?recent.map(card).join(''):`<div class="empty">Nenhum serviço cadastrado.<br>Comece criando o primeiro.</div>`;
 let arr=currentFilter==='Todos'?services:services.filter(x=>x.status===currentFilter);
 if(currentFilter==='Atrasado')arr=services.filter(isLate);
 arr=[...arr].sort((a,b)=>b.created-a);
 $('#serviceList').innerHTML=arr.length?arr.map(card).join(''):`<div class="empty">Nenhum serviço encontrado.</div>`;
 const hist=services.filter(x=>x.status==='Concluído').sort((a,b)=>(b.completed||0)-(a.completed||0));
 $('#historyList').innerHTML=hist.length?hist.map(card).join(''):`<div class="empty">Ainda não há serviços concluídos.</div>`;
 $$('.card').forEach(c=>c.onclick=()=>openDetail(c.dataset.id));
}
function show(name){$$('.screen').forEach(s=>s.classList.remove('active'));$('#'+name).classList.add('active');window.scrollTo(0,0)}
function openDetail(id){
 const x=services.find(s=>s.id===id); if(!x)return;
 $('#detailContent').innerHTML=`<div class="detail-box">
 <div class="card-top"><h2>${esc(x.title)}</h2><span class="status ${statusClass(x)}">${statusText(x)}</span></div>
 <div class="meta">${x.location?`📍 ${esc(x.location)}`:''}${x.assignee?`👷 ${esc(x.assignee)}`:''}${x.deadline?`📅 Prazo: ${fmt(x.deadline)}`:''}</div>
 ${x.description?`<p>${esc(x.description)}</p>`:''}
 ${x.materials?`<p><b>Materiais</b><br>${esc(x.materials).replace(/\n/g,'<br>')}</p>`:''}
 ${x.photo?`<img class="photo" src="${x.photo}" alt="Foto do serviço">`:''}
 ${x.note?`<p><b>Última observação</b><br>${esc(x.note)}</p>`:''}
 <div class="actions">
 ${x.status==='Pendente'?`<button class="primary" onclick="changeStatus('${x.id}','Em execução')">▶ Iniciar serviço</button>`:''}
 ${x.status==='Em execução'?`<button class="primary" onclick="changeStatus('${x.id}','Concluído')">✓ Concluir serviço</button><button class="secondary" onclick="changeStatus('${x.id}','Pendente')">⏸ Pausar / voltar a pendente</button>`:''}
 ${x.status==='Concluído'?`<button class="secondary" onclick="changeStatus('${x.id}','Em execução')">↩ Reabrir serviço</button>`:''}
 <button class="secondary" onclick="addNote('${x.id}')">📝 Registrar observação</button>
 <button class="danger" onclick="removeService('${x.id}')">Excluir serviço</button>
 </div></div>`;
 show('detail');
}
window.changeStatus=(sid,status)=>{const x=services.find(s=>s.id===sid);x.status=status;if(status==='Concluído')x.completed=Date.now();else x.completed=null;save();render();openDetail(sid)};
window.addNote=sid=>{const x=services.find(s=>s.id===sid);const n=prompt('Digite a observação da execução:');if(n){x.note=n;x.updated=Date.now();save();render();openDetail(sid)}};
window.removeService=sid=>{if(confirm('Excluir este serviço?')){services=services.filter(x=>x.id!==sid);save();render();show('services')}};

$('#serviceForm').onsubmit=async e=>{
 e.preventDefault();const f=new FormData(e.target);let photo='';
 const file=f.get('photo'); if(file&&file.size){photo=await new Promise(r=>{const rd=new FileReader();rd.onload=()=>r(rd.result);rd.readAsDataURL(file)})}
 services.push({id:id(),title:f.get('title'),description:f.get('description'),location:f.get('location'),assignee:f.get('assignee'),deadline:f.get('deadline'),priority:f.get('priority'),materials:f.get('materials'),photo,status:'Pendente',created:Date.now()});
 save();e.target.reset();render();show('services');
};
$$('[data-screen]').forEach(b=>b.onclick=()=>show(b.dataset.screen));
$('#navNew').onclick=$('#newFromHome').onclick=$('#newFromServices').onclick=()=>show('new');
$('#cancelNew').onclick=()=>show('services');
$('#backToServices').onclick=()=>show('services');
$$('[data-filter]').forEach(b=>b.onclick=()=>{if(b.dataset.filter==='Pendente'||b.dataset.filter==='Em execução'||b.dataset.filter==='Concluído'||b.dataset.filter==='Todos'){currentFilter=b.dataset.filter;$$('#filters button').forEach(z=>z.classList.remove('selected'));const q=$(`#filters button[data-filter="${currentFilter}"]`);if(q)q.classList.add('selected');show('services');render()}});
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
let deferredPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').hidden=false});
$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null}};
render();