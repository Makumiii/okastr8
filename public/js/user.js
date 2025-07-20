document.addEventListener('DOMContentLoaded', () => {
    console.log('user.js loaded');
    const createUserForm = document.getElementById('create-user-form');
    const deleteUserForm = document.getElementById('delete-user-form');
    const lastLoginForm = document.getElementById('last-login-form');
    const listGroupsForm = document.getElementById('list-groups-form');
    const lockUserForm = document.getElementById('lock-user-form');
    const listUsersButton = document.getElementById('list-users-button');
    const resultsDisplay = document.getElementById('user-results');

    console.log('User Management Elements:', {
        createUserForm, deleteUserForm, lastLoginForm, listGroupsForm, lockUserForm, listUsersButton, resultsDisplay
    });

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
            console.error(`Fetch error for /api${url}:`, error);
            displayResult(`Error: ${error.message}`, true);
        }
    }

    if (createUserForm) createUserForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/create'));
    if (deleteUserForm) deleteUserForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/delete'));
    if (lastLoginForm) lastLoginForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/last-login'));
    if (listGroupsForm) listGroupsForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/list-groups'));
    if (lockUserForm) lockUserForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/lock'));
    if (listUsersButton) listUsersButton.addEventListener('click', () => handleButtonClick('/user/list-users'));
});