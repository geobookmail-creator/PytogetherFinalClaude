let currentSearch = "";

let searchTimeout = null;

let currentPage = 1;

let totalTours = 0;

const toursPerPage = 5;

let selectedTourId = null;

let selectedTourTitle = "";


document.addEventListener("DOMContentLoaded", function () {

    checkAuthentication();

    setupSearch();

    setupPagination();

    setupTourActions();

    setupDeleteModal();


});



function setupDeleteModal() {

    const confirmDeleteBtn = document.getElementById(
        "confirmDeleteBtn"
    );


    const cancelDeleteBtn = document.getElementById(
        "cancelDeleteBtn"
    );


    const closeDeleteModalBtn = document.getElementById(
        "closeDeleteModalBtn"
    );


    const deleteModalOverlay = document.getElementById(
        "deleteModalOverlay"
    );


    // Confirm deletion

    confirmDeleteBtn.addEventListener(
        "click",
        function () {

            deleteTour();

        }
    );


    // Cancel deletion

    cancelDeleteBtn.addEventListener(
        "click",
        closeDeleteModal
    );


    // Close button

    closeDeleteModalBtn.addEventListener(
        "click",
        closeDeleteModal
    );


    // Click outside modal

    deleteModalOverlay.addEventListener(
        "click",
        closeDeleteModal
    );

}

function openDeleteModal(tourId, tourTitle) {

    selectedTourId = tourId;

    selectedTourTitle = tourTitle;


    const deleteModal = document.getElementById(
        "deleteModal"
    );


    const deleteModalMessage = document.getElementById(
        "deleteModalMessage"
    );


    deleteModalMessage.textContent =
        `Are you sure you want to delete "${tourTitle}"?`;


    deleteModal.classList.remove(
        "hidden"
    );


    document.body.classList.add(
        "overflow-hidden"
    );

}

function closeDeleteModal() {

    const deleteModal = document.getElementById(
        "deleteModal"
    );


    deleteModal.classList.add(
        "hidden"
    );


    document.body.classList.remove(
        "overflow-hidden"
    );


    selectedTourId = null;

    selectedTourTitle = "";

}

async function deleteTour() {

    if (!selectedTourId) {

        return;

    }

    const tourIdToDelete =
        selectedTourId;


    const tourTitleToDelete =
        selectedTourTitle;


    const token = localStorage.getItem(
        "access_token"
    );


    const confirmDeleteBtn = document.getElementById(
        "confirmDeleteBtn"
    );


    const originalButtonText =
        confirmDeleteBtn.textContent;


    confirmDeleteBtn.disabled = true;

    confirmDeleteBtn.textContent =
        "Deleting...";


    try {

        const response = await fetch(
            `/api/tours/${selectedTourId}/`,
            {

                method: "DELETE",

                headers: {

                    "Authorization": `Bearer ${token}`,

                },

            }
        );


        // Token expired or invalid

        if (response.status === 401) {

            handleUnauthorized();

            return;

        }


        // Tour does not exist or user does not own it

        if (response.status === 404) {

            closeDeleteModal();


            showMessage(
                "Tour not found or you do not have permission to delete it.",
                "error"
            );


            loadTours();

            return;

        }


        // Successful deletion

        if (response.status === 204) {

            closeDeleteModal();


            showMessage(
                `"${tourTitleToDelete}" deleted successfully.`,
                "success"
            );


            handlePageAfterDeletion();

            return;

        }


        // Other server errors

        let data = null;


        try {

            data = await response.json();

        }

        catch {

            // No JSON response

        }


        showMessage(
            getApiErrorMessage(data),
            "error"
        );

    }

    catch (error) {

        console.error(
            "Error deleting tour:",
            error
        );


        showMessage(
            "Unable to delete the tour. Please try again.",
            "error"
        );

    }

    finally {

        confirmDeleteBtn.disabled = false;

        confirmDeleteBtn.textContent =
            originalButtonText;

    }

}

function handlePageAfterDeletion() {

    const totalPagesBeforeDeletion =
        Math.ceil(
            totalTours / toursPerPage
        );


    const totalToursAfterDeletion =
        totalTours - 1;


    const totalPagesAfterDeletion =
        Math.ceil(
            totalToursAfterDeletion /
            toursPerPage
        );


    if (
        currentPage > totalPagesAfterDeletion &&
        currentPage > 1
    ) {

        currentPage--;

    }


    totalTours =
        totalToursAfterDeletion;


    loadTours();

}

function setupTourActions() {

    const tableBody = document.getElementById(
        "tourTableBody"
    );


    tableBody.addEventListener(
        "click",
        function (event) {

            // Edit button

            const copyJoinCodeButton =
                event.target.closest(".copyJoinCodeBtn");


            if (copyJoinCodeButton) {

                copyJoinCode(copyJoinCodeButton.dataset.joinCode);

                return;

            }


            const shareJoinCodeButton =
                event.target.closest(".shareJoinCodeBtn");


            if (shareJoinCodeButton) {

                shareJoinCode(
                    shareJoinCodeButton.dataset.joinCode,
                    shareJoinCodeButton.dataset.tourTitle
                );

                return;

            }


            // Edit button

            const editButton =
                event.target.closest(".editTourBtn");


            if (editButton) {

                const tourId =
                    editButton.dataset.tourId;


                window.location.href =
                    `/tours/edit/${tourId}/`;

                return;

            }


            // Delete button

            const deleteButton =
                event.target.closest(".deleteTourBtn");


            if (deleteButton) {

                const tourId =
                    deleteButton.dataset.tourId;


                const tourTitle =
                    deleteButton.dataset.tourTitle;


                openDeleteModal(
                    tourId,
                    tourTitle
                );

            }

        }
    );

}

function setupSearch() {

    const searchForm = document.getElementById(
        "searchForm"
    );

    const searchInput = document.getElementById(
        "searchInput"
    );

    const clearSearchBtn = document.getElementById(
        "clearSearchBtn"
    );


    // Search when form is submitted

    searchForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            clearTimeout(searchTimeout);

            currentSearch = searchInput.value.trim();

            currentPage = 1;

            loadTours();

        }
    );


    // Clear Search Button

    clearSearchBtn.addEventListener(
        "click",
        function () {

            clearTimeout(searchTimeout);

            searchInput.value = "";

            currentSearch = "";


            currentPage = 1;

            loadTours();

        }
    );


    // Live Search with Debounce

    searchInput.addEventListener(
        "input",
        function () {

            clearTimeout(searchTimeout);


            searchTimeout = setTimeout(
                function () {

                    currentSearch = searchInput.value.trim();

                    currentPage = 1;

                    loadTours();

                },
                500
            );

        }
    );

}


function checkAuthentication() {

    const token = localStorage.getItem("access_token");

    if (!token) {

        window.location.href = "/login/";

        return;

    }

    loadTours();

}

function renderTours(tours) {

    const container = document.getElementById("tourTableBody");

    container.innerHTML = "";

    tours.forEach(function (tour) {

        const cover = tour.image
            ? `<img src="${tour.image}" alt=""
                    class="h-40 w-full object-cover">`
            : `<div class="flex h-40 w-full items-center justify-center bg-ink/5
                          text-sm text-ink/35">No cover photo</div>`;

        const card = `

            <article class="overflow-hidden rounded-2xl bg-white shadow-card">

                <a href="/tours/${tour.id}/" class="block">
                    ${cover}
                </a>

                <div class="p-5">

                    <div class="flex items-start justify-between gap-3">

                        <a href="/tours/${tour.id}/"
                           class="font-display text-lg font-semibold leading-tight
                                  hover:text-brand2">
                            ${escapeHtml(tour.title)}
                        </a>

                        ${getStatusBadge(tour.status)}

                    </div>

                    <p class="mt-1 text-sm text-ink/55">
                        ${escapeHtml(tour.destination)}
                    </p>

                    <p class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/50">
                        <span class="tnum">
                            ${formatDate(tour.start_date)} to ${formatDate(tour.end_date)}
                        </span>
                        <span aria-hidden="true">&middot;</span>
                        <span>${tour.member_count ?? 1} ${(tour.member_count ?? 1) === 1 ? "member" : "members"}</span>
                    </p>

                    <div class="mt-4 grid grid-cols-2 gap-4 border-t border-ink/10 pt-4">

                        <span>
                            <span class="block text-xs text-ink/50">Spent</span>
                            <span class="mt-0.5 block whitespace-nowrap font-display text-sm
                                         font-semibold tnum">
                                ${formatCurrency(tour.total_expense)}
                            </span>
                        </span>

                        <span>
                            <span class="block text-xs text-ink/50">Budget</span>
                            <span class="mt-0.5 block whitespace-nowrap font-display text-sm
                                         font-semibold tnum">
                                ${formatCurrency(tour.budget)}
                            </span>
                        </span>

                    </div>

                    <div class="mt-4 rounded-lg bg-canvas px-3 py-2.5">

                        <div class="flex items-center justify-between gap-2">

                            <code class="font-display text-sm font-bold tracking-[0.2em] tnum">
                                ${escapeHtml(tour.join_code)}
                            </code>

                            <span class="flex gap-3 text-xs font-semibold">

                                <button type="button"
                                        class="copyJoinCodeBtn text-brand2 hover:underline"
                                        data-join-code="${escapeHtml(tour.join_code)}">
                                    Copy
                                </button>

                                <button type="button"
                                        class="shareJoinCodeBtn text-brand2 hover:underline"
                                        data-join-code="${escapeHtml(tour.join_code)}"
                                        data-tour-title="${escapeHtml(tour.title)}">
                                    Share
                                </button>

                            </span>

                        </div>

                    </div>

                    <div class="mt-4 flex items-center gap-3 text-sm font-semibold">

                        <a href="/tours/${tour.id}/"
                           class="text-brand2 hover:underline">
                            Open
                        </a>

                        <button type="button"
                                class="editTourBtn text-ink/70 hover:underline"
                                data-tour-id="${tour.id}">
                            Edit
                        </button>

                        <button type="button"
                                class="deleteTourBtn text-owe hover:underline"
                                data-tour-id="${tour.id}"
                                data-tour-title="${escapeHtml(tour.title)}">
                            Delete
                        </button>

                    </div>

                </div>

            </article>

        `;

        container.insertAdjacentHTML("beforeend", card);

    });

}


function formatCurrency(amount) {

    // Matches formatMoney() in toast.js so every screen reads the same.
    return "PKR " + Number(amount || 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

}


function formatDate(dateString) {

    if (!dateString) {

        return "-";

    }

    const date = new Date(
        `${dateString}T00:00:00`
    );

    return new Intl.DateTimeFormat(
        "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric",
        }
    ).format(date);

}


function getStatusBadge(status) {

    const statusMap = {

        planned: {
            label: "Planned",
            classes: "bg-brand/10 text-brand2"
        },

        ongoing: {
            label: "Ongoing",
            classes: "bg-gold/20 text-[#8A5D0F]"
        },

        completed: {
            label: "Completed",
            classes: "bg-owed/10 text-owed"
        },

        cancelled: {
            label: "Cancelled",
            classes: "bg-owe/10 text-owe"
        }

    };


    const statusData = statusMap[status] || {

        label: status || "Unknown",
        classes: "bg-ink/10 text-ink/70"

    };


    return `

        <span
            class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusData.classes}">

            ${escapeHtml(statusData.label)}

        </span>

    `;

}


function escapeHtml(value) {

    const text = String(value ?? "");

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}


async function copyJoinCode(joinCode) {

    try {

        await navigator.clipboard.writeText(joinCode);

        showMessage("Join code copied to your clipboard.", "success");

    }

    catch (error) {

        console.error("Unable to copy join code:", error);

        showMessage("Unable to copy the join code. Please copy it manually.", "error");

    }

}


async function shareJoinCode(joinCode, tourTitle) {

    const shareText = `Join my tour "${tourTitle}" with code: ${joinCode}`;

    if (navigator.share) {

        try {

            await navigator.share({
                title: `Join ${tourTitle}`,
                text: shareText,
            });

            return;

        }

        catch (error) {

            if (error.name === "AbortError") {

                return;

            }

            console.error("Unable to share join code:", error);

        }

    }

    await copyJoinCode(joinCode);

    showMessage("Sharing is not available here, so the join code was copied instead.", "success");

}


async function loadTours() {

    const token = localStorage.getItem("access_token");

    
    showLoading();

    const params = new URLSearchParams();

    params.set("page", currentPage);
    

    if (currentSearch.trim() !== "") {

        params.set(
            "search",
            currentSearch.trim()
        );

    }

    let apiUrl = `/api/tours/?${params.toString()}`;

    // if (currentSearch.trim() !== "") {

    //     apiUrl += `?search=${encodeURIComponent(
    //         currentSearch.trim()
    //     )}`;
        

    // }
    
    try {

        const response = await fetch(apiUrl, {

            method: "GET",

            headers: {

                "Authorization": `Bearer ${token}`,

                // "Content-Type": "application/json",

            },
            

        });


        if (response.status === 401) {

            handleUnauthorized();

            return;

        }


        if (!response.ok) {

            throw new Error(
                "Unable to load tours."
            );

        }


        const data = await response.json();

        console.log("Tour API Response:", data);

        totalTours = data.count;

        if (data.count === 0) {

            showEmptyState();

            updatePagination(null, null);

            return;

        }


        showTableContainer();


        renderTours(data.results);

        updatePagination(
            data.next,
            data.previous
        );

        

    }

    catch (error) {

        

        console.error(
            "Error loading tours:",
            error
        );

        showError(
            "Unable to load tours. Please try again."
        );

    }

}





function setupPagination() {

    const previousPageBtn = document.getElementById(
        "previousPageBtn"
    );

    const nextPageBtn = document.getElementById(
        "nextPageBtn"
    );


    previousPageBtn.addEventListener(
        "click",
        function () {

            if (currentPage > 1) {

                currentPage--;

                loadTours();

            }

        }
    );


    nextPageBtn.addEventListener(
        "click",
        function () {

            const totalPages = Math.ceil(
                totalTours / toursPerPage
            );


            if (currentPage < totalPages) {

                currentPage++;

                loadTours();

            }

        }
    );

}


function updatePagination(nextUrl, previousUrl) {

    const paginationContainer = document.getElementById(
        "paginationContainer"
    );

    const previousPageBtn = document.getElementById(
        "previousPageBtn"
    );

    const nextPageBtn = document.getElementById(
        "nextPageBtn"
    );

    const currentPageInfo = document.getElementById(
        "currentPageInfo"
    );

    const paginationInfo = document.getElementById(
        "paginationInfo"
    );


    if (totalTours === 0) {

        paginationContainer.classList.add("hidden");

        return;

    }


    paginationContainer.classList.remove("hidden");


    const totalPages = Math.ceil(
        totalTours / toursPerPage
    );


    const startItem =
        ((currentPage - 1) * toursPerPage) + 1;


    const endItem = Math.min(
        currentPage * toursPerPage,
        totalTours
    );


    paginationInfo.textContent =
        `Showing ${startItem}–${endItem} of ${totalTours} tours`;


    currentPageInfo.textContent =
        `Page ${currentPage} of ${totalPages}`;


    previousPageBtn.disabled = !previousUrl;

    nextPageBtn.disabled = !nextUrl;

}



function showLoading() {

    document
        .getElementById("loadingState")
        .classList
        .remove("hidden");


    document
        .getElementById("emptyState")
        .classList
        .add("hidden");


    document
        .getElementById("tableContainer")
        .classList
        .add("hidden");

    document
        .getElementById("paginationContainer")
        .classList
        .add("hidden");


    document
        .getElementById("messageArea")
        .innerHTML = "";

}


function showEmptyState() {

    document
        .getElementById("loadingState")
        .classList
        .add("hidden");


    document
        .getElementById("emptyState")
        .classList
        .remove("hidden");


    document
        .getElementById("tableContainer")
        .classList
        .add("hidden");

    document
    .getElementById("paginationContainer")
    .classList
    .add("hidden");


    const title = document.getElementById(
        "emptyStateTitle"
    );

    const message = document.getElementById(
        "emptyStateMessage"
    );

    const button = document.getElementById(
        "emptyStateButton"
    );


    if (currentSearch.trim() !== "") {

        title.textContent = "No Matching Tours";

        message.textContent =
            `We couldn't find any tours matching "${currentSearch}".`;

        button.classList.add("hidden");

    }

    else {

        title.textContent = "No Tours Found";

        message.textContent =
            "You haven't created any tours yet.";

        button.classList.remove("hidden");

    }

}

function showTableContainer() {

    document
        .getElementById("loadingState")
        .classList
        .add("hidden");


    document
        .getElementById("emptyState")
        .classList
        .add("hidden");


    document
        .getElementById("tableContainer")
        .classList
        .remove("hidden");

}


function showMessage(message, type) {

    const messageArea = document.getElementById(
        "messageArea"
    );


    const styles = {

        success:
            "border border-owed/30 bg-owed/10 text-owed",

        error:
            "border border-owe/30 bg-owe/10 text-owe"

    };


    messageArea.innerHTML = `

        <div class="${styles[type] || styles.error} rounded-lg px-4 py-3 text-sm">

            ${escapeHtml(message)}

        </div>

    `;

}


function handleUnauthorized() {

    localStorage.removeItem("access_token");

    localStorage.removeItem("refresh_token");


    window.location.href = "/login/";

}


function showError(message) {

    document
        .getElementById("loadingState")
        .classList
        .add("hidden");


    document
        .getElementById("emptyState")
        .classList
        .add("hidden");


    document
        .getElementById("tableContainer")
        .classList
        .add("hidden");


    document
        .getElementById("messageArea")
        .innerHTML = `

            <div class="bg-red-100 border border-red-300 text-red-700 px-5 py-4 rounded-lg">

                ${message}

            </div>

        `;

}
