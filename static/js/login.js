const loginForm = document.getElementById("loginForm");
const messageBox = document.getElementById("message");
const loginButton = document.getElementById("loginButton");

/**
 * The browser owns the JWT, so it is the only place that can decide whether
 * the initial route should be login or dashboard. Check its expiry as well as
 * its presence to avoid redirecting with a stale token.
 */
function hasValidAccessToken() {

    const token = localStorage.getItem("access_token");

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

        return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
    }
    catch (error) {
        return false;
    }
}

if (hasValidAccessToken()) {
    window.location.replace("/dashboard/");
}
else if (loginForm) {
    loginForm.addEventListener("submit", loginUser);
}

async function loginUser(event) {

    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    messageBox.innerHTML = "";

    loginButton.disabled = true;
    loginButton.textContent = "Signing in…";

    try {

        const response = await fetch("/api/login/", {

            method: "POST",

            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify({
                email,
                password,
            }),

        });

        const data = await response.json();

        if (response.ok) {

            localStorage.setItem(
                "access_token",
                data.tokens.access
            );

            localStorage.setItem(
                "refresh_token",
                data.tokens.refresh
            );

            localStorage.setItem(
                "user_name",
                data.user.full_name
            );

            showMessage(
                "Signed in. Taking you to your dashboard…",
                "success"
            );

            setTimeout(() => {

                window.location.href = "/dashboard/";

            }, 1000);

        } else {

            const errorMessage =
                data.detail ||
                data.non_field_errors?.[0] ||
                "Invalid email or password.";

            showMessage(
                errorMessage,
                "error"
            );

        }

    } catch (error) {

        console.error(error);

        showMessage(
            "Server error. Please try again.",
            "error"
        );

    }

    loginButton.disabled = false;
    loginButton.textContent = "Sign in";

}

function showMessage(message, type) {

    const style =
        type === "success"
            ? "border-owed/30 bg-owed/10 text-owed"
            : "border-owe/30 bg-owe/10 text-owe";

    messageBox.innerHTML = `
        <div class="rounded-lg border ${style} px-4 py-3 text-sm"></div>
    `;

    messageBox.firstElementChild.textContent = message;

}
