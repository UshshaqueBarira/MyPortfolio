let activeApps = [];

async function initPortfolio() {
  const grid = document.getElementById("app-grid");
  const titleEl = document.getElementById("portfolio-title");
  const subtitleEl = document.getElementById("portfolio-subtitle");
  const countEl = document.getElementById("app-count");

  try {
    const response = await fetch("../config/apps.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const config = await response.json();

    titleEl.textContent = config.portfolio_title || "Deployed Applications";
    subtitleEl.textContent = config.portfolio_subtitle || "";

    activeApps = (config.apps || []).filter((app) => app.active !== false);
    countEl.textContent = `${activeApps.length} App${activeApps.length === 1 ? "" : "s"}`;

    renderCards(grid, activeApps);
    verifyAllEndpoints();
  } catch (err) {
    subtitleEl.textContent = "Failed to load configuration from config/apps.json.";
    console.error("Portfolio initialization failed:", err);
  }
}

function renderCards(container, apps) {
  container.innerHTML = "";
  apps.forEach((app) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div>
        <div class="card-top">
          <span class="tag">${app.category || "App"}</span>
          <span class="status">
            <span class="dot" id="dot-${app.id}"></span>
            <span id="status-${app.id}">Checking...</span>
          </span>
        </div>
        <h2>${app.title}</h2>
        <p>${app.description}</p>
      </div>
      <div class="card-actions">
        <a class="btn-link" href="${app.url}" target="_blank" rel="noopener">Launch App</a>
        ${app.repo ? `<a class="btn-repo" href="${app.repo}" target="_blank" rel="noopener">Code</a>` : ""}
      </div>
    `;
    container.appendChild(card);
  });
}

async function checkEndpoint(app) {
  const dot = document.getElementById(`dot-${app.id}`);
  const label = document.getElementById(`status-${app.id}`);
  if (!dot || !label) return;

  dot.className = "dot";
  label.textContent = "Checking...";

  try {
    await fetch(app.url, { mode: "no-cors", cache: "no-store" });
    dot.classList.add("reachable");
    label.textContent = "Reachable";
  } catch {
    dot.classList.add("unreachable");
    label.textContent = "Unreachable";
  }
}

function verifyAllEndpoints() {
  activeApps.forEach((app) => checkEndpoint(app));
}

document.getElementById("verify-btn").addEventListener("click", verifyAllEndpoints);
document.addEventListener("DOMContentLoaded", initPortfolio);
