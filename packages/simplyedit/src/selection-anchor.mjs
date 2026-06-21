const DEFAULT_SELECTOR = '[contenteditable]'

export function createSelectionAnchor({ container=document.body, selector=DEFAULT_SELECTOR }={})
{
    const element = document.createElement('div')
    element.className = 'simply-edit-selection-anchor'
    Object.assign(element.style, {
        background: '#ea5922',
        display: 'none',
        height: '10px',
        left: '0',
        pointerEvents: 'none',
        position: 'fixed',
        top: '0',
        transform: 'rotate(45deg)',
        transformOrigin: 'top left',
        width: '10px',
        zIndex: '9999'
    })
    element.style.setProperty('anchor-name', '--cursor-anchor')
    container.appendChild(element)

    return {
        element,

        update({ referenceElement, allowCollapsed=true }={}) {
            const position = getCursorPosition(container, { selector, referenceElement, allowCollapsed })
                || getReferencePosition(referenceElement)
            if (!position) {
                this.hide()
                return null
            }
            element.style.left = `${position.viewportX}px`
            element.style.top = `${position.viewportY + position.height}px`
            element.style.display = 'block'
            return position
        },

        hide() {
            element.style.display = 'none'
        },

        destroy() {
            element.remove()
        }
    }
}


export function hasVisibleSelection(container=document.body, options={})
{
    return Boolean(getCursorPosition(container, Object.assign({}, options, { allowCollapsed: false })))
}

export function hasCaretOrSelection(container=document.body, options={})
{
    return Boolean(getCursorPosition(container, Object.assign({}, options, { allowCollapsed: true })))
}

export function getSelectionRect(container=document.body, options={})
{
    const position = getCursorPosition(container, options)
    if (!position) {
        return null
    }
    return {
        left: position.viewportX,
        right: position.viewportX,
        top: position.viewportY,
        bottom: position.viewportY + position.height,
        width: 0,
        height: position.height,
        x: position.viewportX,
        y: position.viewportY
    }
}

/**
 * Return the cursor position and line height for the current selection.
 *
 * The x/y values are relative to the given container. viewportX/viewportY are
 * absolute viewport coordinates. The function does not alter the DOM, and falls
 * back to the focused element's padding when the browser does not expose a range
 * rectangle for an empty line.
 */
export function getCursorPosition(container=document.body, { selector=DEFAULT_SELECTOR, referenceElement, allowCollapsed=true }={})
{
    const selection = globalThis.getSelection?.()
    if (!selection || !selection.rangeCount) {
        return null
    }
    if (!allowCollapsed && selection.isCollapsed) {
        return null
    }

    const focusNode = selection.focusNode || selection.anchorNode
    if (!focusNode || !nodeIsInside(container, focusNode)) {
        return null
    }

    const cursorElement = focusNode.nodeType === Node.TEXT_NODE
        ? focusNode.parentElement
        : focusNode

    if (!cursorElement?.getBoundingClientRect) {
        return null
    }

    const editableElement = cursorElement.closest?.(selector)
    if (!editableElement && !(referenceElement && referenceElement.contains?.(focusNode))) {
        return null
    }

    const range = document.createRange()
    try {
        range.setStart(focusNode, selection.focusOffset ?? selection.anchorOffset ?? 0)
        range.collapse(true)
    } catch (error) {
        return null
    }

    const containerRect = container.getBoundingClientRect?.() ?? { left: 0, top: 0 }
    const rects = range.getClientRects?.()
    let viewportX
    let viewportY
    let height

    if (rects && rects.length > 0) {
        const rect = rects[0]
        viewportX = rect.left
        viewportY = rect.top
        height = rect.height || getLineHeight(cursorElement)
    } else {
        const style = globalThis.getComputedStyle?.(cursorElement) ?? {}
        const cursorRect = cursorElement.getBoundingClientRect()
        viewportX = cursorRect.left + parseFloat(style.paddingLeft || 0)
        viewportY = cursorRect.top + parseFloat(style.paddingTop || 0)
        height = getLineHeight(cursorElement, style)
    }

    return {
        x: viewportX - containerRect.left,
        y: viewportY - containerRect.top,
        viewportX,
        viewportY,
        height,
        element: cursorElement,
        editableElement
    }
}

export function positionNearSelection(element, { container=document.body, referenceElement, anchor }={})
{
    const position = anchor?.update?.({ referenceElement }) || getCursorPosition(container, { referenceElement })
    if (!position) {
        element.style.left = '1rem'
        element.style.top = '1rem'
        element.style.transform = ''
        return
    }
    positionNearAnchor(element, anchor?.element, position)
}

export function positionNearAnchor(element, anchorElement, fallbackPosition)
{
    element.style.setProperty('position-anchor', '--cursor-anchor')
    element.style.setProperty('position-area', 'end span-all')
    element.style.transform = ''

    if (supportsAnchorPositioning()) {
        element.style.left = ''
        element.style.top = ''
        return
    }

    const rect = anchorElement?.getBoundingClientRect?.()
    const hasRect = rect && (rect.left || rect.top || rect.right || rect.bottom || rect.width || rect.height)
    const anchorX = hasRect ? rect.left + rect.width / 2 : fallbackPosition.viewportX
    const anchorBottom = hasRect ? rect.bottom : fallbackPosition.viewportY + fallbackPosition.height
    const width = element.offsetWidth || element.getBoundingClientRect?.().width || 0
    const viewportWidth = globalThis.innerWidth || document.documentElement?.clientWidth || 0
    const padding = 8
    const x = width
        ? anchorX - width / 2
        : anchorX
    const maxX = viewportWidth && width
        ? viewportWidth - width - padding
        : x

    element.style.left = `${Math.max(padding, Math.min(x, maxX))}px`
    element.style.top = `${Math.max(padding, anchorBottom)}px`
}

function supportsAnchorPositioning()
{
    return Boolean(globalThis.CSS?.supports?.('position-anchor: --cursor-anchor'))
}

function getReferencePosition(referenceElement)
{
    const rect = referenceElement?.getBoundingClientRect?.()
    if (!rect) {
        return null
    }
    return {
        x: rect.left,
        y: rect.top,
        viewportX: rect.left + rect.width / 2,
        viewportY: rect.top,
        height: rect.height,
        element: referenceElement,
        editableElement: referenceElement
    }
}

function nodeIsInside(container, node)
{
    if (node === container) {
        return true
    }
    return container.contains?.(node) ?? false
}

function getLineHeight(element, style=globalThis.getComputedStyle?.(element) ?? {})
{
    const lineHeight = parseFloat(style.lineHeight)
    if (!Number.isNaN(lineHeight)) {
        return lineHeight
    }
    const fontSize = parseFloat(style.fontSize)
    return Number.isNaN(fontSize) ? 16 : fontSize
}
