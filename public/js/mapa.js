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

const DELETED_ZONES_KEY = 'glowpath_deleted_zones';
const ZONE_OVERRIDES_KEY = 'glowpath_zone_overrides';

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

function loadDeletedZoneKeys() {
  try {
    const raw = localStorage.getItem(DELETED_ZONES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map(normalizeCityKey));
  } catch {
    return new Set();
  }
}

function loadZoneOverrides() {
  try {
    const raw = localStorage.getItem(ZONE_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveZoneOverrides(overrides) {
  localStorage.setItem(ZONE_OVERRIDES_KEY, JSON.stringify(overrides || {}));
}

function getZoneStorageKey(zone) {
  return String(zone?.id_zona ?? normalizeCityKey(getZoneLabel(zone)));
}

function toStatusLabel(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'atencao' || value === 'atenção') return 'Atenção';
  if (value === 'manutencao' || value === 'manutenção') return 'Manutenção';
  if (value === 'avaria') return 'Avaria';
  if (value === 'operacional') return 'Operacional';
  return status || 'Operacional';
}

function toStatusSelectValue(status) {
  const label = toStatusLabel(status);
  if (label === 'Atenção') return 'Atencao';
  if (label === 'Manutenção') return 'Manutencao';
  return label;
}

function toStatusBadgeClass(status) {
  const value = toStatusLabel(status).toLowerCase();
  if (value.includes('avaria')) return 'status-bad';
  if (value.includes('aten') || value.includes('manuten')) return 'status-warning';
  return 'status-ok';
}

function formatDateForInput(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(value) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-PT');
}

function applyZoneOverride(zone, overridesByZone) {
  const override = overridesByZone[getZoneStorageKey(zone)];
  if (!override) return zone;
  return {
    ...zone,
    ...override
  };
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

function getZoneMetrics(zone) {
  const faultCount = normalizeNumber(zone.avarias);
  const computedStatus = faultCount > 10 ? 'Avaria' : faultCount > 3 ? 'Atenção' : 'Operacional';
  return {
    posts: normalizeNumber(zone.postes),
    faults: faultCount,
    status: toStatusLabel(zone.status || computedStatus),
    consumption: parseConsumptionKwh(zone.consumo),
    lamps: normalizeNumber(zone.vencimento),
    lastUpdate: zone.substituicao || 'Sem data'
  };
}

function renderZoneInfoPanel(zone, zoneKey, metrics) {
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
    `<p><strong>Última Substituição:</strong> ${formatDateForDisplay(metrics.lastUpdate)}</p>`
  ].join('');

  const canManageZone = typeof isAuthenticated === 'function' && isAuthenticated();
  if (canManageZone) {
    zoneInfoPanel.innerHTML += `<div class="zona-actions"><button type="button" class="js-view-details" data-zone="${zoneKey}">Ver Detalhes</button><button type="button" class="js-edit-zone" data-zone="${zoneKey}">Editar</button></div>`;
  }
}

function calculateRiskLevel(rate) {
  if (rate >= 10) return 'Alto';
  if (rate >= 5) return 'Médio';
  return 'Baixo';
}

function mapPostStateToStatus(state) {
  const value = String(state || '').toLowerCase();
  if (value.includes('avaria') || value.includes('inativo')) return 'status-bad';
  if (value.includes('manuten') || value.includes('aten')) return 'status-warning';
  return 'status-ok';
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { zones } = await loadMapData();
    const map = L.map('map').setView([39.55, -8.05], 6);
    const deletedZoneKeys = loadDeletedZoneKeys();
    const zoneOverrides = loadZoneOverrides();
    const markersByCity = {};
    const zonesByKey = new Map();
    let activeZoneKey = null;

    const mapCard = document.querySelector('.map-card');
    const detailsView = document.getElementById('detailsView');
    const detailsTitle = document.getElementById('detailsTitle');
    const detailsSubtitle = document.getElementById('detailsSubtitle');
    const detailsTableBody = document.getElementById('detailsTableBody');
    const detailsEmpty = document.getElementById('detailsEmpty');
    const modal = document.getElementById('editRegionModal');
    const form = document.getElementById('editRegionForm');
    const faultRateEl = document.getElementById('faultRate');
    const riskLevelEl = document.getElementById('riskLevel');
    let modalMessage = null;

    function getZoneByKey(zoneKey) {
      return zonesByKey.get(zoneKey) || null;
    }

    function saveZoneOverride(zone, partialOverride) {
      const key = getZoneStorageKey(zone);
      const current = zoneOverrides[key] || {};
      zoneOverrides[key] = {
        ...current,
        ...partialOverride
      };
      saveZoneOverrides(zoneOverrides);
    }

    function showModalMessage(message, type) {
      if (!form) return;
      if (!modalMessage) {
        modalMessage = document.createElement('p');
        modalMessage.className = 'modal-message';
        form.insertBefore(modalMessage, form.querySelector('.modal-footer'));
      }
      modalMessage.textContent = message;
      modalMessage.classList.remove('is-success', 'is-error');
      modalMessage.classList.add(type === 'success' ? 'is-success' : 'is-error');
    }

    function clearModalMessage() {
      if (!modalMessage) return;
      modalMessage.textContent = '';
      modalMessage.classList.remove('is-success', 'is-error');
    }

    function updateZoneCard(zoneKey) {
      const zone = getZoneByKey(zoneKey);
      if (!zone) return;
      renderZoneInfoPanel(zone, zoneKey, getZoneMetrics(zone));
    }

    async function loadZonePosts(zone) {
      if (!zone || !zone.id_zona || typeof authFetch !== 'function') {
        return [];
      }

      try {
        const response = await authFetch(`/zonas/${zone.id_zona}/postes`);
        if (!response.ok) return [];
        const payload = await response.json().catch(() => []);
        return Array.isArray(payload) ? payload : [];
      } catch {
        return [];
      }
    }

    async function renderDetails(zoneKey) {
      const zone = getZoneByKey(zoneKey);
      if (!zone || !detailsView || !mapCard) return;

      const metrics = getZoneMetrics(zone);
      const zonePosts = await loadZonePosts(zone);

      if (detailsTitle) {
        detailsTitle.textContent = `Detalhes de ${getZoneLabel(zone)}`;
      }

      if (detailsSubtitle) {
        detailsSubtitle.textContent = `${metrics.posts} postes • ${metrics.faults} avarias • ${metrics.lamps} lâmpadas a vencer`;
      }

      if (detailsTableBody) {
        detailsTableBody.innerHTML = zonePosts.map(post => {
          const state = post.estado || 'Operacional';
          const statusClass = mapPostStateToStatus(state);
          return [
            '<tr>',
            `<td>${post.id_poste || '-'}</td>`,
            `<td>Zona ${zone.id_zona || '-'}</td>`,
            `<td>Intensidade ${normalizeNumber(post.intensidade_atual)}%</td>`,
            `<td><span class="status-pill ${statusClass}">${state}</span></td>`,
            '</tr>'
          ].join('');
        }).join('');
      }

      if (detailsEmpty) {
        detailsEmpty.hidden = zonePosts.length > 0;
      }

      mapCard.hidden = true;
      detailsView.hidden = false;
    }

    function showMapView() {
      if (detailsView) detailsView.hidden = true;
      if (mapCard) mapCard.hidden = false;
    }

    function updateDerivedFields() {
      if (!form || !faultRateEl || !riskLevelEl) return;
      const totalPoles = Number(form.elements.poles.value) || 0;
      const faults = Number(form.elements.faults.value) || 0;
      const rate = totalPoles > 0 ? (faults / totalPoles) * 100 : 0;
      faultRateEl.textContent = `${rate.toFixed(1)}%`;
      riskLevelEl.textContent = calculateRiskLevel(rate);
    }

    function openEditModal(zoneKey) {
      const zone = getZoneByKey(zoneKey);
      if (!zone || !form || !modal) return;

      const metrics = getZoneMetrics(zone);

      form.dataset.zoneKey = zoneKey;
      form.elements.name.value = getZoneLabel(zone);
      form.elements.status.value = toStatusSelectValue(metrics.status);
      form.elements.poles.value = metrics.posts;
      form.elements.faults.value = metrics.faults;
      form.elements.consumption.value = metrics.consumption;
      form.elements.expiring.value = metrics.lamps;
      form.elements.lastReplacement.value = formatDateForInput(zone.substituicao);
      form.elements.notes.value = zone.notes || '';

      if (!form.elements.lastReplacement.dataset.pickerBound) {
        form.elements.lastReplacement.dataset.pickerBound = 'true';
        form.elements.lastReplacement.addEventListener('click', () => {
          try { form.elements.lastReplacement.showPicker(); } catch {}
        });
      }

      clearModalMessage();
      updateDerivedFields();
      modal.hidden = false;
    }

    function closeEditModal() {
      if (!modal) return;
      modal.hidden = true;
      clearModalMessage();
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    zones.forEach(zone => {
      const hydratedZone = applyZoneOverride(zone, zoneOverrides);
      const zoneKey = normalizeCityKey(getZoneLabel(zone));
      if (deletedZoneKeys.has(zoneKey)) return;

      const coordinates = resolveZoneCoordinates(hydratedZone);
      if (!coordinates) return;

      zonesByKey.set(zoneKey, hydratedZone);

      const [latitude, longitude] = coordinates;

      const marker = L.marker([latitude, longitude]).addTo(map).bindPopup(`<b>${getZoneLabel(hydratedZone)}</b>`);
      markersByCity[zoneKey] = marker;

      marker.on('click', () => {
        activeZoneKey = zoneKey;
        renderZoneInfoPanel(hydratedZone, zoneKey, getZoneMetrics(hydratedZone));
      });

    });

    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.classList.contains('js-view-details')) {
        const zoneKey = target.getAttribute('data-zone') || activeZoneKey;
        if (zoneKey) {
          renderDetails(zoneKey);
        }
      }

      if (target.classList.contains('js-edit-zone')) {
        const zoneKey = target.getAttribute('data-zone') || activeZoneKey;
        if (zoneKey) {
          openEditModal(zoneKey);
        }
      }

      if (target.classList.contains('js-back-map')) {
        showMapView();
      }

      if (target.hasAttribute('data-close')) {
        closeEditModal();
      }

      if (target === modal) {
        closeEditModal();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal && !modal.hidden) {
        closeEditModal();
      }
    });

    if (form) {
      form.addEventListener('input', event => {
        const fieldName = event?.target?.name;
        if (fieldName === 'poles' || fieldName === 'faults') {
          updateDerivedFields();
        }
      });

      form.addEventListener('submit', async event => {
        event.preventDefault();

        const zoneKey = form.dataset.zoneKey;
        const zone = getZoneByKey(zoneKey);
        if (!zone) return;

        const statusLabel = toStatusLabel(form.elements.status.value);
        const nextOverride = {
          status: statusLabel,
          avarias: normalizeNumber(form.elements.faults.value),
          vencimento: normalizeNumber(form.elements.expiring.value),
          postes: normalizeNumber(form.elements.poles.value),
          consumo: `${normalizeNumber(form.elements.consumption.value)} kWh`,
          substituicao: form.elements.lastReplacement.value || null,
          notes: String(form.elements.notes.value || '').trim()
        };

        let apiUpdated = false;
        if (zone.id_zona && typeof authFetch === 'function') {
          try {
            const response = await authFetch(`/zonas/${zone.id_zona}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: statusLabel,
                nome: String(form.elements.name.value || getZoneLabel(zone)).trim(),
                substituicao: nextOverride.substituicao || null
              })
            });

            if (response.ok) {
              apiUpdated = true;
            }
          } catch {
            apiUpdated = false;
          }
        }

        const updatedZone = {
          ...zone,
          nome: String(form.elements.name.value || getZoneLabel(zone)).trim(),
          ...nextOverride
        };

        zonesByKey.set(zoneKey, updatedZone);
        saveZoneOverride(updatedZone, nextOverride);
        updateZoneCard(zoneKey);

        if (detailsView && !detailsView.hidden && activeZoneKey === zoneKey) {
          await renderDetails(zoneKey);
        }

        if (apiUpdated) {
          showModalMessage('Alteracoes guardadas com sucesso.', 'success');
        } else {
          showModalMessage('Alteracoes guardadas localmente. Nao foi possivel sincronizar tudo com a API.', 'error');
        }

        setTimeout(() => {
          closeEditModal();
        }, 500);
      });
    }

    window.addEventListener('storage', event => {
      if (event.key !== DELETED_ZONES_KEY) return;

      const currentDeleted = loadDeletedZoneKeys();
      Object.entries(markersByCity).forEach(([zoneKey, marker]) => {
        if (currentDeleted.has(zoneKey) && map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      });
    });
  } catch (error) {
    console.error('Error loading map data:', error);
  }
});