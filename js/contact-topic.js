(function() {
    'use strict';

    var select = document.getElementById('contactTopic');
    var label = document.getElementById('contactTopicLabel');
    if (!select || !label || select.dataset.topicPickerReady) return;
    var picker = select.closest('.contact-topic-picker');
    if (!picker || !select.options.length) return;

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = 'contactTopicTrigger';
    trigger.className = 'contact-topic-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'contactTopicMenu');
    trigger.setAttribute('aria-labelledby', label.id + ' contactTopicValue');

    var value = document.createElement('span');
    value.id = 'contactTopicValue';
    value.className = 'contact-topic-value';
    trigger.appendChild(value);

    function icon(className, viewBox, pathData) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', className);
        svg.setAttribute('viewBox', viewBox);
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);
        return svg;
    }

    trigger.appendChild(icon('contact-topic-chevron', '0 0 24 24', 'm6 9 6 6 6-6'));

    var menu = document.createElement('ul');
    menu.id = 'contactTopicMenu';
    menu.className = 'contact-topic-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-labelledby', label.id);
    menu.hidden = true;

    var options = [];
    var activeIndex = -1;
    var open = false;
    var search = '';
    var searchTime = 0;

    function isDisabled(index) {
        var option = select.options[index];
        return !option || option.disabled || (option.parentElement && option.parentElement.disabled);
    }

    function focus(element) {
        try { element.focus({ preventScroll: true }); }
        catch (_) { element.focus(); }
    }

    function setActive(index, moveFocus) {
        if (!options[index] || isDisabled(index)) return;
        activeIndex = index;
        options.forEach(function(option, optionIndex) {
            option.classList.toggle('is-active', optionIndex === index);
        });
        if (moveFocus) {
            focus(options[index]);
            options[index].scrollIntoView({ block: 'nearest' });
        }
    }

    function close(returnFocus) {
        if (!open) return;
        open = false;
        search = '';
        menu.hidden = true;
        picker.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        options.forEach(function(option) { option.classList.remove('is-active'); });
        if (returnFocus) focus(trigger);
    }

    function firstEnabled(fromEnd) {
        for (var i = fromEnd ? options.length - 1 : 0;
            i >= 0 && i < options.length; i += fromEnd ? -1 : 1) {
            if (!isDisabled(i)) return i;
        }
        return -1;
    }

    function show(index) {
        if (trigger.disabled) return;
        open = true;
        menu.hidden = false;
        picker.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        var target = typeof index === 'number' ? index : select.selectedIndex;
        if (isDisabled(target)) target = firstEnabled(false);
        setActive(target, true);
    }

    function commit(index) {
        if (isDisabled(index)) return;
        var changed = select.selectedIndex !== index;
        select.selectedIndex = index;
        sync();
        close(true);
        if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function sync() {
        var hadFocus = menu.contains(document.activeElement);
        var selected = select.options[select.selectedIndex];
        value.textContent = selected ? selected.textContent : '';
        trigger.disabled = select.disabled;
        menu.textContent = '';
        options = Array.prototype.map.call(select.options, function(source, index) {
            var option = document.createElement('li');
            option.id = 'contactTopicOption' + index;
            option.className = 'contact-topic-option';
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', String(index === select.selectedIndex));
            option.classList.toggle('is-selected', index === select.selectedIndex);
            option.tabIndex = -1;
            if (isDisabled(index)) option.setAttribute('aria-disabled', 'true');
            var text = document.createElement('span');
            text.textContent = source.textContent;
            option.appendChild(text);
            option.appendChild(icon('contact-topic-check', '0 0 20 20', 'm5 10 3 3 7-7'));
            option.addEventListener('click', function() { commit(index); });
            option.addEventListener('focus', function() { setActive(index, false); });
            menu.appendChild(option);
            return option;
        });
        activeIndex = select.selectedIndex;
        if (open) {
            if (trigger.disabled) close(false);
            else setActive(isDisabled(activeIndex) ? firstEnabled(false) : activeIndex, hadFocus);
        }
    }

    function move(direction) {
        var next = activeIndex;
        for (var i = 0; i < options.length; i++) {
            next = (next + direction + options.length) % options.length;
            if (!isDisabled(next)) { setActive(next, true); return; }
        }
    }

    function typeAhead(key) {
        var now = Date.now();
        search = now - searchTime > 750 ? key : search + key;
        searchTime = now;
        // Repeating a letter cycles through options beginning with that letter.
        if (search.split('').every(function(character) { return character === key; })) search = key;
        for (var offset = 1; offset <= options.length; offset++) {
            var index = (Math.max(activeIndex, 0) + offset) % options.length;
            var text = select.options[index].textContent.trim().toLocaleLowerCase();
            if (!isDisabled(index) && text.indexOf(search) === 0) {
                setActive(index, true);
                return;
            }
        }
    }

    trigger.addEventListener('click', function() {
        if (open) close(false);
        else show();
    });

    picker.addEventListener('keydown', function(event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        var key = event.key;
        if (key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            close(true);
        } else if (key === 'Tab') {
            // Resume native tab order from the trigger before hiding its focused option.
            close(true);
        } else if (key === 'ArrowDown' || key === 'ArrowUp') {
            event.preventDefault();
            if (!open) show();
            else move(key === 'ArrowDown' ? 1 : -1);
        } else if (key === 'Home' || key === 'End') {
            event.preventDefault();
            var edge = firstEnabled(key === 'End');
            if (!open) show(edge);
            else setActive(edge, true);
        } else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
            event.preventDefault();
            if (!open) show();
            else commit(activeIndex);
        } else if (key.length === 1 && !/\s/.test(key)) {
            event.preventDefault();
            if (!open) show();
            typeAhead(key.toLocaleLowerCase());
        }
    });

    document.addEventListener('pointerdown', function(event) {
        if (open && !picker.contains(event.target)) close(false);
    });
    picker.addEventListener('focusout', function(event) {
        if (open && event.relatedTarget && !picker.contains(event.relatedTarget)) close(false);
    });
    select.addEventListener('change', sync);
    document.addEventListener('points:locale-ready', sync);
    if (select.form) select.form.addEventListener('reset', function() {
        close(false);
        // Native reset restores the value after its reset event finishes.
        window.setTimeout(sync, 0);
    });

    sync();
    picker.appendChild(trigger);
    picker.appendChild(menu);
    label.htmlFor = trigger.id;
    select.classList.add('contact-topic-native');
    select.hidden = true;
    select.dataset.topicPickerReady = 'true';
})();
