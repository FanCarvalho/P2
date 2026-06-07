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

const FAULT_OVERRIDES_KEY = 'dashboard_fault_overrides';
const dashboardState = {
  zones: [],
  faultsChart: null,
  hiddenFaultLabels: new Set()
};

function loadFaultOverrides() {
  try {
    const raw = localStorage.getItem(FAULT_OVERRIDES_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveFaultOverrides(overrides) {
  localStorage.setItem(FAULT_OVERRIDES_KEY, JSON.stringify(overrides));
}

function canEditFaultEntries() {
  if (typeof getAuthenticatedUser !== 'function') return false;
  const user = getAuthenticatedUser();
  if (!user) return false;
  const level = String(user.nivel_acesso || '').toLowerCase();
  return level === 'administrador' || level === 'operador';
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

function renderFaultsLegend(labels, colors) {
  const tableA = document.querySelector('#faultsLegendTableA tbody');
  const tableB = document.querySelector('#faultsLegendTableB tbody');
  if (!tableA || !tableB) return;

  tableA.innerHTML = '';
  tableB.innerHTML = '';

  const midpoint = Math.ceil(labels.length / 2);

  labels.forEach((label, index) => {
    const row = document.createElement('tr');
    row.dataset.faultLabel = label;
    if (dashboardState.hiddenFaultLabels.has(label)) {
      row.classList.add('is-hidden');
    }

    const cityCell = document.createElement('td');
    cityCell.className = 'city';
    cityCell.textContent = label;

    const colorCell = document.createElement('td');
    const dot = document.createElement('span');
    dot.className = 'color-dot';
    dot.style.backgroundColor = colors[index];
    colorCell.appendChild(dot);

    row.appendChild(cityCell);
    row.appendChild(colorCell);

    if (index < midpoint) {
      tableA.appendChild(row);
    } else {
      tableB.appendChild(row);
    }
  });
}

function setupFaultsLegendInteractions() {
  const tablesWrapper = document.querySelector('.faults-legend-tables');
  if (!tablesWrapper || tablesWrapper.dataset.bound === 'true') return;
  tablesWrapper.dataset.bound = 'true';

  tablesWrapper.addEventListener('click', event => {
    const row = event.target.closest('tr[data-fault-label]');
    if (!row) return;

    const label = row.dataset.faultLabel;
    const chart = dashboardState.faultsChart;
    if (!chart || !label) return;

    const dataIndex = chart.data.labels.indexOf(label);
    if (dataIndex === -1) return;

    const isVisible = chart.getDataVisibility(dataIndex);
    chart.toggleDataVisibility(dataIndex);

    if (isVisible) {
      dashboardState.hiddenFaultLabels.add(label);
    } else {
      dashboardState.hiddenFaultLabels.delete(label);
    }

    chart.update();

    document.querySelectorAll(`tr[data-fault-label="${label}"]`).forEach(targetRow => {
      targetRow.classList.toggle('is-hidden', dashboardState.hiddenFaultLabels.has(label));
    });
  });
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

  const overrides = loadFaultOverrides();

  const rows = zones
    .filter(zone => normalizeNumber(zone.avarias) > 0)
    .sort((a, b) => normalizeNumber(b.avarias) - normalizeNumber(a.avarias))
    .slice(0, 8);

  rows.forEach((zone, index) => {
    const zoneKey = getZoneKey(zone);
    const override = overrides[zoneKey] || {};
    const faultCount = normalizeNumber(override.faultCount ?? zone.avarias);
    const status = override.status || (faultCount > 10 ? 'Avaria' : faultCount > 3 ? 'Atenção' : 'Operacional');
    const statusClass = status === 'Avaria' ? 'badge-danger' : status === 'Atenção' ? 'badge-warning' : 'badge-success';
    const lastUpdate = override.lastUpdate || zone.substituicao || '';
    const notes = override.notes || '';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>#${String(index + 1).padStart(3, '0')}</td>
      <td>${getZoneLabel(zone)}</td>
      <td>${faultCount} ocorrências</td>
      <td>${formatDate(lastUpdate)}</td>
      <td><span class="badge ${statusClass}">${status}</span></td>
      <td>
        <button class="button" data-fault-action="view" data-zone-key="${zoneKey}">Ver</button>
        <button class="button-outline" data-fault-action="edit" data-zone-key="${zoneKey}">Editar</button>
      </td>
    `;

    row.dataset.faultEntry = JSON.stringify({
      zoneKey,
      zoneName: getZoneLabel(zone),
      faultCount,
      lastUpdate,
      status,
      notes
    });

    tableBody.appendChild(row);
  });
}

function ensureFaultModal() {
  const existing = document.getElementById('fault-modal');
  if (existing) return existing;

  const modal = document.createElement('div');
  modal.id = 'fault-modal';
  modal.className = 'fault-modal';
  modal.innerHTML = `
    <div class="fault-modal-backdrop" data-fault-close="true"></div>
    <div class="fault-modal-card" role="dialog" aria-modal="true" aria-labelledby="faultModalTitle">
      <h3 id="faultModalTitle">Detalhes de Avaria</h3>
      <p><strong>Zona:</strong> <span data-fault-field="zoneName"></span></p>
      <label>Ocorrências
        <input type="number" min="0" data-fault-field="faultCount" />
      </label>
      <label>Status
        <select data-fault-field="status">
          <option value="Operacional">Operacional</option>
          <option value="Atenção">Atenção</option>
          <option value="Avaria">Avaria</option>
        </select>
      </label>
      <label>Última atualização
        <input type="date" data-fault-field="lastUpdate" />
      </label>
      <label>Notas
        <textarea rows="3" data-fault-field="notes" placeholder="Observações da intervenção..."></textarea>
      </label>
      <div class="fault-modal-actions">
        <button type="button" class="btn btn-secondary" data-fault-close="true">Fechar</button>
        <button type="button" class="btn btn-primary" data-fault-save="true">Guardar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  return modal;
}

function openFaultModal(entry, mode) {
  const modal = ensureFaultModal();
  const saveButton = modal.querySelector('[data-fault-save="true"]');

  modal.dataset.mode = mode;
  modal.dataset.zoneKey = entry.zoneKey;

  modal.querySelector('[data-fault-field="zoneName"]').textContent = entry.zoneName;
  modal.querySelector('[data-fault-field="faultCount"]').value = entry.faultCount;
  modal.querySelector('[data-fault-field="status"]').value = entry.status;
  modal.querySelector('[data-fault-field="lastUpdate"]').value = entry.lastUpdate ? new Date(entry.lastUpdate).toISOString().slice(0, 10) : '';
  modal.querySelector('[data-fault-field="notes"]').value = entry.notes || '';

  const canEdit = mode === 'edit' && canEditFaultEntries();
  modal.classList.toggle('is-view', !canEdit);
  modal.querySelectorAll('input, select, textarea').forEach(field => {
    field.disabled = !canEdit;
  });
  saveButton.style.display = canEdit ? '' : 'none';

  modal.classList.add('is-open');
}

function closeFaultModal() {
  const modal = document.getElementById('fault-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.classList.remove('is-view');
}

function setupFaultsActions() {
  const tableBody = document.querySelector('.table tbody');
  if (!tableBody || tableBody.dataset.bound === 'true') return;
  tableBody.dataset.bound = 'true';

  tableBody.addEventListener('click', event => {
    const trigger = event.target.closest('[data-fault-action]');
    if (!trigger) return;

    const row = trigger.closest('tr');
    if (!row || !row.dataset.faultEntry) return;

    const entry = JSON.parse(row.dataset.faultEntry);
    const action = trigger.dataset.faultAction;

    if (action === 'edit' && !canEditFaultEntries()) {
      alert('Apenas operadores e administradores podem editar avarias.');
      return;
    }

    openFaultModal(entry, action);
  });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-fault-close="true"]')) {
      closeFaultModal();
      return;
    }

    if (!event.target.closest('[data-fault-save="true"]')) return;
    const modal = document.getElementById('fault-modal');
    if (!modal) return;

    const zoneKey = modal.dataset.zoneKey;
    if (!zoneKey) return;

    const overrides = loadFaultOverrides();
    overrides[zoneKey] = {
      faultCount: normalizeNumber(modal.querySelector('[data-fault-field="faultCount"]').value),
      status: modal.querySelector('[data-fault-field="status"]').value,
      lastUpdate: modal.querySelector('[data-fault-field="lastUpdate"]').value,
      notes: modal.querySelector('[data-fault-field="notes"]').value.trim()
    };

    saveFaultOverrides(overrides);
    renderFaultsTable({ zones: dashboardState.zones });
    closeFaultModal();
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
    const sortedFaultZones = [...zones].sort((left, right) =>
      getZoneLabel(left).localeCompare(getZoneLabel(right), 'pt-PT', { sensitivity: 'base' })
    );
    const faultLabels = sortedFaultZones.map(zone => getZoneLabel(zone));
    const faultValues = sortedFaultZones.map(zone => normalizeNumber(zone.avarias));
    const faultColors = faultLabels.map((_, index) => getRegionColor(index));

    if (dashboardState.faultsChart) {
      dashboardState.faultsChart.destroy();
    }

    dashboardState.faultsChart = new Chart(faultsCanvas, {
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
        plugins: { legend: { display: false } }
      }
    });

    faultLabels.forEach((label, index) => {
      if (dashboardState.hiddenFaultLabels.has(label) && dashboardState.faultsChart.getDataVisibility(index)) {
        dashboardState.faultsChart.toggleDataVisibility(index);
      }
    });
    dashboardState.faultsChart.update();

    renderFaultsLegend(faultLabels, faultColors);
    setupFaultsLegendInteractions();
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
    dashboardState.zones = data.zones;
    renderMetrics(data);
    renderZoneFilter(data.zones);
    renderFaultsTable(data);
    renderMaintenanceList(data);
    renderCharts(data);
    setupFaultsActions();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
});