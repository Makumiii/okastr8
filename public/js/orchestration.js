document.addEventListener('DOMContentLoaded', () => {
    const orchestrateForm = document.getElementById('orchestrate-form');

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
            alert(result.message);
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    orchestrateForm.addEventListener('submit', (e) => handleFormSubmit(e, '/orchestrate'));
});