document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;

            // Deactivate all tabs and buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Activate the clicked tab and its content
            button.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        });
    });

    // Set initial state
    if (tabButtons.length > 0) {
        tabButtons[0].classList.add('active');
        document.getElementById(tabButtons[0].dataset.tab).classList.add('active');
    }
});