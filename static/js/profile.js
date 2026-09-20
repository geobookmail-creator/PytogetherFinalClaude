/**
 * Profile page: edit your details and change your password.
 * Shared helpers come from app.js and toast.js.
 */

document.addEventListener("DOMContentLoaded", () => {

    if (!isAuthenticated()) {
        return;
    }

    loadProfile();

    document.getElementById("profileForm")
        .addEventListener("submit", saveProfile);

    document.getElementById("passwordForm")
        .addEventListener("submit", changePassword);

});


async function loadProfile() {

    try {

        const response = await apiRequest("/api/profile/");

        if (!response.ok) {
            throw new Error("Unable to load the profile.");
        }

        const data = await response.json();
        const user = data.user || data;

        document.getElementById("fullName").value = user.full_name || "";
        document.getElementById("email").value = user.email || "";
        document.getElementById("phone").value = user.phone || "";

    }
    catch (error) {

        console.error(error);
        showToast("We couldn't load your profile. Try refreshing the page.", "error");

    }

}


function setError(fieldId, message) {

    const field = document.getElementById(fieldId);

    if (message) {
        field.textContent = message;
        field.classList.remove("hidden");
    }
    else {
        field.classList.add("hidden");
    }

}


/** Pull the first readable message out of a DRF error response. */
function firstError(errors) {

    if (!errors || typeof errors !== "object") {
        return null;
    }

    if (errors.detail) {
        return errors.detail;
    }

    const key = Object.keys(errors)[0];

    if (!key) {
        return null;
    }

    const value = errors[key];

    return Array.isArray(value) ? value[0] : String(value);

}


async function saveProfile(event) {

    event.preventDefault();
    setError("profileError", null);

    const fullName = document.getElementById("fullName").value.trim();

    if (!fullName) {
        setError("profileError", "Enter the name your group will recognise.");
        return;
    }

    const button = document.getElementById("saveProfileBtn");

    button.disabled = true;
    button.textContent = "Saving…";

    try {

        const response = await apiRequest("/api/profile/", {
            method: "PATCH",
            body: JSON.stringify({
                full_name: fullName,
                phone: document.getElementById("phone").value.trim(),
            }),
        });

        if (response.ok) {

            showToast("Profile saved.", "success");

            // Keep the name in the top bar in step with the change.
            loadNavUser();

            return;
        }

        const errors = await response.json().catch(() => ({}));

        setError("profileError", firstError(errors) || "Your details couldn't be saved.");

    }
    catch (error) {

        console.error(error);
        setError("profileError", "We couldn't reach the server. Try again in a moment.");

    }
    finally {

        button.disabled = false;
        button.textContent = "Save changes";

    }

}


async function changePassword(event) {

    event.preventDefault();
    setError("passwordError", null);

    const oldPassword = document.getElementById("oldPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (newPassword.length < 8) {
        setError("passwordError", "Use at least 8 characters for the new password.");
        return;
    }

    if (newPassword !== confirmPassword) {
        setError("passwordError", "The two new passwords don't match.");
        return;
    }

    const button = document.getElementById("savePasswordBtn");

    button.disabled = true;
    button.textContent = "Changing…";

    try {

        const response = await apiRequest("/api/profile/change-password/", {
            method: "POST",
            body: JSON.stringify({
                old_password: oldPassword,
                new_password: newPassword,
                confirm_password: confirmPassword,
            }),
        });

        if (response.ok) {

            document.getElementById("passwordForm").reset();

            showToast("Password changed. Use it the next time you sign in.", "success");

            return;
        }

        const errors = await response.json().catch(() => ({}));

        setError("passwordError", firstError(errors) || "Your password couldn't be changed.");

    }
    catch (error) {

        console.error(error);
        setError("passwordError", "We couldn't reach the server. Try again in a moment.");

    }
    finally {

        button.disabled = false;
        button.textContent = "Change password";

    }

}
