const fs = require('fs');
const path = require('path');

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
    const value = Math.random() * (max - min) + min;
    return Number(value.toFixed(decimals));
}

function pick(list) {
    return list[randomInt(0, list.length - 1)];
}

function toIsoDate(daysBackMax) {
    const now = Date.now();
    const offsetMs = randomInt(0, daysBackMax) * 24 * 60 * 60 * 1000;
    return new Date(now - offsetMs).toISOString().slice(0, 10);
}

function buildApiDb() {
    const firstNames = ['Ana', 'Rui', 'Marta', 'Tiago', 'Ines', 'Luis', 'Carla', 'Bruno', 'Sofia', 'Pedro'];
    const lastNames = ['Silva', 'Santos', 'Ferreira', 'Costa', 'Ribeiro', 'Pereira', 'Oliveira', 'Mendes'];
    const streets = ['Rua Principal', 'Avenida Central', 'Rua do Mercado', 'Rua da Estacao', 'Travessa Nova'];
    const lampModels = ['LED-XPTO', 'LED-URBAN', 'LED-ECO'];

    const operadoresCount = randomInt(6, 12);
    const sensoresCount = randomInt(8, 18);
    const zonasCount = randomInt(8, 20);
    const perfisCount = randomInt(3, 6);
    // Increased scale for larger simulation scenarios.
    const postesCount = randomInt(800, 2200);

    const operadores = [
        {
            id_operador: 1,
            nome: 'Administrador',
            email: 'admin@glowpath.com',
            password: 'admin123',
            nivel_acesso: 'administrador',
            ativo: true
        },
        {
            id_operador: 2,
            nome: 'Operador Demo',
            email: 'operador@glowpath.com',
            password: 'operador123',
            nivel_acesso: 'operador',
            ativo: true
        }
    ];

    for (let id = 3; id <= operadoresCount; id += 1) {
        const nome = `${pick(firstNames)} ${pick(lastNames)}`;
        const emailBase = nome.toLowerCase().replace(/\s+/g, '.');
        operadores.push({
            id_operador: id,
            nome,
            email: `${emailBase}.${id}@empresa.com`,
            password: `pass${randomInt(1000, 9999)}`,
            nivel_acesso: 'operador',
            ativo: Math.random() > 0.1
        });
    }

    const perfisIluminacao = [];
    for (let id = 1; id <= perfisCount; id += 1) {
        const intensidade = randomInt(25, 95);
        perfisIluminacao.push({
            id_perfil: id,
            nome: `Perfil ${id}`,
            hora_inicio: `${String(randomInt(0, 22)).padStart(2, '0')}:00`,
            hora_fim: `${String(randomInt(1, 23)).padStart(2, '0')}:00`,
            intensidade
        });
    }

    const sensoresMovimento = [];
    for (let id = 1; id <= sensoresCount; id += 1) {
        sensoresMovimento.push({
            id_sensor: id,
            modelo: `SM-${100 + id}`,
            sensibilidade: randomInt(40, 95),
            alcance: randomFloat(6, 18, 1),
            estado: pick(['ativo', 'ativo', 'inativo']),
            ultimo_calibracao: toIsoDate(220)
        });
    }

    const zonas = [];
    for (let id = 1; id <= zonasCount; id += 1) {
        zonas.push({
            id_zona: id,
            nome: `Zona ${id}`,
            rua: `${pick(streets)} ${id}`,
            codigo_postal: `${randomInt(1000, 4999)}-${String(randomInt(0, 999)).padStart(3, '0')}`,
            id_sensor: pick(sensoresMovimento).id_sensor
        });
    }

    const postes = [];
    for (let id = 1; id <= postesCount; id += 1) {
        postes.push({
            id_poste: id,
            estado: pick(['ativo', 'ativo', 'ativo', 'manutencao', 'desligado']),
            intensidade_atual: randomInt(0, 100),
            latitude: randomFloat(41.08, 41.24, 6),
            longitude: randomFloat(-8.74, -8.50, 6),
            altura: randomFloat(6.5, 11.0, 1),
            data_instalacao: toIsoDate(1500),
            id_zona: pick(zonas).id_zona,
            id_perfil: pick(perfisIluminacao).id_perfil
        });
    }

    const lampadas = postes.map(poste => {
        const modelo = pick(lampModels);
        return {
            id_lampada: poste.id_poste,
            id_poste: poste.id_poste,
            modelo,
            estado: pick(['ativa', 'ativa', 'ativa', 'avariada']),
            potencia_watts: pick([35, 50, 70, 90]),
            luminosidade_max: pick([700, 800, 1000, 1200]),
            luminosidade_min: pick([120, 180, 220, 260]),
            tempo_vida_horas: pick([30000, 40000, 50000, 60000])
        };
    });

    const registosLampada = lampadas.map((lampada, index) => {
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() - randomInt(0, 60));
        const ligar = new Date(baseDate);
        ligar.setHours(randomInt(17, 22), 0, 0, 0);
        const desligar = new Date(ligar);
        desligar.setHours(randomInt(5, 8), 0, 0, 0);
        desligar.setDate(desligar.getDate() + 1);

        return {
            id_registo: index + 1,
            id_lampada: lampada.id_lampada,
            id_poste: lampada.id_poste,
            modelo: lampada.modelo,
            hora_ligar: ligar.toISOString(),
            hora_desligar: desligar.toISOString(),
            luminosidade: randomFloat(35, 95, 1),
            estado: lampada.estado,
            potencia_watts: lampada.potencia_watts,
            luminosidade_max: lampada.luminosidade_max,
            luminosidade_min: lampada.luminosidade_min,
            tempo_vida_horas: lampada.tempo_vida_horas
        };
    });

    const agendamentosCount = Math.max(8, Math.floor(postes.length * 0.1));
    const agendamentosManutencao = [];
    for (let id = 1; id <= agendamentosCount; id += 1) {
        agendamentosManutencao.push({
            id_agendamento: id,
            data_manutencao: toIsoDate(45),
            descricao: pick([
                'Substituicao de lampada',
                'Revisao de cablagem',
                'Calibracao de sensor',
                'Verificacao geral de poste'
            ]),
            prioridade: pick(['baixa', 'media', 'alta']),
            estado: pick(['pendente', 'pendente', 'concluido']),
            id_poste: pick(postes).id_poste
        });
    }

    const avariasCount = Math.max(10, Math.floor(postes.length * 0.15));
    const avarias = [];
    for (let id = 1; id <= avariasCount; id += 1) {
        const lampada = pick(lampadas);
        avarias.push({
            id_avaria: id,
            descricao: pick([
                'Lampada nao acende',
                'Falha intermitente de luminosidade',
                'Driver com sobreaquecimento',
                'Sensor associado sem comunicacao'
            ]),
            severidade: pick(['baixa', 'media', 'alta']),
            estado: pick(['pendente', 'em_resolucao', 'resolvida']),
            id_lampada: lampada.id_lampada
        });
    }

    return {
        operadores,
        perfisIluminacao,
        sensoresMovimento,
        zonas,
        postes,
        lampadas,
        registosLampada,
        agendamentosManutencao,
        avarias
    };
}

function main() {
    const apiDb = buildApiDb();
    const outputDir = path.join(__dirname, '..', 'data');
    const outputPath = path.join(outputDir, 'api-data.json');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(apiDb, null, 2), 'utf8');

    console.log("Script 'gerarDados.js' executado com sucesso.");
    console.log(`Ficheiro guardado em: ${outputPath}`);
    console.log(`- ${apiDb.operadores.length} operadores gerados.`);
    console.log(`- ${apiDb.perfisIluminacao.length} perfis de iluminacao gerados.`);
    console.log(`- ${apiDb.sensoresMovimento.length} sensores gerados.`);
    console.log(`- ${apiDb.zonas.length} zonas geradas.`);
    console.log(`- ${apiDb.postes.length} postes gerados.`);
    console.log(`- ${apiDb.lampadas.length} lampadas geradas.`);
    console.log(`- ${apiDb.registosLampada.length} registos de lampada gerados.`);
    console.log(`- ${apiDb.agendamentosManutencao.length} agendamentos gerados.`);
    console.log(`- ${apiDb.avarias.length} avarias geradas.`);
}

main();
