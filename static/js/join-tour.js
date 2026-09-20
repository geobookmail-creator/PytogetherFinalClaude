document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
        window.location.replace("/login/");
        return;
    }

    const form = document.getElementById("joinTourForm");
    const codeInput = document.getElementById("joinCode");
    const button = document.getElementById("joinButton");

    codeInput.addEventListener("input", () => {
        codeInput.value = codeInput.value.replace(/\s/g, "").toUpperCase();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const joinCode = codeInput.value.trim();
        if (!joinCode) {
            showMessage("Enter a join code.", "error");
            codeInput.focus();
            return;
        }

        button.disabled = true;
        button.textContent = "Joining…";
        try {
            const response = await fetch("/api/tours/join/", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ join_code: joinCode }),
            });
            const data = await response.json().catch(() => ({}));

            if (response.status === 401) {
                localStorage.clear();
                window.location.replace("/login/");
                return;
            }
            if (!response.ok) {
                const message = data.detail || data.join_code?.[0] || "Unable to join this tour.";
                showMessage(message, "error");
                return;
            }

            showMessage(data.message || "You joined the tour successfully.", "success");
            form.reset();
            setTimeout(() => window.location.assign("/dashboard/"), 800);
        } catch (error) {
            console.error("Join tour failed:", error);
            showMessage("Unable to connect to the server. Please try again.", "error");
        } finally {
            button.disabled = false;
            button.textContent = "Join tour";
        }
    });
});

function showMessage(message, type) {
    const classes = type === "success"
        ? "border-owed/30 bg-owed/10 text-owed"
        : "border-owe/30 bg-owe/10 text-owe";
    document.getElementById("messageArea").innerHTML =
        `<div class="rounded-lg border px-4 py-3 text-sm ${classes}">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value;
    return element.innerHTML;
}
