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
let operatorModalMode = 'create';
let activeOperatorRow = null;

function normalizeZoneName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
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

function normalizeStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'avaria') return 'Avaria';
  if (status === 'atenção' || status === 'atencao') return 'Atenção';
  return 'Operacional';
}

function getStatusBadgeClass(status) {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === 'Atenção') return 'badge-warning';
  if (normalizedStatus === 'Avaria') return 'badge-danger';
  return 'badge-success';
}

function createZoneTableRow({ zoneId, nome, postes, avarias, consumo, substituicao, estado }) {
  const normalizedStatus = normalizeStatus(estado);
  const statusClass = getStatusBadgeClass(normalizedStatus);
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
    <td><span class="badge ${statusClass}">${normalizedStatus}</span></td>
    <td>
      <button class="btn btn-outline btn-sm">Editar</button>
      <button class="btn btn-danger btn-sm">Excluir</button>
    </td>
  `;
  return row;
}

function formatOperatorStatus(value) {
  return value === false ? 'Inativo' : 'Ativo';
}

function getOperatorStatusClass(value) {
  return value === false ? 'badge-danger' : 'badge-success';
}

function createOperatorTableRow({ id_operador, nome, email, ativo, nivel_acesso }) {
  const row = document.createElement('tr');
  row.dataset.operatorId = String(id_operador || '');
  row.dataset.accessLevel = String(nivel_acesso || 'operador');

  const statusLabel = formatOperatorStatus(ativo);
  const statusClass = getOperatorStatusClass(ativo);

  row.innerHTML = `
    <td>${nome || '-'}</td>
    <td>${email || '-'}</td>
    <td><span class="badge ${statusClass}">${statusLabel}</span></td>
    <td>
      <button class="btn btn-outline btn-sm js-edit-operator" type="button">Editar</button>
      <button class="btn btn-danger btn-sm js-delete-operator" type="button">Excluir</button>
    </td>
  `;

  return row;
}

function closeOperatorModal() {
  const modal = document.getElementById('operatorModal');
  const form = document.getElementById('operatorForm');
  if (!modal) return;

  modal.classList.remove('is-open');
  modal.style.display = 'none';
  modal.hidden = true;
  if (form) form.reset();

  activeOperatorRow = null;
  operatorModalMode = 'create';
  document.body.style.overflow = '';
}

function openOperatorModal(mode, row = null) {
  const modal = document.getElementById('operatorModal');
  const form = document.getElementById('operatorForm');
  const title = document.getElementById('operatorModalTitle');
  const hint = document.getElementById('operatorPasswordHint');
  const submit = document.getElementById('operatorSubmitBtn');
  if (!modal || !form) return;

  operatorModalMode = mode;
  activeOperatorRow = row;

  form.reset();

  if (mode === 'edit' && row) {
    const cells = row.querySelectorAll('td');
    form.nome.value = cells[0]?.textContent.trim() || '';
    form.email.value = cells[1]?.textContent.trim() || '';
    form.nivel_acesso.value = row.dataset.accessLevel || 'operador';
    form.ativo.value = (cells[2]?.textContent.trim() || '').toLowerCase() === 'inativo' ? 'false' : 'true';
    form.password.value = '';
    form.password.required = false;
    if (title) title.textContent = 'Editar Operador';
    if (submit) submit.textContent = 'Salvar Alterações';
    if (hint) hint.textContent = 'Deixe em branco para manter a palavra-passe atual.';
  } else {
    form.nivel_acesso.value = 'operador';
    form.ativo.value = 'true';
    form.password.value = '';
    form.password.required = true;
    if (title) title.textContent = 'Novo Operador';
    if (submit) submit.textContent = 'Guardar Operador';
    if (hint) hint.textContent = 'Na criação, a palavra-passe é obrigatória (mínimo 10 caracteres).';
  }

  modal.hidden = false;
  modal.classList.add('is-open');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function extractApiError(payload, fallback) {
  if (!payload || typeof payload !== 'object') return fallback;
  if (payload.description && typeof payload.description === 'string') return payload.description;
  if (!payload.errors || typeof payload.errors !== 'object') return fallback;

  const firstMessages = Object.values(payload.errors)
    .filter(value => Array.isArray(value) && value.length > 0)
    .map(value => value[0]);

  return firstMessages[0] || fallback;
}

function setupOperatorManagement() {
  const tableBody = document.getElementById('operatorsTableBody');
  const addButton = document.getElementById('addOperatorBtn');
  const modal = document.getElementById('operatorModal');
  const form = document.getElementById('operatorForm');
  if (!tableBody || !addButton || !modal || !form) return;
  if (tableBody.dataset.operatorBound === 'true') return;
  tableBody.dataset.operatorBound = 'true';

  modal.classList.remove('is-open');
  modal.style.display = 'none';
  modal.hidden = true;

  addButton.addEventListener('click', () => openOperatorModal('create'));

  tableBody.addEventListener('click', async event => {
    const editButton = event.target.closest('.js-edit-operator');
    if (editButton) {
      const row = editButton.closest('tr');
      if (!row) return;
      openOperatorModal('edit', row);
      return;
    }

    const deleteButton = event.target.closest('.js-delete-operator');
    if (!deleteButton) return;

    const row = deleteButton.closest('tr');
    const operatorId = row?.dataset.operatorId;
    const operatorName = row?.querySelector('td')?.textContent?.trim() || 'este operador';
    if (!row || !operatorId) return;

    if (!confirm(`Tem certeza que deseja excluir ${operatorName}?`)) return;

    try {
      const response = await authFetch(`/operadores/${operatorId}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 204) {
        const payload = await response.json().catch(() => ({}));
        alert(extractApiError(payload, 'Não foi possível excluir o operador.'));
        return;
      }
      row.remove();
    } catch (error) {
      console.error('Erro ao excluir operador:', error);
      alert('Erro ao excluir operador.');
    }
  });

  modal.addEventListener('click', event => {
    if (event.target === modal || event.target.closest('[data-operator-close]') || event.target.closest('[data-operator-cancel]')) {
      closeOperatorModal();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) {
      closeOperatorModal();
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const payload = {
      nome: form.nome.value.trim(),
      email: form.email.value.trim(),
      nivel_acesso: form.nivel_acesso.value,
      ativo: form.ativo.value === 'true'
    };

    if (form.password.value.trim()) {
      payload.password = form.password.value.trim();
    }

    if (!payload.nome || !payload.email) {
      alert('Preencha nome e email do operador.');
      return;
    }

    if (operatorModalMode === 'create' && !payload.password) {
      alert('Na criação, a palavra-passe é obrigatória.');
      return;
    }

    try {
      if (operatorModalMode === 'create') {
        const response = await authFetch('/operadores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          alert(extractApiError(result, 'Não foi possível criar o operador.'));
          return;
        }

        tableBody.appendChild(createOperatorTableRow({
          id_operador: result.id_operador,
          nome: payload.nome,
          email: payload.email,
          ativo: payload.ativo,
          nivel_acesso: payload.nivel_acesso
        }));
      } else {
        const operatorId = activeOperatorRow?.dataset.operatorId;
        if (!operatorId || !activeOperatorRow) return;

        const response = await authFetch(`/operadores/${operatorId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          alert(extractApiError(result, 'Não foi possível atualizar o operador.'));
          return;
        }

        const nextStatus = formatOperatorStatus(payload.ativo);
        const nextClass = getOperatorStatusClass(payload.ativo);
        const cells = activeOperatorRow.querySelectorAll('td');
        cells[0].textContent = payload.nome;
        cells[1].textContent = payload.email;
        cells[2].innerHTML = `<span class="badge ${nextClass}">${nextStatus}</span>`;
        activeOperatorRow.dataset.accessLevel = payload.nivel_acesso;
      }

      closeOperatorModal();
    } catch (error) {
      console.error('Erro ao guardar operador:', error);
      alert('Erro ao guardar operador.');
    }
  });
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
  form.estado.value = normalizeStatus(cells[5].textContent);

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

function openDuplicateZoneModal(message) {
  const modal = document.getElementById('duplicateZoneModal');
  const messageNode = document.getElementById('duplicateZoneMessage');
  if (!modal) return;
  if (messageNode) {
    messageNode.textContent = message || 'Erro: Esta zona já existe. Por favor, escolha um nome diferente.';
  }
  modal.hidden = false;
  modal.classList.add('is-open');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeDuplicateZoneModal() {
  const modal = document.getElementById('duplicateZoneModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.style.display = 'none';
  modal.hidden = true;
  document.body.style.overflow = '';
}

function hasDuplicateZoneName(tableBody, zoneName) {
  if (!tableBody) return false;
  const normalizedTarget = normalizeZoneName(zoneName);
  if (!normalizedTarget) return false;

  const existingNames = [...tableBody.querySelectorAll('tr td:first-child')]
    .map(cell => normalizeZoneName(cell.textContent));

  return existingNames.includes(normalizedTarget);
}

function setupZoneEditModal() {
  const tableBody = document.getElementById('zonesTableBody');
  const modal = document.getElementById('zoneEditModal');
  const duplicateModal = document.getElementById('duplicateZoneModal');
  const form = document.getElementById('zoneEditForm');
  const addZoneButton = document.getElementById('addZoneBtn');
  if (!tableBody || !modal || !form || !addZoneButton || !duplicateModal) return;
  if (tableBody.dataset.zoneEditBound === 'true') return;
  tableBody.dataset.zoneEditBound = 'true';

  modal.classList.remove('is-open');
  modal.style.display = 'none';
  modal.hidden = true;
  duplicateModal.classList.remove('is-open');
  duplicateModal.style.display = 'none';
  duplicateModal.hidden = true;

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

  duplicateModal.addEventListener('click', event => {
    if (event.target === duplicateModal || event.target.closest('[data-duplicate-close]')) {
      closeDuplicateZoneModal();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !duplicateModal.hidden) {
      closeDuplicateZoneModal();
      return;
    }

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
    const estado = normalizeStatus(form.estado.value);

    if (!nome) {
      alert('Preencha o nome/região da zona.');
      return;
    }

    if (modalMode === 'create') {
      if (hasDuplicateZoneName(tableBody, nome)) {
        openDuplicateZoneModal('Erro: Esta zona já existe. Por favor, escolha um nome diferente.');
        return;
      }

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
  const operatorsResponse = await authFetch('/operadores');
  const operators = await operatorsResponse.json().catch(() => []);

  const zonesResponse = await authFetch('/zonas');
  const zones = await zonesResponse.json();

  return {
    operators: Array.isArray(operators) ? operators : [],
    zones: Array.isArray(zones) ? zones : []
  };
}

function renderOperatorsTable({ operators }) {
  const tableBody = document.getElementById('operatorsTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '';

  operators.forEach(operator => {
    tableBody.appendChild(createOperatorTableRow(operator));
  });
}

function renderAdminTable({ zones }) {
  const tableBody = document.getElementById('zonesTableBody');
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
    renderOperatorsTable(data);
    renderAdminTable(data);
    setupOperatorManagement();
    setupZoneEditModal();
  } catch (error) {
    console.error('Error loading admin data:', error);
  }
});