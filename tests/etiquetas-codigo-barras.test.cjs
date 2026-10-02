const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {Code128Reader,BitArray}=require('@zxing/library');
test('código Code 128 contém identificador e checksum legíveis em 203 dpi',()=>{
  const ctx={JsBarcode:require('jsbarcode')};vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('etiquetas-codigo-barras.js','utf8'),ctx);
  for(const codigo of ['PED-12345','P000001-01','123456789012']){
    const {modulos,escala,largura}=ctx.MicheleCodigoBarras.codificar(codigo);
    assert.ok(largura<=384);
    const linha=new BitArray(400),inicio=Math.floor((400-largura)/2)+10*escala;
    for(let i=0;i<modulos.length;i++)if(modulos[i]==='1')for(let j=0;j<escala;j++)linha.set(inicio+i*escala+j);
    assert.equal(new Code128Reader().decodeRow(0,linha).getText(),codigo);
  }
  assert.throws(()=>ctx.MicheleCodigoBarras.codificar('P'.repeat(60)),/muito longo/);
});
