async function includeComponents() {
  const placeholders = [...document.querySelectorAll("[data-include]")];
  const currentUser = getAuthenticatedUser();
  const userInitials = currentUser ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'AM';

  const adminMenuItems = isAdmin() ? `
      <a href="./admin.html" data-page-link="admin">Painel de Administração</a>` : '';

  const fallbackComponents = {
    "./components/sidebar.html": `
<nav class="sidebar">
  <a href="./dashboard.html" class="brand-link" aria-label="Ir para o Painel de Controlo">
    <div class="brand">
      <img src="/img/Glowpath.png" alt="Glowpath" class="brand-image" />
    </div>
  </a>
  <div>
    <div class="menu-label">Menu Principal</div>
    <div class="nav">
      <a href="./dashboard.html" data-page-link="dashboard">Painel de Controlo</a>
      <a href="./empresa.html" data-page-link="empresa">Empresa</a>
      <a href="./mapa.html" data-page-link="mapa">Mapa</a>${adminMenuItems}
    </div>
  </div>
  <div>
    <div class="menu-label">Conta</div>
    <div class="nav">
      <a href="./perfil.html" data-page-link="perfil">Definições</a>
      <a href="#" onclick="logout(); return false;">Sair</a>
    </div>
  </div>
</nav>`,
    "./components/topbar.html": `
<header class="topbar">
  <div>
    <h1 class="page-title">Painel de Controlo</h1>
    <p class="page-subtitle">Gerir a infraestrutura de rede, localizações e sensores.</p>
  </div>
  <div class="topbar-right">
    <a href="./perfil.html" class="avatar-link" aria-label="Abrir definições do perfil">
      <div class="avatar" title="${currentUser ? currentUser.email : 'Visitante'}">${userInitials}</div>
    </a>
  </div>
</header>`,
    "./components/footer.html": `
<footer class="footer">
  Glowpath • 2026
</footer>`
  };

  await Promise.all(
    placeholders.map(async (node) => {
      const path = node.getAttribute("data-include");
      if (!path) return;

      try {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`Falha ao carregar componente: ${path}`);
        }
        node.innerHTML = await response.text();
      } catch (error) {
        node.innerHTML = fallbackComponents[path] || `<p style="color:#c27878">Erro ao carregar componente.</p>`;
        console.error(error);
      }
    })
  );
}

function updateTopbarAvatar() {
  const avatar = document.querySelector('.topbar .avatar');
  if (!avatar) return;

  const currentUser = getAuthenticatedUser();
  if (!currentUser) {
    avatar.innerHTML = '<img src="../img/user.png" alt="Utilizador visitante" class="avatar-image">';
    avatar.setAttribute('title', 'Visitante');
    return;
  }

  const userInitials = currentUser.name
    .split(' ')
    .filter(Boolean)
    .map(namePart => namePart[0])
    .join('')
    .toUpperCase() || 'U';

  avatar.textContent = userInitials;
  avatar.setAttribute('title', currentUser.email || currentUser.name);
}

function applyPageState() {
  const page = document.body.dataset.page;
  if (!page) return;

  const activeLink = document.querySelector(`[data-page-link="${page}"]`);
  if (activeLink) activeLink.classList.add("active");

  const titleMap = {
    dashboard: ["Painel de Controlo", "Visão geral do sistema de iluminação pública"],
    empresa: ["Glowpath Engenharia", "Liderança em manutenção de infraestruturas urbanas inteligentes"],
    market: ["Glowpath Engenharia", "Liderança em manutenção de infraestruturas urbanas inteligentes"],
    mapa: ["Mapa", "Zonas e cobertura geolocalizada"],
    perfil: ["Definições", "Preferências e segurança da conta"],
    admin: ["Painel de Administração", "Gerir a infraestrutura de rede, localizações e sensores"]
  };

  const [title, subtitle] = titleMap[page] || ["Painel de Controlo", ""];
  const titleNode = document.querySelector(".page-title");
  const subtitleNode = document.querySelector(".page-subtitle");
  if (titleNode) titleNode.textContent = title;
  if (subtitleNode) subtitleNode.textContent = subtitle;
}

// Adicionar Painel de Administração ao menu lateral apenas para admins
function addAdminMenuItemIfNeeded() {
  if (isAdmin()) {
    const mainMenu = document.querySelector('.sidebar .nav');
    if (mainMenu && !mainMenu.querySelector('[data-page-link="admin"]')) {
      const adminLink = document.createElement('a');
      adminLink.href = './admin.html';
      adminLink.setAttribute('data-page-link', 'admin');
      adminLink.textContent = 'Painel de Administração';
      mainMenu.appendChild(adminLink);
    }
  }
}

function applyGuestNavigationState() {
  if (typeof isAuthenticated !== 'function' || isAuthenticated()) {
    return;
  }

  const profileLink = document.querySelector('[data-page-link="perfil"]');
  if (profileLink) {
    profileLink.remove();
  }

  const logoutLink = document.querySelector('.sidebar a[onclick*="logout"]');
  if (logoutLink) {
    logoutLink.removeAttribute('onclick');
    logoutLink.setAttribute('href', './login.html');
    logoutLink.textContent = 'Entrar';
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await includeComponents();
  updateTopbarAvatar();
  applyGuestNavigationState();
  addAdminMenuItemIfNeeded();
  hideAdminElements();
  applyPageState();
});
