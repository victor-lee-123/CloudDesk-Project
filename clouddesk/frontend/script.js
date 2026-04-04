/* ============================================
   CloudDesk — User Frontend Logic
   ============================================ */

// ─── Configuration ──────────────────────────
// Your EC2 public IP — update this if the IP changes
const API_BASE_URL = "http://3.238.196.68:5000";

// ─── State ──────────────────────────────────
let allTickets = [];
let currentFilter = "all";
let currentSearch = "";

// ─── Page Navigation ────────────────────────
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));

    // Show target page
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.add("active");

    // Update nav links
    document.querySelectorAll(".nav-link").forEach(link => {
        link.classList.toggle("active", link.dataset.page === pageId);
    });

    // Load data when navigating
    if (pageId === "tickets") {
        loadTickets();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─── API Helpers ────────────────────────────
async function apiGet(endpoint) {
    try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`);
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
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("Backend error:", text);
            throw new Error(`HTTP ${res.status}: ${text}`);
        }

        return await res.json();
    } catch (err) {
        console.error("API POST error:", err);
        showToast("Failed to submit. Please try again.", "error");
        return null;
    }
}

// ─── Load Tickets ───────────────────────────
async function loadTickets() {
    const listEl = document.getElementById("tickets-list");
    const emptyEl = document.getElementById("empty-state");
    const statsEl = document.getElementById("ticket-stats");

    // Show skeleton loading
    listEl.innerHTML = Array(3)
        .fill('<div class="skeleton skeleton-row"></div>')
        .join("");
    emptyEl.style.display = "none";

    const data = await apiGet("/tickets");

    if (!data) {
        listEl.innerHTML = "";
        emptyEl.style.display = "block";
        statsEl.innerHTML = "";
        return;
    }

    allTickets = data;
    renderStats();
    renderTickets();
}

// ─── Render Stats ───────────────────────────
function renderStats() {
    const statsEl = document.getElementById("ticket-stats");
    const total = allTickets.length;
    const open = allTickets.filter(t => t.status === "Open").length;
    const inProgress = allTickets.filter(t => t.status === "In Progress").length;
    const resolved = allTickets.filter(t => t.status === "Resolved" || t.status === "Closed").length;

    statsEl.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Total</div>
            <div class="stat-value blue">${total}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Open</div>
            <div class="stat-value amber">${open}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">In Progress</div>
            <div class="stat-value purple">${inProgress}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Resolved</div>
            <div class="stat-value green">${resolved}</div>
        </div>
    `;
}

// ─── Render Tickets ─────────────────────────
function renderTickets() {
    const listEl = document.getElementById("tickets-list");
    const emptyEl = document.getElementById("empty-state");

    let filtered = allTickets;

    // Apply status filter
    if (currentFilter !== "all") {
        filtered = filtered.filter(t => t.status === currentFilter);
    }

    // Apply search
    if (currentSearch.trim()) {
        const q = currentSearch.toLowerCase();
        filtered = filtered.filter(
            t =>
                t.title.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                String(t.id).includes(q)
        );
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (filtered.length === 0) {
        listEl.innerHTML = "";
        emptyEl.style.display = "block";
        emptyEl.querySelector("h3").textContent =
            allTickets.length === 0 ? "No tickets yet" : "No matching tickets";
        emptyEl.querySelector("p").textContent =
            allTickets.length === 0
                ? "Submit your first support ticket to get started."
                : "Try adjusting your search or filter.";
        return;
    }

    emptyEl.style.display = "none";

    listEl.innerHTML = filtered
        .map(
            t => `
        <div class="ticket-row" onclick="showTicketDetail(${t.id})">
            <div class="ticket-info">
                <div class="ticket-title-text">${escapeHtml(t.title)}</div>
                <div class="ticket-meta">
                    <span class="ticket-id-label">#${String(t.id).padStart(4, "0")}</span>
                    <span>${formatDate(t.created_at)}</span>
                </div>
            </div>
            <div class="ticket-right">
                <span class="status-badge ${statusClass(t.status)}">${escapeHtml(t.status)}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted)"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        </div>
    `
        )
        .join("");
}

// ─── Filter & Search ────────────────────────
function filterTickets(status, btn) {
    currentFilter = status;
    document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    renderTickets();
}

function searchTickets(query) {
    currentSearch = query;
    renderTickets();
}

// ─── Ticket Detail ──────────────────────────
function showTicketDetail(id) {
    const ticket = allTickets.find(t => t.id === id);
    if (!ticket) return;

    const contentEl = document.getElementById("ticket-detail-content");

    contentEl.innerHTML = `
        <div class="detail-card">
            <div class="detail-header">
                <div class="detail-header-top">
                    <h2>${escapeHtml(ticket.title)}</h2>
                    <span class="status-badge ${statusClass(ticket.status)}">${escapeHtml(ticket.status)}</span>
                </div>
                <div class="detail-meta">
                    <span class="detail-meta-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Ticket #${String(ticket.id).padStart(4, "0")}
                    </span>
                    <span class="detail-meta-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        ${formatDate(ticket.created_at)}
                    </span>
                </div>
            </div>
            <div class="detail-body">
                <h4>Description</h4>
                <p class="detail-description">${escapeHtml(ticket.description)}</p>
            </div>
        </div>
    `;

    showPage("detail");
}

// ─── Submit Ticket ──────────────────────────
async function submitTicket() {
    const titleInput = document.getElementById("ticket-title");
    const descInput = document.getElementById("ticket-desc");
    const submitBtn = document.getElementById("submit-btn");

    const title = titleInput.value.trim();
    const description = descInput.value.trim();

    // Validate
    if (!title) {
        showToast("Please enter a title.", "error");
        titleInput.focus();
        return;
    }
    if (!description) {
        showToast("Please enter a description.", "error");
        descInput.focus();
        return;
    }

    // Disable button
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/></svg>
        Submitting...
    `;

    const result = await apiPost("/tickets", { title, description });

    submitBtn.disabled = false;
    submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        Submit Ticket
    `;

    if (result) {
        showToast("Ticket submitted successfully!", "success");
        clearForm();
        showPage("tickets");
    }
}

function clearForm() {
    document.getElementById("ticket-title").value = "";
    document.getElementById("ticket-desc").value = "";
}

// ─── Toast Notifications ────────────────────
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${
                type === "success"
                    ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
                    : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
            }
        </svg>
        ${escapeHtml(message)}
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("exit");
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ─── Utilities ──────────────────────────────
function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function statusClass(status) {
    const map = {
        Open: "open",
        "In Progress": "in-progress",
        Resolved: "resolved",
        Closed: "closed",
    };
    return map[status] || "open";
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) return "Just now";
    // Less than 1 hour
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    // Less than 24 hours
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    // Less than 7 days
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    // Otherwise full date
    return date.toLocaleDateString("en-SG", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

// ─── CSS for spinner ────────────────────────
const style = document.createElement("style");
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    .spin {
        animation: spin 0.8s linear infinite;
    }
`;
document.head.appendChild(style);

// ─── Init ───────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    showPage("home");
});