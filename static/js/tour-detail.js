/**
 * Tour detail page.
 * Loads the tour, its expenses, and the settlement report, and lets members
 * add, edit, and remove expenses.
 * Shared helpers come from app.js and toast.js.
 */

let tourId = null;
let currentTour = null;
let editingExpenseId = null;
let pendingDelete = null;   // { kind: "tour" | "expense", id }
let pendingPay = null;      // { toUserId, toUserName, amount }


document.addEventListener("DOMContentLoaded", () => {

    if (!isAuthenticated()) {
        return;
    }

    tourId = readTourIdFromUrl();

    if (!tourId) {
        showErrorState("That tour link doesn't look right. Pick a tour from your list instead.");
        return;
    }

    setupExpenseModal();
    setupDeleteModal();
    setupPayModal();
    setupTourActions();

    document.addEventListener("paytogether:settlement-updated", () => {
        loadReport();
        loadBalances();
    });

    loadTourDetails();
    resolveStripeRedirect();

});


/** The URL looks like /tours/12/ so the id is the last numeric segment. */
function readTourIdFromUrl() {

    const parts = window.location.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];

    return /^\d+$/.test(last) ? last : null;

}


/* ------------------------------------------------------------------ */
/* Tour details                                                        */
/* ------------------------------------------------------------------ */

async function loadTourDetails() {

    try {

        const response = await apiRequest(`/api/tours/${tourId}/`);

        if (response.status === 404 || response.status === 403) {
            showErrorState("This tour doesn't exist, or you're not part of it.");
            return;
        }

        if (!response.ok) {
            showErrorState("We couldn't load this tour. Try again in a moment.");
            return;
        }

        currentTour = await response.json();

        displayTourDetails(currentTour);

        loadExpenses();
        loadReport();
        loadBalances();

    }
    catch (error) {

        console.error(error);
        showErrorState("We couldn't reach the server. Check your connection and try again.");

    }

}


const STATUS_STYLES = {
    planned:   "bg-white/15 text-white",
    ongoing:   "bg-gold text-ink",
    completed: "bg-owed text-white",
    cancelled: "bg-owe text-white",
};


function displayTourDetails(tour) {

    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("tourDetailsContainer").classList.remove("hidden");

    document.getElementById("tourTitle").textContent = tour.title || "Tour";
    document.getElementById("tourDestination").textContent = tour.destination || "—";

    document.getElementById("tourDates").textContent =
        `${formatDate(tour.start_date)} to ${formatDate(tour.end_date)} · ${nightCount(tour)}`;

    document.getElementById("tourDescription").textContent =
        tour.description || "No description was added.";

    const statusChip = document.getElementById("tourStatus");
    statusChip.textContent = tour.status || "planned";
    statusChip.className =
        "inline-block rounded-full px-3 py-1 text-xs font-semibold tracking-wide " +
        (STATUS_STYLES[tour.status] || STATUS_STYLES.planned);

    document.getElementById("statBudget").textContent = formatMoney(tour.budget);
    document.getElementById("statMembers").textContent = tour.member_count ?? 1;

    // Creator-only controls.
    document.querySelectorAll(".ownerOnly").forEach((element) => {
        element.classList.toggle("hidden", !tour.is_owner);
    });

    if (tour.is_owner) {
        document.getElementById("tourJoinCode").textContent = tour.join_code || "—";
        document.getElementById("editTourBtn").href = `/tours/edit/${tour.id}/`;
    }

    const image = document.getElementById("tourImage");

    if (tour.image) {
        image.src = tour.image;
        image.alt = "";
        image.classList.remove("hidden");
    }

}


function nightCount(tour) {

    if (!tour.start_date || !tour.end_date) {
        return "dates not set";
    }

    const start = new Date(tour.start_date);
    const end = new Date(tour.end_date);

    const days = Math.round((end - start) / 86400000) + 1;

    return days === 1 ? "1 day" : `${days} days`;

}


function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });

}


function showErrorState(message) {

    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("tourDetailsContainer").classList.add("hidden");

    const errorState = document.getElementById("errorState");

    document.getElementById("errorMessage").textContent = message;
    errorState.classList.remove("hidden");

}


/* ------------------------------------------------------------------ */
/* Expenses                                                            */
/* ------------------------------------------------------------------ */

const CATEGORY_TINTS = {
    food:          "bg-gold/15 text-[#8A5D0F]",
    transport:     "bg-brand/10 text-brand2",
    accommodation: "bg-ink/10 text-ink",
    activities:    "bg-owed/10 text-owed",
    shopping:      "bg-owe/10 text-owe",
    other:         "bg-ink/10 text-ink/70",
};


async function loadExpenses() {

    const list = document.getElementById("expenseList");

    try {

        const response = await apiRequest(`/api/tours/${tourId}/expenses/`);

        if (!response.ok) {
            throw new Error("Unable to load expenses.");
        }

        const data = await response.json();

        // The endpoint may be paginated or a plain list.
        const expenses = Array.isArray(data) ? data : (data.results || []);

        renderExpenses(expenses);

    }
    catch (error) {

        console.error(error);

        list.innerHTML = `
            <p class="px-6 py-8 text-center text-sm text-ink/55">
                Expenses couldn't be loaded. Try refreshing the page.
            </p>
        `;

    }

}


function renderExpenses(expenses) {

    renderExpenseList(expenses);

    const total = expenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
    );

    updateSpendStats(total);

}


/** Show the running total against the budget. */
function updateSpendStats(total) {

    document.getElementById("statTotalSpent").textContent = formatMoney(total);

    const budget = Number(currentTour?.budget || 0);
    const note = document.getElementById("statBudgetNote");

    if (budget > 0) {
        const left = budget - total;
        note.textContent = left >= 0
            ? `${formatMoney(left)} left`
            : `${formatMoney(Math.abs(left))} over`;
        note.className = left >= 0 ? "mt-1 text-xs text-ink/45" : "mt-1 text-xs text-owe";
    }
    else {
        note.textContent = "No budget set";
    }

}


function renderExpenseList(expenses) {

    const list = document.getElementById("expenseList");

    if (!expenses.length) {

        list.innerHTML = `
            <div class="px-6 py-12 text-center">
                <p class="text-sm text-ink/55">
                    Nothing recorded yet. Add the first expense and everyone's share
                    updates straight away.
                </p>
            </div>
        `;

        return;
    }

    list.innerHTML = expenses.map((expense) => {

        const tint = CATEGORY_TINTS[expense.category] || CATEGORY_TINTS.other;

        const canEdit = expense.is_owner || currentTour?.is_owner;

        const actions = canEdit
            ? `
                <button type="button"
                        data-edit-expense="${expense.id}"
                        class="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium
                               transition hover:border-brand hover:text-brand2">
                    Edit
                </button>
                <button type="button"
                        data-delete-expense="${expense.id}"
                        class="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium
                               text-owe transition hover:border-owe hover:bg-owe hover:text-white">
                    Delete
                </button>
              `
            : "";

        return `
            <div class="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">

                <div class="min-w-0">

                    <p class="font-medium">
                        ${escapeHtml(expense.description || expense.category_display)}
                    </p>

                    <p class="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink/55">
                        <span class="rounded-full px-2 py-0.5 font-medium ${tint}">
                            ${escapeHtml(expense.category_display)}
                        </span>
                        <span>paid by ${escapeHtml(expense.paid_by_name)}</span>
                        <span class="tnum">${escapeHtml(formatDate(expense.expense_date))}</span>
                    </p>

                </div>

                <div class="flex items-center gap-4">

                    <span class="font-display text-lg font-semibold tnum">
                        ${escapeHtml(formatMoney(expense.amount))}
                    </span>

                    <span class="flex gap-2">${actions}</span>

                </div>

            </div>
        `;

    }).join("");

    list.querySelectorAll("[data-edit-expense]").forEach((button) => {
        button.addEventListener("click", () => {
            const expense = expenses.find(
                (item) => String(item.id) === button.dataset.editExpense
            );
            openExpenseModal(expense);
        });
    });

    list.querySelectorAll("[data-delete-expense]").forEach((button) => {
        button.addEventListener("click", () => {
            openDeleteModal("expense", button.dataset.deleteExpense);
        });
    });

}


/* ------------------------------------------------------------------ */
/* Expense modal                                                       */
/* ------------------------------------------------------------------ */

function setupExpenseModal() {

    document.getElementById("addExpenseBtn")
        .addEventListener("click", () => openExpenseModal(null));

    document.querySelectorAll(".expenseModalClose").forEach((element) => {
        element.addEventListener("click", closeExpenseModal);
    });

    document.getElementById("expenseForm")
        .addEventListener("submit", saveExpense);

}


function openExpenseModal(expense) {

    editingExpenseId = expense ? expense.id : null;

    document.getElementById("expenseModalTitle").textContent =
        expense ? "Edit this expense" : "Add an expense";

    document.getElementById("saveExpenseBtn").textContent =
        expense ? "Save changes" : "Save expense";

    document.getElementById("expenseAmount").value = expense ? expense.amount : "";
    document.getElementById("expenseCategory").value = expense ? expense.category : "food";
    document.getElementById("expenseDescription").value = expense ? expense.description : "";

    document.getElementById("expenseDate").value =
        expense ? expense.expense_date : new Date().toISOString().slice(0, 10);

    hideExpenseError();

    document.getElementById("expenseModal").classList.remove("hidden");
    document.getElementById("expenseAmount").focus();

}


function closeExpenseModal() {
    document.getElementById("expenseModal").classList.add("hidden");
    editingExpenseId = null;
}


function showExpenseError(message) {
    const field = document.getElementById("expenseFormError");
    field.textContent = message;
    field.classList.remove("hidden");
}


function hideExpenseError() {
    document.getElementById("expenseFormError").classList.add("hidden");
}


async function saveExpense(event) {

    event.preventDefault();
    hideExpenseError();

    const amount = document.getElementById("expenseAmount").value;

    if (!amount || Number(amount) <= 0) {
        showExpenseError("Enter an amount greater than zero.");
        return;
    }

    const payload = {
        amount: amount,
        category: document.getElementById("expenseCategory").value,
        description: document.getElementById("expenseDescription").value.trim(),
        expense_date: document.getElementById("expenseDate").value,
    };

    const button = document.getElementById("saveExpenseBtn");
    const originalLabel = button.textContent;

    button.disabled = true;
    button.textContent = "Saving…";

    try {

        const url = editingExpenseId
            ? `/api/expenses/${editingExpenseId}/`
            : `/api/tours/${tourId}/expenses/`;

        const response = await apiRequest(url, {
            method: editingExpenseId ? "PATCH" : "POST",
            body: JSON.stringify(payload),
        });

        if (response.ok) {

            showToast(editingExpenseId ? "Expense updated." : "Expense added.", "success");

            closeExpenseModal();

            await loadExpenses();
            await loadReport();
            await loadBalances();

            return;
        }

        const errors = await response.json().catch(() => ({}));

        showExpenseError(firstErrorMessage(errors) || "That expense couldn't be saved.");

    }
    catch (error) {

        console.error(error);
        showExpenseError("We couldn't reach the server. Try again in a moment.");

    }
    finally {

        button.disabled = false;
        button.textContent = originalLabel;

    }

}


/** Pull the first readable message out of a DRF error response. */
function firstErrorMessage(errors) {

    if (!errors || typeof errors !== "object") {
        return null;
    }

    if (errors.detail) {
        return errors.detail;
    }

    const firstKey = Object.keys(errors)[0];

    if (!firstKey) {
        return null;
    }

    const value = errors[firstKey];

    return Array.isArray(value) ? value[0] : String(value);

}


/* ------------------------------------------------------------------ */
/* Settlement report                                                   */
/* ------------------------------------------------------------------ */

async function loadReport() {

    const body = document.getElementById("reportBody");

    try {

        const response = await apiRequest(`/api/tours/${tourId}/report/`);

        if (!response.ok) {
            throw new Error("Unable to load the report.");
        }

        const report = await response.json();

        document.getElementById("statShare").textContent =
            formatMoney(report.share_per_member);

        renderReport(report);
        renderCategories(report.category_breakdown || []);

    }
    catch (error) {

        console.error(error);

        body.innerHTML = `
            <p class="py-4 text-center text-sm text-ink/55">
                The settlement couldn't be worked out right now. Try the refresh button.
            </p>
        `;

    }

}


function renderReport(report) {

    const body = document.getElementById("reportBody");

    if (!report.members || !report.members.length) {
        body.innerHTML = `
            <p class="py-4 text-center text-sm text-ink/55">
                No members to settle up between yet.
            </p>
        `;
        return;
    }

    if (Number(report.total_expense) === 0) {
        body.innerHTML = `
            <p class="py-4 text-center text-sm text-ink/55">
                Once expenses are added, everyone's share shows up here.
            </p>
        `;
        return;
    }

    const rows = report.members.map((member) => {

        const balance = Number(member.balance);

        let rail = "bg-ink/20";
        let amountClass = "text-ink/60";
        let note = "settled up";

        if (balance > 0.005) {
            rail = "bg-owed";
            amountClass = "text-owed";
            note = `gets back ${formatMoney(balance)}`;
        }
        else if (balance < -0.005) {
            rail = "bg-owe";
            amountClass = "text-owe";
            note = `owes ${formatMoney(Math.abs(balance))}`;
        }

        const creatorTag = member.is_tour_creator
            ? `<span class="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand2">organiser</span>`
            : "";

        return `
            <div class="flex items-stretch gap-4 py-4">

                <span class="w-1 shrink-0 rounded-full ${rail}"></span>

                <div class="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                    <div>

                        <p class="flex items-center gap-2 font-medium">
                            ${escapeHtml(member.full_name)} ${creatorTag}
                        </p>

                        <p class="mt-1 text-xs text-ink/55 tnum">
                            paid ${escapeHtml(formatMoney(member.paid))}
                            · share ${escapeHtml(formatMoney(member.share))}
                        </p>

                    </div>

                    <p class="font-display text-sm font-semibold ${amountClass}">
                        ${escapeHtml(note)}
                    </p>

                </div>

            </div>
        `;

    }).join("");

    body.innerHTML = `
        <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2
                    rounded-xl bg-canvas px-4 py-3">

            <p class="text-sm text-ink/60">
                ${escapeHtml(formatMoney(report.total_expense))} across
                ${report.expense_count} ${report.expense_count === 1 ? "expense" : "expenses"},
                split between ${report.member_count}
            </p>

            <p class="font-display font-semibold tnum">
                ${escapeHtml(formatMoney(report.share_per_member))} each
            </p>

        </div>

        <div class="divide-y divide-ink/10">${rows}</div>
    `;

}


function renderCategories(categories) {

    const body = document.getElementById("categoryBody");

    if (!categories.length) {
        body.innerHTML = "";
        return;
    }

    const total = categories.reduce(
        (sum, item) => sum + Number(item.total || 0),
        0
    );

    const bars = categories
        .sort((a, b) => Number(b.total) - Number(a.total))
        .map((item) => {

            const percent = total > 0
                ? Math.round((Number(item.total) / total) * 100)
                : 0;

            return `
                <div>

                    <div class="flex items-baseline justify-between text-sm">
                        <span class="capitalize">${escapeHtml(item.category)}</span>
                        <span class="tnum text-ink/60">
                            ${escapeHtml(formatMoney(item.total))} · ${percent}%
                        </span>
                    </div>

                    <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas">
                        <div class="h-full rounded-full bg-brand" style="width: ${percent}%"></div>
                    </div>

                </div>
            `;

        }).join("");

    body.innerHTML = `
        <p class="mb-4 text-sm font-medium">Where the money went</p>
        <div class="space-y-3">${bars}</div>
    `;

}


/* ------------------------------------------------------------------ */
/* Settle up (pairwise payments) + Pay modal                           */
/* ------------------------------------------------------------------ */

const SETTLEMENT_STATUS_LABEL = {
    pending:   "Waiting for confirmation",
    approved:  "Settled",
    paid:      "Settled",
    rejected:  "Not confirmed",
    cancelled: "Cancelled",
};


async function loadBalances() {

    const body = document.getElementById("settleUpBody");

    try {

        const response = await apiRequest(`/api/tours/${tourId}/balances/`);

        if (!response.ok) {
            throw new Error("Unable to load balances.");
        }

        const data = await response.json();

        renderSettleUp(data.settle_up || []);

    }
    catch (error) {

        console.error(error);

        body.innerHTML = `
            <p class="py-2 text-center text-sm text-ink/55">
                Couldn't work out who owes what right now.
            </p>
        `;

    }

}


function renderSettleUp(settleUp) {

    const body = document.getElementById("settleUpBody");

    if (!settleUp.length) {
        body.innerHTML = `
            <p class="py-2 text-center text-sm text-ink/55">
                Everyone's settled up. Nothing to pay.
            </p>
        `;
        return;
    }

    body.innerHTML = settleUp.map((item) => {

        const pending = item.pending_settlement;

        let actionHtml = "";

        if (pending) {

            const badgeTint = pending.status === "rejected" ? "text-owe" : "text-ink/55";

            actionHtml = `
                <span class="text-xs font-medium ${badgeTint}">
                    ${escapeHtml(SETTLEMENT_STATUS_LABEL[pending.status] || pending.status)}
                    · ${escapeHtml(pending.method_display || pending.method)}
                </span>
            `;

            // The payee can confirm/reject a pending cash request right here too,
            // not just from the notification bell.
            if (pending.status === "pending" && pending.is_payee && ["cash", "raast"].includes(pending.method)) {
                actionHtml = `
                    <div class="flex items-center gap-2">
                        <button type="button" data-approve-settlement="${pending.id}"
                                class="rounded-lg bg-owed px-3 py-1.5 text-xs font-semibold
                                       text-white transition hover:brightness-110">
                            Confirm
                        </button>
                        <button type="button" data-reject-settlement="${pending.id}"
                                class="rounded-lg border border-ink/15 px-3 py-1.5 text-xs
                                       font-medium transition hover:border-owe hover:text-owe">
                            Reject
                        </button>
                    </div>
                `;
            }

        }
        else if (item.is_payer) {
            actionHtml = `
                <button type="button"
                        data-pay-to="${item.to_user_id}"
                        data-pay-name="${escapeHtml(item.to_user_name)}"
                        data-pay-amount="${item.amount}"
                        class="btn-primary rounded-lg px-4 py-2 text-xs font-semibold text-white">
                    Pay
                </button>
            `;
        }

        const line = item.is_payer
            ? `You owe <strong>${escapeHtml(item.to_user_name)}</strong>`
            : item.is_payee
                ? `<strong>${escapeHtml(item.from_user_name)}</strong> owes you`
                : `<strong>${escapeHtml(item.from_user_name)}</strong> owes
                   <strong>${escapeHtml(item.to_user_name)}</strong>`;

        return `
            <div class="flex flex-col gap-3 rounded-xl border border-ink/10 px-4 py-3
                        sm:flex-row sm:items-center sm:justify-between">

                <p class="text-sm text-ink/80">
                    ${line}
                    <span class="ml-1 font-display font-semibold text-ink tnum">
                        ${escapeHtml(formatMoney(item.amount))}
                    </span>
                </p>

                <div class="flex shrink-0 items-center gap-2 sm:justify-end">
                    ${actionHtml}
                </div>

            </div>
        `;

    }).join("");

    body.querySelectorAll("[data-pay-to]").forEach((button) => {
        button.addEventListener("click", () => {
            openPayModal({
                toUserId: button.dataset.payTo,
                toUserName: button.dataset.payName,
                amount: button.dataset.payAmount,
            });
        });
    });

    body.querySelectorAll("[data-approve-settlement]").forEach((button) => {
        button.addEventListener("click", () => resolveOwnSettlement(button.dataset.approveSettlement, "approve"));
    });

    body.querySelectorAll("[data-reject-settlement]").forEach((button) => {
        button.addEventListener("click", () => resolveOwnSettlement(button.dataset.rejectSettlement, "reject"));
    });

}


/** Approve/reject a cash settlement directly from the tour page's settle-up list. */
async function resolveOwnSettlement(settlementId, action) {

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

        loadReport();
        loadBalances();

    }
    catch (error) {
        console.error(error);
        showToast("We couldn't reach the server. Try again in a moment.", "error");
    }

}


function setupPayModal() {

    document.querySelectorAll(".payModalClose").forEach((element) => {
        element.addEventListener("click", closePayModal);
    });

    document.getElementById("payChooseCashBtn")
        .addEventListener("click", showPayCashStep);

    document.getElementById("payChooseCardBtn")
        .addEventListener("click", startCardPayment);

    document.getElementById("payChooseRaastBtn")
        .addEventListener("click", showPayRaastStep);

    document.getElementById("payCashBackBtn")
        .addEventListener("click", showPayChoiceStep);

    document.getElementById("payCashConfirmBtn")
        .addEventListener("click", confirmCashPayment);

    document.getElementById("payRaastBackBtn")
        .addEventListener("click", showPayChoiceStep);

    document.getElementById("payRaastConfirmBtn")
        .addEventListener("click", confirmRaastPayment);

    document.getElementById("copyRaastIdBtn")
        .addEventListener("click", copyRaastId);

    document.querySelectorAll("[data-raast-app]").forEach((button) => {
        button.addEventListener("click", () => openRaastPaymentApp(button.dataset.raastApp));
    });

}


function openPayModal(payment) {

    pendingPay = payment;

    document.getElementById("payModalName").textContent = payment.toUserName;
    document.getElementById("payModalAmount").textContent = formatMoney(payment.amount);
    document.getElementById("payCashAmount").textContent = formatMoney(payment.amount);
    document.getElementById("payCashName").textContent = payment.toUserName;
    document.getElementById("payRaastAmount").textContent = formatMoney(payment.amount);
    document.getElementById("payRaastName").textContent = payment.toUserName;

    hidePayMethodError();
    showPayChoiceStep();

    document.getElementById("payModal").classList.remove("hidden");

}


function closePayModal() {
    document.getElementById("payModal").classList.add("hidden");
    pendingPay = null;
}


function showPayChoiceStep() {
    document.getElementById("payStepChoice").classList.remove("hidden");
    document.getElementById("payStepCash").classList.add("hidden");
    document.getElementById("payStepRaast").classList.add("hidden");
}


function showPayCashStep() {
    document.getElementById("payStepChoice").classList.add("hidden");
    document.getElementById("payStepCash").classList.remove("hidden");
    document.getElementById("payStepRaast").classList.add("hidden");
}


async function showPayRaastStep() {

    if (!pendingPay) return;

    hidePayMethodError();
    document.getElementById("payRaastId").textContent = "Loading…";
    document.getElementById("payStepChoice").classList.add("hidden");
    document.getElementById("payStepCash").classList.add("hidden");
    document.getElementById("payStepRaast").classList.remove("hidden");

    try {
        const response = await apiRequest(
            `/api/tours/${tourId}/settlements/raast-recipient/${pendingPay.toUserId}/`
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(firstErrorMessage(data) || "Raast ID is unavailable.");

        document.getElementById("payRaastId").textContent = data.raast_id;
    }
    catch (error) {
        console.error(error);
        showPayMethodError(error.message || "Raast ID is unavailable.");
        showPayChoiceStep();
    }
}


async function copyRaastId() {
    const raastId = document.getElementById("payRaastId").textContent;
    if (!raastId || raastId === "Loading…") return;

    try {
        await navigator.clipboard.writeText(raastId);
        showToast("Raast ID copied. Paste it in your payment app.", "success");
    }
    catch (error) {
        showToast("Copy the Raast ID manually.", "info");
    }
}


function openRaastPaymentApp(app) {
    copyRaastId();

    // Payment providers do not offer a common recipient-safe deep link, so
    // copy the ID and let the user select the app installed on their device.
    const label = app === "jazzcash"
        ? "JazzCash"
        : app === "easypaisa"
            ? "Easypaisa"
            : "your banking app";
    showToast(`Raast ID copied. Open ${label} and send the payment using Raast ID.`, "info", 5000);
}


function showPayMethodError(message) {
    const field = document.getElementById("payMethodError");
    field.textContent = message;
    field.classList.remove("hidden");
}


function hidePayMethodError() {
    document.getElementById("payMethodError").classList.add("hidden");
}


/** Create the settlement request and notify the payee; used for cash. */
async function confirmCashPayment() {

    if (!pendingPay) {
        return;
    }

    const button = document.getElementById("payCashConfirmBtn");
    const originalLabel = button.textContent;

    button.disabled = true;
    button.textContent = "Sending…";

    try {

        const response = await apiRequest(`/api/tours/${tourId}/settlements/`, {
            method: "POST",
            body: JSON.stringify({
                payee: pendingPay.toUserId,
                amount: pendingPay.amount,
                method: "cash",
            }),
        });

        if (response.ok) {
            showToast(
                `Payment request sent to ${pendingPay.toUserName}. They'll confirm once received.`,
                "success"
            );
            closePayModal();
            loadReport();
            loadBalances();
            return;
        }

        const errors = await response.json().catch(() => ({}));
        showToast(firstErrorMessage(errors) || "That couldn't be sent. Try again.", "error");

    }
    catch (error) {
        console.error(error);
        showToast("We couldn't reach the server. Try again in a moment.", "error");
    }
    finally {
        button.disabled = false;
        button.textContent = originalLabel;
    }

}


/** Record a user-authorised manual Raast transfer for the receiver to confirm. */
async function confirmRaastPayment() {

    if (!pendingPay) return;

    const button = document.getElementById("payRaastConfirmBtn");
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Sending…";

    try {
        const response = await apiRequest(`/api/tours/${tourId}/settlements/`, {
            method: "POST",
            body: JSON.stringify({
                payee: pendingPay.toUserId,
                amount: pendingPay.amount,
                method: "raast",
            }),
        });

        if (!response.ok) {
            const errors = await response.json().catch(() => ({}));
            throw new Error(firstErrorMessage(errors) || "That couldn't be recorded.");
        }

        showToast(`Raast payment sent to ${pendingPay.toUserName} for confirmation.`, "success");
        closePayModal();
        loadReport();
        loadBalances();
    }
    catch (error) {
        console.error(error);
        showPayMethodError(error.message || "We couldn't reach the server. Try again in a moment.");
    }
    finally {
        button.disabled = false;
        button.textContent = originalLabel;
    }
}


/** Create the settlement, start a Stripe checkout session, then redirect. */
async function startCardPayment() {

    if (!pendingPay) {
        return;
    }

    hidePayMethodError();

    const cashBtn = document.getElementById("payChooseCashBtn");
    const cardBtn = document.getElementById("payChooseCardBtn");

    cashBtn.disabled = true;
    cardBtn.disabled = true;
    cardBtn.classList.add("opacity-60");

    try {

        const createResponse = await apiRequest(`/api/tours/${tourId}/settlements/`, {
            method: "POST",
            body: JSON.stringify({
                payee: pendingPay.toUserId,
                amount: pendingPay.amount,
                method: "card",
            }),
        });

        if (!createResponse.ok) {
            const errors = await createResponse.json().catch(() => ({}));
            showPayMethodError(firstErrorMessage(errors) || "That couldn't be started. Try again.");
            return;
        }

        const settlement = await createResponse.json();

        const checkoutResponse = await apiRequest(`/api/settlements/${settlement.id}/checkout/`, {
            method: "POST",
            body: JSON.stringify({ origin: window.location.origin }),
        });

        if (!checkoutResponse.ok) {
            const errors = await checkoutResponse.json().catch(() => ({}));
            showPayMethodError(
                firstErrorMessage(errors) ||
                "Card payments aren't set up yet. Ask the tour organiser to add Stripe keys."
            );
            return;
        }

        const { checkout_url: checkoutUrl } = await checkoutResponse.json();

        if (checkoutUrl) {
            window.location.href = checkoutUrl;
            return;
        }

        showPayMethodError("Stripe didn't return a checkout link. Try again.");

    }
    catch (error) {
        console.error(error);
        showPayMethodError("We couldn't reach the server. Try again in a moment.");
    }
    finally {
        cashBtn.disabled = false;
        cardBtn.disabled = false;
        cardBtn.classList.remove("opacity-60");
    }

}


/** After Stripe redirects back with ?settlement=<id>&session_id=..., sync it. */
async function resolveStripeRedirect() {

    const params = new URLSearchParams(window.location.search);
    const settlementId = params.get("settlement");
    const sessionId = params.get("session_id");
    const cancelledId = params.get("settlement_cancelled");

    if (cancelledId) {
        showToast("Card payment cancelled. Nothing was charged.", "info");
        window.history.replaceState({}, "", window.location.pathname);
        return;
    }

    if (!settlementId || !sessionId) {
        return;
    }

    try {

        const response = await apiRequest(`/api/settlements/${settlementId}/confirm/`, {
            method: "POST",
            body: JSON.stringify({ session_id: sessionId }),
        });

        if (response.ok) {

            const settlement = await response.json();

            if (settlement.status === "paid") {
                showToast(`Paid ${formatMoney(settlement.amount)} to ${settlement.payee_name}.`, "success");
            }
            else {
                showToast("We're still confirming that payment with Stripe.", "info");
            }

            loadReport();
            loadBalances();

        }

    }
    catch (error) {
        console.error(error);
    }
    finally {
        window.history.replaceState({}, "", window.location.pathname);
    }

}


/* ------------------------------------------------------------------ */
/* Deleting                                                            */
/* ------------------------------------------------------------------ */

function setupTourActions() {

    document.getElementById("deleteTourBtn")
        .addEventListener("click", () => openDeleteModal("tour", tourId));

    document.getElementById("refreshReportBtn")
        .addEventListener("click", () => {
            loadExpenses();
            loadReport();
            loadBalances();
            showToast("Settlement updated.", "info", 2000);
        });

    document.getElementById("copyJoinCodeBtn")
        .addEventListener("click", copyJoinCode);

    document.getElementById("shareJoinCodeBtn")
        .addEventListener("click", shareJoinCode);

}


function setupDeleteModal() {

    document.querySelectorAll(".deleteModalClose").forEach((element) => {
        element.addEventListener("click", closeDeleteModal);
    });

    document.getElementById("confirmDeleteBtn")
        .addEventListener("click", confirmDelete);

}


function openDeleteModal(kind, id) {

    pendingDelete = { kind: kind, id: id };

    document.getElementById("deleteModalTitle").textContent =
        kind === "tour" ? "Delete this tour?" : "Delete this expense?";

    document.getElementById("deleteModalMessage").textContent =
        kind === "tour"
            ? `"${currentTour?.title || "This tour"}" and every expense in it will be removed for all members. This can't be undone.`
            : "The expense will be removed and everyone's share will be recalculated.";

    document.getElementById("deleteModal").classList.remove("hidden");

}


function closeDeleteModal() {
    document.getElementById("deleteModal").classList.add("hidden");
    pendingDelete = null;
}


async function confirmDelete() {

    if (!pendingDelete) {
        return;
    }

    const button = document.getElementById("confirmDeleteBtn");
    const { kind, id } = pendingDelete;

    button.disabled = true;
    button.textContent = "Deleting…";

    try {

        const url = kind === "tour"
            ? `/api/tours/${id}/`
            : `/api/expenses/${id}/`;

        const response = await apiRequest(url, { method: "DELETE" });

        if (response.ok || response.status === 204) {

            if (kind === "tour") {
                window.location.replace("/tours/");
                return;
            }

            closeDeleteModal();

            showToast("Expense deleted.", "success");

            await loadExpenses();
            await loadReport();
            await loadBalances();

            return;
        }

        if (response.status === 403) {
            showToast("Only the person who added this can remove it.", "error");
        }
        else {
            showToast("That couldn't be deleted. Try again in a moment.", "error");
        }

        closeDeleteModal();

    }
    catch (error) {

        console.error(error);
        showToast("We couldn't reach the server. Try again in a moment.", "error");
        closeDeleteModal();

    }
    finally {

        button.disabled = false;
        button.textContent = "Delete";

    }

}


/* ------------------------------------------------------------------ */
/* Join code sharing                                                   */
/* ------------------------------------------------------------------ */

async function copyJoinCode() {

    const joinCode = currentTour?.join_code;

    if (!joinCode) {
        return;
    }

    try {
        await navigator.clipboard.writeText(joinCode);
        showToast("Join code copied.", "success");
    }
    catch (error) {
        console.error(error);
        showToast("Copying isn't available here. Type the code out instead.", "error");
    }

}


async function shareJoinCode() {

    const joinCode = currentTour?.join_code;

    if (!joinCode) {
        return;
    }

    if (navigator.share) {

        try {

            await navigator.share({
                title: `Join ${currentTour.title}`,
                text: `Join my tour "${currentTour.title}" on PayTogether with code ${joinCode}`,
            });

            return;

        }
        catch (error) {

            if (error.name === "AbortError") {
                return;
            }

            console.error(error);

        }

    }

    await copyJoinCode();

}
