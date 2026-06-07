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

const DELETED_ZONES_KEY = 'glowpath_deleted_zones';
const ZONE_OVERRIDES_KEY = 'glowpath_zone_overrides';
let activeEditingRow = null;
let modalMode = 'edit';

function normalizeZoneName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function loadDeletedZones() {
  try {
    const raw = localStorage.getItem(DELETED_ZONES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map(normalizeZoneName));
  } catch {
    return new Set();
  }
}

function saveDeletedZones(zoneSet) {
  localStorage.setItem(DELETED_ZONES_KEY, JSON.stringify(Array.from(zoneSet)));
}

function registerDeletedZone(zoneName) {
  const deletedZones = loadDeletedZones();
  deletedZones.add(normalizeZoneName(zoneName));
  saveDeletedZones(deletedZones);
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
  localStorage.setItem(ZONE_OVERRIDES_KEY, JSON.stringify(overrides));
}

function getZoneStorageKey(zoneId, zoneName) {
  if (zoneId !== undefined && zoneId !== null && String(zoneId).trim() !== '') {
    return `id:${String(zoneId)}`;
  }
  return `name:${normalizeZoneName(zoneName)}`;
}

function persistZoneOverride({ zoneId, zoneName, postes, avarias, consumo, substituicao, estado }) {
  const overrides = loadZoneOverrides();
  const key = getZoneStorageKey(zoneId, zoneName);
  overrides[key] = {
    nome: String(zoneName || ''),
    postes: normalizeNumber(postes),
    avarias: normalizeNumber(avarias),
    consumo: normalizeNumber(consumo),
    substituicao: substituicao || 'Sem data',
    estado: String(estado || 'Operacional')
  };
  saveZoneOverrides(overrides);
}

function deleteZoneOverride(zoneId, zoneName) {
  const overrides = loadZoneOverrides();
  const byId = getZoneStorageKey(zoneId, zoneName);
  const byName = getZoneStorageKey(null, zoneName);
  delete overrides[byId];
  delete overrides[byName];
  saveZoneOverrides(overrides);
}

function restoreDeletedZone(zoneName) {
  const deletedZones = loadDeletedZones();
  const normalized = normalizeZoneName(zoneName);
  if (!deletedZones.has(normalized)) return;
  deletedZones.delete(normalized);
  saveDeletedZones(deletedZones);
}

function parseNumericText(value) {
  const numeric = String(value || '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseConsumptionKwh(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const numeric = Number(value.replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return 0;
}

function parseDateForInput(value) {
  const text = String(value || '').trim();
  if (!text || text.toLowerCase() === 'sem data') return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function getStatusBadgeClass(status) {
  if (status === 'Atenção') return 'badge-warning';
  if (status === 'Avaria') return 'badge-danger';
  return 'badge-success';
}

function createZoneTableRow({ zoneId, nome, postes, avarias, consumo, substituicao, estado }) {
  const statusClass = getStatusBadgeClass(estado);
  const row = document.createElement('tr');
  if (zoneId !== undefined && zoneId !== null) {
    row.dataset.zoneId = String(zoneId);
  }
  row.innerHTML = `
    <td>${nome}</td>
    <td>${formatInteger(postes)}</td>
    <td>${formatInteger(avarias)}</td>
    <td>${formatInteger(consumo)} kWh</td>
    <td>${substituicao || 'Sem data'}</td>
    <td><span class="badge ${statusClass}">${estado}</span></td>
    <td>
      <button class="btn btn-outline btn-sm">Editar</button>
      <button class="btn btn-danger btn-sm">Excluir</button>
    </td>
  `;
  return row;
}

function openZoneEditModal(row) {
  const modal = document.getElementById('zoneEditModal');
  const form = document.getElementById('zoneEditForm');
  const modalTitle = document.getElementById('zoneEditModalTitle');
  const submitButton = form?.querySelector('button[type="submit"]');
  if (!modal || !form || !row) return;

  const cells = row.querySelectorAll('td');
  if (cells.length < 7) return;

  activeEditingRow = row;
  modalMode = 'edit';
  if (modalTitle) modalTitle.textContent = 'Editar Zona';
  if (submitButton) submitButton.textContent = 'Salvar Alterações';
  form.nome.value = cells[0].textContent.trim();
  form.postes.value = parseNumericText(cells[1].textContent);
  form.avarias.value = parseNumericText(cells[2].textContent);
  form.consumo.value = parseNumericText(cells[3].textContent);
  form.substituicao.value = parseDateForInput(cells[4].textContent);
  form.estado.value = cells[5].textContent.includes('Atenção') ? 'Atenção' : 'Operacional';

  modal.hidden = false;
  modal.classList.add('is-open');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function openZoneCreateModal() {
  const modal = document.getElementById('zoneEditModal');
  const form = document.getElementById('zoneEditForm');
  const modalTitle = document.getElementById('zoneEditModalTitle');
  const submitButton = form?.querySelector('button[type="submit"]');
  if (!modal || !form) return;

  activeEditingRow = null;
  modalMode = 'create';
  form.reset();
  form.nome.value = '';
  form.postes.value = 0;
  form.avarias.value = 0;
  form.consumo.value = 0;
  form.substituicao.value = '';
  form.estado.value = 'Operacional';

  if (modalTitle) modalTitle.textContent = 'Nova Zona';
  if (submitButton) submitButton.textContent = 'Adicionar Zona';

  modal.hidden = false;
  modal.classList.add('is-open');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeZoneEditModal() {
  const modal = document.getElementById('zoneEditModal');
  const form = document.getElementById('zoneEditForm');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.style.display = 'none';
  modal.hidden = true;
  if (form) form.reset();
  activeEditingRow = null;
  document.body.style.overflow = '';
}

function setupZoneEditModal() {
  const tableBody = document.querySelector('.data-table tbody');
  const modal = document.getElementById('zoneEditModal');
  const form = document.getElementById('zoneEditForm');
  const addZoneButton = document.getElementById('addZoneBtn');
  if (!tableBody || !modal || !form || !addZoneButton) return;
  if (tableBody.dataset.zoneEditBound === 'true') return;
  tableBody.dataset.zoneEditBound = 'true';

  modal.classList.remove('is-open');
  modal.style.display = 'none';
  modal.hidden = true;

  addZoneButton.addEventListener('click', () => {
    openZoneCreateModal();
  });

  tableBody.addEventListener('click', event => {
    const deleteButton = event.target.closest('.btn-danger');
    if (deleteButton && tableBody.contains(deleteButton)) {
      const row = deleteButton.closest('tr');
      if (!row) return;

      const zoneName = row.querySelector('td')?.textContent?.trim() || 'esta zona';
      const zoneId = row.dataset.zoneId || null;
      const confirmed = confirm(`Tem certeza que deseja excluir a zona ${zoneName}?`);
      if (!confirmed) return;

      registerDeletedZone(zoneName);
      deleteZoneOverride(zoneId, zoneName);
      if (activeEditingRow === row) {
        closeZoneEditModal();
      }
      row.remove();
      return;
    }

    const editButton = event.target.closest('.btn-outline');
    if (!editButton || !tableBody.contains(editButton)) return;
    const row = editButton.closest('tr');
    openZoneEditModal(row);
  });

  modal.addEventListener('click', event => {
    if (event.target === modal || event.target.closest('[data-modal-close]') || event.target.closest('[data-modal-cancel]')) {
      closeZoneEditModal();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) {
      closeZoneEditModal();
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const nome = form.nome.value.trim();
    const postes = normalizeNumber(form.postes.value);
    const avarias = normalizeNumber(form.avarias.value);
    const consumo = normalizeNumber(form.consumo.value);
    const substituicao = form.substituicao.value || 'Sem data';
    const estado = form.estado.value;

    if (!nome) {
      alert('Preencha o nome/região da zona.');
      return;
    }

    if (modalMode === 'create') {
      const newRow = createZoneTableRow({ nome, postes, avarias, consumo, substituicao, estado });
      persistZoneOverride({ zoneName: nome, postes, avarias, consumo, substituicao, estado });
      tableBody.appendChild(newRow);
      closeZoneEditModal();
      return;
    }

    if (!activeEditingRow) return;
    const cells = activeEditingRow.querySelectorAll('td');
    if (cells.length < 7) return;

    const statusClass = getStatusBadgeClass(estado);
    cells[0].textContent = nome;
    cells[1].textContent = formatInteger(postes);
    cells[2].textContent = formatInteger(avarias);
    cells[3].textContent = `${formatInteger(consumo)} kWh`;
    cells[4].textContent = substituicao;
    cells[5].innerHTML = `<span class="badge ${statusClass}">${estado}</span>`;

    const zoneId = activeEditingRow.dataset.zoneId || null;
    if (zoneId) {
      try {
        await authFetch(`/zonas/${zoneId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado_manual: estado })
        });
      } catch (error) {
        console.error('Não foi possível persistir estado manual da zona:', error);
      }
    }

    persistZoneOverride({
      zoneId,
      zoneName: nome,
      postes,
      avarias,
      consumo,
      substituicao,
      estado
    });

    closeZoneEditModal();
  });
}

async function loadAdminData() {
  const zonesResponse = await authFetch('/zonas');
  const zones = await zonesResponse.json();

  return {
    zones: Array.isArray(zones) ? zones : []
  };
}

function renderAdminTable({ zones }) {
  const tableBody = document.querySelector('.data-table tbody');
  if (!tableBody) return;

  const deletedZones = loadDeletedZones();
  const zoneOverrides = loadZoneOverrides();

  tableBody.innerHTML = '';

  zones.forEach(zone => {
    if (deletedZones.has(normalizeZoneName(getZoneLabel(zone)))) {
      return;
    }

    const postsCount = normalizeNumber(zone.postes);
    const zoneFaults = normalizeNumber(zone.avarias);
    const consumption = parseConsumptionKwh(zone.consumo);
    const status = zone.status || (zoneFaults > 10 ? 'Avaria' : zoneFaults > 3 ? 'Atenção' : 'Operacional');
    const zoneKeyById = getZoneStorageKey(zone.id_zona, getZoneLabel(zone));
    const zoneKeyByName = getZoneStorageKey(null, getZoneLabel(zone));
    const override = zoneOverrides[zoneKeyById] || zoneOverrides[zoneKeyByName] || null;

    const row = createZoneTableRow({
      zoneId: zone.id_zona,
      nome: override?.nome || getZoneLabel(zone),
      postes: override?.postes ?? postsCount,
      avarias: override?.avarias ?? zoneFaults,
      consumo: override?.consumo ?? consumption,
      substituicao: override?.substituicao ?? (zone.substituicao || 'Sem data'),
      estado: override?.estado || status
    });
    tableBody.appendChild(row);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof ensureAuthenticated === 'function') {
    const ok = await ensureAuthenticated();
    if (!ok) return;
  }

  // Restore Viseu if it was previously removed from admin table/map.
  restoreDeletedZone('Viseu');

  try {
    const data = await loadAdminData();
    renderAdminTable(data);
    setupZoneEditModal();
  } catch (error) {
    console.error('Error loading admin data:', error);
  }
});