/* ============================================
   CloudDesk — Frontend Logic (User + Admin)
   ============================================ */

const API_BASE_URL = "http://98.88.113.7:5000"; 

// ─── Auth State ──────────────────────────────
let authToken = localStorage.getItem("cd_token") || null;
let authUser  = JSON.parse(localStorage.getItem("cd_user") || "null");

// ─── App State ───────────────────────────────
let allTickets      = [];
let allAdminTickets = [];
let allUsers        = [];
let currentFilter   = "all";
let currentSearch   = "";
let adminSearch     = "";

// ─── Auth: Save / Clear ──────────────────────
function saveAuth(token, user) {
    authToken = token;
    authUser  = user;
    localStorage.setItem("cd_token", token);
    localStorage.setItem("cd_user", JSON.stringify(user));
}
function clearAuth() {
    authToken = null;
    authUser  = null;
    localStorage.removeItem("cd_token");
    localStorage.removeItem("cd_user");
}

// ─── Auth: Navbar Sync ───────────────────────
function syncNavAuth() {
    const navLinks     = document.getElementById("nav-links");
    const navAuth      = document.getElementById("nav-auth");
    const adminNavLink = document.getElementById("nav-admin-link");

    if (authToken && authUser) {
        navLinks.style.display     = "flex";
        adminNavLink.style.display = authUser.role === "admin" ? "flex" : "none";
        navAuth.innerHTML = `
            <span class="nav-user-name">👋 ${escapeHtml(authUser.name)}</span>
            <button class="btn-ghost" onclick="logout()">Sign out</button>
        `;
    } else {
        navLinks.style.display     = "none";
        adminNavLink.style.display = "none";
        navAuth.innerHTML = `<button class="btn-auth-login" onclick="openModal('login')">Sign in</button>`;
    }
}

function requireAuth(action) {
    if (authToken) { action(); }
    else { window._pendingAction = action; openModal("login"); }
}

// ─── Auth Modal ──────────────────────────────
function openModal(mode = "login") {
    switchModal(mode);
    document.getElementById("auth-modal").classList.add("open");
}
function closeModal() {
    document.getElementById("auth-modal").classList.remove("open");
    window._pendingAction = null;
}
function switchModal(mode) {
    document.getElementById("modal-login").style.display    = mode === "login"    ? "block" : "none";
    document.getElementById("modal-register").style.display = mode === "register" ? "block" : "none";
    document.getElementById("login-error").classList.remove("show");
    document.getElementById("register-error").classList.remove("show");
}
document.getElementById("auth-modal").addEventListener("click", function(e) {
    if (e.target === this) closeModal();
});
document.addEventListener("keydown", function(e) {
    if (e.key !== "Enter") return;
    const modal = document.getElementById("auth-modal");
    if (!modal.classList.contains("open")) return;
    document.getElementById("modal-login").style.display !== "none" ? doLogin() : doRegister();
});

// ─── Login (explicit credentials, no DOM) ────
async function doLoginWithCredentials(email, password) {
    try {
        const res  = await fetch(`${API_BASE_URL}/login`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || "Login failed.", "error"); return; }
        saveAuth(data.token, { name: data.name, id: data.id, role: data.role });
        closeModal();
        syncNavAuth();
        showToast(`Welcome, ${data.name}!`, "success");
        if (window._pendingAction) { window._pendingAction(); window._pendingAction = null; }
    } catch { showToast("Could not sign in automatically. Please log in manually.", "error"); }
}

// ─── DELETE TICKET ─────────────────
async function deleteTicket(ticketId) {
    if (!confirm("Are you sure you want to delete this ticket?")) return;

    try {
        const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${authToken}`
            }
        });

        if (res.ok) {
            showToast("Ticket deleted successfully");
            // Refresh the list depending on which page you are on
            if (document.getElementById("page-admin").classList.contains("active")) {
                loadAdminData();
            } else {
                loadTickets();
            }
        } else {
            const err = await res.json();
            alert("Error: " + err.error);
        }
    } catch (error) {
        console.error("Delete failed:", error);
        alert("Failed to reach server.");
    }
}

// ─── Login (from modal form) ─────────────────
async function doLogin() {
    const email    = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const errEl    = document.getElementById("login-error");
    const btn      = document.getElementById("login-btn");
    errEl.classList.remove("show");
    if (!email || !password) { errEl.textContent = "Please enter your email and password."; errEl.classList.add("show"); return; }
    btn.disabled = true; btn.textContent = "Signing in…";
    try {
        const res  = await fetch(`${API_BASE_URL}/login`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || "Login failed."; errEl.classList.add("show"); return; }
        saveAuth(data.token, { name: data.name, id: data.id, role: data.role });
        closeModal(); syncNavAuth();
        showToast(`Welcome back, ${data.name}!`, "success");
        if (window._pendingAction) { window._pendingAction(); window._pendingAction = null; }
    } catch { errEl.textContent = "Cannot reach server."; errEl.classList.add("show"); }
    finally { btn.disabled = false; btn.textContent = "Sign In"; }
}

// ─── Register ────────────────────────────────
async function doRegister() {
    const name     = document.getElementById("reg-name").value.trim();
    const email    = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const errEl    = document.getElementById("register-error");
    const btn      = document.getElementById("register-btn");
    errEl.classList.remove("show");
    if (!name || !email || !password) { errEl.textContent = "Please fill in all fields."; errEl.classList.add("show"); return; }
    if (password.length < 6) { errEl.textContent = "Password must be at least 6 characters."; errEl.classList.add("show"); return; }
    btn.disabled = true; btn.textContent = "Creating account…";
    try {
        const res  = await fetch(`${API_BASE_URL}/register`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || "Registration failed."; errEl.classList.add("show"); return; }
        showToast("Account created! Signing you in…", "success");
        await doLoginWithCredentials(email, password);
    } catch { errEl.textContent = "Cannot reach server."; errEl.classList.add("show"); }
    finally { btn.disabled = false; btn.textContent = "Create Account"; }
}

// ─── Logout ──────────────────────────────────
function logout() {
    clearAuth(); syncNavAuth(); showPage("home");
    showToast("You've been signed out.", "info");
}

// ─── Page Navigation ─────────────────────────
function showPage(pageId) {
    if (["submit","tickets","detail","admin"].includes(pageId) && !authToken) {
        window._pendingAction = () => showPage(pageId);
        openModal("login"); return;
    }
    if (pageId === "admin" && authUser?.role !== "admin") {
        showToast("Admin access only.", "error"); return;
    }
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.add("active");
    document.querySelectorAll(".nav-link").forEach(l => l.classList.toggle("active", l.dataset.page === pageId));
    if (pageId === "tickets") loadTickets();
    if (pageId === "admin")   loadAdminData();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─── API Helpers ─────────────────────────────
async function apiGet(endpoint) {
    try {
        const headers = { "Content-Type": "application/json" };
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
        const res = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
        if (res.status === 401) { handleExpiredSession(); return null; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error("API GET error:", err);
        showToast("Failed to reach server. Is the backend running?", "error");
        return null;
    }
}
async function apiPost(endpoint, data) {
    try {
        const headers = { "Content-Type": "application/json" };
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST", headers, body: JSON.stringify(data),
        });
        if (res.status === 401) { handleExpiredSession(); return null; }
        if (!res.ok) {
            const text = await res.text();
            let msg = "Request failed.";
            try { msg = JSON.parse(text).error || msg; } catch {}
            showToast(msg, "error"); return null;
        }
        return await res.json();
    } catch (err) {
        console.error("API POST error:", err);
        showToast("Failed to submit. Please try again.", "error");
        return null;
    }
}
async function apiPatch(endpoint, data) {
    try {
        const headers = { "Content-Type": "application/json" };
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "PATCH", headers, body: JSON.stringify(data),
        });
        if (res.status === 401) { handleExpiredSession(); return null; }
        if (!res.ok) {
            const text = await res.text();
            let msg = "Update failed.";
            try { msg = JSON.parse(text).error || msg; } catch {}
            showToast(msg, "error"); return null;
        }
        return await res.json();
    } catch (err) {
        console.error("API PATCH error:", err);
        showToast("Failed to update.", "error");
        return null;
    }
}
function handleExpiredSession() {
    clearAuth(); syncNavAuth();
    showToast("Session expired. Please sign in again.", "error");
    openModal("login");
}

// ═══════════════════════════════════════════════
//  USER — TICKETS
// ═══════════════════════════════════════════════

async function loadTickets() {
    const listEl  = document.getElementById("tickets-list");
    const emptyEl = document.getElementById("empty-state");
    const statsEl = document.getElementById("ticket-stats");
    listEl.innerHTML = Array(3).fill('<div class="skeleton skeleton-row"></div>').join("");
    emptyEl.style.display = "none";
    const data = await apiGet("/tickets");
    if (!data) { listEl.innerHTML = ""; emptyEl.style.display = "block"; statsEl.innerHTML = ""; return; }
    allTickets = data;
    renderStats(); renderTickets();
}

function renderStats() {
    const statsEl = document.getElementById("ticket-stats");
    const total = allTickets.length;
    const open  = allTickets.filter(t => t.status === "Open").length;
    const inp   = allTickets.filter(t => t.status === "In Progress").length;
    const res   = allTickets.filter(t => t.status === "Resolved" || t.status === "Closed").length;
    statsEl.innerHTML = `
        <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value blue">${total}</div></div>
        <div class="stat-card"><div class="stat-label">Open</div><div class="stat-value amber">${open}</div></div>
        <div class="stat-card"><div class="stat-label">In Progress</div><div class="stat-value purple">${inp}</div></div>
        <div class="stat-card"><div class="stat-label">Resolved</div><div class="stat-value green">${res}</div></div>
    `;
}

function renderTickets() {
    const listEl  = document.getElementById("tickets-list");
    const emptyEl = document.getElementById("empty-state");
    let filtered  = allTickets;
    if (currentFilter !== "all") filtered = filtered.filter(t => t.status === currentFilter);
    if (currentSearch.trim()) {
        const q = currentSearch.toLowerCase();
        filtered = filtered.filter(t =>
            t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || String(t.id).includes(q)
        );
    }
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (!filtered.length) {
        listEl.innerHTML = ""; emptyEl.style.display = "block";
        emptyEl.querySelector("h3").textContent = allTickets.length === 0 ? "No tickets yet" : "No matching tickets";
        emptyEl.querySelector("p").textContent  = allTickets.length === 0 ? "Submit your first support ticket to get started." : "Try adjusting your search or filter.";
        return;
    }
    emptyEl.style.display = "none";
    listEl.innerHTML = filtered.map(t => `
        <div class="ticket-row" onclick="showTicketDetail(${t.id})">
            <div class="ticket-info">
                <div class="ticket-title-text">${escapeHtml(t.title)}</div>
                <div class="ticket-meta">
                    <span class="ticket-id-label">#${String(t.id).padStart(4,"0")}</span>
                    <span>${formatDate(t.created_at)}</span>
                    ${t.priority ? `<span class="priority-badge priority-${t.priority}">${t.priority}</span>` : ""}
                </div>
            </div>
            <div class="ticket-right">
                <span class="status-badge ${statusClass(t.status)}">${escapeHtml(t.status)}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted)"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        </div>
    `).join("");
}

function filterTickets(status, btn) {
    currentFilter = status;
    document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active"); renderTickets();
}
function searchTickets(query) { currentSearch = query; renderTickets(); }

function showTicketDetail(id) {
    const ticket = allTickets.find(t => t.id === id);
    if (!ticket) return;
    const contentEl  = document.getElementById("ticket-detail-content");
    const responses  = ticket.responses || [];
    const responsesHtml = responses.length
        ? responses.map(r => `
            <div class="response-item ${r.responder_role === "admin" ? "admin-response" : "user-response"}">
                <div class="response-meta">
                    <strong>${escapeHtml(r.responder_name)}</strong>
                    <span class="resp-role-badge">${r.responder_role}</span>
                    <span>${formatDate(r.created_at)}</span>
                </div>
                <p>${escapeHtml(r.message)}</p>
            </div>`).join("")
        : `<p style="color:var(--text-muted);font-size:.9rem;">No responses yet.</p>`;
    contentEl.innerHTML = `
        <div class="detail-card">
            <div class="detail-header">
                <div class="detail-header-top">
                    <h2>${escapeHtml(ticket.title)}</h2>
                    <span class="status-badge ${statusClass(ticket.status)}">${escapeHtml(ticket.status)}</span>
                </div>
                <div class="detail-meta">
                    <span class="detail-meta-item">Ticket #${String(ticket.id).padStart(4,"0")}</span>
                    <span class="detail-meta-item">${formatDate(ticket.created_at)}</span>
                    ${ticket.priority ? `<span class="priority-badge priority-${ticket.priority}">${ticket.priority}</span>` : ""}
                </div>
            </div>
            <div class="detail-body">
                <h4>Description</h4>
                <p class="detail-description">${escapeHtml(ticket.description)}</p>
            </div>
            <div class="detail-responses"><h4>Responses</h4>${responsesHtml}</div>
        </div>`;
    showPage("detail");
}

async function submitTicket() {
    if (!authToken) { openModal("login"); return; }
    const titleInput    = document.getElementById("ticket-title");
    const descInput     = document.getElementById("ticket-desc");
    const priorityInput = document.getElementById("ticket-priority");
    const submitBtn     = document.getElementById("submit-btn");
    const title         = titleInput.value.trim();
    const description   = descInput.value.trim();
    const priority      = priorityInput ? priorityInput.value : "medium";
    if (!title)       { showToast("Please enter a title.", "error"); titleInput.focus(); return; }
    if (!description) { showToast("Please enter a description.", "error"); descInput.focus(); return; }
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/></svg> Submitting…`;
    const result = await apiPost("/tickets", { title, description, priority });
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit Ticket`;
    if (result) { showToast("Ticket submitted successfully!", "success"); clearForm(); showPage("tickets"); }
}

function clearForm() {
    document.getElementById("ticket-title").value = "";
    document.getElementById("ticket-desc").value  = "";
    const p = document.getElementById("ticket-priority");
    if (p) p.value = "medium";
}

// ═══════════════════════════════════════════════
//  ADMIN DASHBOARD
// ═══════════════════════════════════════════════

async function loadAdminData() {
    // Load tickets and users in parallel
    const [tickets, users] = await Promise.all([
        apiGet("/admin/tickets"),
        apiGet("/users"),
    ]);
    if (tickets) { allAdminTickets = tickets; renderAdminOverview(); renderAdminTicketsTable(); }
    if (users)   { allUsers = users; renderAdminUsers(); }
}

function showAdminSection(section) {
    document.querySelectorAll(".admin-section").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".admin-nav-item").forEach(b => b.classList.remove("active"));
    document.getElementById(`admin-section-${section}`).classList.add("active");
    document.getElementById(`anav-${section}`).classList.add("active");
}

// ── Overview ─────────────────────────────────
function renderAdminOverview() {
    const total  = allAdminTickets.length;
    const open   = allAdminTickets.filter(t => t.status === "Open").length;
    const inp    = allAdminTickets.filter(t => t.status === "In Progress").length;
    const res    = allAdminTickets.filter(t => t.status === "Resolved").length;
    const closed = allAdminTickets.filter(t => t.status === "Closed").length;

    document.getElementById("admin-stats-grid").innerHTML = `
        <div class="admin-stat"><div class="admin-stat-label">Total</div><div class="admin-stat-value asv-blue">${total}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Open</div><div class="admin-stat-value asv-amber">${open}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">In Progress</div><div class="admin-stat-value asv-purple">${inp}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Resolved</div><div class="admin-stat-value asv-green">${res}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Closed</div><div class="admin-stat-value" style="color:#64748b">${closed}</div></div>
    `;

    // Show 10 most recent
    const recent = [...allAdminTickets].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);
    document.getElementById("admin-recent-tbody").innerHTML = recent.length
        ? recent.map(t => `
            <tr>
                <td class="td-id">#${String(t.id).padStart(4,"0")}</td>
                <td class="td-title">${escapeHtml(t.title)}</td>
                <td>${escapeHtml(t.submitted_by || "—")}</td>
                <td>${t.priority ? `<span class="priority-badge priority-${t.priority}">${t.priority}</span>` : "—"}</td>
                <td><span class="status-badge ${statusClass(t.status)}">${escapeHtml(t.status)}</span></td>
                <td>${formatDate(t.created_at)}</td>
            </tr>`).join("")
        : `<tr><td colspan="6" class="table-empty">No tickets yet.</td></tr>`;
}

// ── All Tickets Table ─────────────────────────
function renderAdminTicketsTable() {
    const q        = adminSearch.toLowerCase();
    const filtered = allAdminTickets.filter(t =>
        !q || t.title.toLowerCase().includes(q) || (t.submitted_by || "").toLowerCase().includes(q)
    ).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    document.getElementById("admin-tickets-tbody").innerHTML = filtered.length
        ? filtered.map(t => `
            <tr>
                <td class="td-id">#${String(t.id).padStart(4,"0")}</td>
                <td class="td-title">${escapeHtml(t.title)}</td>
                <td>${escapeHtml(t.submitted_by || "—")}</td>
                <td>${t.priority ? `<span class="priority-badge priority-${t.priority}">${t.priority}</span>` : "—"}</td>
                <td><span class="status-badge ${statusClass(t.status)}">${escapeHtml(t.status)}</span></td>
                <td>${formatDate(t.created_at)}</td>
                <td>
                    <button class="btn-manage" onclick="openAdminTicketDetail(${t.id})">Manage</button>
                    <button class="btn-delete" onclick="deleteTicket(${t.id})" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; margin-left:4px; cursor:pointer;">Delete</button>
                </td>
            </tr>`).join("")
        : `<tr><td colspan="7" class="table-empty">No tickets found.</td></tr>`;
}

function filterAdminTickets(query) {
    adminSearch = query;
    renderAdminTicketsTable();
}

// ── Ticket Detail (Admin) ─────────────────────
async function openAdminTicketDetail(id) {
    // Fetch the full ticket (with responses) from the server
    const ticket = await apiGet(`/admin/tickets/${id}`);
    if (!ticket) return;

    // Update cached copy
    const idx = allAdminTickets.findIndex(t => t.id === id);
    if (idx !== -1) allAdminTickets[idx] = { ...allAdminTickets[idx], ...ticket };

    document.getElementById("admin-tickets-list-view").style.display   = "none";
    document.getElementById("admin-ticket-detail-view").style.display  = "block";

    const responses    = ticket.responses || [];
    const responsesHtml = responses.length
        ? responses.map(r => `
            <div class="resp-bubble ${r.responder_role === "admin" ? "admin-resp" : "user-resp"}">
                <div class="resp-bubble-meta">
                    <strong>${escapeHtml(r.responder_name)}</strong>
                    <span class="role-pill ${r.responder_role === "admin" ? "admin" : ""}">${r.responder_role}</span>
                    <span>${formatDate(r.created_at)}</span>
                </div>
                ${escapeHtml(r.message)}
            </div>`).join("")
        : `<p style="color:#94a3b8;font-size:.88rem;">No responses yet — be the first to reply.</p>`;

    document.getElementById("admin-detail-panel").innerHTML = `
        <h2>${escapeHtml(ticket.title)}</h2>
        <div class="admin-detail-meta">
            <span>Ticket #${String(ticket.id).padStart(4,"0")}</span>
            <span>Submitted by <strong>${escapeHtml(ticket.submitted_by || "Unknown")}</strong></span>
            <span>${formatDate(ticket.created_at)}</span>
            ${ticket.priority ? `<span class="priority-badge priority-${ticket.priority}">${ticket.priority}</span>` : ""}
        </div>

        <div class="admin-desc">${escapeHtml(ticket.description)}</div>

        <!-- Status update -->
        <div class="admin-actions-row">
            <span class="admin-status-label">Status:</span>
            <select class="admin-status-full" id="admin-status-select">
                <option value="Open"        ${ticket.status === "Open"        ? "selected" : ""}>Open</option>
                <option value="In Progress" ${ticket.status === "In Progress" ? "selected" : ""}>In Progress</option>
                <option value="Resolved"    ${ticket.status === "Resolved"    ? "selected" : ""}>Resolved</option>
                <option value="Closed"      ${ticket.status === "Closed"      ? "selected" : ""}>Closed</option>
            </select>
            <button class="btn-update-status" onclick="adminUpdateStatus(${ticket.id})">Update Status</button>
        </div>

        <!-- Responses -->
        <div class="admin-responses">
            <h4>Conversation</h4>
            <div id="admin-responses-list">${responsesHtml}</div>
        </div>

        <!-- Reply box -->
        <div class="admin-reply-box">
            <h4>Reply to User</h4>
            <textarea id="admin-reply-text" placeholder="Type your reply here…" rows="4"></textarea>
            <button class="btn-send-reply" id="admin-reply-btn" onclick="adminSendReply(${ticket.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Send Reply
            </button>
        </div>
    `;
}

function backToAdminList() {
    document.getElementById("admin-tickets-list-view").style.display  = "block";
    document.getElementById("admin-ticket-detail-view").style.display = "none";
    renderAdminTicketsTable();
}

async function adminUpdateStatus(ticketId) {
    const select    = document.getElementById("admin-status-select");
    const newStatus = select.value;
    const result    = await apiPatch(`/tickets/${ticketId}/status`, { status: newStatus });
    if (result) {
        showToast(`Status updated to "${newStatus}".`, "success");
        // Update local cache
        const t = allAdminTickets.find(t => t.id === ticketId);
        if (t) t.status = newStatus;
    }
}

async function adminSendReply(ticketId) {
    const textarea = document.getElementById("admin-reply-text");
    const btn      = document.getElementById("admin-reply-btn");
    const message  = textarea.value.trim();
    if (!message) { showToast("Please type a reply first.", "error"); return; }
    btn.disabled = true; btn.textContent = "Sending…";
    const result = await apiPost(`/tickets/${ticketId}/responses`, { message });
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send Reply`;
    if (result) {
        showToast("Reply sent!", "success");
        textarea.value = "";
        // Refresh the detail view to show new reply
        await openAdminTicketDetail(ticketId);
    }
}

// ── Users Table ───────────────────────────────
function renderAdminUsers() {
    document.getElementById("admin-users-tbody").innerHTML = allUsers.length
        ? allUsers.map(u => `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar">${escapeHtml(u.name.charAt(0).toUpperCase())}</div>
                        <span style="font-weight:600;color:#0f172a">${escapeHtml(u.name)}</span>
                    </div>
                </td>
                <td style="color:#64748b">${escapeHtml(u.email)}</td>
                <td><span class="${u.role === "admin" ? "role-badge-admin" : "role-badge-user"}">${u.role}</span></td>
                <td style="color:#64748b">${formatDate(u.created_at)}</td>
            </tr>`).join("")
        : `<tr><td colspan="4" class="table-empty">No users found.</td></tr>`;
}

// ═══════════════════════════════════════════════
//  SHARED UTILITIES
// ═══════════════════════════════════════════════

function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast     = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${type === "success"
                ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
                : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
        </svg>
        ${escapeHtml(message)}`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add("exit"); setTimeout(() => toast.remove(), 300); }, 3500);
}

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
function statusClass(status) {
    return { Open: "open", "In Progress": "in-progress", Resolved: "resolved", Closed: "closed" }[status] || "open";
}
function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const diff = Date.now() - date;
    if (diff < 60000)    return "Just now";
    if (diff < 3600000)  return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff/86400000)}d ago`;
    return date.toLocaleDateString("en-SG", { day:"numeric", month:"short", year:"numeric" });
}

// ─── Extra CSS ────────────────────────────────
const style = document.createElement("style");
style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    .spin { animation: spin 0.8s linear infinite; }
    .priority-badge { display:inline-block;font-size:.72rem;font-weight:700;padding:.15rem .5rem;border-radius:99px;text-transform:uppercase;letter-spacing:.04em; }
    .priority-low    { background:#d1fae5;color:#065f46; }
    .priority-medium { background:#fef3c7;color:#92400e; }
    .priority-high   { background:#fee2e2;color:#991b1b; }
    .detail-responses { margin-top:1.5rem;border-top:1px solid var(--border,#e5e7eb);padding-top:1.5rem; }
    .detail-responses h4 { margin-bottom:1rem; }
    .response-item { padding:1rem;border-radius:10px;margin-bottom:.75rem; }
    .admin-response { background:#eff6ff;border:1px solid #bfdbfe; }
    .user-response  { background:var(--bg,#f9fafb);border:1px solid var(--border,#e5e7eb); }
    .response-meta  { display:flex;align-items:center;gap:.6rem;margin-bottom:.4rem;font-size:.85rem;color:var(--text-muted); }
    .response-meta strong { color:var(--text,#111827); }
    .resp-role-badge { font-size:.7rem;font-weight:700;text-transform:uppercase;background:var(--border,#e5e7eb);padding:.1rem .45rem;border-radius:99px; }
`;
document.head.appendChild(style);

// ─── Init ─────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    syncNavAuth();
    showPage("home");
});
