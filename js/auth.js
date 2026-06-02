// Sistema de autenticação
const AUTH_STORAGE_KEY = 'glowpath_auth';
const DEFAULT_API_BASE_URL = window.API_BASE_URL || (window.location.port === '5500' ? 'http://127.0.0.1:3000' : '');

function buildApiUrl(path) {
  if (!path) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (!DEFAULT_API_BASE_URL) {
    return path;
  }
  const separator = path.startsWith('/') ? '' : '/';
  return `${DEFAULT_API_BASE_URL}${separator}${path}`;
}

function buildAuthErrorMessage(payload) {
  const errors = payload && payload.errors ? payload.errors : null;
  if (errors && errors.credentials && errors.credentials.length) {
    return errors.credentials[0];
  }
  if (errors && errors.email && errors.email.length) {
    return errors.email[0];
  }
  if (errors && errors.password && errors.password.length) {
    return errors.password[0];
  }
  return payload && payload.description ? payload.description : 'Email ou senha incorretos';
}

function setAuthSession(session) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function getAuthSession() {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}

function normalizeOperator(operator, fallbackEmail = '') {
  if (!operator) return null;
  return {
    id_operador: operator.id_operador,
    name: operator.nome || operator.name || 'Utilizador',
    email: operator.email || fallbackEmail,
    nivel_acesso: operator.nivel_acesso || ''
  };
}

function updateSessionUser(operator, fallbackEmail = '') {
  const session = getAuthSession();
  if (!session) return;

  const normalized = normalizeOperator(operator, fallbackEmail);
  if (!normalized) return;

  session.user = normalized;
  setAuthSession(session);
}

// Fazer login
async function login(email, password) {
  const response = await fetch(buildApiUrl('/operadores/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { success: false, message: buildAuthErrorMessage(payload) };
  }

  const operator = payload.operator || {};
  const session = {
    accessToken: payload.accessToken,
    user: normalizeOperator(operator, email),
    loginTime: new Date().getTime()
  };

  setAuthSession(session);
  return { success: true, user: session.user };
}

// Fazer logout
function logout() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.location.href = './login.html';
}

// Obter usuário autenticado
function getAuthenticatedUser() {
  const session = getAuthSession();
  return session ? session.user : null;
}

function getAccessToken() {
  const session = getAuthSession();
  return session ? session.accessToken : null;
}

// Verificar se está autenticado
function isAuthenticated() {
  return getAuthenticatedUser() !== null;
}

// Verificar se é admin
function isAdmin() {
  const user = getAuthenticatedUser();
  return user && String(user.nivel_acesso).toLowerCase() === 'administrador';
}

// Verificar se é usuário normal
function isUser() {
  const user = getAuthenticatedUser();
  return user && String(user.nivel_acesso).toLowerCase() !== 'administrador';
}

async function ensureAuthenticated() {
  const token = getAccessToken();
  if (!token) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = './login.html';
    return false;
  }

  try {
    const response = await authFetch('/api/me');
    if (!response.ok) {
      throw new Error('Unauthorized');
    }

    const payload = await response.json().catch(() => ({}));
    if (payload && payload.operator) {
      updateSessionUser(payload.operator, getAuthenticatedUser()?.email || '');
    }
    return true;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = './login.html';
    return false;
  }
}

// Fetch helper para chamadas autenticadas
async function authFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildApiUrl(url), { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    if (!window.location.pathname.includes('login.html')) {
      window.location.href = './login.html';
    }
    throw new Error('Unauthorized');
  }

  if (response.status >= 500) {
    console.error('Server error', response.status, response.statusText);
    throw new Error('Server error');
  }

  return response;
}

// Verificar autenticação e redirecionar se necessário
async function checkAuthentication() {
  const currentPage = document.body.dataset.page;
  const isLogin = window.location.pathname.includes('login.html');

  if (!isLogin) {
    const ok = await ensureAuthenticated();
    if (!ok) return false;
  }

  // Verificar se está a tentar aceder à página de admin sem permissões
  if (currentPage === 'admin' && !isAdmin()) {
    window.location.href = './dashboard.html';
    return false;
  }

  return true;
}

// Esconder elementos de admin se o utilizador for user
function hideAdminElements() {
  if (isUser()) {
    // Esconder todos os elementos com classe 'admin-only'
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
      el.style.display = 'none';
    });

    // Ajustar o layout do gráfico para ocupar toda a largura
    const chartsSection = document.getElementById('chartsSection');
    if (chartsSection) {
      chartsSection.style.gridTemplateColumns = '1fr';
    }
  }
}

// Executar verificação de autenticação ao carregar a página
document.addEventListener('DOMContentLoaded', function() {
  const currentPage = document.body.dataset.page;
  
  // Login page é acessível sem autenticação
  if (currentPage !== 'login') {
    checkAuthentication();
  }
});
