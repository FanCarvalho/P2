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
    const map = L.map('map').setView([39.5, -8], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    const bounds = [];

    zones.forEach(zone => {
      const latitude = normalizeNumber(zone.lat);
      const longitude = normalizeNumber(zone.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

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

      bounds.push([latitude, longitude]);
    });

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  } catch (error) {
    console.error('Error loading map data:', error);
  }
});