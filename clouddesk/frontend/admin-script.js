/* =============================================
   CloudDesk Admin — JavaScript Logic
   ============================================= */

// ─── Victor ──────────────────────────────────
// CONFIG — edit these two lines to go live:
//   1. Set MOCK_MODE = false
//   2. Set API_BASE_URL to the EC2 public IP
// ─────────────────────────────────────────────
const MOCK_MODE    = true;
const API_BASE_URL = "http://3.238.196.68:5000";

// ─── Mock Data ───────────────────────────────
// Edwin: replace this with your real DB seed data to verify schema matches
const MOCK_USERS = [
    { id: 1, name: "Alice Tan",    email: "alice@test.com",   role: "user",  created_at: "2025-01-10T08:00:00" },
    { id: 2, name: "Bob Lim",      email: "bob@test.com",     role: "user",  created_at: "2025-01-11T09:30:00" },
    { id: 3, name: "Charlie Ng",   email: "charlie@test.com", role: "user",  created_at: "2025-01-12T10:00:00" },
    { id: 4, name: "Admin Sara",   email: "sara@test.com",    role: "admin", created_at: "2025-01-01T00:00:00" },
    { id: 5, name: "Admin James",  email: "james@test.com",   role: "admin", created_at: "2025-01-01T00:00:00" },
];

// Joel: mock admin credentials — replace with your real /login response shape if it changes
const MOCK_ADMIN_CREDENTIALS = [
    { email: "sara@test.com",  password: "password123", id: 4, name: "Admin Sara" },
    { email: "james@test.com", password: "password123", id: 5, name: "Admin James" },
];

// Dylan: mock tickets — replace with your real /admin/tickets response shape if it changes
const MOCK_TICKETS = [
    {
        id: 1, user_id: 1, assigned_to: 4,
        title: "Cannot login to portal",
        description: "Getting invalid credentials error when I try to log in. I have tried resetting my password but the issue persists.",
        status: "In Progress", priority: "high",
        submitted_by: "Alice Tan", assigned_admin: "Admin Sara",
        created_at: "2025-03-01T08:30:00", updated_at: "2025-03-02T10:00:00",
        responses: [
            { id: 1, ticket_id: 1, responder_name: "Admin Sara", responder_role: "admin", message: "Hi Alice, please try resetting your password and clearing cache.", created_at: "2025-03-01T09:00:00" },
            { id: 2, ticket_id: 1, responder_name: "Alice Tan",  responder_role: "user",  message: "I tried that, still not working.", created_at: "2025-03-01T09:30:00" },
        ]
    },
    {
        id: 2, user_id: 2, assigned_to: 4,
        title: "Page not loading",
        description: "Dashboard shows blank screen after logging in. Tried Chrome and Firefox, same issue.",
        status: "Open", priority: "medium",
        submitted_by: "Bob Lim", assigned_admin: "Admin Sara",
        created_at: "2025-03-02T11:00:00", updated_at: "2025-03-02T11:00:00",
        responses: [
            { id: 3, ticket_id: 2, responder_name: "Admin Sara", responder_role: "admin", message: "Hi Bob, we are looking into this issue.", created_at: "2025-03-02T12:00:00" },
        ]
    },
    {
        id: 3, user_id: 3, assigned_to: 5,
        title: "Wrong email displayed",
        description: "My profile shows wrong email address. It shows an old company email instead of my personal one.",
        status: "Resolved", priority: "low",
        submitted_by: "Charlie Ng", assigned_admin: "Admin James",
        created_at: "2025-03-03T14:00:00", updated_at: "2025-03-04T09:00:00",
        responses: [
            { id: 4, ticket_id: 3, responder_name: "Charlie Ng", responder_role: "user", message: "Thanks, the email is now correct.", created_at: "2025-03-04T08:00:00" },
        ]
    },
    {
        id: 4, user_id: 1, assigned_to: 5,
        title: "File upload fails",
        description: "PDF upload gives 500 error every time. File is under 5MB so it should be fine.",
        status: "Open", priority: "high",
        submitted_by: "Alice Tan", assigned_admin: "Admin James",
        created_at: "2025-03-04T10:00:00", updated_at: "2025-03-04T10:00:00",
        responses: [
            { id: 5, ticket_id: 4, responder_name: "Admin James", responder_role: "admin", message: "Hi Alice, please check your file size is under 10MB.", created_at: "2025-03-04T11:00:00" },
        ]
    },
    {
        id: 5, user_id: 2, assigned_to: null,
        title: "Slow response time",
        description: "System is very laggy in the afternoon, pages take 10+ seconds to load.",
        status: "Closed", priority: "medium",
        submitted_by: "Bob Lim", assigned_admin: null,
        created_at: "2025-03-05T15:00:00", updated_at: "2025-03-06T09:00:00",
        responses: []
    },
];

// ─── Mock API layer ──────────────────────────
// All mock functions mirror the real API response shape exactly.
// When MOCK_MODE = false, these are never called.

function mockDelay(ms = 300) {
    return new Promise(res => setTimeout(res, ms));
}

async function mockLogin(email, password) {
    await mockDelay(500);
    const match = MOCK_ADMIN_CREDENTIALS.find(u => u.email === email && u.password === password);
    if (!match) return { ok: false, data: { error: "Invalid credentials" } };
    // Fake a JWT-shaped token (not a real JWT, just for local testing)
    const fakePayload = btoa(JSON.stringify({ sub: String(match.id), role: "admin" }));
    const fakeToken = `header.${fakePayload}.signature`;
    return { ok: true, data: { token: fakeToken, role: "admin" } };
}

async function mockGetAdminTickets() {
    await mockDelay(400);
    return { ok: true, data: [...MOCK_TICKETS] };
}

async function mockGetTicket(id) {
    await mockDelay(300);
    const ticket = MOCK_TICKETS.find(t => t.id === id);
    if (!ticket) return { ok: false, data: { error: "Not found" } };
    return { ok: true, data: { ...ticket } };
}

async function mockUpdateStatus(ticketId, newStatus) {
    await mockDelay(300);
    const ticket = MOCK_TICKETS.find(t => t.id === ticketId);
    if (ticket) ticket.status = newStatus;
    return { ok: true, data: { message: "Status updated" } };
}

async function mockAddResponse(ticketId, message, responderId) {
    await mockDelay(300);
    const ticket = MOCK_TICKETS.find(t => t.id === ticketId);
    if (!ticket) return { ok: false, data: { error: "Not found" } };
    const responder = MOCK_USERS.find(u => u.id === responderId);
    ticket.responses.push({
        id: Date.now(),
        ticket_id: ticketId,
        responder_name: responder?.name || "Admin",
        responder_role: responder?.role || "admin",
        message,
        created_at: new Date().toISOString(),
    });
    return { ok: true, data: { message: "Response added" } };
}

async function mockGetUsers() {
    await mockDelay(350);
    return { ok: true, data: [...MOCK_USERS] };
}

// ─── State ──────────────────────────────────
let adminToken = null;
let adminUser  = null;
let allAdminTickets = [];
let allUsers        = [];
let currentAdminFilter = "all";
let currentAdminSearch = "";
let currentView = "dashboard";

// ─── Auth ────────────────────────────────────
async function adminLogin() {
    const email    = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const errEl    = document.getElementById("login-error");
    const btn      = document.getElementById("login-btn");

    errEl.style.display = "none";

    if (!email || !password) {
        showLoginError("Please enter your email and password.");
        return;
    }

    btn.disabled = true;
    btn.querySelector("span").textContent = "Signing in…";

    try {
        let ok, data;

        if (MOCK_MODE) {
            ({ ok, data } = await mockLogin(email, password));
        } else {
            // Joel: real /login endpoint
            const res = await fetch(`${API_BASE_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            ok   = res.ok;
            data = await res.json();
        }

        if (!ok || !data.token) {
            showLoginError(data.error || "Invalid credentials.");
            return;
        }

        if (data.role !== "admin") {
            showLoginError("Access denied. This portal is for administrators only.");
            return;
        }

        adminToken = data.token;

        try {
            const payload = JSON.parse(atob(adminToken.split(".")[1]));
            adminUser = { id: parseInt(payload.sub), role: payload.role };
        } catch (_) {
            adminUser = { id: null, role: "admin" };
        }

        document.getElementById("login-overlay").style.display = "none";
        document.getElementById("app").style.display = "flex";

        initAdmin();

    } catch (err) {
        showLoginError("Cannot reach server. Is the backend running?");
    } finally {
        btn.disabled = false;
        btn.querySelector("span").textContent = "Sign In";
    }
}

function showLoginError(msg) {
    const errEl = document.getElementById("login-error");
    errEl.textContent = msg;
    errEl.style.display = "block";
}

function logout() {
    adminToken = null;
    adminUser  = null;
    allAdminTickets = [];
    allUsers = [];
    document.getElementById("login-overlay").style.display = "flex";
    document.getElementById("app").style.display = "none";
    document.getElementById("login-password").value = "";
    document.getElementById("login-error").style.display = "none";
}

// Allow pressing Enter to login
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("login-password").addEventListener("keydown", e => {
        if (e.key === "Enter") adminLogin();
    });
    document.getElementById("login-email").addEventListener("keydown", e => {
        if (e.key === "Enter") adminLogin();
    });
    startClock();
});

// ─── Init ────────────────────────────────────
async function initAdmin() {
    await loadAdminInfo();
    await Promise.all([loadAdminTickets(), loadUsers()]);
}

async function loadAdminInfo() {
    if (!adminUser?.id) return;
    let users;

    if (MOCK_MODE) {
        const r = await mockGetUsers();
        users = r.data;
    } else {
        try {
            const res = await authFetch(`/users`);
            if (!res) return;
            users = await res.json();
        } catch (_) { return; }
    }

    const me = users.find(u => u.id === adminUser.id);
    if (me) {
        document.getElementById("admin-name-label").textContent = me.name || "Admin";
        document.getElementById("admin-avatar").textContent = (me.name || "A")[0].toUpperCase();
    }
}

// ─── Authenticated fetch ─────────────────────
async function authFetch(endpoint, options = {}) {
    if (!adminToken) return null;
    try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`,
                ...(options.headers || {})
            }
        });
        if (res.status === 401 || res.status === 403) {
            showToast("Session expired. Please sign in again.", "error");
            logout();
            return null;
        }
        return res;
    } catch (err) {
        showToast("Cannot reach server.", "error");
        return null;
    }
}

// ─── Load Tickets ────────────────────────────
async function loadAdminTickets() {
    let data;

    if (MOCK_MODE) {
        const r = await mockGetAdminTickets();
        data = r.data;
    } else {
        // Dylan: real /admin/tickets endpoint (JWT-protected)
        const res = await authFetch("/admin/tickets");
        if (!res) return;
        data = await res.json();
    }

    allAdminTickets = Array.isArray(data) ? data : [];
    renderDashboard();
    renderAdminTickets();

    const openCount = allAdminTickets.filter(t => t.status === "Open" || t.status === "open").length;
    document.getElementById("open-count-badge").textContent = openCount;
}

async function loadUsers() {
    let data;

    if (MOCK_MODE) {
        const r = await mockGetUsers();
        data = r.data;
    } else {
        // Edwin: real /users endpoint
        const res = await authFetch("/users");
        if (!res) return;
        data = await res.json();
    }

    allUsers = Array.isArray(data) ? data : [];
    renderUsers();
}

async function refreshAll() {
    showToast("Refreshing…", "info");
    await Promise.all([loadAdminTickets(), loadUsers()]);
}

// ─── Dashboard ───────────────────────────────
function renderDashboard() {
    const open     = allAdminTickets.filter(t => t.status === "Open").length;
    const progress = allAdminTickets.filter(t => t.status === "In Progress").length;
    const resolved = allAdminTickets.filter(t => t.status === "Resolved" || t.status === "Closed").length;
    const total    = allAdminTickets.length;

    document.getElementById("stat-open").textContent     = open;
    document.getElementById("stat-progress").textContent = progress;
    document.getElementById("stat-resolved").textContent = resolved;
    document.getElementById("stat-total").textContent    = total;

    const recent = [...allAdminTickets].slice(0, 8);
    const wrap = document.getElementById("recent-tickets-list");
    if (recent.length === 0) {
        wrap.innerHTML = `<p style="padding:20px;color:var(--text-muted);font-size:13px;">No tickets yet.</p>`;
        return;
    }

    wrap.innerHTML = `
        <table class="tickets-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>Submitted by</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Created</th>
                </tr>
            </thead>
            <tbody>
                ${recent.map(t => ticketRowHtml(t)).join("")}
            </tbody>
        </table>
    `;
}

// ─── Ticket Table ────────────────────────────
function renderAdminTickets() {
    let filtered = allAdminTickets;

    if (currentAdminFilter !== "all") {
        filtered = filtered.filter(t => {
            const s = (t.status || "").toLowerCase().replace(" ", "_");
            return s === currentAdminFilter;
        });
    }

    if (currentAdminSearch.trim()) {
        const q = currentAdminSearch.toLowerCase();
        filtered = filtered.filter(t =>
            (t.title || "").toLowerCase().includes(q) ||
            (t.submitted_by || "").toLowerCase().includes(q) ||
            String(t.id).includes(q)
        );
    }

    const tbody = document.getElementById("admin-tickets-body");
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="table-loading">No tickets match.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(t => `
        <tr onclick="openTicketModal(${t.id})">
            <td class="ticket-id-mono">#${String(t.id).padStart(4, "0")}</td>
            <td class="ticket-title-cell">${esc(t.title)}</td>
            <td class="ticket-submitter">${esc(t.submitted_by || "—")}</td>
            <td>${priorityDot(t.priority)}</td>
            <td>${statusBadge(t.status)}</td>
            <td class="timestamp">${formatDate(t.created_at)}</td>
            <td>
                <button class="action-btn" onclick="event.stopPropagation(); openTicketModal(${t.id})">
                    Open
                </button>
            </td>
        </tr>
    `).join("");
}

function ticketRowHtml(t) {
    return `
        <tr onclick="openTicketModal(${t.id})">
            <td class="ticket-id-mono">#${String(t.id).padStart(4, "0")}</td>
            <td class="ticket-title-cell">${esc(t.title)}</td>
            <td class="ticket-submitter">${esc(t.submitted_by || "—")}</td>
            <td>${statusBadge(t.status)}</td>
            <td>${priorityDot(t.priority)}</td>
            <td class="timestamp">${formatDate(t.created_at)}</td>
        </tr>
    `;
}

function filterAdminTickets(filter, btn) {
    currentAdminFilter = filter;
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    renderAdminTickets();
}

function adminSearch(query) {
    currentAdminSearch = query;
    renderAdminTickets();
}

// ─── Users Table ─────────────────────────────
function renderUsers() {
    const tbody = document.getElementById("users-body");
    if (allUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="table-loading">No users found.</td></tr>`;
        return;
    }

    tbody.innerHTML = allUsers.map(u => `
        <tr>
            <td class="ticket-id-mono">${u.id}</td>
            <td style="font-weight:500;">${esc(u.name || "—")}</td>
            <td style="color:var(--text-secondary);">${esc(u.email)}</td>
            <td>${roleBadge(u.role)}</td>
            <td class="timestamp">${formatDate(u.created_at)}</td>
        </tr>
    `).join("");
}

// ─── Ticket Modal ─────────────────────────────
async function openTicketModal(id) {
    const overlay = document.getElementById("modal-overlay");
    const content = document.getElementById("modal-content");
    overlay.style.display = "flex";
    content.innerHTML = `<p style="color:var(--text-muted);font-size:13px;padding:40px 0;text-align:center;">Loading…</p>`;

    let t;
    if (MOCK_MODE) {
        const r = await mockGetTicket(id);
        if (!r.ok) { closeModal(); return; }
        t = r.data;
    } else {
        // Dylan: real /tickets/:id endpoint with responses
        const res = await authFetch(`/tickets/${id}`);
        if (!res) { closeModal(); return; }
        t = await res.json();
    }

    // Update local cache to keep status in sync
    const idx = allAdminTickets.findIndex(x => x.id === id);
    if (idx !== -1) allAdminTickets[idx] = { ...allAdminTickets[idx], ...t };

    const responses = t.responses || [];

    content.innerHTML = `
        <div class="modal-ticket-header">
            <div class="modal-ticket-id">Ticket #${String(t.id).padStart(4, "0")}</div>
            <div class="modal-ticket-title">${esc(t.title)}</div>
            <div class="modal-meta-row">
                ${statusBadge(t.status)}
                ${priorityDot(t.priority)}
                <span class="modal-meta-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    ${esc(t.submitted_by || "Unknown")}
                </span>
                <span class="modal-meta-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    ${formatDate(t.created_at)}
                </span>
            </div>
        </div>

        <div class="modal-section">
            <div class="modal-section-title">Description</div>
            <p class="modal-description">${esc(t.description)}</p>
        </div>

        <div class="modal-section">
            <div class="modal-section-title">Update Status</div>
            <div class="modal-status-row">
                <select class="status-select" id="modal-status-select">
                    <option value="Open"        ${t.status === "Open"        ? "selected" : ""}>Open</option>
                    <option value="In Progress" ${t.status === "In Progress" ? "selected" : ""}>In Progress</option>
                    <option value="Resolved"    ${t.status === "Resolved"    ? "selected" : ""}>Resolved</option>
                    <option value="Closed"      ${t.status === "Closed"      ? "selected" : ""}>Closed</option>
                </select>
                <button class="btn-update" onclick="updateStatus(${t.id})">Update</button>
            </div>
        </div>

        <div class="modal-section">
            <div class="modal-section-title">Responses (${responses.length})</div>
            <div class="response-list" id="response-list-${t.id}">
                ${responses.length === 0
                    ? `<div class="no-responses">No responses yet. Add the first one below.</div>`
                    : responses.map(r => `
                        <div class="response-item">
                            <div class="response-meta">
                                <span class="responder-name">${esc(r.responder_name || "Unknown")}</span>
                                ${roleBadge(r.responder_role)}
                                <span class="response-time">${formatDate(r.created_at)}</span>
                            </div>
                            <div class="response-message">${esc(r.message)}</div>
                        </div>
                    `).join("")
                }
            </div>

            <div class="reply-box">
                <textarea id="reply-input-${t.id}" placeholder="Write a response to the user…"></textarea>
                <button class="reply-submit" onclick="submitReply(${t.id})">
                    Send Response
                </button>
            </div>
        </div>
    `;
}

function closeModal(e) {
    if (e && e.target !== document.getElementById("modal-overlay")) return;
    document.getElementById("modal-overlay").style.display = "none";

    // Refresh to reflect any status changes
    renderDashboard();
    renderAdminTickets();
}

// close on Escape
document.addEventListener("keydown", e => {
    if (e.key === "Escape") document.getElementById("modal-overlay").style.display = "none";
});

// ─── Update Status ───────────────────────────
async function updateStatus(ticketId) {
    const newStatus = document.getElementById("modal-status-select").value;

    let ok;
    if (MOCK_MODE) {
        const r = await mockUpdateStatus(ticketId, newStatus);
        ok = r.ok;
    } else {
        // Dylan: real PATCH /tickets/:id/status
        const res = await authFetch(`/tickets/${ticketId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: newStatus })
        });
        ok = res && res.ok;
    }

    if (!ok) {
        showToast("Failed to update status.", "error");
        return;
    }

    // Update local cache
    const idx = allAdminTickets.findIndex(t => t.id === ticketId);
    if (idx !== -1) allAdminTickets[idx].status = newStatus;

    showToast(`Status updated to "${newStatus}".`, "success");

    // Update open count badge
    const openCount = allAdminTickets.filter(t => t.status === "Open").length;
    document.getElementById("open-count-badge").textContent = openCount;
}

// ─── Submit Reply ────────────────────────────
async function submitReply(ticketId) {
    const input   = document.getElementById(`reply-input-${ticketId}`);
    const message = (input.value || "").trim();

    if (!message) {
        showToast("Please write a message.", "error");
        return;
    }

    const responder_id = adminUser?.id || 4;

    let ok;
    if (MOCK_MODE) {
        const r = await mockAddResponse(ticketId, message, responder_id);
        ok = r.ok;
    } else {
        // Dylan: real POST /tickets/:id/responses
        const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/responses`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`
            },
            body: JSON.stringify({ message, responder_id })
        });
        ok = res && res.ok;
    }

    if (!ok) {
        showToast("Failed to send response.", "error");
        return;
    }

    showToast("Response sent.", "success");
    input.value = "";

    // Reload the modal to show new response
    openTicketModal(ticketId);
}

// ─── View Switching ──────────────────────────
function switchView(viewId, linkEl) {
    currentView = viewId;

    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(`view-${viewId}`).classList.add("active");

    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    if (linkEl) linkEl.classList.add("active");

    const titles = { dashboard: "Dashboard", tickets: "All Tickets", users: "Users" };
    document.getElementById("topbar-title").textContent = titles[viewId] || viewId;
}

// ─── Clock ───────────────────────────────────
function startClock() {
    function tick() {
        const el = document.getElementById("topbar-time");
        if (el) {
            el.textContent = new Date().toLocaleTimeString("en-SG", {
                hour: "2-digit", minute: "2-digit", second: "2-digit"
            });
        }
    }
    tick();
    setInterval(tick, 1000);
}

// ─── Toast ───────────────────────────────────
function showToast(message, type = "info") {
    const container = document.getElementById("admin-toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add("exit");
        setTimeout(() => toast.remove(), 250);
    }, 3000);
}

// ─── Render Helpers ──────────────────────────
function statusBadge(status) {
    const map = {
        "Open":        "badge badge-open",
        "open":        "badge badge-open",
        "In Progress": "badge badge-progress",
        "in_progress": "badge badge-progress",
        "Resolved":    "badge badge-resolved",
        "resolved":    "badge badge-resolved",
        "Closed":      "badge badge-closed",
        "closed":      "badge badge-closed",
    };
    const label = {
        "open": "Open", "in_progress": "In Progress",
        "resolved": "Resolved", "closed": "Closed"
    };
    const cls = map[status] || "badge badge-closed";
    const text = label[status] || status;
    return `<span class="${cls}">${esc(text)}</span>`;
}

function priorityDot(priority) {
    const p = (priority || "medium").toLowerCase();
    const labels = { high: "High", medium: "Medium", low: "Low" };
    return `<span class="priority-dot ${p}">${labels[p] || priority}</span>`;
}

function roleBadge(role) {
    const cls = role === "admin" ? "badge badge-admin" : "badge badge-user";
    return `<span class="${cls}">${esc(role || "user")}</span>`;
}

function esc(str) {
    if (!str) return "";
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    const now   = new Date();
    const diff  = now - date;

    if (diff < 60000)    return "Just now";
    if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return date.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}