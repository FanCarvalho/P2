async function includeComponents() {
  const placeholders = [...document.querySelectorAll("[data-include]")];
  const fallbackComponents = {
    "./components/sidebar.html": `
<nav class="sidebar">
  <div class="brand">
    <div class="brand-logo">GP</div>
    <div class="brand-name">Glowpath</div>
  </div>
  <div>
    <div class="menu-label">Main Menu</div>
    <div class="nav">
      <a href="./dashboard.html" data-page-link="dashboard">Dashboard</a>
      <a href="./market.html" data-page-link="market">Markets</a>
      <a href="./mapa.html" data-page-link="mapa">Map</a>
    </div>
  </div>
  <div>
    <div class="menu-label">Account</div>
    <div class="nav">
      <a href="./perfil.html" data-page-link="perfil">Settings</a>
      <a href="./login.html" data-page-link="login">Logout</a>
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
    <div class="avatar">AM</div>
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

function applyPageState() {
  const page = document.body.dataset.page;
  if (!page) return;

  const activeLink = document.querySelector(`[data-page-link="${page}"]`);
  if (activeLink) activeLink.classList.add("active");

  const titleMap = {
    dashboard: ["Dashboard", "Visao geral do portfolio"],
    market: ["Markets", "Cotacoes e volume de mercado em tempo real"],
    mapa: ["Map", "Parceiros e cobertura geolocalizada"],
    perfil: ["Settings", "Preferencias e seguranca da conta"]
  };

  const [title, subtitle] = titleMap[page] || ["Crypto Dashboard", ""];
  const titleNode = document.querySelector(".page-title");
  const subtitleNode = document.querySelector(".page-subtitle");
  if (titleNode) titleNode.textContent = title;
  if (subtitleNode) subtitleNode.textContent = subtitle;
}

document.addEventListener("DOMContentLoaded", async () => {
  await includeComponents();
  applyPageState();
});
