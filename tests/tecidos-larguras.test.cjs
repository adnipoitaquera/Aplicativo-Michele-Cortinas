const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const larguras=require('../tecidos-larguras.js');
const calculo=require('../cortina-calculo.js');
test('larguras dos tecidos, forros, blackout e Dalas seguem as medidas informadas',()=>{
  const grupos=[
    [2.8,['ANDRIA','BERGAMO','CHIFON','SAN MATEO','BLACKOUT DE TECIDO 70 %','BLACKOUT SOMÁLIA','BLACKOUT FLORENÇA','BLACKOUT PISTOIA']],
    [2.9,['IGUATEMI','LEBLON','MOEMA','TRIANON','VERONA','GUADALAJARA','JORDANIA','ROSALES']],
    [2.95,['HIGIENOPOLIS','ARGELIA','ACAPULCO','BAHAMAS','BOSTON','CABO VERDE','CABANA','CHICAGO','COLORADO','CORDOBA','DOMINICA','EL SALVADOR','FRESNO','HAVAI','LA PAZ','MISSISSIPI','MONTERREY','NICARAGUA','ORLEANS','ORLANDO','REINO UNIDO','SACRAMENTO','SAN JUAN']],
    [3.3,['ENSEADA','IRLANDA','MALIBU','PERDIZES']],
    [3,['CALIFORNIA','CRISTAL','C.ZURIQUE','HONDURAS','HUNGRIA','MIAMI','MONTREAL','MADRI','NILO','RAVENA','SORANO','VOIL LISO','XADREZ','ABUDHAB','ANDORRA','ARUBA','ARGENTINA','ANTILHAS','ARIZONA','ALABAMA','ARCANSAS','AUSTIN','BARILOCHE','BALI','DALLAS','DETROIT','ELPASO','EL PIETRA','GUATEMALA','LOS ANGELES','OKLAHOMA','PHOENIX','PHILADELPHIA']]
  ];
  for(const [largura,nomes] of grupos)for(const nome of nomes)assert.equal(larguras.padrao(nome),largura,nome);
  for(const nome of ['PIETRA','TIVOLI','FORRO DE MICRO FIBRA PESADO(100 GRAMAS)']){
    assert.equal(larguras.padrao(nome+' 3,00'),3);assert.equal(larguras.padrao(nome+' 3,30'),3.3);
  }
  assert.equal(larguras.padrao('PERDIZES 3,3'),3.3);
  assert.equal(larguras.padrao('Tecido novo'),3);
});
test('carregamento completa os cadastros antigos e conserva preços e larguras editadas',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const salvo=[{nome:'ANDRIA 2,80',preco:999,extra:'preservado'},{nome:'PIETRA 3,30',preco:43.4},{nome:'Personalizado',preco:10,larguraTecido:2.7}];
  const ctx={PRECOS_VOAL:[],PRECOS_FORRO:[{nome:'BLACKOUT FLORENÇA 2,80',preco:59.9}],PRECOS_PERSIANA:[],PRECOS_ACESSORIOS:[],PRECOS_MOTORIZACAO:[],MicheleTecidosLarguras:larguras,dadosStorage:{getItem:k=>k==='michele_produtos_voal'?JSON.stringify(salvo):null},separarVariacoesTecidos:x=>x,completarCatalogoMateriaisPersianas(){},atualizarCategoriasProdutoSelecionaveis(){},categoriasProduto:{}};
  vm.createContext(ctx);
  const inicio=html.indexOf('function restaurarCatalogoProdutos()');
  vm.runInContext(html.slice(inicio,html.indexOf('// Estado da aplicação',inicio)),ctx);ctx.restaurarCatalogoProdutos();
  assert.equal(ctx.PRECOS_VOAL[0].larguraTecido,2.8);assert.equal(ctx.PRECOS_VOAL[0].preco,999);assert.equal(ctx.PRECOS_VOAL[0].extra,'preservado');
  assert.equal(ctx.PRECOS_VOAL[1].larguraTecido,3.3);assert.equal(ctx.PRECOS_VOAL[2].larguraTecido,2.7);assert.equal(ctx.PRECOS_FORRO[0].larguraTecido,2.8);
});
test('largura do cadastro altera a necessidade de inverter o tecido',()=>{
  const base={largura:3,altura:2.8,quantidade:1,'select-voal':10,'prop-voal':2,'cortina-barra':'10 cm','cortina-altura-cabecote':0.09};
  for(const [nome,invertido] of [['ANDRIA 2,80',true],['PIETRA 3,30',false]]){
    const tecido=larguras.completar([{nome}])[0];
    const valores={...base,'cortina-largura-tecido-voal':tecido.larguraTecido};
    const resultado=calculo.calcular(k=>valores[k]??'',()=>nome);
    assert.equal(resultado.avisos.length>0,invertido);
  }
});
