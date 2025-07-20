document.addEventListener('DOMContentLoaded', () => {
    const createUserForm = document.getElementById('create-user-form');
    const deleteUserForm = document.getElementById('delete-user-form');
    const lastLoginForm = document.getElementById('last-login-form');
    const listGroupsForm = document.getElementById('list-groups-form');
    const lockUserForm = document.getElementById('lock-user-form');
    const switchUserForm = document.getElementById('switch-user-form');
    const listUsersButton = document.getElementById('list-users-button');
    const resultsDisplay = document.getElementById('user-results');

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

    createUserForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/create'));
    deleteUserForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/delete'));
    lastLoginForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/last-login'));
    listGroupsForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/list-groups'));
    lockUserForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/lock'));
    switchUserForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/switch'));
    listUsersButton.addEventListener('click', () => handleButtonClick('/user/list-users'));
});