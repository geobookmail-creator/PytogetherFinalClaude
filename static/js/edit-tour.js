let tourId = null;


document.addEventListener("DOMContentLoaded", function () {

    if (!checkAuthentication()) {

        return;

    }


    if (!getTourId()) {

        return;

    }


    setupEditForm();

    loadTour();
    
    displayCurrentImage(tour);

});


function displayCurrentImage(tour) {

    const container =
        document.getElementById(
            "currentImageContainer"
        );


    const image =
        document.getElementById(
            "currentImage"
        );


    if (tour.image) {

        image.src =
            tour.image;


        container.classList.remove(
            "hidden"
        );

    }

    else {

        container.classList.add(
            "hidden"
        );

    }

}

const imageInput =
    document.getElementById("image");


imageInput.addEventListener(
    "change",
    function () {

        const file =
            this.files[0];


        if (!file) {

            return;

        }


        if (!file.type.startsWith("image/")) {

            alert(
                "Please select an image file."
            );

            this.value = "";

            return;

        }


        const preview =
            document.getElementById(
                "newImagePreview"
            );


        const container =
            document.getElementById(
                "newImagePreviewContainer"
            );


        preview.src =
            URL.createObjectURL(file);


        container.classList.remove(
            "hidden"
        );

    }
);

function checkAuthentication() {

    const token = localStorage.getItem(
        "access_token"
    );


    if (!token) {

        window.location.href = "/login/";

        return false;

    }


    return true;

}

function getTourId() {

    const tourIdInput = document.getElementById(
        "tourId"
    );


    tourId = tourIdInput.value;


    if (!tourId) {

        showError(
            "Invalid tour ID."
        );

        return false;

    }


    return true;

}


async function loadTour() {

    const token = localStorage.getItem(
        "access_token"
    );


    try {

        const response = await fetch(
            `/api/tours/${tourId}/`,
            {

                method: "GET",

                headers: {

                    "Authorization": `Bearer ${token}`,

                    // "Content-Type": "application/json",

                },

            }
        );


        if (response.status === 401) {

            handleUnauthorized();

            return;

        }


        if (response.status === 404) {

            showError(
                "Tour not found or you do not have permission to access it."
            );

            return;

        }


        if (!response.ok) {

            throw new Error(
                "Unable to load tour."
            );

        }


        const tour = await response.json();


        console.log(
            "Tour Data:",
            tour
        );


        fillTourForm(tour);

        showForm();

    }

    catch (error) {

        console.error(
            "Error loading tour:",
            error
        );


        showError(
            "Unable to load tour information. Please try again."
        );

    }

}



function fillTourForm(tour) {

    document.getElementById("title").value =
        tour.title || "";


    document.getElementById("destination").value =
        tour.destination || "";


    document.getElementById("description").value =
        tour.description || "";


    document.getElementById("budget").value =
        tour.budget || "";


    document.getElementById("status").value =
        tour.status || "planned";


    document.getElementById("start_date").value =
        tour.start_date || "";


    document.getElementById("end_date").value =
        tour.end_date || "";

}

function showForm() {

    document
        .getElementById("loadingState")
        .classList
        .add("hidden");


    document
        .getElementById("formContainer")
        .classList
        .remove("hidden");

}

function setupEditForm() {

    const form = document.getElementById(
        "editTourForm"
    );


    form.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            updateTour();

        }
    );

}


async function updateTour() {

    const token = localStorage.getItem(
        "access_token"
    );


    const submitBtn = document.getElementById(
        "submitBtn"
    );


    const title = document.getElementById(
        "title"
    ).value.trim();


    const destination = document.getElementById(
        "destination"
    ).value.trim();


    const description = document.getElementById(
        "description"
    ).value.trim();


    const budget = document.getElementById(
        "budget"
    ).value;


    const status = document.getElementById(
        "status"
    ).value;


    const startDate = document.getElementById(
        "start_date"
    ).value;


    const endDate = document.getElementById(
        "end_date"
    ).value;


    if (!title || !destination) {

        showMessage(
            "Please fill in all required fields.",
            "error"
        );

        return;

    }


    if (!budget || Number(budget) < 0) {

        showMessage(
            "Please enter a valid budget.",
            "error"
        );

        return;

    }


    if (!startDate || !endDate) {

        showMessage(
            "Please select both start and end dates.",
            "error"
        );

        return;

    }


    if (new Date(endDate) < new Date(startDate)) {

        showMessage(
            "End date cannot be earlier than start date.",
            "error"
        );

        return;

    }


    // const tourData = {

    //     title: title,

    //     destination: destination,

    //     description: description,

    //     budget: budget,

    //     status: status,

    //     start_date: startDate,

    //     end_date: endDate,

    // };

    const formData = new FormData();

    formData.append(
    "title",
    title
);

formData.append(
    "destination",
    destination
);

formData.append(
    "description",
    description
);

formData.append(
    "budget",
    budget
);

formData.append(
    "start_date",
    startDate
);

formData.append(
    "end_date",
    endDate
);

formData.append(
    "status",
    status
);

const imageFile =
    imageInput.files[0];


if (imageFile) {

    formData.append(
        "image",
        imageFile
    );

}


    submitBtn.disabled = true;

    submitBtn.textContent = "Saving…";


    try {

        const response = await fetch(
            `/api/tours/${tourId}/`,
            {

                method: "PATCH",

                headers: {

                    "Authorization": `Bearer ${token}`,

                    // "Content-Type": "application/json",

                },

                // body: JSON.stringify(tourData),
                body: formData,

            }
        );


        if (response.status === 401) {

            handleUnauthorized();

            return;

        }


        if (response.status === 404) {

            showMessage(
                "Tour not found or you do not have permission to update it.",
                "error"
            );

            return;

        }


        const data = await response.json();


        if (!response.ok) {

            console.error(
                "Update errors:",
                data
            );


            const errorMessage =
                getApiErrorMessage(data);


            showMessage(
                errorMessage,
                "error"
            );

            return;

        }


        console.log(
            "Updated Tour:",
            data
        );


        showMessage(
            "Tour updated successfully!",
            "success"
        );


        setTimeout(
            function () {

                window.location.href = "/tours/";

            },
            1000
        );

    }

    catch (error) {

        console.error(
            "Error updating tour:",
            error
        );


        showMessage(
            "Unable to update the tour. Please try again.",
            "error"
        );

    }

    finally {

        submitBtn.disabled = false;

        submitBtn.textContent = "Save changes";

    }

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


    window.scrollTo({

        top: 0,

        behavior: "smooth"

    });

}


function getApiErrorMessage(data) {

    if (!data) {

        return "Unable to update the tour.";

    }


    if (typeof data === "string") {

        return data;

    }


    if (data.detail) {

        return data.detail;

    }


    const messages = [];


    for (const field in data) {

        const errors = Array.isArray(data[field])
            ? data[field]
            : [data[field]];


        errors.forEach(function (error) {

            messages.push(
                `${field}: ${error}`
            );

        });

    }


    return messages.length > 0
        ? messages.join(" ")
        : "Unable to update the tour.";

}


function handleUnauthorized() {

    localStorage.removeItem(
        "access_token"
    );


    localStorage.removeItem(
        "refresh_token"
    );


    window.location.href = "/login/";

}

function showError(message) {

    document
        .getElementById("loadingState")
        .classList
        .add("hidden");


    document
        .getElementById("formContainer")
        .classList
        .add("hidden");


    showMessage(
        message,
        "error"
    );

}

function escapeHtml(value) {

    const div = document.createElement("div");

    div.textContent = String(value ?? "");

    return div.innerHTML;

}