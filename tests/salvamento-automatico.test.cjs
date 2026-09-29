const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {extrairCampos,atualizarRascunho} = require('../salvamento-automatico.js');
test('rascunhos não guardam senha, arquivo ou pesquisas e preservam outros usuários', () => {
    const campos = extrairCampos([{id:'c-nome',value:'Maria',type:'text'},{id:'p-senha',value:'segredo',type:'password'},{id:'config-logo',type:'file',value:'arquivo'},{id:'busca-cliente',type:'search',value:'pesquisa'}]);
    assert.deepEqual(Object.keys(campos),['c-nome']);
    const outro={usuarioId:'B',tela:'clientes',estado:{campos:{}}};
    const atualizado=atualizarRascunho([outro], 'A','clientes',{campos});
    assert.equal(atualizado.length,2); assert.equal(atualizado[0],outro);
    assert.deepEqual(atualizarRascunho(atualizado,'A','clientes',null),[outro]);
});
function ambiente(storage=new Map()) {
    const campos={},eventos={},timers=new Map(); let proximo=0;
    for(const k of ['codigo','nome','cpf','telefone','email','endereco']) campos['c-'+k]={id:'c-'+k,value:k==='codigo'?'CLI-1':'',type:'text',checkValidity:()=>true,closest:seletor=>seletor==='#aba-clientes'?secao:null};
    const secao={querySelectorAll:()=>Object.values(campos).filter(c=>c.id?.startsWith('c-')),prepend:c=>campos[c.id]=c};
    campos['aba-clientes']=secao;campos['btn-salvar-cliente']={textContent:''};
    const ctx={console,Map,Promise,clientes:JSON.parse(storage.get('michele_clientes')||'[]'),clienteEditando:null,usuarioAtual:{id:'A',cargo:'Vendedor'},
      dadosStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
      document:{getElementById:id=>campos[id],createElement:()=>({setAttribute(){}}),addEventListener:(nome,fn)=>eventos[nome]=fn},
      setTimeout:fn=>{timers.set(++proximo,fn);return proximo;},clearTimeout:id=>timers.delete(id),
      alert:()=>{throw Error('Não deveria abrir alerta');},gerarCodigosUnicos(){},popularClientesSelect(){},atualizarTabelaClientes(){},atualizarDashboard(){},avisarGravacao:async()=>true,iniciarAplicacao(){}};
    ctx.window=ctx;vm.createContext(ctx);
    const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
    const inicio=html.indexOf('function limparCliente()'),fim=html.indexOf('function excluirCliente(',inicio);
    vm.runInContext(html.slice(inicio,fim),ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../salvamento-automatico.js'),'utf8'),ctx);
    ctx.iniciarAplicacao();
    return {ctx,campos,storage,digitar(k,v){campos[k].value=v;eventos.input({target:campos[k]});},esperar(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}};
}
test('digitar salva rascunho e depois atualiza cliente sem limpar tela ou duplicar', () => {
    const a=ambiente();a.digitar('c-telefone','11');a.esperar();
    assert.equal(a.storage.has('michele_clientes'),false);
    assert.equal(JSON.parse(a.storage.get('michele_rascunhos'))[0].estado.campos['c-telefone'].value,'11');
    a.digitar('c-nome','Maria');a.esperar();
    assert.equal(a.campos['c-nome'].value,'Maria');assert.equal(a.ctx.clientes.length,1);
    a.digitar('c-nome','Maria Silva');a.esperar();
    assert.equal(a.ctx.clientes.length,1);assert.equal(a.ctx.clientes[0].nome,'Maria Silva');
    const b=ambiente(a.storage);
    assert.equal(b.campos['c-nome'].value,'Maria Silva');
    b.digitar('c-telefone','119999');b.esperar();
    assert.equal(b.ctx.clientes.length,1);assert.equal(b.ctx.clientes[0].telefone,'119999');
});
