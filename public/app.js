const state = {
  products: [],
  selectedProductId: null
};

const heroStats = document.getElementById("heroStats");
const productsGrid = document.getElementById("productsGrid");
const productSelect = document.getElementById("productSelect");
const auditView = document.getElementById("auditView");
const feedback = document.getElementById("feedback");
const registerForm = document.getElementById("registerForm");
const actionForm = document.getElementById("actionForm");

function showFeedback(message, type = "") {
  feedback.textContent = message;
  feedback.className = `feedback ${type}`.trim();
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "So'rov bajarilmadi");
  }
  return data;
}

function relativeTime(timestamp) {
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s oldin`;
  }
  if (deltaSeconds < 3600) {
    return `${Math.floor(deltaSeconds / 60)} min oldin`;
  }
  if (deltaSeconds < 86400) {
    return `${Math.floor(deltaSeconds / 3600)} soat oldin`;
  }
  return `${Math.floor(deltaSeconds / 86400)} kun oldin`;
}

function renderHero(chain, products) {
  const inTransit = products.filter((product) => product.status === "In Transit").length;
  const delivered = products.filter((product) => product.status === "Delivered").length;
  const verified = products.length;

  heroStats.innerHTML = `
    <div class="metric">
      <div class="eyebrow">Chain blocks</div>
      <div class="metric-value">${chain.totalBlocks}</div>
      <div class="metric-label">Immutable tranzaksiya yozuvlari</div>
    </div>
    <div class="metric">
      <div class="eyebrow">Products</div>
      <div class="metric-value">${products.length}</div>
      <div class="metric-label">Aktiv kuzatilayotgan mahsulotlar</div>
    </div>
    <div class="metric">
      <div class="eyebrow">In transit</div>
      <div class="metric-value">${inTransit}</div>
      <div class="metric-label">Yo'lda bo'lgan jo'natmalar</div>
    </div>
    <div class="metric">
      <div class="eyebrow">Delivered</div>
      <div class="metric-value">${delivered}</div>
      <div class="metric-label">Yakunlangan yetkazib berishlar</div>
    </div>
    <div class="metric">
      <div class="eyebrow">Verified</div>
      <div class="metric-value">${verified}</div>
      <div class="metric-label">Haqiqiyligi tekshiriladigan aktivlar</div>
    </div>
  `;
}

function renderProductOptions(products) {
  const currentValue = state.selectedProductId || products[0]?.productId || "";
  productSelect.innerHTML = products
    .map(
      (product) =>
        `<option value="${product.productId}">${product.productId} - ${product.name}</option>`
    )
    .join("");

  productSelect.value = products.find((item) => item.productId === currentValue)
    ? currentValue
    : products[0]?.productId || "";

  state.selectedProductId = productSelect.value || null;
}

function renderProducts(products) {
  productsGrid.innerHTML = products
    .map(
      (product) => `
      <article class="product-card">
        <div class="eyebrow">${product.productId}</div>
        <h3>${product.name}</h3>
        <div class="status-pill"><span class="status-dot"></span>${product.status}</div>
        <div class="meta">
          <div><strong>Joriy egasi:</strong> ${product.currentOwner}</div>
          <div><strong>Lokatsiya:</strong> ${product.currentLocation}</div>
          <div><strong>Ishlab chiqaruvchi:</strong> ${product.manufacturer}</div>
          <div><strong>Oxirgi scan:</strong> ${relativeTime(product.lastScanAt)}</div>
        </div>
        <div class="card-actions">
          <button class="secondary" data-audit="${product.productId}">Audit</button>
          <button class="primary" data-verify="${product.productId}">Verify</button>
        </div>
      </article>
    `
    )
    .join("");
}

function renderAudit(report) {
  const { product, verification, checkpoints, blocks } = report;
  auditView.className = "audit-report";
  auditView.innerHTML = `
    <div class="audit-top">
      <div class="audit-box">
        <div class="eyebrow">Product</div>
        <h3>${product.name}</h3>
        <div>${product.productId}</div>
      </div>
      <div class="audit-box">
        <div class="eyebrow">Authenticity</div>
        <h3>${verification.isAuthentic ? "Verified" : "Invalid"}</h3>
        <div>Chain: ${verification.isChainValid ? "Valid" : "Broken"}</div>
      </div>
      <div class="audit-box">
        <div class="eyebrow">Owner</div>
        <h3>${product.currentOwner}</h3>
        <div>${product.currentLocation}</div>
      </div>
      <div class="audit-box">
        <div class="eyebrow">Blocks</div>
        <h3>${blocks.length}</h3>
        <div>Ledger yozuvlari</div>
      </div>
    </div>
    <div class="audit-box">
      <div class="eyebrow">Authenticity Signature</div>
      <div>${product.authenticitySignature}</div>
    </div>
    <div class="timeline">
      ${checkpoints
        .map(
          (item) => `
            <div class="timeline-item">
              <strong>${item.action}</strong>
              <div>${new Date(item.timestamp).toLocaleString()}</div>
              <div>${item.actor} | ${item.location}</div>
              <div>Status: ${item.status}</div>
              <div>${item.note || ""}</div>
              ${item.from ? `<div>Transfer: ${item.from} -> ${item.to}</div>` : ""}
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

async function loadDashboard() {
  const data = await apiFetch("/api/dashboard");
  state.products = data.products;
  renderHero(data.chain, data.products);
  renderProductOptions(data.products);
  renderProducts(data.products);
}

async function loadAudit(productId) {
  const report = await apiFetch(`/api/products/${productId}/audit`);
  renderAudit(report);
  state.selectedProductId = productId;
  productSelect.value = productId;
}

async function verifyProduct(productId) {
  const result = await apiFetch(`/api/products/${productId}/verify`, {
    method: "POST",
    body: JSON.stringify({})
  });
  showFeedback(
    result.isAuthentic
      ? `Mahsulot haqiqiy. Signature: ${result.authenticitySignature}`
      : "Mahsulotning haqiqiyligi tasdiqlanmadi",
    result.isAuthentic ? "success" : "error"
  );
  await loadAudit(productId);
}

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const result = await apiFetch("/api/products", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    registerForm.reset();
    showFeedback(`Yangi mahsulot yaratildi: ${result.product.productId}`, "success");
    await loadDashboard();
    await loadAudit(result.product.productId);
  } catch (error) {
    showFeedback(error.message, "error");
  }
});

actionForm.addEventListener("click", async (event) => {
  const action = event.target.dataset.action;
  if (!action) {
    return;
  }

  const formData = new FormData(actionForm);
  const payload = Object.fromEntries(formData.entries());
  const productId = payload.productId;

  try {
    if (!productId) {
      throw new Error("Mahsulot tanlanmagan");
    }

    if (action === "location") {
      await apiFetch(`/api/products/${productId}/location`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showFeedback("Lokatsiya muvaffaqiyatli yangilandi", "success");
    }

    if (action === "status") {
      await apiFetch(`/api/products/${productId}/status`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showFeedback("Yetkazib berish holati yangilandi", "success");
    }

    if (action === "transfer") {
      await apiFetch(`/api/products/${productId}/transfer`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showFeedback("Mahsulot egasi muvaffaqiyatli o'zgartirildi", "success");
    }

    if (action === "verify") {
      await verifyProduct(productId);
      return;
    }

    await loadDashboard();
    await loadAudit(productId);
  } catch (error) {
    showFeedback(error.message, "error");
  }
});

productSelect.addEventListener("change", (event) => {
  state.selectedProductId = event.target.value;
});

document.getElementById("refreshDashboard").addEventListener("click", async () => {
  try {
    await loadDashboard();
    if (state.selectedProductId) {
      await loadAudit(state.selectedProductId);
    }
    showFeedback("Dashboard yangilandi", "success");
  } catch (error) {
    showFeedback(error.message, "error");
  }
});

document.getElementById("openRegister").addEventListener("click", () => {
  document.getElementById("registerSection").scrollIntoView({ behavior: "smooth" });
});

productsGrid.addEventListener("click", async (event) => {
  const auditId = event.target.dataset.audit;
  const verifyId = event.target.dataset.verify;

  try {
    if (auditId) {
      await loadAudit(auditId);
      return;
    }
    if (verifyId) {
      await verifyProduct(verifyId);
    }
  } catch (error) {
    showFeedback(error.message, "error");
  }
});

setInterval(async () => {
  try {
    await loadDashboard();
    if (state.selectedProductId) {
      await loadAudit(state.selectedProductId);
    }
  } catch (error) {
    console.error(error);
  }
}, 5000);

loadDashboard()
  .then(() => {
    if (state.products[0]) {
      return loadAudit(state.products[0].productId);
    }
    return null;
  })
  .catch((error) => {
    showFeedback(error.message, "error");
  });
