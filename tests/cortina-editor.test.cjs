const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
test('material da cortina usa somente linhas da cortina e escapa descrições', () => {
    const nodes = {caption:{},tbody:{},tfoot:{}};
    const status = {};
    const ctx = {window:{}, document:{getElementById:id => id.startsWith('cortina-status') ? status : {querySelector:tag=>nodes[tag]}}, formatarMoeda:value=>`R$ ${value.toFixed(2)}`};
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../cortina-editor.js'),'utf8'),ctx);
    ctx.window.MicheleCortinaEditor.renderizar(1,{cortinaAtiva:true, materiaisCortina:[{nome:'Linho <natural>',quantidade:9,unidade:'m',valorUnitario:103,valorTotal:927}],materiais:[{nome:'Persiana',valorTotal:1000}]});
    assert.match(nodes.tbody.innerHTML,/Linho &lt;natural&gt;/);
    assert.doesNotMatch(nodes.tbody.innerHTML,/Persiana/);
    assert.match(nodes.tfoot.innerHTML,/927.00/);
    ctx.window.MicheleCortinaEditor.renderizar(1,{cortinaAtiva:false,materiaisCortina:[]});
    assert.match(nodes.tbody.innerHTML,/Selecione/);
    assert.equal(status.textContent,'Cortina desativada');
});
