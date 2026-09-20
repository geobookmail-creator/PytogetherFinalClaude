/**
 * Small shared toast helper.
 * Any page can call showToast("Expense saved.", "success").
 */

const TOAST_STYLES = {
    success: {
        bar: "bg-owed",
        icon: "&#10003;",
        iconColor: "text-owed",
    },
    error: {
        bar: "bg-owe",
        icon: "!",
        iconColor: "text-owe",
    },
    info: {
        bar: "bg-brand",
        icon: "i",
        iconColor: "text-brand",
    },
};


function showToast(message, type = "info", timeout = 4000) {

    const area = document.getElementById("toastArea");

    if (!area) {
        return;
    }

    const style = TOAST_STYLES[type] || TOAST_STYLES.info;

    const toast = document.createElement("div");

    toast.className =
        "flex items-stretch overflow-hidden rounded-xl bg-white shadow-card " +
        "border border-ink/10";

    toast.setAttribute("role", type === "error" ? "alert" : "status");

    toast.innerHTML = `
        <span class="w-1.5 ${style.bar}"></span>
        <span class="flex items-start gap-3 px-4 py-3">
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center
                         rounded-full border border-current text-[11px] font-bold
                         ${style.iconColor}">${style.icon}</span>
            <span class="text-sm leading-snug text-ink"></span>
        </span>
    `;

    toast.querySelector("span.text-sm").textContent = message;

    area.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, timeout);

}


/** Format a number as money, with thousands separators. */
function formatMoney(value) {

    const amount = Number(value || 0);

    return "PKR " + amount.toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

}
