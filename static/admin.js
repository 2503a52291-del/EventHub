// ==========================================
// EventHub - Admin Dashboard JavaScript
// ==========================================


// HTML-safe text
function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, function (char) {

        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[char];

    });
}


// ==========================================
// LOAD ADMIN DASHBOARD
// ==========================================

async function loadDashboard() {

    const message = document.getElementById("dashboardMessage");

    try {

        const response = await fetch("/api/admin/dashboard", {
            cache: "no-store"
        });

        if (response.status === 401) {
            window.location.href = "/admin/login";
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load dashboard.");
        }

        // Summary cards
        document.getElementById("totalEvents").textContent =
            data.summary.total_events ?? data.events.length;

        document.getElementById("totalCapacity").textContent =
            data.summary.total_capacity;

        document.getElementById("totalRegistered").textContent =
            data.summary.registered;

        document.getElementById("availableSeats").textContent =
            data.summary.available_seats;

        // Display events
        displayEvents(data.events);

        // Display participants
        displayParticipants(data.participants);

        // Update event dropdown
        populateEventDropdown(data.events);

        message.textContent = "";

    } catch (error) {

        console.error("Dashboard Error:", error);

        message.textContent = error.message;

    }

}


// ==========================================
// DISPLAY EVENTS
// ==========================================

function displayEvents(events) {

    const tableBody = document.getElementById("eventsTableBody");

    if (!events || events.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="8">No events available.</td>
            </tr>
        `;

        return;
    }

    tableBody.innerHTML = events.map(event => {

        return `
            <tr>
                <td>${escapeHTML(event.id)}</td>
                <td>${escapeHTML(event.name)}</td>
                <td>${escapeHTML(event.date)}</td>
                <td>${escapeHTML(event.venue)}</td>
                <td>${escapeHTML(event.capacity)}</td>
                <td>${escapeHTML(event.registered)}</td>
                <td>${escapeHTML(event.available_seats)}</td>
                <td>${escapeHTML(event.occupancy)}%</td>
            </tr>
        `;

    }).join("");

}


// ==========================================
// DISPLAY PARTICIPANTS
// ==========================================

function displayParticipants(participants) {

    const tableBody = document.getElementById("participantsTableBody");

    if (!participants || participants.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="5">No participants registered yet.</td>
            </tr>
        `;

        return;
    }

    tableBody.innerHTML = participants.map(person => {

        return `
            <tr>
                <td>${escapeHTML(person.id)}</td>
                <td>${escapeHTML(person.name)}</td>
                <td>${escapeHTML(person.email)}</td>
                <td>${escapeHTML(person.event_name)}</td>
                <td>${escapeHTML(person.registered_at)}</td>
            </tr>
        `;

    }).join("");

}


// ==========================================
// POPULATE EVENT DROPDOWN
// ==========================================

function populateEventDropdown(events) {

    const dropdown = document.getElementById("testEvent");

    if (!dropdown) return;

    const selectedValue = dropdown.value;

    dropdown.innerHTML = `
        <option value="">Select an event</option>
    `;

    events.forEach(event => {

        const option = document.createElement("option");

        option.value = String(event.id);

        option.textContent =
            `${event.name} (${event.available_seats} seats available)`;

        dropdown.appendChild(option);

    });

    if (events.some(event => String(event.id) === selectedValue)) {
        dropdown.value = selectedValue;
    }

}


// ==========================================
// ADD NEW EVENT
// ==========================================

const addEventForm = document.getElementById("addEventForm");

if (addEventForm) {

    addEventForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const button = document.getElementById("addEventButton");

        const message = document.getElementById("addEventMessage");

        const eventData = {

            name: document.getElementById("eventName").value.trim(),

            date: document.getElementById("eventDate").value,

            description:
                document.getElementById("eventDescription").value.trim(),

            venue: document.getElementById("eventVenue").value.trim(),

            capacity: Number(
                document.getElementById("eventCapacity").value
            )

        };

        if (
            !eventData.name ||
            !eventData.date ||
            !eventData.description ||
            !eventData.venue ||
            !Number.isInteger(eventData.capacity) ||
            eventData.capacity < 1
        ) {

            message.textContent = "Please enter valid event details.";
            message.style.color = "red";

            return;
        }

        try {

            button.disabled = true;
            button.textContent = "Adding Event...";

            message.textContent = "Saving event...";

            const response = await fetch("/api/admin/events", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(eventData)

            });

            if (response.status === 401) {
                window.location.href = "/admin/login";
                return;
            }

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Unable to add event.");
            }

            message.textContent =
                result.message || "Event added successfully!";

            message.style.color = "green";

            addEventForm.reset();

            await loadDashboard();

        } catch (error) {

            console.error("Add Event Error:", error);

            message.textContent = error.message;
            message.style.color = "red";

        } finally {

            button.disabled = false;
            button.textContent = "Add Event";

        }

    });

}


// ==========================================
// REFRESH DASHBOARD
// ==========================================

const refreshButton = document.getElementById("refreshButton");

if (refreshButton) {

    refreshButton.addEventListener("click", loadDashboard);

}


// ==========================================
// CONCURRENT REGISTRATION TEST
// ==========================================

const concurrentButton = document.getElementById("runConcurrentTest");

if (concurrentButton) {

    concurrentButton.addEventListener("click", async function () {

        const eventDropdown = document.getElementById("testEvent");

        const name1Input = document.getElementById("member1Name");
        const email1Input = document.getElementById("member1Email");

        const name2Input = document.getElementById("member2Name");
        const email2Input = document.getElementById("member2Email");

        const results = document.getElementById("concurrentResults");

        // Read the current input values
        const eventId = eventDropdown.value;

        const name1 = name1Input.value.trim();
        const email1 = email1Input.value.trim();

        const name2 = name2Input.value.trim();
        const email2 = email2Input.value.trim();


        console.log("Concurrent Test Input:", {
            eventId,
            name1,
            email1,
            name2,
            email2
        });


        // Validate event selection
        if (!eventId) {

            results.textContent = "Please select an event.";

            return;
        }


        // Validate participant details
        if (!name1 || !email1 || !name2 || !email2) {

            results.textContent =
                "Please enter the name and email for both participants.";

            return;
        }


        // Validate email format
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email1) || !emailPattern.test(email2)) {

            results.textContent = "Please enter valid email addresses.";

            return;
        }


        // Prevent same email
        if (email1.toLowerCase() === email2.toLowerCase()) {

            results.textContent =
                "Please enter two different email addresses.";

            return;
        }


        try {

            concurrentButton.disabled = true;
            concurrentButton.textContent = "Testing...";

            results.innerHTML = `
                <p>Sending two registration requests simultaneously...</p>
            `;


            const participant1 = {

                name: name1,
                email: email1,
                event_id: Number(eventId)

            };


            const participant2 = {

                name: name2,
                email: email2,
                event_id: Number(eventId)

            };


            // Send both requests simultaneously
            const responses = await Promise.all([

                fetch("/register", {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(participant1)

                }),

                fetch("/register", {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(participant2)

                })

            ]);


            // Read both responses
            const resultsData = await Promise.all(

                responses.map(async response => {

                    const data = await response.json();

                    return {
                        ...data,
                        httpStatus: response.status
                    };

                })

            );


            // Display results
            results.innerHTML = `
                <h3>Concurrent Registration Results</h3>

                <div class="test-result">

                    <h4>Participant 1: ${escapeHTML(name1)}</h4>

                    <p>
                        ${escapeHTML(
                            resultsData[0].message || "Request completed"
                        )}
                    </p>

                </div>

                <div class="test-result">

                    <h4>Participant 2: ${escapeHTML(name2)}</h4>

                    <p>
                        ${escapeHTML(
                            resultsData[1].message || "Request completed"
                        )}
                    </p>

                </div>
            `;


            // Refresh dashboard after both requests
            await loadDashboard();


        } catch (error) {

            console.error("Concurrent Test Error:", error);

            results.textContent = "Error: " + error.message;

        } finally {

            concurrentButton.disabled = false;

            concurrentButton.textContent =
                "Run Concurrent Registration Test";

        }

    });

}


// ==========================================
// INITIALIZE DASHBOARD
// ==========================================

document.addEventListener("DOMContentLoaded", function () {

    loadDashboard();

    // Refresh dashboard every 30 seconds
    setInterval(loadDashboard, 30000);

});