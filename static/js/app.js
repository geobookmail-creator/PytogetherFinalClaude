/**
 * Shared app behaviour: tokens, authenticated requests, and the nav bar.
 * Loaded on every signed-in page before that page's own script.
 */

function getAccessToken() {
    return localStorage.getItem("access_token");
}

function getRefreshToken() {
    return localStorage.getItem("refresh_token");
}

function saveAccessToken(token) {
    localStorage.setItem("access_token", token);
}

function isAuthenticated() {
    const token = getAccessToken();

    if (!token) {
        return false;
    }

    try {
        const payload = JSON.parse(
            decodeURIComponent(
                atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
                    .split("")
                    .map((character) => `%${(`00${character.charCodeAt(0).toString(16)}`).slice(-2)}`)
                    .join("")
            )
        );

        // `exp` is measured in seconds. Treat malformed or expired tokens as
        // signed out instead of allowing a dashboard flash before redirecting.
        return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
    }
    catch (error) {
        return false;
    }
}

function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_name");
    window.location.replace("/login/");
}


/** Ask the server for a fresh access token using the stored refresh token. */
async function refreshAccessToken() {

    const refresh = getRefreshToken();

    if (!refresh) {
        return false;
    }

    try {

        const response = await fetch("/api/token/refresh/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refresh }),
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();

        saveAccessToken(data.access);

        return true;

    }
    catch (error) {
        console.error(error);
        return false;
    }

}


/**
 * Make an authenticated request. If the access token has expired, refresh it
 * once and retry, so the user is not bounced to the login page mid-task.
 */
async function apiRequest(url, options = {}, isRetry = false) {

    const settings = { ...options };

    settings.headers = {
        ...(options.headers || {}),
        "Authorization": `Bearer ${getAccessToken()}`,
    };

    // FormData sets its own multipart boundary, so don't override it.
    if (!(settings.body instanceof FormData) && !settings.headers["Content-Type"]) {
        settings.headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, settings);

    if (response.status === 401 && !isRetry) {

        const refreshed = await refreshAccessToken();

        if (refreshed) {
            return apiRequest(url, options, true);
        }

        logout();

    }

    return response;

}


/** Turn a full name into the initials shown in the nav avatar. */
function initialsFor(name) {

    return String(name || "")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");

}


async function loadNavUser() {

    const nameField = document.getElementById("userName");

    if (!nameField) {
        return null;
    }

    try {

        const response = await apiRequest("/api/profile/");

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        const user = data.user || data;

        nameField.textContent = user.full_name;

        const initialField = document.getElementById("userInitial");

        if (initialField) {
            initialField.textContent = initialsFor(user.full_name);
        }

        const welcome = document.getElementById("welcomeName");

        if (welcome) {
            welcome.textContent = user.full_name.split(" ")[0];
        }

        return user;

    }
    catch (error) {
        console.error(error);
        return null;
    }

}


function setupNav() {

    const logoutButton = document.getElementById("logoutBtn");

    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }

    const toggle = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("appSidebar");
    const backdrop = document.getElementById("sidebarBackdrop");

    if (!toggle || !sidebar || !backdrop) {
        return;
    }

    function openSidebar() {
        sidebar.classList.remove("-translate-x-full");
        backdrop.classList.remove("hidden");
    }

    function closeSidebar() {
        sidebar.classList.add("-translate-x-full");
        backdrop.classList.add("hidden");
    }

    toggle.addEventListener("click", openSidebar);
    backdrop.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeSidebar();
        }
    });

}


/** Send visitors without a token back to the login page. */
function requireAuth() {

    if (!isAuthenticated()) {
        window.location.replace("/login/");
        return false;
    }

    return true;

}


document.addEventListener("DOMContentLoaded", () => {

    if (!document.getElementById("appSidebar")) {
        return;
    }

    if (!requireAuth()) {
        return;
    }

    setupNav();
    loadNavUser();
    setupNotifications();

});


/* ------------------------------------------------------------------ */
/* Notifications (settlement requests, approvals, etc.)                */
/* ------------------------------------------------------------------ */

let notifPollTimer = null;

const NOTIF_ICONS = {
    payment_request:   { icon: "&#128176;", tint: "bg-gold/15 text-[#8A5D0F]" },
    payment_approved:  { icon: "&#10003;",  tint: "bg-owed/10 text-owed" },
    payment_rejected:  { icon: "&#33;",     tint: "bg-owe/10 text-owe" },
    payment_completed: { icon: "&#10003;",  tint: "bg-brand/10 text-brand2" },
};


function setupNotifications() {

    const button = document.getElementById("notifBtn");
    const panel = document.getElementById("notifPanel");
    const backdrop = document.getElementById("notifBackdrop");
    const markAllBtn = document.getElementById("notifMarkAllBtn");

    if (!button || !panel) {
        return;
    }

    function openPanel() {
        panel.classList.remove("hidden");
        backdrop.classList.remove("hidden");
        loadNotifications();
    }

    function closePanel() {
        panel.classList.add("hidden");
        backdrop.classList.add("hidden");
    }

    button.addEventListener("click", () => {
        panel.classList.contains("hidden") ? openPanel() : closePanel();
    });

    backdrop.addEventListener("click", closePanel);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closePanel();
        }
    });

    markAllBtn.addEventListener("click", async () => {
        try {
            await apiRequest("/api/notifications/read-all/", { method: "POST" });
            loadNotifications();
        }
        catch (error) {
            console.error(error);
        }
    });

    loadNotifications();

    // Light polling so a payment request shows up without a manual refresh.
    notifPollTimer = window.setInterval(loadNotifications, 25000);

}


async function loadNotifications() {

    const list = document.getElementById("notifList");
    const badge = document.getElementById("notifBadge");
    const badgeCount = document.getElementById("notifBadgeCount");

    if (!list) {
        return;
    }

    try {

        const response = await apiRequest("/api/notifications/");

        if (!response.ok) {
            throw new Error("Unable to load notifications.");
        }

        const data = await response.json();

        if (data.unread_count > 0) {
            badge.classList.remove("hidden");
            badge.classList.add("flex");
            badgeCount.textContent = data.unread_count > 9 ? "9+" : String(data.unread_count);
        }
        else {
            badge.classList.add("hidden");
            badge.classList.remove("flex");
        }

        renderNotifications(data.results || []);

    }
    catch (error) {
        console.error(error);
        list.innerHTML = `
            <p class="px-4 py-8 text-center text-sm text-ink/55">
                Notifications couldn't be loaded.
            </p>
        `;
    }

}


function renderNotifications(notifications) {

    const list = document.getElementById("notifList");

    if (!notifications.length) {
        list.innerHTML = `
            <p class="px-4 py-10 text-center text-sm text-ink/55">
                You're all caught up.
            </p>
        `;
        return;
    }

    list.innerHTML = notifications.map((item) => {

        const style = NOTIF_ICONS[item.notif_type] || NOTIF_ICONS.payment_completed;

        const canRespond =
            item.notif_type === "payment_request" &&
            item.settlement &&
            item.settlement.status === "pending" &&
            item.settlement.is_payee;

        const actions = canRespond ? `
            <div class="mt-2 flex gap-2">
                <button type="button" data-approve-settlement="${item.settlement.id}"
                        class="rounded-lg bg-owed px-3 py-1.5 text-xs font-semibold text-white
                               transition hover:brightness-110">
                    Confirm received
                </button>
                <button type="button" data-reject-settlement="${item.settlement.id}"
                        class="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium
                               transition hover:border-owe hover:text-owe">
                    Didn't get it
                </button>
            </div>
        ` : "";

        return `
            <div class="flex gap-3 px-4 py-3 ${item.is_read ? "" : "bg-brand/[0.04]"}"
                 data-notif-id="${item.id}">

                <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center
                             rounded-full text-sm ${style.tint}">${style.icon}</span>

                <div class="min-w-0 flex-1">
                    <p class="text-sm leading-snug text-ink/85">${escapeHtml(item.message)}</p>
                    <p class="mt-1 text-xs text-ink/45">${timeAgo(item.created_at)}</p>
                    ${actions}
                </div>

            </div>
        `;

    }).join("");

    list.querySelectorAll("[data-approve-settlement]").forEach((btn) => {
        btn.addEventListener("click", () => respondToSettlement(btn.dataset.approveSettlement, "approve"));
    });

    list.querySelectorAll("[data-reject-settlement]").forEach((btn) => {
        btn.addEventListener("click", () => respondToSettlement(btn.dataset.rejectSettlement, "reject"));
    });

}


/** Approve or reject a cash settlement request from the notification panel. */
async function respondToSettlement(settlementId, action) {

    try {

        const response = await apiRequest(`/api/settlements/${settlementId}/${action}/`, {
            method: "POST",
        });

        if (!response.ok) {
            throw new Error("That didn't go through.");
        }

        showToast(
            action === "approve" ? "Payment confirmed. You're settled up." : "Payment marked as not received.",
            action === "approve" ? "success" : "info"
        );

        loadNotifications();

        // Let the current page (e.g. a tour's settle-up list) know to refresh.
        document.dispatchEvent(new CustomEvent("paytogether:settlement-updated"));

    }
    catch (error) {
        console.error(error);
        showToast("We couldn't reach the server. Try again in a moment.", "error");
    }

}


/** Small "3m ago" / "2h ago" label for notification timestamps. */
function timeAgo(isoString) {

    const then = new Date(isoString).getTime();

    if (Number.isNaN(then)) {
        return "";
    }

    const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));

    if (seconds < 60) return "just now";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;

}


/** Escape text before putting it into innerHTML. */
function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
}
