document.addEventListener('DOMContentLoaded', function () {
    const menuIcon = document.getElementById('menu-icon');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    let isOpen = false; // Додаємо індикатор стану

    if (!menuIcon || !dropdownMenu) {
        console.error("Menu icon or dropdown menu not found");
        return;
    }

    // Обробник для відкриття/закриття меню по кліку на іконку
    menuIcon.addEventListener('click', function (e) {
        e.preventDefault();
        isOpen = !isOpen; // Перемикаємо стан
        if (isOpen) {
            dropdownMenu.classList.add('show');
            console.log("Menu opened.");
        } else {
            dropdownMenu.classList.remove('show');
            console.log("Menu closed.");
        }
    });

    // Закриваємо меню при кліку поза ним
    document.addEventListener('click', function (event) {
        if (isOpen && !menuIcon.contains(event.target) && !dropdownMenu.contains(event.target)) {
            dropdownMenu.classList.remove('show');
            isOpen = false; // Оновлюємо стан
            console.log("Clicked outside. Dropdown menu closed.");
        }
    });
});
