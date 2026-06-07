function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatInteger(value) {
  return new Intl.NumberFormat('pt-PT').format(Math.round(normalizeNumber(value)));
}

function formatDate(value) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-PT');
}

function parseConsumptionKwh(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const numeric = Number(value.replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return 0;
}

function getZoneLabel(zone) {
  return zone.nome || zone.nome_zona || `Zona ${zone.id_zona || ''}`.trim();
}

function getZoneKey(zone) {
  return String(zone.id_zona ?? zone.nome ?? zone.codigo_postal ?? '');
}

function getZoneIdFromPost(post) {
  return String(post.id_zona ?? '');
}

function getZoneFromId(zonesById, zoneId) {
  return zonesById.get(String(zoneId)) || null;
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

function getRegionColor(index) {
  // Golden-angle distribution gives visually distinct colors for many regions.
  const hue = Math.round((index * 137.508) % 360);
  return `hsl(${hue} 78% 56%)`;
}

async function loadDashboardData() {
  const zonesResponse = await fetch(buildApiUrl('/zonas'));
  const zones = zonesResponse.ok ? await zonesResponse.json().catch(() => []) : [];

  return {
    zones: Array.isArray(zones) ? zones : [],
    posts: [],
    faults: [],
    maintenance: []
  };
}

function renderMetrics({ zones }) {
  const totalPosts = zones.reduce((sum, zone) => sum + normalizeNumber(zone.postes), 0);
  const activeFaults = zones.reduce((sum, zone) => sum + normalizeNumber(zone.avarias), 0);
  const lampsAtRisk = zones.reduce((sum, zone) => sum + normalizeNumber(zone.vencimento), 0);
  const totalConsumption = zones.reduce((sum, zone) => sum + parseConsumptionKwh(zone.consumo), 0);

  const cards = Array.from(document.querySelectorAll('.dashboard-metrics .card'));
  const values = [
    { label: 'Total de Postes', value: formatInteger(totalPosts), badgeClass: 'badge-success', badgeText: '+ Atual' },
    { label: 'Avarias Ativas', value: formatInteger(activeFaults), badgeClass: 'badge-danger', badgeText: 'Registos API' },
    { label: 'Lâmpadas a vencer', value: formatInteger(lampsAtRisk), badgeClass: 'badge-warning', badgeText: 'Proxy de falhas' },
    { label: 'Consumo Total (kWh)', value: formatInteger(totalConsumption), badgeClass: 'badge-success', badgeText: 'Soma dos postes' }
  ];

  values.forEach((entry, index) => {
    const card = cards[index];
    if (!card) return;

    const subtitle = card.querySelector('.page-subtitle');
    const valueNode = card.querySelector('h2');
    const badgeNode = card.querySelector('.badge');

    if (subtitle) subtitle.textContent = entry.label;
    if (valueNode) valueNode.textContent = entry.value;
    if (badgeNode) {
      badgeNode.className = `badge ${entry.badgeClass}`;
      badgeNode.textContent = entry.badgeText;
    }
  });
}

function renderZoneFilter(zones) {
  const zonaFilter = document.getElementById('zona-filter');
  if (!zonaFilter) return;

  zonaFilter.innerHTML = '<option value="">Filtrar por Zona</option>';
  zones.forEach(zone => {
    const option = document.createElement('option');
    option.value = getZoneKey(zone);
    option.textContent = getZoneLabel(zone);
    zonaFilter.appendChild(option);
  });
}

function renderFaultsTable({ zones }) {
  const tableBody = document.querySelector('.table tbody');
  if (!tableBody) return;

  tableBody.innerHTML = '';

  const rows = zones
    .filter(zone => normalizeNumber(zone.avarias) > 0)
    .sort((a, b) => normalizeNumber(b.avarias) - normalizeNumber(a.avarias))
    .slice(0, 8);

  rows.forEach((zone, index) => {
    const faultCount = normalizeNumber(zone.avarias);
    const status = faultCount > 10 ? 'Avaria' : faultCount > 3 ? 'Atenção' : 'Operacional';
    const statusClass = status === 'Avaria' ? 'badge-danger' : status === 'Atenção' ? 'badge-warning' : 'badge-success';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>#${String(index + 1).padStart(3, '0')}</td>
      <td>${getZoneLabel(zone)}</td>
      <td>${faultCount} ocorrências</td>
      <td>${formatDate(zone.substituicao)}</td>
      <td><span class="badge ${statusClass}">${status}</span></td>
      <td>
        <button class="button">Ver</button>
        <button class="button-outline">Editar</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function renderMaintenanceList({ zones }) {
  const maintenanceList = document.querySelector('.tx-list');
  if (!maintenanceList) return;

  maintenanceList.innerHTML = '';

  const items = zones
    .filter(zone => zone.substituicao)
    .sort((a, b) => new Date(a.substituicao) - new Date(b.substituicao))
    .slice(0, 8);

  items.forEach(zone => {
    const entry = document.createElement('li');
    entry.className = 'tx-item';
    entry.innerHTML = `<span>Substituição programada - ${getZoneLabel(zone)}</span><strong>${formatDate(zone.substituicao)}</strong>`;
    maintenanceList.appendChild(entry);
  });
}

function renderCharts({ zones }) {
  if (typeof Chart === 'undefined') return;

  const zoneLabels = zones.map(zone => getZoneLabel(zone));
  const zoneValues = zones.map(zone => {
    const monthly = Array.isArray(zone.consumo_mensal) ? zone.consumo_mensal : [];
    if (monthly.length) {
      return monthly.reduce((sum, value) => sum + normalizeNumber(value), 0) / monthly.length;
    }
    return parseConsumptionKwh(zone.consumo);
  });

  const consumoCanvas = document.getElementById('consumoEnergiaChart');
  if (consumoCanvas) {
    new Chart(consumoCanvas, {
      type: 'bar',
      data: {
        labels: zoneLabels.length ? zoneLabels : ['Sem zonas'],
        datasets: [{
          label: 'Consumo médio por zona (kWh)',
          data: zoneValues.length ? zoneValues : [0],
          backgroundColor: '#38bdf8'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } }
      }
    });
  }

  const faultsCanvas = document.getElementById('distribuicaoAvariasChart');
  if (faultsCanvas) {
    const faultLabels = zones.map(zone => getZoneLabel(zone));
    const faultValues = zones.map(zone => normalizeNumber(zone.avarias));
    const faultColors = faultLabels.map((_, index) => getRegionColor(index));

    new Chart(faultsCanvas, {
      type: 'doughnut',
      data: {
        labels: faultLabels,
        datasets: [{
          data: faultValues,
          backgroundColor: faultColors
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const currentPage = document.body && document.body.dataset ? document.body.dataset.page : null;

  // Only require authentication for admin pages; dashboard remains public.
  if (currentPage === 'admin') {
    if (typeof ensureAuthenticated === 'function') {
      const ok = await ensureAuthenticated();
      if (!ok) return;
    }
  }

  try {
    const data = await loadDashboardData();
    renderMetrics(data);
    renderZoneFilter(data.zones);
    renderFaultsTable(data);
    renderMaintenanceList(data);
    renderCharts(data);
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
});