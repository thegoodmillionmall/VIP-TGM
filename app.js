const STORAGE_KEY = "tgm_vip_portal_v2";
const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin123";
const now = new Date();
const daysAgo = (days) => new Date(now.getTime() - days * 86400000).toISOString();
const APP_CONFIG = window.TGM_CONFIG || {};
const supabaseReady = Boolean(APP_CONFIG.supabaseUrl && APP_CONFIG.supabaseAnonKey && window.supabase);
const supabaseClient = supabaseReady ? window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey) : null;
let isRemoteLoading = false;
let isRemoteSaving = false;

const defaultState = {
  products: [
    { id: "p-skincare", name: "The Good Million Skincare Set", code: "TGM-SKIN", active: true },
    { id: "p-serum", name: "Glow Serum", code: "TGM-GLOW", active: true },
    { id: "p-new", name: "สินค้าใหม่รอบ VIP", code: "VIP-NEW", active: true }
  ],
  users: [
    {
      id: "u-owner",
      displayName: "Admin The Good Million",
      username: DEFAULT_ADMIN_USERNAME,
      password: DEFAULT_ADMIN_PASSWORD,
      role: "owner",
      active: true
    }
  ],
  requests: [
    {
      id: "vip-demo-1",
      customerName: "คุณมินตรา ทดสอบ",
      phone: "0812345678",
      address: "88/8 ซอยตัวอย่าง แขวงบางนา เขตบางนา กรุงเทพฯ 10260",
      lineId: "mint.vip",
      tiktokLink: "https://www.tiktok.com/@mintvip",
      facebookName: "Mintra VIP",
      customerNote: "สะดวกรับช่วงบ่าย",
      status: "pending",
      shippedCount: 0,
      items: [
        { id: "item-demo-1", productId: "p-serum", productName: "Glow Serum", quantity: 2, note: "รอบทดลอง" }
      ],
      submittedAt: daysAgo(1),
      updatedAt: daysAgo(1)
    },
    {
      id: "vip-demo-2",
      customerName: "คุณณัฐพล รีวิว",
      phone: "0895552244",
      address: "55 ถนนรีวิว ตำบลตลาด อำเภอเมือง เชียงใหม่ 50000",
      lineId: "nut.review",
      tiktokLink: "https://www.tiktok.com/@nutreview",
      facebookName: "Nut Review",
      customerNote: "ขอสินค้าใช้ทำคอนเทนต์",
      status: "approved",
      shippedCount: 0,
      items: [
        { id: "item-demo-2", productId: "p-skincare", productName: "The Good Million Skincare Set", quantity: 1, note: "คอนเทนต์หลัก" },
        { id: "item-demo-3", productId: "p-new", productName: "สินค้าใหม่รอบ VIP", quantity: 1, note: "เปิดตัว" }
      ],
      submittedAt: daysAgo(4),
      updatedAt: daysAgo(3)
    },
    {
      id: "vip-demo-3",
      customerName: "คุณแพรวา ไลฟ์สด",
      phone: "0861117788",
      address: "12/4 หมู่บ้านตัวอย่าง อำเภอเมือง ขอนแก่น 40000",
      lineId: "praewa.live",
      tiktokLink: "https://www.tiktok.com/@praewalive",
      facebookName: "Praewa Live",
      customerNote: "มีไลฟ์วันศุกร์",
      status: "shipped",
      shippedCount: 2,
      items: [
        { id: "item-demo-4", productId: "p-serum", productName: "Glow Serum", quantity: 3, note: "เติมของ" }
      ],
      submittedAt: daysAgo(9),
      updatedAt: daysAgo(2)
    }
  ]
};

let state = loadState();
let currentFilter = "all";
let selectedProductFilters = new Set();
let isAdminLoggedIn = false;

const statusLabel = {
  pending: "รออนุมัติ",
  approved: "รอจัดส่ง",
  rejected: "เสร็จสิ้น",
  shipped: "เสร็จสิ้น"
};

const statusSubLabel = {
  pending: "รอตรวจสอบจากแอดมิน",
  approved: "อนุมัติแล้ว รอจัดส่งสินค้า",
  rejected: "ปิดรายการ: ไม่อนุมัติ",
  shipped: "ปิดรายการ: จัดส่งแล้ว"
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);

  try {
    return normalizeState({ ...structuredClone(defaultState), ...JSON.parse(saved) });
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizeState(nextState) {
  nextState.users = (nextState.users || []).map((user, index) => ({
    ...user,
    username: user.username || (index === 0 ? DEFAULT_ADMIN_USERNAME : user.email || ""),
    password: user.password || (index === 0 ? DEFAULT_ADMIN_PASSWORD : ""),
    email: user.email || ""
  }));
  nextState.requests = (nextState.requests || []).map((request) => ({
    ...request,
    items: request.items || []
  }));
  if (!nextState.requests.some((request) => request.id.startsWith("vip-demo-"))) {
    nextState.requests = [...structuredClone(defaultState.requests), ...nextState.requests];
  }
  return nextState;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueRemoteSave();
}

function queueRemoteSave() {
  if (!supabaseClient || isRemoteLoading || isRemoteSaving) return;
  isRemoteSaving = true;
  syncStateToSupabase()
    .catch((error) => console.warn("Supabase sync failed", error))
    .finally(() => {
      isRemoteSaving = false;
    });
}

async function initSupabaseState() {
  if (!supabaseClient) return;
  isRemoteLoading = true;
  try {
    const remoteState = await loadStateFromSupabase();
    if (remoteState.requests.length || remoteState.products.length || remoteState.users.length) {
      state = normalizeState({ ...structuredClone(defaultState), ...remoteState });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      await syncStateToSupabase();
    }
    renderAll();
  } catch (error) {
    console.warn("Supabase load failed", error);
  } finally {
    isRemoteLoading = false;
  }
}

async function loadStateFromSupabase() {
  const [productsResult, usersResult, requestsResult, itemsResult] = await Promise.all([
    supabaseClient.from("products").select("*").order("created_at", { ascending: true }),
    supabaseClient.from("admin_users").select("*").order("created_at", { ascending: true }),
    supabaseClient.from("vip_requests").select("*").order("submitted_at", { ascending: false }),
    supabaseClient.from("vip_request_items").select("*")
  ]);

  [productsResult, usersResult, requestsResult, itemsResult].forEach((result) => {
    if (result.error) throw result.error;
  });

  const itemsByRequest = new Map();
  (itemsResult.data || []).forEach((item) => {
    const list = itemsByRequest.get(item.request_id) || [];
    list.push({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      note: item.note || ""
    });
    itemsByRequest.set(item.request_id, list);
  });

  return {
    products: (productsResult.data || []).map((product) => ({
      id: product.id,
      name: product.name,
      code: product.code || "",
      active: product.active
    })),
    users: (usersResult.data || []).map((user) => ({
      id: user.id,
      displayName: user.display_name,
      username: user.username,
      password: user.password,
      role: user.role,
      active: user.active
    })),
    requests: (requestsResult.data || []).map((request) => ({
      id: request.id,
      customerName: request.customer_name,
      phone: request.phone,
      address: request.address,
      lineId: request.line_id,
      tiktokLink: request.tiktok_link,
      facebookName: request.facebook_name,
      customerNote: request.customer_note || "",
      status: request.status,
      shippedCount: request.shipped_count || 0,
      items: itemsByRequest.get(request.id) || [],
      submittedAt: request.submitted_at,
      updatedAt: request.updated_at
    }))
  };
}

async function syncStateToSupabase() {
  if (!supabaseClient) return;

  const products = state.products.map((product) => ({
    id: product.id,
    name: product.name,
    code: product.code || "",
    active: product.active
  }));
  const users = state.users.map((user) => ({
    id: user.id,
    display_name: user.displayName,
    username: user.username,
    password: user.password,
    role: user.role,
    active: user.active
  }));
  const requests = state.requests.map((request) => ({
    id: request.id,
    customer_name: request.customerName,
    phone: request.phone,
    address: request.address,
    line_id: request.lineId,
    tiktok_link: request.tiktokLink,
    facebook_name: request.facebookName,
    customer_note: request.customerNote || "",
    status: request.status,
    shipped_count: request.shippedCount || 0,
    submitted_at: request.submittedAt,
    updated_at: request.updatedAt
  }));
  const items = state.requests.flatMap((request) =>
    request.items.map((item) => ({
      id: item.id,
      request_id: request.id,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      note: item.note || ""
    }))
  );

  const operations = [
    products.length ? supabaseClient.from("products").upsert(products) : null,
    users.length ? supabaseClient.from("admin_users").upsert(users) : null,
    requests.length ? supabaseClient.from("vip_requests").upsert(requests) : null
  ].filter(Boolean);

  const results = await Promise.all(operations);
  results.forEach((result) => {
    if (result.error) throw result.error;
  });

  const existingItems = await supabaseClient.from("vip_request_items").select("id");
  if (existingItems.error) throw existingItems.error;
  const currentItemIds = new Set(items.map((item) => item.id));
  const staleItemIds = (existingItems.data || []).map((item) => item.id).filter((id) => !currentItemIds.has(id));

  if (staleItemIds.length) {
    const deleteResult = await supabaseClient.from("vip_request_items").delete().in("id", staleItemIds);
    if (deleteResult.error) throw deleteResult.error;
  }

  if (items.length) {
    const itemResult = await supabaseClient.from("vip_request_items").upsert(items);
    if (itemResult.error) throw itemResult.error;
  }
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function activeProducts() {
  return state.products.filter((product) => product.active);
}

function showView(viewName) {
  $$(".view").forEach((view) => view.classList.remove("active"));
  $(`#${viewName}-view`).classList.add("active");
  renderAll();
}

function showAdminSection(sectionName) {
  $$(".admin-section").forEach((section) => section.classList.remove("active"));
  $(`#${sectionName}-section`).classList.add("active");
  $$(".admin-tab[data-admin-view]").forEach((tab) => tab.classList.toggle("active", tab.dataset.adminView === sectionName));
  renderAll();
}

function openLoginDialog() {
  if (isAdminLoggedIn) {
    showView("admin");
    return;
  }
  $("#login-message").textContent = "";
  $("#admin-username").value = "";
  $("#admin-password").value = "";
  $("#login-dialog").showModal();
  $("#admin-username").focus();
}

function handleLogin(event) {
  event.preventDefault();
  const username = $("#admin-username").value.trim();
  const password = $("#admin-password").value;
  const user = state.users.find((item) => item.active && item.username === username && item.password === password);

  if (user) {
    isAdminLoggedIn = true;
    $("#login-dialog").close();
    showView("admin");
    return;
  }
  $("#login-message").textContent = "User หรือ Password ไม่ถูกต้อง";
}

function logoutAdmin() {
  isAdminLoggedIn = false;
  showView("form");
}

function handleVipSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  state.requests.unshift({
    id: createId("vip"),
    customerName: formData.get("customerName").trim(),
    phone: formData.get("phone").trim(),
    address: formData.get("address").trim(),
    lineId: formData.get("lineId").trim(),
    tiktokLink: formData.get("tiktokLink").trim(),
    facebookName: formData.get("facebookName").trim(),
    customerNote: formData.get("customerNote").trim(),
    status: "pending",
    shippedCount: 0,
    items: [],
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  saveState();
  form.reset();
  $("#success-dialog").showModal();
  renderAll();
}

function setRequestStatus(id, status) {
  const request = state.requests.find((item) => item.id === id);
  if (!request) return;
  request.status = status;
  if (status === "rejected") request.shippedCount = 0;
  request.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
}

function openEditDialog(id) {
  const request = state.requests.find((item) => item.id === id);
  if (!request) return;

  const form = $("#edit-request-form");
  form.elements.requestId.value = request.id;
  form.elements.customerName.value = request.customerName;
  form.elements.phone.value = request.phone;
  form.elements.lineId.value = request.lineId;
  form.elements.facebookName.value = request.facebookName;
  form.elements.tiktokLink.value = request.tiktokLink;
  form.elements.address.value = request.address;
  form.elements.status.value = request.status;
  form.elements.shippedCount.value = request.shippedCount;
  form.elements.customerNote.value = request.customerNote || "";
  $("#edit-dialog").showModal();
}

function handleEditSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const request = state.requests.find((item) => item.id === data.get("requestId"));
  if (!request) return;

  request.customerName = data.get("customerName").trim();
  request.phone = data.get("phone").trim();
  request.lineId = data.get("lineId").trim();
  request.facebookName = data.get("facebookName").trim();
  request.tiktokLink = data.get("tiktokLink").trim();
  request.address = data.get("address").trim();
  request.status = data.get("status");
  request.shippedCount = Math.max(0, Number(data.get("shippedCount") || 0));
  request.customerNote = data.get("customerNote").trim();
  request.updatedAt = new Date().toISOString();

  saveState();
  $("#edit-dialog").close();
  renderAll();
}

function updateShippedCount(id, count) {
  const request = state.requests.find((item) => item.id === id);
  if (!request) return;
  request.shippedCount = Math.max(0, Number(count || 0));
  request.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
}

function markShipped(id, count) {
  const request = state.requests.find((item) => item.id === id);
  if (!request) return;
  request.shippedCount = Math.max(1, Number(count || request.shippedCount || 1));
  request.status = "shipped";
  request.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
}

function addProductToRequest(id, form) {
  const request = state.requests.find((item) => item.id === id);
  if (!request) return;

  const data = new FormData(form);
  const product = state.products.find((item) => item.id === data.get("productId"));
  request.items.push({
    id: createId("item"),
    productId: product?.id || "",
    productName: product?.name || "ไม่พบสินค้า",
    quantity: Number(data.get("quantity") || 1),
    note: data.get("itemNote").trim()
  });
  request.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
}

function removeProductFromRequest(requestId, itemId) {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request) return;
  request.items = request.items.filter((item) => item.id !== itemId);
  request.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
}

function renderStats() {
  const doneCount = state.requests.filter((item) => item.status === "shipped" || item.status === "rejected").length;
  const stats = [
    ["ทั้งหมด", state.requests.length],
    ["รออนุมัติ", state.requests.filter((item) => item.status === "pending").length],
    ["รอจัดส่ง", state.requests.filter((item) => item.status === "approved").length],
    ["เสร็จสิ้น", doneCount]
  ];

  $("#stats-grid").innerHTML = stats
    .map(([label, value]) => `<div class="stat-card"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderRecords() {
  const records = getFilteredRequests();

  const list = $("#records-list");
  if (!records.length) {
    list.innerHTML = `<div class="empty-state">ยังไม่มีข้อมูลในเงื่อนไขนี้</div>`;
    return;
  }

  list.innerHTML = records.map(recordTemplate).join("");
  $$(".approve-action", list).forEach((button) => button.addEventListener("click", () => setRequestStatus(button.dataset.id, "approved")));
  $$(".reject-action", list).forEach((button) => button.addEventListener("click", () => setRequestStatus(button.dataset.id, "rejected")));
  $$(".edit-action", list).forEach((button) => button.addEventListener("click", () => openEditDialog(button.dataset.id)));
  $$(".mark-shipped-action", list).forEach((button) => {
    button.addEventListener("click", () => {
      const input = $(`.ship-input[data-id="${button.dataset.id}"]`, list);
      markShipped(button.dataset.id, input?.value || 1);
    });
  });
  $$(".ship-input", list).forEach((input) => input.addEventListener("change", () => updateShippedCount(input.dataset.id, input.value)));
  $$(".save-ship", list).forEach((button) => {
    button.addEventListener("click", () => {
      const input = $(`.ship-input[data-id="${button.dataset.id}"]`, list);
      updateShippedCount(button.dataset.id, input?.value || 0);
    });
  });
  $$(".remove-item", list).forEach((button) => {
    button.addEventListener("click", () => removeProductFromRequest(button.dataset.requestId, button.dataset.itemId));
  });
  $$(".assign-product-form", list).forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      addProductToRequest(form.dataset.requestId, form);
    });
  });
}

function getFilteredRequests() {
  const keyword = $("#search-input")?.value.trim().toLowerCase() || "";
  const dateFrom = $("#date-from")?.value || "";
  const dateTo = $("#date-to")?.value || "";

  return state.requests.filter((request) => {
    const statusMatch =
      currentFilter === "all" ||
      request.status === currentFilter ||
      (currentFilter === "done" && (request.status === "shipped" || request.status === "rejected"));
    const productMatch =
      selectedProductFilters.size === 0 || request.items.some((item) => selectedProductFilters.has(item.productId));
    const submittedDate = request.submittedAt.slice(0, 10);
    const fromMatch = !dateFrom || submittedDate >= dateFrom;
    const toMatch = !dateTo || submittedDate <= dateTo;
    const text = [
      request.customerName,
      request.phone,
      request.lineId,
      request.facebookName,
      request.items.map((item) => item.productName).join(" ")
    ]
      .join(" ")
      .toLowerCase();
    return statusMatch && productMatch && fromMatch && toMatch && text.includes(keyword);
  });
}

function recordTemplate(request) {
  const submitted = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.submittedAt));
  const isPending = request.status === "pending";
  const isShipping = request.status === "approved";
  const isClosed = request.status === "shipped" || request.status === "rejected";
  const items = request.items.length
    ? request.items
        .map(
          (item) => `
            <div class="record-item">
              <span>${escapeHtml(item.productName)}${item.note ? ` - ${escapeHtml(item.note)}` : ""}</span>
              <strong>${item.quantity} ชิ้น</strong>
              <button class="danger-button remove-item" data-request-id="${request.id}" data-item-id="${item.id}" type="button">ลบ</button>
            </div>`
        )
        .join("")
    : `<div class="empty-products">ยังไม่ได้เพิ่มสินค้า</div>`;
  const approvalActions = isPending
    ? `
        <button class="primary-button approve-action" data-id="${request.id}" type="button">อนุมัติ</button>
        <button class="danger-button reject-action" data-id="${request.id}" type="button">ไม่อนุมัติ</button>`
    : "";
  const shippingActions = isShipping
    ? `
        <label class="field ship-control">
          <span>จำนวนการส่ง</span>
          <input class="ship-input" data-id="${request.id}" type="number" min="0" value="${request.shippedCount || 1}" />
        </label>
        <button class="primary-button mark-shipped-action" data-id="${request.id}" type="button">✓ จัดส่งแล้ว / ปิดรายการ</button>`
    : "";
  const closedNote = isClosed ? `<div class="closed-note">${statusSubLabel[request.status]}</div>` : "";
  const productTools = isClosed ? "" : assignProductTemplate(request.id);

  return `
    <article class="record-card">
      <div class="record-top">
        <div>
          <h3>${escapeHtml(request.customerName)}</h3>
          <div class="status-row">
            <span class="status-pill status-${request.status}">${statusLabel[request.status]}</span>
            <span>${statusSubLabel[request.status]}</span>
          </div>
        </div>
        <div class="record-date">${submitted}</div>
      </div>
      <div class="workflow-line status-${request.status}">
        <span class="${isPending ? "active" : ""}">รออนุมัติ</span>
        <span class="${isShipping ? "active" : ""}">รอจัดส่ง</span>
        <span class="${isClosed ? "active" : ""}">เสร็จสิ้น</span>
      </div>
      <div class="record-meta">
        <span>โทร: ${escapeHtml(request.phone)}</span>
        <span>LINE: ${escapeHtml(request.lineId)}</span>
        <span>Facebook: ${escapeHtml(request.facebookName)}</span>
      </div>
      <div class="record-meta">
        <span>TikTok: ${linkOrText(request.tiktokLink)}</span>
        <span>ส่งแล้ว: ${request.shippedCount} ครั้ง</span>
        <span>หมายเหตุ: ${escapeHtml(request.customerNote || "-")}</span>
      </div>
      <p><strong>ที่อยู่:</strong> ${escapeHtml(request.address)}</p>
      <div class="record-items">${items}</div>
      <div class="record-actions">
        <div class="status-actions">
          <div class="action-row">
            <button class="secondary-button edit-action" data-id="${request.id}" type="button">ดู/แก้ไข</button>
            ${approvalActions}
          </div>
          ${shippingActions}
          ${closedNote}
        </div>
        ${productTools}
      </div>
    </article>`;
}

function assignProductTemplate(requestId) {
  const options = activeProducts()
    .map((product) => `<option value="${product.id}">${escapeHtml(product.name)}${product.code ? ` (${escapeHtml(product.code)})` : ""}</option>`)
    .join("");

  return `
    <form class="assign-product-form" data-request-id="${requestId}">
      <select name="productId" required>${options}</select>
      <input name="quantity" type="number" min="1" value="1" required />
      <input name="itemNote" placeholder="หมายเหตุสินค้า" />
      <button class="primary-button" type="submit">เพิ่มสินค้า</button>
    </form>`;
}

function handleProductSubmit(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.products.push({
    id: createId("product"),
    name: data.get("productName").trim(),
    code: data.get("productCode").trim(),
    active: true
  });
  event.currentTarget.reset();
  saveState();
  renderAll();
}

function toggleProduct(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  product.active = !product.active;
  saveState();
  renderAll();
}

function deleteProduct(id) {
  state.products = state.products.filter((item) => item.id !== id);
  saveState();
  renderAll();
}

function handleUserSubmit(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const username = data.get("username").trim();
  const password = data.get("password");

  if (state.users.some((user) => user.username === username)) {
    alert("User นี้มีอยู่แล้ว");
    return;
  }

  state.users.push({
    id: createId("user"),
    displayName: data.get("displayName").trim(),
    username,
    password,
    role: "staff",
    active: true
  });
  event.currentTarget.reset();
  saveState();
  renderAll();
}

function toggleUser(id) {
  const user = state.users.find((item) => item.id === id);
  if (!user) return;
  user.active = !user.active;
  saveState();
  renderAll();
}

function renderSettings() {
  $("#settings-products").innerHTML = state.products
    .map(
      (product) => `
        <div class="settings-row">
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <small>${escapeHtml(product.code || "ไม่มีรหัส")} · ${product.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</small>
          </div>
          <div class="row-actions">
            <button class="ghost-button toggle-product" data-id="${product.id}" type="button">${product.active ? "ปิด" : "เปิด"}</button>
            <button class="danger-button delete-product" data-id="${product.id}" type="button">ลบ</button>
          </div>
        </div>`
    )
    .join("");

  $("#settings-users").innerHTML = state.users
    .map(
      (user) => `
        <div class="settings-row">
          <div>
            <strong>${escapeHtml(user.displayName)}</strong>
            <small>User: ${escapeHtml(user.username)} · ${user.role} · ${user.active ? "ใช้งาน" : "ปิดใช้งาน"}</small>
          </div>
          <div class="row-actions">
            <button class="ghost-button toggle-user" data-id="${user.id}" type="button">${user.active ? "ปิด" : "เปิด"}</button>
          </div>
        </div>`
    )
    .join("");

  $$(".toggle-product").forEach((button) => button.addEventListener("click", () => toggleProduct(button.dataset.id)));
  $$(".delete-product").forEach((button) => button.addEventListener("click", () => deleteProduct(button.dataset.id)));
  $$(".toggle-user").forEach((button) => button.addEventListener("click", () => toggleUser(button.dataset.id)));
}

function renderProductFilters() {
  const container = $("#product-filter-options");
  container.innerHTML = activeProducts()
    .map(
      (product) => `
        <label class="filter-chip">
          <input type="checkbox" value="${product.id}" ${selectedProductFilters.has(product.id) ? "checked" : ""} />
          <span>${escapeHtml(product.name)}</span>
        </label>`
    )
    .join("");

  $$("input", container).forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        selectedProductFilters.add(input.value);
      } else {
        selectedProductFilters.delete(input.value);
      }
      renderRecords();
    });
  });
}

function exportExcel() {
  const exportRows = getFilteredRequests().map((request) => ({
    "รหัสรายการ": request.id,
    "สถานะ": statusLabel[request.status] || request.status,
    "รายละเอียดสถานะ": statusSubLabel[request.status] || "",
    "ชื่อ-นามสกุล": request.customerName,
    "เบอร์โทร": request.phone,
    "ไอดีไลน์": request.lineId,
    "Facebook": request.facebookName,
    "TikTok": request.tiktokLink,
    "ที่อยู่จัดส่ง": request.address,
    "สินค้า": request.items.map((item) => `${item.productName} x ${item.quantity}${item.note ? ` (${item.note})` : ""}`).join(" | "),
    "จำนวนรายการสินค้า": request.items.length,
    "จำนวนการส่ง": request.shippedCount,
    "หมายเหตุ": request.customerNote || "",
    "วันที่กรอก": formatDateTimeForExport(request.submittedAt),
    "อัปเดตล่าสุด": formatDateTimeForExport(request.updatedAt)
  }));

  if (window.XLSX) {
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = [
      { wch: 24 },
      { wch: 14 },
      { wch: 26 },
      { wch: 24 },
      { wch: 16 },
      { wch: 18 },
      { wch: 22 },
      { wch: 32 },
      { wch: 42 },
      { wch: 48 },
      { wch: 16 },
      { wch: 14 },
      { wch: 30 },
      { wch: 22 },
      { wch: 22 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "VIP Requests");
    XLSX.writeFile(workbook, `the-good-million-vip-${new Date().toISOString().slice(0, 10)}.xlsx`);
    return;
  }

  exportCsvFallback(exportRows);
}

function exportCsvFallback(exportRows) {
  const header = Object.keys(exportRows[0] || { "ข้อมูล": "" });
  const rows = exportRows.map((row) => header.map((key) => row[key] ?? ""));
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `the-good-million-vip-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function formatDateTimeForExport(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function linkOrText(value) {
  const safe = escapeHtml(value || "-");
  if (!value?.startsWith("http")) return safe;
  return `<a href="${safe}" target="_blank" rel="noreferrer">เปิดลิงก์</a>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAll() {
  renderStats();
  renderProductFilters();
  renderRecords();
  renderSettings();
}

function bindEvents() {
  $("#admin-gear").addEventListener("click", openLoginDialog);
  $("#close-login").addEventListener("click", () => $("#login-dialog").close());
  $("#close-success").addEventListener("click", () => $("#success-dialog").close());
  $("#close-edit").addEventListener("click", () => $("#edit-dialog").close());
  $("#edit-request-form").addEventListener("submit", handleEditSubmit);
  $("#login-form").addEventListener("submit", handleLogin);
  $("#logout-admin").addEventListener("click", logoutAdmin);
  $("#vip-form").addEventListener("submit", handleVipSubmit);
  $("#product-form").addEventListener("submit", handleProductSubmit);
  $("#user-form").addEventListener("submit", handleUserSubmit);
  $("#export-excel").addEventListener("click", exportExcel);
  $("#search-input").addEventListener("input", renderRecords);
  $("#date-from").addEventListener("change", renderRecords);
  $("#date-to").addEventListener("change", renderRecords);
  $("#clear-date-filter").addEventListener("click", () => {
    $("#date-from").value = "";
    $("#date-to").value = "";
    renderRecords();
  });
  $("#clear-product-filter").addEventListener("click", () => {
    selectedProductFilters.clear();
    renderProductFilters();
    renderRecords();
  });

  $$(".admin-tab[data-admin-view]").forEach((button) => {
    button.addEventListener("click", () => showAdminSection(button.dataset.adminView));
  });

  $$(".segmented button").forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;
      $$(".segmented button").forEach((item) => item.classList.toggle("active", item === button));
      renderRecords();
    });
  });
}

bindEvents();
renderAll();
initSupabaseState();
