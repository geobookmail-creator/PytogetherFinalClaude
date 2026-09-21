const registerForm = document.getElementById("registerForm");
const messageBox = document.getElementById("message");

registerForm.addEventListener("submit", registerUser);

async function registerUser(event) {
    event.preventDefault();

    messageBox.innerHTML = "";

    const full_name = document.getElementById("full_name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const raast_id = document.getElementById("raast_id").value.trim();
    const password = document.getElementById("password").value;
    const confirm_password = document.getElementById("confirm_password").value;

    if (
        !full_name ||
        !email ||
        !password ||
        !confirm_password
    ) {
        showMessage(
            "Please fill all required fields.",
            "red"
        );

        return;
    }

    if (password !== confirm_password) {
        showMessage(
            "Passwords do not match.",
            "red"
        );

        return;
    }

    try {

        const response = await fetch("/api/register/", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                full_name,
                email,
                phone,
                raast_id,
                password,
                confirm_password

            })

        });

        const data = await response.json();

        if (response.ok) {

            showMessage(
                "Account created. Taking you to the sign-in page…",
                "green"
            );

            registerForm.reset();

            setTimeout(() => {

                window.location.href = "/login/";

            }, 1500);

        }

        else {

            displayErrors(data);

        }

    }

    catch (error) {

        showMessage(

            "Server error. Please try again later.",

            "red"

        );

        console.error(error);

    }

}

function showMessage(message, color) {

    const style = color === "green"
        ? "border-owed/30 bg-owed/10 text-owed"
        : "border-owe/30 bg-owe/10 text-owe";

    messageBox.innerHTML = `
        <div class="rounded-lg border ${style} px-4 py-3 text-left text-sm"></div>
    `;

    messageBox.firstElementChild.textContent = message;

}

/** Show field-level errors returned by the API, in plain language. */
function displayErrors(errors) {

    const labels = {
        full_name: "Full name",
        email: "Email",
        phone: "Phone",
        raast_id: "Raast ID",
        password: "Password",
        confirm_password: "Repeat password",
    };

    const box = document.createElement("div");

    box.className =
        "rounded-lg border border-owe/30 bg-owe/10 px-4 py-3 text-left text-sm text-owe space-y-1";

    for (const field in errors) {

        const message = Array.isArray(errors[field])
            ? errors[field][0]
            : String(errors[field]);

        const line = document.createElement("p");

        line.textContent = field === "detail"
            ? message
            : `${labels[field] || field}: ${message}`;

        box.appendChild(line);

    }

    messageBox.innerHTML = "";
    messageBox.appendChild(box);

}
