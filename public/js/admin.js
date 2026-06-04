function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatInteger(value) {
  return new Intl.NumberFormat('pt-PT').format(Math.round(normalizeNumber(value)));
}

function getZoneLabel(zone) {
  return zone.nome || zone.nome_zona || `Zona ${zone.id_zona || ''}`.trim();
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

async function loadAdminData() {
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

function renderAdminTable({ zones, posts, faults }) {
  const tableBody = document.querySelector('.data-table tbody');
  if (!tableBody) return;

  const postsByZone = groupBy(posts, post => String(post.id_zona ?? ''));
  const faultsByPost = groupBy(faults, fault => String(fault.id_poste ?? fault.id_lampada ?? ''));

  tableBody.innerHTML = '';

  zones.forEach(zone => {
    const zonePosts = postsByZone.get(String(zone.id_zona)) || [];
    const zoneFaults = zonePosts.reduce((sum, post) => sum + (faultsByPost.get(String(post.id_poste)) || []).length, 0);
    const consumption = zonePosts.reduce((sum, post) => sum + normalizeNumber(post.intensidade_atual), 0);
    const status = zoneFaults > 10 ? 'Avaria' : zoneFaults > 3 ? 'Atenção' : 'Operacional';
    const statusClass = status === 'Avaria' ? 'badge-danger' : status === 'Atenção' ? 'badge-warning' : 'badge-success';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${getZoneLabel(zone)}</td>
      <td>${formatInteger(zonePosts.length)}</td>
      <td>${formatInteger(zoneFaults)}</td>
      <td>${formatInteger(consumption)} kWh</td>
      <td>${zonePosts[0]?.data_instalacao || 'Sem data'}</td>
      <td><span class="badge ${statusClass}">${status}</span></td>
      <td>
        <button class="btn btn-outline btn-sm">Editar</button>
        <button class="btn btn-danger btn-sm">Excluir</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof ensureAuthenticated === 'function') {
    const ok = await ensureAuthenticated();
    if (!ok) return;
  }

  try {
    const data = await loadAdminData();
    renderAdminTable(data);
  } catch (error) {
    console.error('Error loading admin data:', error);
  }
});