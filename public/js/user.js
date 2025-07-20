document.addEventListener('DOMContentLoaded', () => {
    const createUserForm = document.getElementById('create-user-form');
    const deleteUserForm = document.getElementById('delete-user-form');
    const lastLoginForm = document.getElementById('last-login-form');
    const listGroupsForm = document.getElementById('list-groups-form');
    const lockUserForm = document.getElementById('lock-user-form');
    const listUsersButton = document.getElementById('list-users-button');

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

    async function handleButtonClick(url) {
        try {
            const response = await fetch(`/api${url}`);
            const result = await response.json();
            alert(result.message);
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    createUserForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/create'));
    deleteUserForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/delete'));
    lastLoginForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/last-login'));
    listGroupsForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/list-groups'));
    lockUserForm.addEventListener('submit', (e) => handleFormSubmit(e, '/user/lock'));
    listUsersButton.addEventListener('click', () => handleButtonClick('/user/list-users'));
});