(function () {
    let draggedCard = null;
    const RELATIONSHIPS_KEY = 'ketryxTraceabilityRelationships';
    const pendingSuggestions = {};
    const defaultState = {
        'fit-1': { rowKey: 'row-fit-1', list: 'design-input', parentRq: null },
        'fit-2': { rowKey: 'row-fit-2', list: 'design-input', parentRq: null },
        'fit-3': { rowKey: 'row-extra', list: 'validation-test', parentRq: null },
        'fit-4': { rowKey: 'row-extra', list: 'validation-test', parentRq: null },
        'fit-5': { rowKey: 'row-fit-1', list: 'validation-test', parentRq: 'FIT-1' },
        'fit-6': { rowKey: 'row-fit-1', list: 'validation-test', parentRq: 'FIT-1' },
        'fit-7': { rowKey: 'row-extra', list: 'validation-test', parentRq: null }
    };
    const suggestionCandidates = {
        'FIT-2': ['fit-3', 'fit-4']
    };
    const GHOST_ATTR = 'data-ghost-of';

    function clearAllSuggestionDiffs() {
        document.querySelectorAll('.suggest-diff').forEach(el => {
            el.classList.remove('suggest-diff', 'suggest-diff-added', 'suggest-diff-removed');
        });
    }

    function clearAllGhosts() {
        document.querySelectorAll(`[${GHOST_ATTR}]`).forEach(el => el.remove());
    }

    function createGhostPlaceholder(container, card) {
        if (!container || !card) {
            return;
        }

        const existing = container.querySelector(`[${GHOST_ATTR}="${card.dataset.cardId || ''}"]`);
        if (existing) {
            return;
        }

        const ghost = card.cloneNode(true);
        ghost.classList.add('suggest-ghost-card');
        ghost.setAttribute(GHOST_ATTR, card.dataset.cardId || '');
        ghost.setAttribute('draggable', 'false');
        ghost.querySelectorAll('[draggable]').forEach(el => el.setAttribute('draggable', 'false'));

        const dropZone = container.querySelector('.drop-zone');
        if (dropZone) {
            container.insertBefore(ghost, dropZone);
        } else {
            container.appendChild(ghost);
        }
    }

    function markSuggestionDiff(element, type) {
        if (!element) {
            return;
        }
        element.classList.add('suggest-diff');
        element.classList.remove('suggest-diff-added', 'suggest-diff-removed');
        if (type === 'added') {
            element.classList.add('suggest-diff-added');
        } else if (type === 'removed') {
            element.classList.add('suggest-diff-removed');
        }
    }

    function resetBoardState() {
        Object.keys(pendingSuggestions).forEach(key => delete pendingSuggestions[key]);
        clearAllSuggestionDiffs();
        clearAllGhosts();

        Object.entries(defaultState).forEach(([cardId, info]) => {
            const card = document.querySelector(`.trello-card[data-card-id="${cardId}"]`);
            if (!card) {
                return;
            }

            if (info.parentRq) {
                card.setAttribute('data-parent-rq', info.parentRq);
            } else {
                card.removeAttribute('data-parent-rq');
            }

            placeCard(card, info.rowKey, info.list);
        });

        document.querySelectorAll('.suggest-controls').forEach(ctrl => ctrl.classList.remove('active'));

        updateAllDropZonePositions();
        refreshRelationships();
        updateCardCounts();

        try {
            localStorage.removeItem(RELATIONSHIPS_KEY);
        } catch (err) {
            console.warn('Unable to clear stored board state:', err);
        }
        window.location.reload();
    }

    function initializeDragAndDrop() {
        const cards = document.querySelectorAll('.trello-card');
        const dropZones = document.querySelectorAll('.drop-zone');
        const cardsContainers = document.querySelectorAll('.cards-container');

        cards.forEach(card => {
            addCardEventListeners(card);
        });

        dropZones.forEach(zone => {
            zone.addEventListener('dragover', handleDragOver);
            zone.addEventListener('drop', handleDrop);
            zone.addEventListener('dragenter', handleDragEnter);
            zone.addEventListener('dragleave', handleDragLeave);
        });

        cardsContainers.forEach(container => {
            container.addEventListener('dragover', handleDragOver);
            container.addEventListener('drop', handleDrop);
        });
    }

    function addCardEventListeners(card) {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    }

    function handleDragStart(e) {
        draggedCard = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.outerHTML);

        const originCell = this.closest('.trello-cell');
        if (originCell) {
            originCell.classList.add('origin-cell');
        }

        document.querySelector('.trello-board').classList.add('dragging-active');
        highlightValidDropTargets(true);
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
        draggedCard = null;

        document.querySelectorAll('.origin-cell').forEach(cell => {
            cell.classList.remove('origin-cell');
        });

        document.querySelector('.trello-board').classList.remove('dragging-active');
        highlightValidDropTargets(false);
        updateCardCounts();
        refreshRelationships();
    }

    function highlightValidDropTargets(highlight) {
        const allCells = document.querySelectorAll('.trello-cell');

        allCells.forEach(cell => {
            if (highlight && draggedCard) {
                const cardBadge = draggedCard.querySelector('.test-case-badge');
                const cardType = cardBadge ? cardBadge.textContent.trim() : '';
                const cellType = cell.getAttribute('data-list');
                const isValidTarget = isValidDropTarget(cardType, cellType);

                if (isValidTarget) {
                    cell.classList.add('valid-drop-target');
                    updateDropZonePosition(cell);
                }
            } else {
                cell.classList.remove('valid-drop-target');
            }
        });
    }

    function updateDropZonePosition(cell) {
        const container = cell.querySelector('.cards-container');
        const dropZone = container.querySelector('.drop-zone');
        const cards = container.querySelectorAll('.trello-card');

        if (dropZone && cards.length > 0) {
            container.appendChild(dropZone);
        }
    }

    function isValidDropTarget(cardType, cellType) {
        if (cardType === 'TC') {
            return cellType === 'validation-test';
        } else if (cardType === 'RQ') {
            return cellType === 'design-input';
        } else if (cellType === 'use-cases') {
            return true;
        }
        return false;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(e) {
        e.preventDefault();
        if (this.classList.contains('drop-zone')) {
            this.classList.add('drag-over');
        }
    }

    function handleDragLeave() {
        if (this.classList.contains('drop-zone')) {
            this.classList.remove('drag-over');
        }
    }

    function handleDrop(e) {
        e.preventDefault();

        if (this.classList.contains('drop-zone')) {
            this.classList.remove('drag-over');
        }

        if (!draggedCard) {
            return;
        }

        let targetContainer;
        let targetCell;

        if (this.classList.contains('drop-zone')) {
            targetContainer = this.parentElement;
            targetCell = targetContainer.parentElement;
        } else if (this.classList.contains('cards-container')) {
            targetContainer = this;
            targetCell = targetContainer.parentElement;
        }

        if (!targetContainer || !targetCell) {
            return;
        }

        const cardBadge = draggedCard.querySelector('.test-case-badge');
        const cardType = cardBadge ? cardBadge.textContent.trim() : '';
        let cellType = targetCell.getAttribute('data-list');

        if (cardType === 'TC' && cellType !== 'validation-test') {
            const targetRow = targetCell.closest('.trello-row');
            const validationCell = targetRow ? targetRow.querySelector('.trello-cell[data-list="validation-test"]') : null;
            if (validationCell) {
                const validationContainer = validationCell.querySelector('.cards-container');
                if (validationContainer) {
                    targetCell = validationCell;
                    targetContainer = validationContainer;
                    cellType = 'validation-test';
                }
            }
        }

        if (!isValidDropTarget(cardType, cellType)) {
            return;
        }

        draggedCard.remove();

        const targetDropZone = targetContainer.querySelector('.drop-zone');
        if (targetDropZone) {
            targetContainer.insertBefore(draggedCard, targetDropZone);
        } else {
            targetContainer.appendChild(draggedCard);
        }

        addCardEventListeners(draggedCard);

        if (cardType === 'TC') {
            const parentRow = targetCell.closest('.trello-row');
            if (parentRow) {
                const rowRqCard = parentRow.querySelector('.trello-card[data-rq-id]');
                if (rowRqCard) {
                    draggedCard.setAttribute('data-parent-rq', rowRqCard.getAttribute('data-rq-id'));
                } else {
                    draggedCard.removeAttribute('data-parent-rq');
                }
            }
        }

        updateCardCounts();
        updateAllDropZonePositions();
        refreshRelationships();
        saveBoardState();
    }

    function updateAllDropZonePositions() {
        document.querySelectorAll('.trello-cell').forEach(cell => {
            updateDropZonePosition(cell);
        });
    }

    function updateCardCounts() {
        const columns = document.querySelectorAll('.trello-column');
        columns.forEach(column => {
            const cards = column.querySelectorAll('.trello-card');
            const countElement = column.querySelector('.card-count');
            if (countElement) {
                countElement.textContent = cards.length;
            }
        });
    }

    function applyChangeHighlight(element, className) {
        if (!element) {
            return;
        }

        element.classList.add('change-highlight', className);

        setTimeout(() => {
            element.classList.remove(className);
            if (!element.classList.contains('change-added') && !element.classList.contains('change-removed')) {
                element.classList.remove('change-highlight');
            }
        }, 1600);
    }

    function getCardPlacement(card) {
        const row = card.closest('.trello-row');
        const cell = card.closest('.trello-cell');
        return {
            rowKey: row ? row.dataset.rowKey || null : null,
            list: cell ? cell.dataset.list || null : null
        };
    }

    function placeCard(card, rowKey, list) {
        if (!rowKey) {
            return;
        }

        const row = document.querySelector(`.trello-row[data-row-key="${rowKey}"]`);
        if (!row) {
            return;
        }

        let targetList = list;
        const cardType = card.querySelector('.test-case-badge')?.textContent.trim();
        if (cardType === 'TC') {
            targetList = 'validation-test';
        }

        const cell = row.querySelector(`.trello-cell[data-list="${targetList}"]`) || row.querySelector('.trello-cell[data-list="validation-test"]');
        const container = cell ? cell.querySelector('.cards-container') : null;

        if (!container) {
            return;
        }

        const dropZone = container.querySelector('.drop-zone');
        if (dropZone) {
            container.insertBefore(card, dropZone);
        } else {
            container.appendChild(card);
        }

        updateDropZonePosition(cell);
    }

    function handleSuggestClick(cardId) {
        const controls = document.querySelector(`.suggest-controls[data-card-id="${cardId}"]`);
        if (controls && controls.classList.contains('suggesting')) {
            return;
        }
        if (controls) {
            controls.classList.remove('active');
            controls.classList.add('suggesting');
        }

        setTimeout(() => {
            const success = applySuggestion(cardId);
            const updatedControls = document.querySelector(`.suggest-controls[data-card-id="${cardId}"]`);
            if (updatedControls) {
                updatedControls.classList.remove('suggesting');
                if (!success) {
                    updatedControls.classList.remove('active');
                }
            }
        }, 500);
    }

    function applySuggestion(cardId) {
        const rqCard = document.querySelector(`.trello-card[data-card-id="${cardId}"]`);
        if (!rqCard) {
            return false;
        }

        const rqId = rqCard.getAttribute('data-rq-id');
        if (!rqId) {
            return false;
        }

        const rqRow = rqCard.closest('.trello-row');
        if (!rqRow) {
            return false;
        }

        const controls = document.querySelector(`.suggest-controls[data-card-id="${cardId}"]`);

        clearAllSuggestionDiffs();
        clearAllGhosts();

        const targetCell = rqRow.querySelector('.trello-cell[data-list="validation-test"]');
        const targetContainer = targetCell ? targetCell.querySelector('.cards-container') : null;
        if (!targetContainer) {
            return false;
        }

        let tcCards = Array.from(document.querySelectorAll(`.trello-card[data-parent-rq="${rqId}"]`));
        if (tcCards.length === 0) {
            const fallbackIds = suggestionCandidates[rqId] || [];
            tcCards = fallbackIds
                .map(id => document.querySelector(`.trello-card[data-card-id="${id}"]`))
                .filter(Boolean);
        }
        if (tcCards.length === 0) {
            if (controls) {
                controls.classList.add('active');
            }
            return false;
        }

        pendingSuggestions[cardId] = {
            movements: tcCards.map(tcCard => ({
                cardId: tcCard.getAttribute('data-card-id'),
                placement: getCardPlacement(tcCard)
            }))
        };

        tcCards.forEach(tcCard => {
            const currentContainer = tcCard.closest('.cards-container');
            if (!currentContainer) {
                return;
            }

            const originCell = currentContainer.closest('.trello-cell');
            const movingToNewContainer = currentContainer !== targetContainer;

            if (movingToNewContainer) {
                markSuggestionDiff(currentContainer, 'removed');
                createGhostPlaceholder(currentContainer, tcCard);
            }

            tcCard.setAttribute('data-parent-rq', rqId);
            const referenceNode = targetContainer.querySelector('.drop-zone') || targetContainer.firstChild;
            if (referenceNode) {
                targetContainer.insertBefore(tcCard, referenceNode);
            } else {
                targetContainer.appendChild(tcCard);
            }

            markSuggestionDiff(targetContainer, 'added');
            markSuggestionDiff(tcCard, 'added');

            if (originCell && movingToNewContainer) {
                updateDropZonePosition(originCell);
            }
        });

        updateDropZonePosition(targetCell);
        updateAllDropZonePositions();
        refreshRelationships();
        updateCardCounts();

        if (controls) {
            controls.classList.add('active');
        }
        return true;
    }

    function handleAcceptSuggestion(cardId) {
        const controls = document.querySelector(`.suggest-controls[data-card-id="${cardId}"]`);
        if (controls) {
            controls.classList.remove('active');
        }
        delete pendingSuggestions[cardId];
        clearAllSuggestionDiffs();
        clearAllGhosts();
        if (cardId === 'fit-2') {
            const card = document.querySelector(`.trello-card[data-card-id="${cardId}"]`);
            const statusRow = card?.querySelector('.status-row');
            if (statusRow) {
                const badge = document.createElement('div');
                badge.className = 'status-badge status-approved';
                badge.textContent = 'Missing approval';
                statusRow.replaceWith(badge);
            }
        }
        saveBoardState();
    }

    function handleRejectSuggestion(cardId) {
        const controls = document.querySelector(`.suggest-controls[data-card-id="${cardId}"]`);
        if (controls) {
            controls.classList.remove('active');
        }

        const pending = pendingSuggestions[cardId];
        if (!pending) {
            return;
        }

        pending.movements.forEach(move => {
            const tcCard = document.querySelector(`.trello-card[data-card-id="${move.cardId}"]`);
            if (!tcCard) {
                return;
            }

            placeCard(tcCard, move.placement.rowKey, move.placement.list);
        });

        delete pendingSuggestions[cardId];

        updateAllDropZonePositions();
        refreshRelationships();
        updateCardCounts();
        clearAllSuggestionDiffs();
        clearAllGhosts();
        saveBoardState();
    }

    function saveBoardState() {
        const state = {};
        const cards = document.querySelectorAll('.trello-card[data-card-id]');

        cards.forEach(card => {
            const cardId = card.getAttribute('data-card-id');
            const row = card.closest('.trello-row');
            const cell = card.closest('.trello-cell');

            state[cardId] = {
                rowKey: row ? row.dataset.rowKey || null : null,
                list: cell ? cell.dataset.list || null : null,
                parentRq: card.getAttribute('data-parent-rq') || null
            };
        });

        Object.entries(pendingSuggestions).forEach(([rqCardId, data]) => {
            state[rqCardId] = state[rqCardId] || {};
            state[rqCardId].pendingMovements = data.movements;
            state[rqCardId].rqCardId = rqCardId;
        });

        try {
            localStorage.setItem(RELATIONSHIPS_KEY, JSON.stringify(state));
        } catch (err) {
            console.warn('Unable to save board state:', err);
        }
    }

    function loadBoardState() {
        let stored;
        try {
            stored = localStorage.getItem(RELATIONSHIPS_KEY);
        } catch (err) {
            console.warn('Unable to access board state:', err);
            return;
        }

        if (!stored) {
            return;
        }

        let state;
        try {
            state = JSON.parse(stored);
        } catch (err) {
            console.warn('Invalid board state data:', err);
            return;
        }

        Object.entries(state).forEach(([cardId, info]) => {
            const card = document.querySelector(`.trello-card[data-card-id="${cardId}"]`);
            if (!card) {
                return;
            }

            if (info.parentRq) {
                card.setAttribute('data-parent-rq', info.parentRq);
            } else {
                card.removeAttribute('data-parent-rq');
            }

            if (!info.rowKey) {
                return;
            }

            const row = document.querySelector(`.trello-row[data-row-key="${info.rowKey}"]`);
            if (!row) {
                return;
            }

            let targetList = info.list;
            if (!targetList) {
                targetList = card.querySelector('.test-case-badge')?.textContent.trim() === 'TC'
                    ? 'validation-test'
                    : 'design-input';
            }

            const cardType = card.querySelector('.test-case-badge')?.textContent.trim();
            if (cardType === 'TC') {
                targetList = 'validation-test';
            }

            const cell = row.querySelector(`.trello-cell[data-list="${targetList}"]`) || row.querySelector('.trello-cell[data-list="validation-test"]');
            const container = cell ? cell.querySelector('.cards-container') : null;

            if (!container) {
                return;
            }

            const dropZone = container.querySelector('.drop-zone');
            if (dropZone) {
                container.insertBefore(card, dropZone);
            } else {
                container.appendChild(card);
            }

            if (info.pendingMovements) {
                pendingSuggestions[info.rqCardId] = {
                    movements: info.pendingMovements
                };
            }
        });
    }

    function updateRelationshipIndicators() {
        const rqCards = document.querySelectorAll('.trello-card[data-rq-id]');
        rqCards.forEach(rqCard => {
            const note = rqCard.querySelector('.relationship-indicator');
            if (!note) return;

            const rqRow = rqCard.closest('.trello-row');
            if (!rqRow) {
                note.classList.add('hidden');
                note.textContent = '';
                return;
            }

            const rqId = rqCard.getAttribute('data-rq-id');
            const tcCards = Array.from(rqRow.querySelectorAll(`.trello-card[data-parent-rq="${rqId}"]`));

            if (tcCards.length === 0) {
                note.classList.add('hidden');
                note.textContent = '';
            } else {
                note.textContent = '';
                note.classList.remove('hidden');
            }
        });
    }

    function drawRelationshipConnections() {
        const board = document.querySelector('.trello-board');
        if (!board) return;

        const layer = board.querySelector('.connections-layer');
        if (!layer) return;

        const boardRect = board.getBoundingClientRect();
        layer.setAttribute('width', boardRect.width);
        layer.setAttribute('height', boardRect.height);
        layer.setAttribute('viewBox', `0 0 ${boardRect.width} ${boardRect.height}`);
        layer.setAttribute('preserveAspectRatio', 'none');
        layer.innerHTML = '';

        const rqCards = board.querySelectorAll('.trello-card[data-rq-id]');
        rqCards.forEach(rqCard => {
            const rqRow = rqCard.closest('.trello-row');
            if (!rqRow) return;

            const rqId = rqCard.getAttribute('data-rq-id');
            const tcCards = Array.from(rqRow.querySelectorAll(`.trello-card[data-parent-rq="${rqId}"]`));
            if (tcCards.length === 0) return;

            const rqRect = rqCard.getBoundingClientRect();
            const startX = rqRect.right - boardRect.left;
            const startY = rqRect.top + rqRect.height / 2 - boardRect.top;

            tcCards.forEach(tcCard => {
                const tcRect = tcCard.getBoundingClientRect();
                const containerLeft = tcRect.left - boardRect.left;
                const endY = tcRect.top + tcRect.height / 2 - boardRect.top;

                const targetX = Math.max(containerLeft - 10, startX + 12);
                const midX = startX + Math.max((targetX - startX) * 0.6, 24);

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${targetX} ${endY}`);
                path.setAttribute('stroke-linejoin', 'round');
                layer.appendChild(path);

                const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot.setAttribute('cx', targetX);
                dot.setAttribute('cy', endY);
                dot.setAttribute('r', 3);
                layer.appendChild(dot);
            });
        });
    }

    function refreshRelationships() {
        updateRelationshipIndicators();
        requestAnimationFrame(drawRelationshipConnections);
    }

    document.addEventListener('DOMContentLoaded', function() {
        initializeDragAndDrop();
        loadBoardState();
        updateCardCounts();
        updateAllDropZonePositions();
        refreshRelationships();
        saveBoardState();

        const dropdowns = document.querySelectorAll('.dropdown');
        dropdowns.forEach(dropdown => {
            dropdown.addEventListener('change', function() {
                // Placeholder for filtering logic
            });
        });

        const suggestButtons = document.querySelectorAll('.suggest-btn');
        suggestButtons.forEach(btn => {
            btn.addEventListener('mousedown', e => e.stopPropagation(), { passive: false });
            btn.addEventListener('touchstart', e => e.stopPropagation(), { passive: false });
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (this.closest('.suggest-controls')?.classList.contains('suggesting')) {
                    return;
                }
                handleSuggestClick(this.dataset.cardId);
            });
        });

        const acceptButtons = document.querySelectorAll('.suggest-accept');
        acceptButtons.forEach(btn => {
            btn.addEventListener('mousedown', e => e.stopPropagation(), { passive: false });
            btn.addEventListener('touchstart', e => e.stopPropagation(), { passive: false });
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                handleAcceptSuggestion(this.dataset.cardId);
            });
        });

        const rejectButtons = document.querySelectorAll('.suggest-reject');
        rejectButtons.forEach(btn => {
            btn.addEventListener('mousedown', e => e.stopPropagation(), { passive: false });
            btn.addEventListener('touchstart', e => e.stopPropagation(), { passive: false });
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (this.closest('.suggest-controls')?.classList.contains('suggesting')) {
                    return;
                }
                handleRejectSuggestion(this.dataset.cardId);
            });
        });

        const resetBtn = document.getElementById('resetBoardBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                resetBoardState();
            });
        }

        window.addEventListener('resize', refreshRelationships);

        const testCases = document.querySelectorAll('.test-case');
        testCases.forEach(testCase => {
            testCase.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-1px)';
                this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                this.style.transition = 'all 0.2s ease';
            });

            testCase.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none';
            });
        });
    });
})();
