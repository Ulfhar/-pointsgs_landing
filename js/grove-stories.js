/* Local preview only. Selected files stay in this browser; image export is a later step. */
(function () {
    'use strict';

    var form = document.getElementById('story-settings');
    var input = document.getElementById('screenshots');
    var zone = document.getElementById('upload-zone');
    var collage = document.getElementById('collage');
    var slots = document.getElementById('collage-slots');
    var thumbnails = document.getElementById('upload-thumbnails');
    var status = document.getElementById('upload-status');
    var files = [];
    var selectionVersion = 0;
    var formats = { square: '1080 × 1080 px', post: '1080 × 1350 px', story: '1080 × 1920 px' };

    function imageIcon() {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'icon');
        svg.setAttribute('aria-hidden', 'true');
        var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#icon-image');
        svg.appendChild(use);
        return svg;
    }

    function render() {
        var data = new FormData(form);
        var count = Number(data.get('layout'));
        collage.dataset.format = data.get('format');
        collage.dataset.background = data.get('background');
        slots.dataset.count = count;
        slots.replaceChildren();
        thumbnails.replaceChildren();
        document.getElementById('output-size').textContent = formats[data.get('format')];
        document.getElementById('slot-count').textContent = count + (count === 1 ? ' screenshot slot' : ' screenshot slots');

        for (var i = 0; i < count; i++) {
            var slot = document.createElement('div');
            slot.className = 'screenshot-slot';
            var thumb = document.createElement('div');
            thumb.className = 'upload-thumb';
            if (files[i]) {
                var image = document.createElement('img');
                image.src = files[i].url;
                image.alt = files[i].name;
                slot.appendChild(image);
                var miniature = image.cloneNode();
                miniature.alt = '';
                thumb.appendChild(miniature);
            } else {
                slot.appendChild(imageIcon());
                var caption = document.createElement('p');
                caption.textContent = 'Your screenshot here';
                slot.appendChild(caption);
                var hint = document.createElement('small');
                hint.textContent = 'A moment worth keeping';
                slot.appendChild(hint);
                thumb.appendChild(imageIcon());
            }
            var number = document.createElement('span');
            number.className = 'slot-number';
            number.textContent = String(i + 1).padStart(2, '0');
            slot.appendChild(number);
            var thumbNumber = number.cloneNode(true);
            thumbNumber.className = 'upload-thumb-number';
            thumb.appendChild(thumbNumber);
            slots.appendChild(slot);
            thumbnails.appendChild(thumb);
        }
        if (!status.classList.contains('is-error')) {
            status.textContent = files.length
                ? files.length + ' selected · ' + Math.min(files.length, count) + ' shown in this layout.'
                : 'Start with your favourite moments.';
        }
    }

    function release(items) {
        items.forEach(function (file) { URL.revokeObjectURL(file.url); });
    }

    async function selectFiles(list) {
        if (!list.length) return;
        var version = ++selectionVersion;
        var selected = Array.from(list);
        var pending = [];
        status.classList.remove('is-error');
        try {
            if (selected.length > 4) throw new Error('Choose up to 4 screenshots at a time.');
            for (var file of selected) {
                if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Please choose PNG, JPG or WebP images.');
                if (file.size > 15 * 1024 * 1024) throw new Error('Each screenshot must be smaller than 15 MB.');
                var url = URL.createObjectURL(file);
                pending.push({ name: file.name, url: url });
                var image = new Image();
                image.src = url;
                await image.decode();
            }
            if (version !== selectionVersion) { release(pending); return; }
            release(files);
            files = pending;
            form.elements.layout.value = String(files.length === 3 ? 4 : files.length);
            render();
        } catch (error) {
            release(pending);
            if (version !== selectionVersion) return;
            status.classList.add('is-error');
            status.textContent = error instanceof DOMException ? 'This image could not be opened. Try another screenshot.' : error.message;
        } finally {
            if (version === selectionVersion) input.value = '';
        }
    }

    form.addEventListener('submit', function (event) { event.preventDefault(); });
    form.addEventListener('change', function (event) {
        if (event.target !== input) render();
    });
    input.addEventListener('change', function () { selectFiles(input.files); });
    ['dragenter', 'dragover'].forEach(function (name) {
        zone.addEventListener(name, function (event) { event.preventDefault(); zone.classList.add('is-dragging'); });
    });
    zone.addEventListener('dragleave', function (event) {
        if (!zone.contains(event.relatedTarget)) zone.classList.remove('is-dragging');
    });
    zone.addEventListener('drop', function (event) {
        event.preventDefault();
        zone.classList.remove('is-dragging');
        selectFiles(event.dataTransfer.files);
    });
    document.getElementById('reset-story').addEventListener('click', function () {
        selectionVersion++;
        release(files);
        files = [];
        form.reset();
        status.classList.remove('is-error');
        render();
    });
    render();
}());
