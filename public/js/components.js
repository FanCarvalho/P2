async function includeComponents() {
  const placeholders = [...document.querySelectorAll("[data-include]")];
  const currentUser = getAuthenticatedUser();
  const userInitials = currentUser ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'AM';
  
  const adminMenuItems = isAdmin() ? `
      <a href="./admin.html" data-page-link="admin">Admin Panel</a>` : '';
  
  const fallbackComponents = {
    "./components/sidebar.html": `
<nav class="sidebar">
  <div class="brand">
    <img src="../img/Glowpath.png" alt="Glowpath" class="brand-image" />
  </div>
  <div>
    <div class="menu-label">Main Menu</div>
    <div class="nav">
      <a href="./dashboard.html" data-page-link="dashboard">Dashboard</a>
      <a href="./market.html" data-page-link="market">Markets</a>
      <a href="./mapa.html" data-page-link="mapa">Map</a>${adminMenuItems}
    </div>
  </div>
  <div>
    <div class="menu-label">Account</div>
    <div class="nav">
      <a href="./perfil.html" data-page-link="perfil">Settings</a>
      <a href="#" onclick="logout(); return false;">Logout</a>
    </div>
  </div>
</nav>`,
    "./components/topbar.html": `
<header class="topbar">
  <div>
    <h1 class="page-title">Crypto Dashboard</h1>
    <p class="page-subtitle">Acompanhe portfolio, mercados e configuracoes.</p>
  </div>
  <div class="topbar-right">
    <input class="search" type="search" placeholder="Search..." aria-label="Search" />
    <div class="avatar" title="${currentUser ? currentUser.email : 'Usuário'}">${userInitials}</div>
  </div>
</header>`,
    "./components/footer.html": `
<footer class="footer">
  Copyright 2026 CryptoVault. UI refatorada para estrutura modular HTML + CSS.
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
    avatar.innerHTML = '<img src="../img/user.png" alt="Guest user" class="avatar-image">';
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
    dashboard: ["Dashboard", "Visao geral do portfolio"],
    market: ["Glowpath Engenharia", "Promocao da empresa e sede principal no Porto"],
    mapa: ["Map", "Parceiros e cobertura geolocalizada"],
    perfil: ["Settings", "Preferencias e seguranca da conta"],
    admin: ["Admin Panel", "Gerenciar a infraestrutura de rede"]
  };

  const [title, subtitle] = titleMap[page] || ["Crypto Dashboard", ""];
  const titleNode = document.querySelector(".page-title");
  const subtitleNode = document.querySelector(".page-subtitle");
  if (titleNode) titleNode.textContent = title;
  if (subtitleNode) subtitleNode.textContent = subtitle;
}

// Adicionar Admin Panel ao menu lateral apenas para admins
function addAdminMenuItemIfNeeded() {
  if (isAdmin()) {
    const mainMenu = document.querySelector('.sidebar .nav');
    if (mainMenu && !mainMenu.querySelector('[data-page-link="admin"]')) {
      const adminLink = document.createElement('a');
      adminLink.href = './admin.html';
      adminLink.setAttribute('data-page-link', 'admin');
      adminLink.textContent = 'Admin Panel';
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
    logoutLink.textContent = 'Login';
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
