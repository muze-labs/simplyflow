import { batch } from '@muze-labs/simplyflow-state'
import { getValueByPath, setValueByPath } from './path.mjs'

const DEFAULT_ATTRIBUTE = 'data-simply'
const HANDLE_ATTRIBUTE = 'data-simply-sort-handle'
const LIST_HANDLE_ATTRIBUTE = 'data-simply-list-handle'
const STYLE_ID = 'simply-edit-sortable-style'
const DRAG_THRESHOLD = 4

export function createSortableLists({ container=document.body, app, attribute=DEFAULT_ATTRIBUTE }={})
{
    if (!app?.data) {
        throw new Error('simplyedit: sortable lists need an app with data')
    }

    injectSortableStyles(container.ownerDocument || document)

    const sortable = new SortableLists({ container, app, attribute })
    sortable.start()
    return sortable
}

class SortableLists
{
    constructor({ container, app, attribute })
    {
        this.container = container
        this.app = app
        this.attribute = attribute
        this.listSelector = `[${attribute}-list][${attribute}-sortable]`
        this.keyAttribute = `${attribute}-key`
        this._listeners = []
        this._scanQueued = false
        this.drag = null
        this.listHandles = new Map()
        this.toolbar = createSortActionToolbar(container.ownerDocument || document, action => this.handleToolbarAction(action))
        this.toolbarContext = null
    }

    start()
    {
        this.listen(this.container, 'pointerdown', event => this.handlePointerDown(event))
        this.listen(document, 'keydown', event => this.handleKeydown(event))
        this.listen(document, 'click', event => this.handleClick(event))
        this.listen(window, 'resize', () => this.queueScan())
        this.listen(window, 'scroll', () => this.positionListHandles(), { capture: true, passive: true })

        this.observer = new MutationObserver(() => this.queueScan())
        this.observer.observe(this.container, { childList: true, subtree: true })
        this.queueScan()
        return this
    }

    listen(target, type, handler, options)
    {
        target.addEventListener(type, handler, options)
        this._listeners.push(() => target.removeEventListener(type, handler, options))
    }

    queueScan()
    {
        if (this._scanQueued) {
            return
        }
        this._scanQueued = true
        queueMicrotask(() => {
            this._scanQueued = false
            this.scan()
        })
    }

    scan()
    {
        const seen = new Set()
        for (const list of this.container.querySelectorAll(this.listSelector)) {
            seen.add(list)
            this.prepareList(list)
        }
        for (const [list, handle] of Array.from(this.listHandles.entries())) {
            if (!seen.has(list) || !list.isConnected) {
                handle.remove()
                this.listHandles.delete(list)
            }
        }
        this.positionListHandles()
    }

    prepareList(list)
    {
        list.classList.add('simply-edit-sortable-list')
        this.ensureListHandle(list)
        for (const item of getSortableItems(list, this.keyAttribute)) {
            ensureSortHandle(item)
        }
    }

    ensureListHandle(list)
    {
        let handle = this.listHandles.get(list)
        if (handle?.isConnected) {
            return handle
        }

        handle = createDefaultListHandle(list.ownerDocument || document)
        handle._simplyEditSortableList = list
        ;(this.container.ownerDocument?.body || document.body).appendChild(handle)
        this.listHandles.set(list, handle)
        return handle
    }

    positionListHandles()
    {
        for (const [list, handle] of this.listHandles.entries()) {
            if (!list.isConnected) {
                handle.remove()
                this.listHandles.delete(list)
                continue
            }
            const rect = list.getBoundingClientRect()
            const hasRect = rect.width || rect.height || rect.left || rect.top
            handle.hidden = !hasRect
            if (!hasRect) {
                continue
            }
            Object.assign(handle.style, {
                left: `${Math.max(4, rect.left - 34)}px`,
                top: `${Math.max(4, rect.top)}px`
            })
        }
    }

    handleClick(event)
    {
        const action = event.target?.closest?.('[data-simply-sort-action]')
        if (action && this.toolbar.element.contains(action)) {
            event.preventDefault()
            this.handleToolbarAction(action.dataset.simplySortAction)
            return
        }

        const listHandle = event.target?.closest?.(`[${LIST_HANDLE_ATTRIBUTE}]`)
        if (listHandle && this.container.contains(listHandle._simplyEditSortableList || this.container)) {
            event.preventDefault()
            const list = listHandle._simplyEditSortableList
            if (list) {
                this.showListToolbar({ list, handle: listHandle })
            }
            return
        }

        if (!event.target?.closest?.('[data-simply-sort-action-toolbar], [data-simply-sort-handle], [data-simply-list-handle]')) {
            this.hideToolbar()
        }
    }

    handlePointerDown(event)
    {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) {
            return
        }

        const handle = event.target?.closest?.(`[${HANDLE_ATTRIBUTE}]`)
        if (!handle || !this.container.contains(handle)) {
            return
        }

        const item = handle.closest(`[${this.keyAttribute}]`)
        const list = item?.parentElement?.closest?.(this.listSelector)
        if (!item || !list || item.parentElement !== list) {
            return
        }

        const array = this.getListArray(list)
        if (!Array.isArray(array)) {
            console.warn('simplyedit: data-simply-sortable only supports data-simply-list values that are arrays', { cause: list })
            return
        }

        event.preventDefault()
        handle.setPointerCapture?.(event.pointerId)

        this.drag = {
            pointerId: event.pointerId,
            handle,
            list,
            item,
            array,
            from: getItemIndex(item, this.keyAttribute),
            startX: event.clientX,
            startY: event.clientY,
            lastX: event.clientX,
            lastY: event.clientY,
            dragging: false,
            placeholder: null,
            rect: null,
            cleanup: []
        }

        const move = moveEvent => this.handlePointerMove(moveEvent)
        const up = upEvent => this.handlePointerUp(upEvent)
        const cancel = cancelEvent => this.cancelDrag(cancelEvent)
        document.addEventListener('pointermove', move)
        document.addEventListener('pointerup', up)
        document.addEventListener('pointercancel', cancel)
        this.drag.cleanup.push(() => document.removeEventListener('pointermove', move))
        this.drag.cleanup.push(() => document.removeEventListener('pointerup', up))
        this.drag.cleanup.push(() => document.removeEventListener('pointercancel', cancel))
    }

    handlePointerMove(event)
    {
        const drag = this.drag
        if (!drag || event.pointerId !== drag.pointerId) {
            return
        }

        drag.lastX = event.clientX
        drag.lastY = event.clientY

        if (!drag.dragging) {
            const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
            if (distance < DRAG_THRESHOLD) {
                return
            }
            this.startDrag(event)
        }

        event.preventDefault()
        this.updateDraggedItem(event)
        this.updatePlaceholder(event)
    }

    startDrag(event)
    {
        const drag = this.drag
        if (!drag || drag.dragging) {
            return
        }

        this.hideToolbar()
        drag.dragging = true
        drag.rect = drag.item.getBoundingClientRect()
        drag.placeholder = document.createElement(drag.item.tagName)
        drag.placeholder.className = 'simply-edit-sort-placeholder'
        drag.placeholder.style.height = `${Math.max(1, drag.rect.height)}px`
        drag.placeholder.style.width = `${Math.max(1, drag.rect.width)}px`
        drag.item.parentNode.insertBefore(drag.placeholder, drag.item)

        drag.item.classList.add('simply-edit-sort-dragging')
        drag.list.classList.add('simply-edit-sorting')
        drag.handle.setAttribute('aria-pressed', 'true')

        Object.assign(drag.item.style, {
            boxSizing: 'border-box',
            left: `${drag.rect.left}px`,
            pointerEvents: 'none',
            position: 'fixed',
            top: `${drag.rect.top}px`,
            width: `${drag.rect.width}px`,
            zIndex: '10001'
        })

        this.updateDraggedItem(event)
        this.updatePlaceholder(event)
    }

    updateDraggedItem(event)
    {
        const drag = this.drag
        if (!drag?.dragging) {
            return
        }
        const dx = event.clientX - drag.startX
        const dy = event.clientY - drag.startY
        drag.item.style.left = `${drag.rect.left + dx}px`
        drag.item.style.top = `${drag.rect.top + dy}px`
    }

    updatePlaceholder(event)
    {
        const drag = this.drag
        if (!drag?.dragging) {
            return
        }

        const items = getSortableItems(drag.list, this.keyAttribute)
            .filter(item => item !== drag.item)

        for (const item of items) {
            const rect = item.getBoundingClientRect()
            const midpoint = rect.top + rect.height / 2
            if (event.clientY < midpoint) {
                if (drag.placeholder.nextSibling !== item) {
                    drag.list.insertBefore(drag.placeholder, item)
                }
                return
            }
        }

        if (drag.placeholder.parentNode === drag.list) {
            drag.list.appendChild(drag.placeholder)
        }
    }

    handlePointerUp(event)
    {
        const drag = this.drag
        if (!drag || event.pointerId !== drag.pointerId) {
            return
        }

        event.preventDefault()
        if (!drag.dragging) {
            const context = {
                list: drag.list,
                item: drag.item,
                index: drag.from,
                handle: drag.handle
            }
            this.finishDrag({ commit: false })
            this.showItemToolbar(context)
            return
        }

        const to = getPlaceholderIndex(drag.list, drag.placeholder, drag.item, this.keyAttribute)
        this.finishDrag({ commit: true, to })
    }

    cancelDrag(event)
    {
        if (!this.drag || (event?.pointerId != null && event.pointerId !== this.drag.pointerId)) {
            return
        }
        this.finishDrag({ commit: false })
    }

    finishDrag({ commit=false, to }={})
    {
        const drag = this.drag
        if (!drag) {
            return
        }

        for (const remove of drag.cleanup.splice(0)) {
            remove()
        }
        drag.handle.releasePointerCapture?.(drag.pointerId)
        drag.handle.removeAttribute('aria-pressed')

        if (drag.dragging) {
            resetDraggedItem(drag.item)
            drag.item.classList.remove('simply-edit-sort-dragging')
            drag.list.classList.remove('simply-edit-sorting')
            if (drag.placeholder?.parentNode) {
                drag.placeholder.parentNode.insertBefore(drag.item, drag.placeholder)
                drag.placeholder.remove()
            }
        }

        this.drag = null

        if (commit && Number.isInteger(to)) {
            moveArrayItem(drag.array, drag.from, to)
            this.queueScan()
            focusMovedHandle(drag.list, this.keyAttribute, to)
        }
    }

    handleKeydown(event)
    {
        const listHandle = event.target?.closest?.(`[${LIST_HANDLE_ATTRIBUTE}]`)
        if (listHandle?._simplyEditSortableList) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                this.showListToolbar({ list: listHandle._simplyEditSortableList, handle: listHandle })
            } else if (event.key === 'Escape') {
                this.hideToolbar()
            }
            return
        }

        const handle = event.target?.closest?.(`[${HANDLE_ATTRIBUTE}]`)
        if (!handle || !this.container.contains(handle)) {
            return
        }

        const item = handle.closest(`[${this.keyAttribute}]`)
        const list = item?.parentElement?.closest?.(this.listSelector)
        if (!item || !list || item.parentElement !== list) {
            return
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            this.showItemToolbar({
                list,
                item,
                index: getItemIndex(item, this.keyAttribute),
                handle
            })
            return
        }

        if (event.key === 'Escape') {
            this.hideToolbar()
            return
        }

        const from = getItemIndex(item, this.keyAttribute)
        let to = from
        if (event.key === 'ArrowUp') {
            to = Math.max(0, from - 1)
        } else if (event.key === 'ArrowDown') {
            const last = Math.max(0, getSortableItems(list, this.keyAttribute).length - 1)
            to = Math.min(last, from + 1)
        } else if (event.key === 'Home') {
            to = 0
        } else if (event.key === 'End') {
            to = Math.max(0, getSortableItems(list, this.keyAttribute).length - 1)
        } else {
            return
        }

        event.preventDefault()
        if (to === from) {
            return
        }

        const array = this.getListArray(list)
        if (!Array.isArray(array)) {
            return
        }
        moveArrayItem(array, from, to)
        this.queueScan()
        focusMovedHandle(list, this.keyAttribute, to)
    }

    showItemToolbar({ list, item, index, handle })
    {
        this.toolbarContext = { type: 'item', list, item, index }
        this.toolbar.show({
            handle,
            buttons: [
                { action: 'delete', label: 'Delete', icon: '×' },
                { action: 'append', label: 'Append item', icon: '+' }
            ]
        })
    }

    showListToolbar({ list, handle })
    {
        this.toolbarContext = { type: 'list', list }
        this.toolbar.show({
            handle,
            buttons: [
                { action: 'insert', label: 'Insert item', icon: '+' }
            ]
        })
    }

    hideToolbar()
    {
        this.toolbarContext = null
        this.toolbar.hide()
    }

    handleToolbarAction(action)
    {
        const context = this.toolbarContext
        if (!context) {
            return false
        }

        if (action === 'delete' && context.type === 'item') {
            return this.deleteItem(context)
        }
        if (action === 'append' && context.type === 'item') {
            return this.insertItem(context.list, context.index + 1, context.index)
        }
        if (action === 'insert' && context.type === 'list') {
            return this.insertItem(context.list, 0)
        }
        return false
    }

    deleteItem({ list, index })
    {
        const array = this.getListArray(list)
        if (!Array.isArray(array) || index < 0 || index >= array.length) {
            return false
        }
        batch(() => array.splice(index, 1))
        this.hideToolbar()
        this.queueScan()
        focusMovedHandle(list, this.keyAttribute, Math.min(index, array.length - 1), { fallbackListHandle: this.listHandles.get(list) })
        return true
    }

    insertItem(list, index, sourceIndex)
    {
        const array = this.getListArray(list)
        if (!Array.isArray(array)) {
            return false
        }

        const item = createDefaultItemValue(list, this.attribute, array, sourceIndex)
        const to = Math.max(0, Math.min(index, array.length))
        batch(() => array.splice(to, 0, item))
        this.hideToolbar()
        this.queueScan()
        focusMovedHandle(list, this.keyAttribute, to, { fallbackListHandle: this.listHandles.get(list) })
        return true
    }

    getListArray(list)
    {
        const path = list.getAttribute(`${this.attribute}-list`)
        return getValueByPath(this.app.data, path)
    }

    destroy()
    {
        this.cancelDrag()
        this.observer?.disconnect()
        for (const remove of this._listeners.splice(0)) {
            remove()
        }
        this.toolbar.destroy()
        for (const handle of this.listHandles.values()) {
            handle.remove()
        }
        this.listHandles.clear()
        for (const item of this.container.querySelectorAll('.simply-edit-has-default-sort-handle')) {
            const handle = item.querySelector(':scope > .simply-edit-sort-handle[data-simply-generated="true"]')
            handle?.remove()
            item.classList.remove('simply-edit-has-default-sort-handle')
        }
    }
}

function ensureSortHandle(item)
{
    const existing = item.querySelector(`[${HANDLE_ATTRIBUTE}]`)
    if (existing) {
        return existing
    }

    const handle = createDefaultHandle(item.ownerDocument || document)
    if (item instanceof HTMLTableRowElement) {
        const cell = item.ownerDocument.createElement('td')
        cell.className = 'simply-edit-sort-handle-cell'
        cell.appendChild(handle)
        item.insertBefore(cell, item.firstChild)
    } else {
        item.insertBefore(handle, item.firstChild)
    }
    item.classList.add('simply-edit-has-default-sort-handle')
    return handle
}

function createDefaultHandle(doc)
{
    const handle = doc.createElement('button')
    handle.type = 'button'
    handle.className = 'simply-edit-sort-handle'
    handle.setAttribute(HANDLE_ATTRIBUTE, '')
    handle.setAttribute('data-simply-generated', 'true')
    handle.setAttribute('aria-label', 'Move or edit item')
    handle.setAttribute('title', 'Move or edit item')
    handle.textContent = '⋮⋮'
    return handle
}

function createDefaultListHandle(doc)
{
    const handle = doc.createElement('button')
    handle.type = 'button'
    handle.className = 'simply-edit-list-handle'
    handle.setAttribute(LIST_HANDLE_ATTRIBUTE, '')
    handle.setAttribute('data-simply-generated', 'true')
    handle.setAttribute('aria-label', 'Insert item')
    handle.setAttribute('title', 'Insert item')
    handle.textContent = '+'
    return handle
}

function createSortActionToolbar(doc, onAction)
{
    const toolbar = doc.createElement('div')
    toolbar.className = 'simply-edit-sort-action-toolbar'
    toolbar.setAttribute('data-simply-sort-action-toolbar', '')
    toolbar.setAttribute('role', 'toolbar')
    toolbar.hidden = true
    ;(doc.body || doc.documentElement).appendChild(toolbar)

    return {
        element: toolbar,
        show({ handle, buttons }) {
            toolbar.replaceChildren(...buttons.map(button => createToolbarButton(doc, button)))
            const rect = handle.getBoundingClientRect()
            toolbar.hidden = false
            Object.assign(toolbar.style, {
                left: `${Math.max(4, rect.left)}px`,
                top: `${Math.max(4, rect.bottom + 4)}px`
            })
        },
        hide() {
            toolbar.hidden = true
            toolbar.replaceChildren()
        },
        destroy() {
            toolbar.remove()
        }
    }
}

function createToolbarButton(doc, button)
{
    const element = doc.createElement('button')
    element.type = 'button'
    element.className = 'simply-edit-sort-action-button'
    element.dataset.simplySortAction = button.action
    element.title = button.label
    element.innerHTML = `<span class="simply-edit-sort-action-icon">${escapeHTML(button.icon || '')}</span><span class="simply-edit-sort-action-label">${escapeHTML(button.label || button.action)}</span>`
    return element
}

function getSortableItems(list, keyAttribute)
{
    return Array.from(list.children)
        .filter(child => child instanceof HTMLElement && child.hasAttribute(keyAttribute))
}

function getItemIndex(item, keyAttribute)
{
    return Number.parseInt(item.getAttribute(keyAttribute), 10)
}

function getPlaceholderIndex(list, placeholder, draggedItem, keyAttribute)
{
    const children = Array.from(list.children)
        .filter(child => child !== draggedItem && child.tagName !== 'TEMPLATE')
    return Math.max(0, children.indexOf(placeholder))
}

function resetDraggedItem(item)
{
    item.style.boxSizing = ''
    item.style.left = ''
    item.style.pointerEvents = ''
    item.style.position = ''
    item.style.top = ''
    item.style.width = ''
    item.style.zIndex = ''
}

function moveArrayItem(array, from, to)
{
    if (!Array.isArray(array) || from === to || from < 0 || to < 0 || from >= array.length || to >= array.length) {
        return false
    }

    batch(() => {
        const [item] = array.splice(from, 1)
        array.splice(to, 0, item)
    })
    return true
}

function focusMovedHandle(list, keyAttribute, index, { fallbackListHandle }={})
{
    setTimeout(() => {
        const item = Array.from(list.children).find(child => child.getAttribute?.(keyAttribute) === ''+index)
        const handle = item?.querySelector?.(`[${HANDLE_ATTRIBUTE}]`)
        if (handle) {
            handle.focus?.()
            return
        }
        fallbackListHandle?.focus?.()
    }, 0)
}

function createDefaultItemValue(list, attribute, array, sourceIndex)
{
    const source = Number.isInteger(sourceIndex) ? array[sourceIndex] : array[0]
    if (source !== undefined) {
        return createEmptyValueLike(source)
    }
    return createValueFromTemplate(list, attribute)
}

function createEmptyValueLike(value)
{
    if (Array.isArray(value)) {
        return []
    }
    if (value && typeof value === 'object') {
        const result = {}
        for (const key of Object.keys(value)) {
            result[key] = createEmptyValueLike(value[key])
        }
        return result
    }
    if (typeof value === 'boolean') {
        return false
    }
    if (typeof value === 'number') {
        return 0
    }
    return ''
}

function createValueFromTemplate(list, attribute)
{
    const template = Array.from(list.children).find(child => child.tagName === 'TEMPLATE')
    if (!template?.content) {
        return {}
    }

    const result = {}
    const selector = [`[${attribute}-field]`, `[${attribute}-edit]`, `[${attribute}-list]`].join(',')
    for (const element of template.content.querySelectorAll(selector)) {
        const listPath = element.getAttribute(`${attribute}-list`)
        const fieldPath = element.getAttribute(`${attribute}-field`) || element.getAttribute(`${attribute}-edit`)
        const path = listPath || fieldPath
        if (!path || path.startsWith(':') || path.startsWith('/')) {
            continue
        }
        setValueByPath(result, path, listPath ? [] : '')
    }
    return Object.keys(result).length ? result : ''
}

function injectSortableStyles(doc)
{
    if (doc.getElementById(STYLE_ID)) {
        return
    }
    const style = doc.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
.simply-edit-sortable-list {
    position: relative;
}
.simply-edit-has-default-sort-handle {
    position: relative;
}
.simply-edit-sort-handle,
.simply-edit-list-handle {
    align-items: center;
    background: #fff;
    border: 1px solid #d0d0d0;
    border-radius: 3px;
    color: #555;
    cursor: grab;
    display: inline-flex;
    font: inherit;
    font-size: 14px;
    justify-content: center;
    line-height: 1;
    min-height: 1.75rem;
    min-width: 1.75rem;
    padding: .15rem .25rem;
    touch-action: none;
    user-select: none;
    z-index: 9998;
}
.simply-edit-sort-handle[data-simply-generated="true"] {
    left: -2.25rem;
    margin: 0;
    position: absolute;
    top: .35rem;
}
.simply-edit-list-handle {
    cursor: pointer;
    font-weight: bold;
    position: fixed;
}
.simply-edit-sort-handle:hover,
.simply-edit-sort-handle:focus,
.simply-edit-list-handle:hover,
.simply-edit-list-handle:focus {
    border-color: #ea5922;
    outline: 2px solid transparent;
}
.simply-edit-sorting .simply-edit-sort-handle,
.simply-edit-sort-dragging .simply-edit-sort-handle {
    cursor: grabbing;
}
.simply-edit-sort-dragging {
    background: #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,.18);
    opacity: .96;
}
.simply-edit-sort-placeholder {
    background: rgba(234, 89, 34, .08);
    border: 2px dashed #ea5922;
    box-sizing: border-box;
    list-style: none;
    min-height: 1.75rem;
}
.simply-edit-sort-handle-cell {
    width: 1%;
    white-space: nowrap;
}
.simply-edit-sort-action-toolbar {
    background: white;
    border-top: 2px solid #ea5922;
    box-shadow: 0 1px 1px rgba(0,0,0,.11), 0 2px 2px rgba(0,0,0,.09), 0 4px 4px rgba(0,0,0,.07);
    display: flex;
    min-height: 40px;
    position: fixed;
    white-space: nowrap;
    z-index: 10000;
}
.simply-edit-sort-action-toolbar[hidden] {
    display: none;
}
.simply-edit-sort-action-button {
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    color: #333;
    cursor: pointer;
    font: 11px Arial, Helvetica, sans-serif;
    min-height: 40px;
    min-width: 54px;
    padding: 0 5px;
    text-align: center;
}
.simply-edit-sort-action-button:hover,
.simply-edit-sort-action-button:focus {
    border-bottom-color: #ea5922;
    outline: 2px solid transparent;
}
.simply-edit-sort-action-icon {
    display: block;
    font-size: 18px;
    font-weight: bold;
    line-height: 20px;
}
.simply-edit-sort-action-label {
    display: block;
}
`
    doc.head?.appendChild(style)
}

function escapeHTML(value)
{
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
}

export { moveArrayItem, ensureSortHandle }
