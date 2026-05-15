// Sistema de autenticação
const AUTH_STORAGE_KEY = 'glowpath_user';

// Usuários de teste (em produção, isso viria do backend)
const USERS_DATABASE = {
  'admin@glowpath.com': {
    password: 'admin123',
    type: 'admin',
    name: 'Administrador'
  },
  'user@glowpath.com': {
    password: 'user123',
    type: 'user',
    name: 'Usuário Normal'
  },
  'admin2@glowpath.com': {
    password: 'admin456',
    type: 'admin',
    name: 'Admin 2'
  }
};

// Fazer login
function login(email, password) {
  const user = USERS_DATABASE[email];
  
  if (!user) {
    return { success: false, message: 'Email ou senha incorretos' };
  }
  
  if (user.password !== password) {
    return { success: false, message: 'Email ou senha incorretos' };
  }
  
  // Guardar usuário autenticado no localStorage
  const userData = {
    email,
    type: user.type,
    name: user.name,
    loginTime: new Date().getTime()
  };
  
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
  return { success: true, user: userData };
}

// Fazer logout
function logout() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.location.href = './login.html';
}

// Obter usuário autenticado
function getAuthenticatedUser() {
  const userData = localStorage.getItem(AUTH_STORAGE_KEY);
  return userData ? JSON.parse(userData) : null;
}

// Verificar se está autenticado
function isAuthenticated() {
  return getAuthenticatedUser() !== null;
}

// Verificar se é admin
function isAdmin() {
  const user = getAuthenticatedUser();
  return user && user.type === 'admin';
}

// Verificar se é usuário normal
function isUser() {
  const user = getAuthenticatedUser();
  return user && user.type === 'user';
}

// Verificar autenticação e redirecionar se necessário
function checkAuthentication() {
  const user = getAuthenticatedUser();
  const currentPage = document.body.dataset.page;
  
  if (!user) {
    // Se não está autenticado, redireciona para login
    if (!window.location.pathname.includes('login.html')) {
      window.location.href = './login.html';
    }
    return false;
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
