document.addEventListener('DOMContentLoaded', () => {
    const orchestrateForm = document.getElementById('orchestrate-form');
    const resultsDisplay = document.getElementById('orchestration-results');

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

    orchestrateForm.addEventListener('submit', (e) => handleFormSubmit(e, '/orchestrate'));
});