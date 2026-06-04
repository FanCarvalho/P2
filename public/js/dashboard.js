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

async function loadDashboardData() {
  // Use unauthenticated fetch for public dashboard data to avoid forcing login
  const [zonesResponse, postsResponse, faultsResponse, maintenanceResponse] = await Promise.all([
    fetch(buildApiUrl('/zonas')),
    fetch(buildApiUrl('/postes')),
    fetch(buildApiUrl('/avarias')),
    fetch(buildApiUrl('/agendamentos-manutencao'))
  ]);

  const [zones, posts, faults, maintenance] = await Promise.all([
    zonesResponse.ok ? zonesResponse.json().catch(() => []) : [],
    postsResponse.ok ? postsResponse.json().catch(() => []) : [],
    faultsResponse.ok ? faultsResponse.json().catch(() => []) : [],
    maintenanceResponse.ok ? maintenanceResponse.json().catch(() => []) : []
  ]);

  return {
    zones: Array.isArray(zones) ? zones : [],
    posts: Array.isArray(posts) ? posts : [],
    faults: Array.isArray(faults) ? faults : [],
    maintenance: Array.isArray(maintenance) ? maintenance : []
  };
}

function renderMetrics({ posts, faults }) {
  const totalPosts = posts.length;
  const activeFaults = faults.filter(item => String(item.estado || '').toLowerCase() !== 'resolvida').length;
  const lampsAtRisk = faults.length;
  const totalConsumption = posts.reduce((sum, post) => sum + normalizeNumber(post.intensidade_atual), 0);

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

function renderFaultsTable({ zones, posts, faults }) {
  const tableBody = document.querySelector('.table tbody');
  if (!tableBody) return;

  const zonesById = new Map(zones.map(zone => [String(zone.id_zona), zone]));
  const postsById = new Map(posts.map(post => [String(post.id_poste), post]));

  tableBody.innerHTML = '';

  faults.slice(0, 8).forEach((fault, index) => {
    const relatedPost = fault.id_poste ? postsById.get(String(fault.id_poste)) : null;
    const relatedZone = relatedPost ? getZoneFromId(zonesById, relatedPost.id_zona) : null;
    const zoneName = relatedZone ? getZoneLabel(relatedZone) : 'Sem zona associada';
    const status = String(fault.estado || 'pendente');
    const statusClass = status.toLowerCase() === 'resolvida' ? 'badge-success' : status.toLowerCase() === 'em análise' ? 'badge-warning' : 'badge-danger';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>#${String(fault.id_avaria ?? index + 1).padStart(3, '0')}</td>
      <td>${zoneName}</td>
      <td>${fault.descricao || 'Avaria'}</td>
      <td>${formatDate(fault.data_registo || fault.criado_em || fault.data)}</td>
      <td><span class="badge ${statusClass}">${status}</span></td>
      <td>
        <button class="button">Ver</button>
        <button class="button-outline">Editar</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function renderMaintenanceList({ maintenance }) {
  const maintenanceList = document.querySelector('.tx-list');
  if (!maintenanceList) return;

  maintenanceList.innerHTML = '';
  maintenance.slice(0, 8).forEach(item => {
    const entry = document.createElement('li');
    entry.className = 'tx-item';
    entry.innerHTML = `<span>${item.descricao || 'Manutenção programada'}</span><strong>${formatDate(item.data_manutencao || item.data)}</strong>`;
    maintenanceList.appendChild(entry);
  });
}

function renderCharts({ zones, posts, faults }) {
  if (typeof Chart === 'undefined') return;

  const postsByZone = groupBy(posts, post => getZoneIdFromPost(post));
  const zoneLabels = zones.map(zone => getZoneLabel(zone));
  const zoneValues = zones.map(zone => {
    const zonePosts = postsByZone.get(String(zone.id_zona)) || [];
    if (!zonePosts.length) return 0;
    return Math.round(zonePosts.reduce((sum, post) => sum + normalizeNumber(post.intensidade_atual), 0) / zonePosts.length);
  });

  const consumoCanvas = document.getElementById('consumoEnergiaChart');
  if (consumoCanvas) {
    new Chart(consumoCanvas, {
      type: 'bar',
      data: {
        labels: zoneLabels.length ? zoneLabels : ['Sem zonas'],
        datasets: [{
          label: 'Intensidade média por zona',
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
    const severityCounts = faults.reduce((accumulator, fault) => {
      const key = String(fault.severidade || 'indefinida');
      accumulator.set(key, (accumulator.get(key) || 0) + 1);
      return accumulator;
    }, new Map());

    new Chart(faultsCanvas, {
      type: 'doughnut',
      data: {
        labels: Array.from(severityCounts.keys()),
        datasets: [{
          data: Array.from(severityCounts.values()),
          backgroundColor: ['#f97316', '#ef4444', '#eab308', '#22c55e']
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