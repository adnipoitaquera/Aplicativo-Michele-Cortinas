(function(root) {
  'use strict';
  const excecoes = {
    ANDRIA:2.8, BERGAMO:2.8, CHIFON:2.8, ENSEADA:3.3,
    HIGIENOPOLIS:2.95, IGUATEMI:2.9, IRLANDA:3.3, LEBLON:2.9,
    MALIBU:3.3, MOEMA:2.9, PERDIZES:3.3, 'SAN MATEO':2.8,
    TRIANON:2.9, VERONA:2.9, 'BLACKOUT DE TECIDO 70 %':2.8,
    'BLACKOUT SOMALIA':2.8, 'BLACKOUT FLORENCA':2.8, 'BLACKOUT PISTOIA':2.8,
    ARGELIA:2.95, ACAPULCO:2.95, BAHAMAS:2.95, BOSTON:2.95,
    'CABO VERDE':2.95, CABANA:2.95, CHICAGO:2.95, COLORADO:2.95,
    CORDOBA:2.95, DOMINICA:2.95, 'EL SALVADOR':2.95, FRESNO:2.95,
    GUADALAJARA:2.9, HAVAI:2.95, JORDANIA:2.9, 'LA PAZ':2.95,
    MISSISSIPI:2.95, MONTERREY:2.95, NICARAGUA:2.95, ORLEANS:2.95,
    ORLANDO:2.95, ROSALES:2.9, 'REINO UNIDO':2.95, SACRAMENTO:2.95,
    'SAN JUAN':2.95
  };
  function padrao(nome) {
    const texto = String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
    // As opções PIETRA, TIVOLI e microfibra usam a largura no próprio nome.
    const medida = texto.match(/(?:^|\s)([23][,.]\d{1,2})\s*(?:M)?$/);
    if (medida) return Number(medida[1].replace(',','.'));
    for (const [tecido, largura] of Object.entries(excecoes)) {
      if (texto === tecido || texto.startsWith(tecido + ' ') || texto.startsWith(tecido + '-')) return largura;
    }
    return 3;
  }
  function completar(lista) {
    return lista.map(item => Number.isFinite(Number(item.larguraTecido)) && Number(item.larguraTecido) > 0
      ? item : {...item, larguraTecido:padrao(item.nome)});
  }
  root.MicheleTecidosLarguras = {padrao, completar};
  if (typeof module !== 'undefined') module.exports = root.MicheleTecidosLarguras;
})(typeof window !== 'undefined' ? window : globalThis);
