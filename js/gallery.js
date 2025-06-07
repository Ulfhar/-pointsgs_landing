// Функція для розширення зображення
function expandImage(element) {
    let expandedBG = document.querySelector('.expanded-bg');
    if (!expandedBG) {
        expandedBG = document.createElement('div');
        expandedBG.className = 'expanded-bg';
        expandedBG.onclick = closeImage; // Дозволяємо закриття при кліку на фон
        document.body.appendChild(expandedBG);
    }
    expandedBG.innerHTML = ''; // Очищуємо вміст перед додаванням нового зображення

    const expandedImg = document.createElement('img');
    expandedImg.src = element.src;
    expandedImg.className = 'expanded-image';

    const closeIcon = document.createElement('img');
    closeIcon.src = 'images/x.png';
    closeIcon.className = 'close-icon';
    closeIcon.onclick = closeImage;

    expandedBG.appendChild(expandedImg);
    expandedBG.appendChild(closeIcon);
    expandedBG.style.display = 'block';

    // Додаємо обробник для закриття при скролі
    document.addEventListener('scroll', closeImageOnScroll);
}

// Функція для закриття зображення
function closeImage() {
    const expandedBG = document.querySelector('.expanded-bg');
    if (expandedBG) {
        expandedBG.style.display = 'none'; // Змінюємо стиль замість видалення елемента
    }
    // Видаляємо обробник події scroll, коли зображення закрито
    document.removeEventListener('scroll', closeImageOnScroll);
}

// Функція для закриття зображення при скролі
function closeImageOnScroll() {
    closeImage();
}
