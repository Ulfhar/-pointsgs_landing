(() => {
    const blocks = [...document.querySelectorAll('.press-expandable')].map(block => {
        const content = block.querySelector('.press-expandable-content');
        const button = block.querySelector('.press-expandable-toggle');
        const label = button?.querySelector('span');
        if (!content || !button || !label) return null;

        let expanded = false;

        const update = () => {
            // Measure the same four-line excerpt at the current font and width.
            block.classList.add('is-collapsed');
            const overflowing = content.scrollHeight > content.clientHeight + 1;
            block.classList.toggle('is-collapsed', overflowing && !expanded);
            button.hidden = !overflowing && !expanded;
            button.setAttribute('aria-expanded', String(expanded));
            label.textContent = expanded ? block.dataset.lessLabel : block.dataset.moreLabel;
        };

        button.addEventListener('click', () => {
            expanded = !expanded;
            update();
            if (!expanded) {
                const top = document.querySelector('.fixed-header')?.getBoundingClientRect().bottom ?? 0;
                if (button.getBoundingClientRect().top < top + 16) {
                    content.scrollIntoView({ block: 'start', behavior: 'auto' });
                }
            }
        });

        update();
        return update;
    }).filter(Boolean);

    let frame;
    const updateAll = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => blocks.forEach(update => update()));
    };
    window.addEventListener('resize', updateAll);
    if (document.fonts) document.fonts.ready.then(updateAll);
})();
