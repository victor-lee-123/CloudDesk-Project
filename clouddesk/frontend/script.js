const API_BASE_URL = "http://32.194.158.217:5000";

async function loadTickets() {
    const response = await fetch(`${API_BASE_URL}/tickets`);
    const tickets = await response.json();
    console.log(tickets);
}