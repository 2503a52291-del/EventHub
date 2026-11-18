document.addEventListener("DOMContentLoaded", function () {

    const eventCards = document.querySelectorAll(".event-card");


    eventCards.forEach(card => {

        const eventId = card.dataset.eventId;

        const detailsPanel =
            card.querySelector(".event-details-panel");

        const viewButton =
            card.querySelector(".view-details-btn");

        const closeButton =
            card.querySelector(".close-details-btn");

        const backButton =
            card.querySelector(".close-details-bottom");

        const registerButton =
            card.querySelector(".open-registration-btn");

        const cancelButton =
            card.querySelector(".open-cancellation-btn");

        const registrationBox =
            card.querySelector(".registration-box");

        const cancellationBox =
            card.querySelector(".cancellation-section");

        const registrationForm =
            card.querySelector(".registration-form");

        const cancellationForm =
            card.querySelector(".cancellation-form");


        // OPEN EVENT DETAILS
        viewButton.addEventListener("click", function () {

            detailsPanel.hidden = false;

        });


        // CLOSE EVENT DETAILS
        function closeDetails() {

            detailsPanel.hidden = true;

            registrationBox.hidden = true;
            cancellationBox.hidden = true;

        }

        closeButton.addEventListener("click", closeDetails);

        backButton.addEventListener("click", closeDetails);


        // OPEN REGISTRATION FORM
        registerButton.addEventListener("click", function () {

            registrationBox.hidden = !registrationBox.hidden;

            cancellationBox.hidden = true;

        });


        // OPEN CANCELLATION FORM
        cancelButton.addEventListener("click", function () {

            cancellationBox.hidden = !cancellationBox.hidden;

            registrationBox.hidden = true;

        });


        // REGISTRATION
        registrationForm.addEventListener("submit", async function (e) {

            e.preventDefault();

            const submitButton =
                registrationForm.querySelector("button[type='submit']");

            const message =
                card.querySelector(".registration-message");

            const formData = new FormData(registrationForm);

            const username = formData.get("username").trim();

            const email = formData.get("email").trim();


            submitButton.disabled = true;

            message.textContent = "Processing registration...";

            try {

                const response = await fetch("/register", {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        username: username,

                        email: email,

                        event_id: eventId

                    })

                });


                const result = await response.json();


                if (result.success) {

                    message.textContent =
                        result.message || "Registration successful!";

                    message.className =
                        "registration-message success-message";

                    registrationForm.reset();

                    await updateEventSeats(card);

                } else {

                    message.textContent =
                        result.message || "Registration failed.";

                    message.className =
                        "registration-message error-message";

                }

            } catch (error) {

                message.textContent =
                    "Unable to connect to the server.";

            } finally {

                submitButton.disabled = false;

            }

        });


        // CANCELLATION
        cancellationForm.addEventListener("submit", async function (e) {

            e.preventDefault();

            const submitButton =
                cancellationForm.querySelector("button[type='submit']");

            const message =
                card.querySelector(".cancellation-message");

            const formData = new FormData(cancellationForm);

            const email = formData.get("email").trim();


            submitButton.disabled = true;

            message.textContent = "Processing cancellation...";

            try {

                const response = await fetch("/cancel", {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        email: email,

                        event_id: eventId

                    })

                });


                const result = await response.json();


                if (result.success) {

                    message.textContent =
                        result.message || "Registration cancelled successfully!";

                    message.className =
                        "cancellation-message success-message";

                    cancellationForm.reset();

                    await updateEventSeats(card);

                } else {

                    message.textContent =
                        result.message || "Cancellation failed.";

                    message.className =
                        "cancellation-message error-message";

                }

            } catch (error) {

                message.textContent =
                    "Unable to connect to the server.";

            } finally {

                submitButton.disabled = false;

            }

        });

    });


    // UPDATE AVAILABLE SEATS
    async function updateEventSeats(card) {

        try {

            const response =
                await fetch("/api/admin/dashboard");

            const data = await response.json();

            const eventId = card.dataset.eventId;

            const event = data.events.find(
                item => String(item.id) === String(eventId)
            );

            if (event) {

                const availableSeats =
                    card.querySelector(".available-seats");

                const detailsSeats =
                    card.querySelector(".details-available-seats");

                if (availableSeats) {
                    availableSeats.textContent = event.available_seats;
                }

                if (detailsSeats) {
                    detailsSeats.textContent = event.available_seats;
                }

            }

        } catch (error) {

            console.error("Unable to update available seats:", error);

        }

    }

});