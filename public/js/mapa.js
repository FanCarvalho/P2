function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getZoneLabel(zone) {
  return zone.nome || zone.nome_zona || `Zona ${zone.id_zona || ''}`.trim();
}

function getZoneKey(zone) {
  return String(zone.id_zona ?? zone.nome ?? zone.codigo_postal ?? '');
}

function parseConsumptionKwh(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const numeric = Number(value.replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return 0;
}

const CITY_COORDINATES = {
  faro: [37.0179, -7.9308],
  lisboa: [38.7223, -9.1393],
  porto: [41.1579, -8.6291],
  coimbra: [40.2033, -8.4103],
  braga: [41.5454, -8.4265],
  funchal: [32.6669, -16.9241],
  'vila nova de gaia': [41.1239, -8.6118],
  amadora: [38.7596, -9.2239],
  guimaraes: [41.4425, -8.2918],
  setubal: [38.526, -8.8948],
  'setúbal': [38.526, -8.8948],
  almada: [38.6765, -9.1651],
  aveiro: [40.6405, -8.6538],
  leiria: [39.7436, -8.8071],
  viseu: [40.6566, -7.9125],
  guimarães: [41.4425, -8.2918],
  barreiro: [38.6609, -9.0733],
  matosinhos: [41.1821, -8.6891],
  cascais: [38.6979, -9.4215],
  maia: [41.2356, -8.6199],
  gondomar: [41.1413, -8.5326],
  oeiras: [38.691, -9.31],
  acores: [37.7412, -25.6756],
  'açores': [37.7412, -25.6756],
  madeira: [32.7607, -16.9595]
};

function normalizeCityKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function resolveZoneCoordinates(zone) {
  const cityKey = normalizeCityKey(getZoneLabel(zone));
  if (CITY_COORDINATES[cityKey]) {
    return CITY_COORDINATES[cityKey];
  }

  const lat = Number(zone?.lat);
  const lon = Number(zone?.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return [lat, lon];
  }

  return null;
}

function averageCoordinate(points, key) {
  if (!points.length) return null;
  const total = points.reduce((sum, point) => sum + normalizeNumber(point[key]), 0);
  return total / points.length;
}

function groupBy(list, keyFn) {
  return list.reduce((accumulator, item) => {
    const key = keyFn(item);
    if (!accumulator.has(key)) {
      accumulator.set(key, []);
    }
    accumulator.get(key).push(item);
    return accumulator;
  }, new Map());
}

async function loadMapData() {
  const zonesResponse = await fetch(buildApiUrl('/zonas'));
  const zones = zonesResponse.ok ? await zonesResponse.json().catch(() => []) : [];

  return {
    zones: Array.isArray(zones) ? zones : [],
    posts: [],
    faults: []
  };
}

function renderZoneInfoPanel(zone, metrics) {
  const zoneInfoPanel = document.getElementById('zona-info');
  if (!zoneInfoPanel) return;

  zoneInfoPanel.hidden = false;
  zoneInfoPanel.classList.remove('is-empty');
  zoneInfoPanel.innerHTML = [
    `<h4>${getZoneLabel(zone)}</h4>`,
    `<p><strong>Quantidade de Postes:</strong> ${metrics.posts}</p>`,
    `<p><strong>Avarias Atuais:</strong> ${metrics.faults}</p>`,
    `<p><strong>Status:</strong> ${metrics.status}</p>`,
    `<p><strong>Consumo Médio:</strong> ${metrics.consumption} kWh</p>`,
    `<p><strong>Lâmpadas a Vencer:</strong> ${metrics.lamps}</p>`,
    `<p><strong>Última Substituição:</strong> ${metrics.lastUpdate}</p>`
  ].join('');

  if (typeof isAdmin === 'function' && isAdmin()) {
    zoneInfoPanel.innerHTML += '<div class="zona-actions"><button type="button">Ver Detalhes</button><button type="button">Editar</button></div>';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { zones } = await loadMapData();
    const map = L.map('map').setView([39.55, -8.05], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    zones.forEach(zone => {
      const coordinates = resolveZoneCoordinates(zone);
      if (!coordinates) return;

      const [latitude, longitude] = coordinates;

      const marker = L.marker([latitude, longitude]).addTo(map).bindPopup(`<b>${getZoneLabel(zone)}</b>`);

      marker.on('click', () => {
        const faultCount = normalizeNumber(zone.avarias);
        const status = faultCount > 10 ? 'Avaria' : faultCount > 3 ? 'Atenção' : 'Operacional';
        renderZoneInfoPanel(zone, {
          posts: normalizeNumber(zone.postes),
          faults: faultCount,
          status: zone.status || status,
          consumption: parseConsumptionKwh(zone.consumo),
          lamps: normalizeNumber(zone.vencimento),
          lastUpdate: zone.substituicao || 'Sem data'
        });
      });

    });
  } catch (error) {
    console.error('Error loading map data:', error);
  }
});