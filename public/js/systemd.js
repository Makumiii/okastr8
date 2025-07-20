document.addEventListener('DOMContentLoaded', () => {
    const createServiceForm = document.getElementById('create-service-form');
    const deleteServiceForm = document.getElementById('delete-service-form');
    const startServiceForm = document.getElementById('start-service-form');
    const stopServiceForm = document.getElementById('stop-service-form');
    const restartServiceForm = document.getElementById('restart-service-form');
    const statusServiceForm = document.getElementById('status-service-form');
    const logsServiceForm = document.getElementById('logs-service-form');
    const enableServiceForm = document.getElementById('enable-service-form');
    const disableServiceForm = document.getElementById('disable-service-form');
    const reloadDaemonButton = document.getElementById('reload-daemon-button');
    const listServicesButton = document.getElementById('list-services-button');
    const resultsDisplay = document.getElementById('systemd-results');

    function displayResult(message, isError = false) {
        resultsDisplay.innerHTML = ``; // Clear previous results
        resultsDisplay.textContent = message;
        resultsDisplay.style.color = isError ? 'red' : 'green';
    }

    async function handleFormSubmit(event, url) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        console.log(`Sending POST to /api${url} with data:`, data);
        try {
            const response = await fetch(`/api${url}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            console.log(`Response from /api${url}:`, result);
            displayResult(result.message, !result.success);
        } catch (error) {
            console.error(`Fetch error for /api${url}:`, error);
            displayResult(`Error: ${error.message}`, true);
        }
    }

    async function handleButtonClick(url) {
        console.log(`Sending GET to /api${url}`);
        try {
            const response = await fetch(`/api${url}`);
            const result = await response.json();
            console.log(`Response from /api${url}:`, result);
            displayResult(result.message, !result.success);
        } catch (error) {
            displayResult(`Error: ${error.message}`, true);
        }
    }

    if (createServiceForm) createServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/create'));
    if (deleteServiceForm) deleteServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/delete'));
    if (startServiceForm) startServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/start'));
    if (stopServiceForm) stopServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/stop'));
    if (restartServiceForm) restartServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/restart'));
    if (statusServiceForm) statusServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/status'));
    if (logsServiceForm) logsServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/logs'));
    if (enableServiceForm) enableServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/enable'));
    if (disableServiceForm) disableServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/disable'));
    if (reloadDaemonButton) reloadDaemonButton.addEventListener('click', () => handleButtonClick('/systemd/reload'));
    if (listServicesButton) listServicesButton.addEventListener('click', () => handleButtonClick('/systemd/list'));
});