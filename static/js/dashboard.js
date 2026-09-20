/**
 * Dashboard page: headline numbers and the two tour lists.
 * Shared helpers (apiRequest, logout, escapeHtml) come from app.js.
 */

document.addEventListener("DOMContentLoaded", () => {

    if (!isAuthenticated()) {
        return;
    }

    loadTourDashboard();

});


async function loadTourDashboard() {

    try {

        const response = await apiRequest("/api/tours/dashboard/");

        if (!response.ok) {
            throw new Error("Unable to load tours.");
        }

        const data = await response.json();

        renderSummary(data.summary || {});

        renderTourSection(
            "createdTours",
            data.created_tours || [],
            "No tours yet. Start one and share the code with your group."
        );

        renderTourSection(
            "joinedTours",
            data.joined_tours || [],
            "Nobody has added you yet. Join a tour with the code a friend shares."
        );

    }
    catch (error) {

        console.error(error);

        showToast("We couldn't load your tours. Check your connection and try again.", "error");

        renderTourSection("createdTours", [], "Your tours couldn't be loaded.");
        renderTourSection("joinedTours", [], "Your tours couldn't be loaded.");

    }

}


function renderSummary(summary) {

    document.getElementById("totalToursCount").textContent =
        summary.total_tours ?? 0;

    document.getElementById("totalPeopleCount").textContent =
        summary.total_people ?? 0;

    document.getElementById("totalExpenseAmount").textContent =
        formatMoney(summary.total_expense);

    const balance = Number(summary.balance || 0);

    document.getElementById("balanceAmount").textContent =
        formatMoney(Math.abs(balance));

    const label = document.getElementById("balanceLabel");
    const card = document.getElementById("balanceCard");

    card.classList.remove("bg-ink", "bg-owed", "bg-owe");

    if (balance > 0.005) {
        card.classList.add("bg-owed");
        label.textContent = "You are owed this much";
    }
    else if (balance < -0.005) {
        card.classList.add("bg-owe");
        label.textContent = "You owe this much";
    }
    else {
        card.classList.add("bg-ink");
        label.textContent = "All settled up";
    }

}


const STATUS_STYLES = {
    planned:   "bg-brand/10 text-brand2",
    ongoing:   "bg-gold/15 text-[#8A5D0F]",
    completed: "bg-owed/10 text-owed",
    cancelled: "bg-owe/10 text-owe",
};


function renderTourSection(containerId, tours, emptyMessage) {

    const container = document.getElementById(containerId);

    if (!tours.length) {

        container.innerHTML = `
            <div class="rounded-xl border border-dashed border-ink/20 px-5 py-8 text-center">
                <p class="text-sm text-ink/55">${escapeHtml(emptyMessage)}</p>
            </div>
        `;

        return;
    }

    container.innerHTML = tours.map((tour) => {

        const statusClass = STATUS_STYLES[tour.status] || STATUS_STYLES.planned;

        return `
            <a href="/tours/${tour.id}/"
               class="flex items-center justify-between gap-4 rounded-xl border border-ink/10
                      px-5 py-4 transition hover:border-brand hover:bg-brand/5">

                <span class="min-w-0">

                    <span class="block truncate font-semibold">
                        ${escapeHtml(tour.title)}
                    </span>

                    <span class="mt-1 block text-sm text-ink/55">
                        ${escapeHtml(tour.destination)}
                    </span>

                    <span class="mt-2 inline-flex items-center gap-2">
                        <span class="rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}">
                            ${escapeHtml(tour.status)}
                        </span>
                        <span class="text-xs text-ink/50">
                            ${tour.member_count} ${tour.member_count === 1 ? "member" : "members"}
                        </span>
                    </span>

                </span>

                <span class="shrink-0 text-right">
                    <span class="block font-display font-semibold tnum">
                        ${escapeHtml(formatMoney(tour.total_expense))}
                    </span>
                    <span class="mt-1 block text-xs text-ink/45">spent</span>
                </span>

            </a>
        `;

    }).join("");

}
