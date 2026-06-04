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
  const [zonesResponse, postsResponse, faultsResponse] = await Promise.all([
    authFetch('/zonas'),
    authFetch('/postes'),
    authFetch('/avarias')
  ]);

  const [zones, posts, faults] = await Promise.all([
    zonesResponse.json(),
    postsResponse.json(),
    faultsResponse.json()
  ]);

  return {
    zones: Array.isArray(zones) ? zones : [],
    posts: Array.isArray(posts) ? posts : [],
    faults: Array.isArray(faults) ? faults : []
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
  if (typeof ensureAuthenticated === 'function') {
    const ok = await ensureAuthenticated();
    if (!ok) return;
  }

  try {
    const { zones, posts, faults } = await loadMapData();
    const map = L.map('map').setView([39.5, -8], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    const postsByZone = groupBy(posts, post => getZoneKey({ id_zona: post.id_zona }));
    const faultsByZone = groupBy(faults, fault => getZoneKey({ id_zona: fault.id_zona || fault.id_poste || fault.id_lampada }));
    const bounds = [];

    zones.forEach(zone => {
      const zonePosts = postsByZone.get(String(zone.id_zona)) || [];
      if (!zonePosts.length) return;

      const latitude = averageCoordinate(zonePosts, 'latitude');
      const longitude = averageCoordinate(zonePosts, 'longitude');
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const zoneFaults = faults.filter(fault => String(fault.id_zona || '') === String(zone.id_zona));
      const marker = L.marker([latitude, longitude]).addTo(map).bindPopup(`<b>${getZoneLabel(zone)}</b>`);

      marker.on('click', () => {
        const faultCount = zoneFaults.length || (faultsByZone.get(String(zone.id_zona)) || []).length;
        const status = faultCount > 10 ? 'Avaria' : faultCount > 3 ? 'Atenção' : 'Operacional';
        renderZoneInfoPanel(zone, {
          posts: zonePosts.length,
          faults: faultCount,
          status,
          consumption: Math.round(zonePosts.reduce((sum, post) => sum + normalizeNumber(post.intensidade_atual), 0) / zonePosts.length),
          lamps: zonePosts.filter(post => String(post.estado || '').toLowerCase() !== 'ativo').length,
          lastUpdate: zonePosts[0].data_instalacao || 'Sem data'
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