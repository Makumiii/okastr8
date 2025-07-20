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
        const p = document.createElement('p');
        p.textContent = message;
        p.style.color = isError ? 'red' : 'green';
        resultsDisplay.appendChild(p);
    }

    async function handleFormSubmit(event, url) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(`/api${url}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            displayResult(result.message, !result.success);
        } catch (error) {
            displayResult(`Error: ${error.message}`, true);
        }
    }

    async function handleButtonClick(url) {
        try {
            const response = await fetch(`/api${url}`);
            const result = await response.json();
            displayResult(result.message, !result.success);
        } catch (error) {
            displayResult(`Error: ${error.message}`, true);
        }
    }

    createServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/create'));
    deleteServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/delete'));
    startServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/start'));
    stopServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/stop'));
    restartServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/restart'));
    statusServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/status'));
    logsServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/logs'));
    enableServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/enable'));
    disableServiceForm.addEventListener('submit', (e) => handleFormSubmit(e, '/systemd/disable'));
    reloadDaemonButton.addEventListener('click', () => handleButtonClick('/systemd/reload'));
    listServicesButton.addEventListener('click', () => handleButtonClick('/systemd/list'));
});