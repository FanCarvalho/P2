const { faker } = require('@faker-js/faker');
const fs = require('fs');
const path = require('path');

// 1. Configura faker.seed(123) para reprodutibilidade.
faker.seed(123);

// 2. Cria a entidade Sistema.
const sistema = {
    id: faker.string.uuid(),
    nome: "Sistema de Iluminação Pública Inteligente",
    versao: "1.0.0",
    data_criacao: faker.date.past({ years: 2 })
};

// Gera Operadores (3-10).
const operadores = Array.from({ length: faker.number.int({ min: 3, max: 10 }) }, () => ({
    id_operador: faker.string.uuid(),
    nome: faker.person.fullName(),
    email: faker.internet.email(),
    nivel_acesso: faker.helpers.arrayElement(['admin', 'operador', 'visualizador'])
}));

// 3. Gera Zonas (5-40).
const zonas = Array.from({ length: faker.number.int({ min: 5, max: 40 }) }, () => ({
    id_zona: faker.string.uuid(),
    nome: `Zona ${faker.location.city()}`,
    coordenadas: `${faker.location.latitude()}, ${faker.location.longitude()}`
}));

// 3. Gera Postes (50-500) com integridade referencial e novas regras.
const postes = Array.from({ length: faker.number.int({ min: 50, max: 500 }) }, () => {
    const intensidade = faker.number.int({ min: 0, max: 100 });
    const consumo = intensidade === 0 ? 0 : faker.number.float({ min: 0.0, max: 0.35, precision: 0.01 });

    return {
        id_poste: faker.string.uuid(),
        id_zona: faker.helpers.arrayElement(zonas).id_zona,
        estado: faker.helpers.arrayElement(['operacional', 'desligado', 'manutencao']),
        modelo_luminaria: faker.helpers.arrayElement(['LED-X1', 'LED-Y2', 'LED-Z3']),
        coordenadas: `${faker.location.latitude()}, ${faker.location.longitude()}`,
        consumo_kwh: consumo,
        intensidade_percentagem: intensidade
    };
});

// Gera Sensores (1 por poste).
const sensores = postes.map(poste => ({
    id_sensor: faker.string.uuid(),
    id_poste: poste.id_poste,
    tipo: faker.helpers.arrayElement(['luminosidade', 'movimento', 'temperatura']),
    sensibilidade: faker.number.float({ min: 0.1, max: 1.0, precision: 0.1 }),
    alcance_metros: faker.number.int({ min: 5, max: 50 })
}));

// 4. Implementa a lógica de Avarias (10-200).
const avarias = Array.from({ length: faker.number.int({ min: 10, max: 200 }) }, () => {
    const posteAvariado = faker.helpers.arrayElement(postes);
    const data_deteccao = faker.date.recent({ days: 90 });
    const isResolvida = faker.datatype.boolean(0.75);

    const avaria = {
        id_avaria: faker.string.uuid(),
        id_poste: posteAvariado.id_poste,
        data_deteccao: data_deteccao,
        data_resolucao: null,
        tipo_avaria: faker.helpers.arrayElement(['lâmpada queimada', 'falha no sensor', 'problema elétrico', 'vandalismo']),
        custo_reparacao: null
    };

    if (isResolvida) {
        avaria.data_resolucao = faker.date.between({ from: data_deteccao, to: new Date() });
        avaria.custo_reparacao = faker.number.float({ min: 50, max: 1500, precision: 0.01 });
    } else {
        const posteParaAtualizar = postes.find(p => p.id_poste === posteAvariado.id_poste);
        if (posteParaAtualizar) {
            posteParaAtualizar.estado = 'falha';
        }
    }

    return avaria;
});

// 5. Exporta o resultado como um objeto JSON.
const dadosFinais = {
    sistema,
    operadores,
    zonas,
    postes,
    sensores,
    avarias
};

// Garante que a pasta 'data' existe.
const outputDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Escreve o resultado no ficheiro JSON dentro da pasta 'data'.
const outputPath = path.join(outputDir, 'dadosIluminacaoPublica.json');
fs.writeFileSync(outputPath, JSON.stringify(dadosFinais, null, 4), 'utf8');

console.log("Script 'gerarDados.js' executado com sucesso.");
console.log(`Ficheiro guardado em: ${outputPath}`);
console.log(`- ${operadores.length} operadores gerados.`);
console.log(`- ${zonas.length} zonas geradas.`);
console.log(`- ${postes.length} postes gerados.`);
console.log(`- ${sensores.length} sensores gerados.`);
console.log(`- ${avarias.length} avarias geradas.`);
const postesEmFalha = postes.filter(p => p.estado === 'falha').length;
console.log(`- ${postesEmFalha} postes estão atualmente em estado de 'falha'.`);
