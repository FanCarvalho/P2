// Filtros de pesquisa usados pelas listas da API.
function matchesLampFilter(lamp, query) {
  if (query.id_poste !== undefined && Number(lamp.id_poste) !== Number(query.id_poste)) return false;
  return true;
}

function matchesPostFilter(post, query) {
  if (query.id_zona !== undefined && Number(post.id_zona) !== Number(query.id_zona)) return false;
  if (query.id_perfil !== undefined && Number(post.id_perfil) !== Number(query.id_perfil)) return false;
  if (query.estado !== undefined && String(post.estado).toLowerCase() !== String(query.estado).toLowerCase()) return false;
  return true;
}

function matchesSensorFilter(sensor, query) {
  if (query.estado !== undefined && String(sensor.estado).toLowerCase() !== String(query.estado).toLowerCase()) return false;
  return true;
}

function matchesZoneFilter(zone, query) {
  if (query.nome !== undefined && !String(zone.nome).toLowerCase().includes(String(query.nome).toLowerCase())) return false;
  if (query.codigo_postal !== undefined && String(zone.codigo_postal).toLowerCase() !== String(query.codigo_postal).toLowerCase()) return false;
  if (query.id_sensor !== undefined && Number(zone.id_sensor) !== Number(query.id_sensor)) return false;
  return true;
}

function matchesProfileFilter(profile, query) {
  if (query.nome !== undefined && !String(profile.nome).toLowerCase().includes(String(query.nome).toLowerCase())) return false;
  if (query.intensidade !== undefined && Number(profile.intensidade) !== Number(query.intensidade)) return false;
  return true;
}

function matchesOperatorFilter(operator, query) {
  if (query.nome !== undefined && !String(operator.nome).toLowerCase().includes(String(query.nome).toLowerCase())) return false;
  if (query.nivel_acesso !== undefined && String(operator.nivel_acesso).toLowerCase() !== String(query.nivel_acesso).toLowerCase()) return false;
  if (query.ativo !== undefined && String(operator.ativo).toLowerCase() !== String(query.ativo).toLowerCase()) return false;
  return true;
}

function matchesMaintenanceFilter(item, query) {
  if (query.estado !== undefined && String(item.estado).toLowerCase() !== String(query.estado).toLowerCase()) return false;
  if (query.prioridade !== undefined && String(item.prioridade).toLowerCase() !== String(query.prioridade).toLowerCase()) return false;
  if (query.id_poste !== undefined && Number(item.id_poste || 0) !== Number(query.id_poste)) return false;
  if (query.id_lampada !== undefined && Number(item.id_lampada || 0) !== Number(query.id_lampada)) return false;
  if (query.id_zona !== undefined && Number(item.id_zona || 0) !== Number(query.id_zona)) return false;
  return true;
}

function matchesFaultFilter(item, query) {
  if (query.estado !== undefined && String(item.estado).toLowerCase() !== String(query.estado).toLowerCase()) return false;
  if (query.severidade !== undefined && String(item.severidade).toLowerCase() !== String(query.severidade).toLowerCase()) return false;
  if (query.id_poste !== undefined && Number(item.id_poste || 0) !== Number(query.id_poste)) return false;
  if (query.id_lampada !== undefined && Number(item.id_lampada || 0) !== Number(query.id_lampada)) return false;
  if (query.id_zona !== undefined && Number(item.id_zona || 0) !== Number(query.id_zona)) return false;
  return true;
}

module.exports = {
  matchesFaultFilter,
  matchesLampFilter,
  matchesMaintenanceFilter,
  matchesOperatorFilter,
  matchesPostFilter,
  matchesProfileFilter,
  matchesSensorFilter,
  matchesZoneFilter
};
