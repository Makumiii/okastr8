document.addEventListener('DOMContentLoaded', () => {
    const orchestrateForm = document.getElementById('orchestrate-form');
    const resultsDisplay = document.getElementById('orchestration-results');

    function displayResult(message, isError = false) {
        resultsDisplay.innerHTML = ``; // Clear previous results
        resultsDisplay.textContent = message;
        resultsDisplay.style.color = isError ? 'red' : 'green';
    }

    async function handleFormSubmit(event, url) {
        event.preventDefault();

        console.log(`Sending POST to /api${url}`);
        try {
            const response = await fetch(`/api${url}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({}) // Send empty body as no arguments are needed
            });
            const result = await response.json();
            console.log(`Response from /api${url}:`, result);
            displayResult(result.message, !result.success);
        } catch (error) {
            console.error(`Fetch error for /api${url}:`, error);
            displayResult(`Error: ${error.message}`, true);
        }
    }

    if (orchestrateForm) orchestrateForm.addEventListener('submit', (e) => handleFormSubmit(e, '/orchestrate'));
});