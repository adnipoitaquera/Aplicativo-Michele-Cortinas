const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
test('catálogo de ilhós aceita acentos, usa preços cadastrados e exclui persianas', () => {
    const select = {options:[{}]};
    let itens = [];
    const ctx = {
        window:{},
        document:{querySelectorAll:seletor=>seletor==='select[id^="select-ilhos-"]'?[select]:[]},
        categoriasProduto:{acessorios:{nome:'Ilhós, tubos e acessórios',lista:[
            {nome:'Ilhós branco',preco:2},{nome:'Ilhos cromado',preco:3},
            {nome:'Argola',preco:4},{nome:'Ilhós persiana',preco:5,uso:'persianas'},
            {nome:'Tubo decorativo',preco:10},{nome:'Trilho suíço',preco:12}
        ]}},
        MicheleCatalogoUso:require('../catalogo-uso.js'),
        atualizarSelectProduto:(_select,produtos)=>{itens=produtos;}
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../cortina-editor.js'),'utf8'),ctx);
    ctx.window.MicheleCortinaEditor.catalogos();
    assert.equal(itens.length,2);
    assert.equal(itens[0].preco,2);
    assert.equal(select.options[0].textContent,'Sem ilhós');
    ctx.categoriasProduto.acessorios.lista[0].preco=7;
    ctx.window.MicheleCortinaEditor.catalogos();
    assert.equal(itens[0].preco,7);
    ctx.categoriasProduto.acessorios.lista=[];
    ctx.window.MicheleCortinaEditor.catalogos();
    assert.equal(itens.length,0);
    assert.equal(select.options[0].textContent,'Cadastre Ilhós nos produtos');
});
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
