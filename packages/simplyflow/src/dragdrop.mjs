// SimplyFlow app module. Place in packages/app/src/ beside path.mjs.
//
// Source: draggable="true" data-simply-drag="card" data-simply-value="card-id"
// Target: data-simply-drop="column" data-simply-value="column-id"
// Both support data-simply-value-path, just like commands.
//
// drags.card(element, value, event) returns { meta, data, effects } or false.
// meta is a small public JSON object for hover. data maps MIME types to strings.
// drops.column defines { effects, accepts(element, value, drag, event),
//                        drop(element, value, drag, event) }.
// accepts is synchronous and is checked again at drop. drop may be async.
// Its action validates the captured drag.data and commits the application change.
//
// Optional sorting: set data-simply-sort="vertical" or "horizontal" on a
// drop target. Direct child cards use stable string IDs as their values.
// drag.before is the next card's ID or null to append.
// Style [data-simply-drag-over], [data-simply-drop-before] and
// [data-simply-drop-end] in the application to show the insertion indicator.
//
// Optional touch: add data-simply-drag-handle to the source or a descendant
// and set touch-action: none on that handle. Desktop uses native HTML dragging.
// Keyboard and menu controls can invoke the same application action.

import path from './path.mjs'

const sourceSelector = '[data-simply-drag]'
const targetSelector = '[data-simply-drop]'
const handleSelector = '[data-simply-drag-handle]'
const metadataPrefix = 'application/x-simplyflow-drag-meta-v1-'
const maxMetadataBytes = 512
const nativeEffects = {
    none: [],
    copy: ['copy'],
    move: ['move'],
    link: ['link'],
    copyMove: ['copy', 'move'],
    copyLink: ['copy', 'link'],
    linkMove: ['move', 'link'],
    all: ['copy', 'link', 'move'],
    uninitialized: ['copy', 'link', 'move']
}

function encodeMetadata(meta) {
    const bytes = new TextEncoder().encode(JSON.stringify(meta))
    if (bytes.length > maxMetadataBytes) {
        throw new RangeError('Drag metadata exceeds 512 UTF-8 bytes')
    }
    return metadataPrefix + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

function readMetadata(types) {
    const markers = types.filter(type => type.startsWith(metadataPrefix))
    if (markers.length !== 1) return
    const hex = markers[0].slice(metadataPrefix.length)
    if (!hex.length || hex.length > 2 * maxMetadataBytes || hex.length % 2 || /[^0-9a-f]/.test(hex)) return
    try {
        const bytes = Uint8Array.from(hex.match(/../g), byte => Number.parseInt(byte, 16))
        const meta = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
        if (meta && typeof meta === 'object' && !Array.isArray(meta)) return meta
    } catch {
        // Invalid or unknown metadata leaves only the advertised payload formats.
    }
}

export function dragdrop({ app, container = app.container, drags = {}, drops = {} }) {
    const document = container.ownerDocument
    const listeners = new AbortController()
    let nativeSource
    let touch
    let preview

    function listen(type, handler, options) {
        container.addEventListener(type, handler, { ...options, signal: listeners.signal })
    }

    function value(element) {
        return element.hasAttribute('data-simply-value-path')
            ? path.get(app.data, element.dataset.simplyValuePath)
            : element.dataset.simplyValue
    }

    function describe(source, event) {
        const name = source.dataset.simplyDrag
        if (!Object.hasOwn(drags, name)) return
        const description = drags[name].call(app, source, value(source), event)
        if (!description) return
        const { meta, data = {}, effects = ['copy'] } = description
        const allowed = Object.keys(nativeEffects).find(key =>
            key !== 'uninitialized' &&
            nativeEffects[key].length === effects.length &&
            nativeEffects[key].every(effect => effects.includes(effect)))
        if (!allowed || allowed === 'none') return
        // Normalize type names and serialize before writing to the browser store.
        const formats = Object.fromEntries(Object.entries(data).map(([type, payload]) => {
            type = type.toLowerCase()
            if (type === 'text') type = 'text/plain'
            if (type === 'url') type = 'text/uri-list'
            if (type.startsWith(metadataPrefix) || typeof payload !== 'string') {
                throw new TypeError('Drag data must map non-reserved formats to strings')
            }
            return [type, payload]
        }))
        if (meta !== undefined) formats[encodeMetadata(meta)] = '1'
        return { formats, allowed }
    }

    function readDrag(types, allowed) {
        return {
            meta: readMetadata(types),
            types: types.filter(type => !type.startsWith(metadataPrefix)),
            effects: nativeEffects[allowed] ?? nativeEffects.uninitialized
        }
    }

    function destination(node, drag, event, source, preferred) {
        let target = node?.closest?.(targetSelector)
        while (target && container.contains(target)) {
            const name = target.dataset.simplyDrop
            const handler = Object.hasOwn(drops, name) ? drops[name] : undefined
            if (typeof handler?.drop === 'function') {
                const effects = drag.effects.filter(effect => !handler.effects || handler.effects.includes(effect))
                const effect = [preferred, source ? 'move' : 'copy', ...effects]
                    .find(candidate => effects.includes(candidate))
                if (effect) {
                    const targetValue = value(target)
                    const context = { ...drag, effect }
                    const before = insertion(target, source, event)
                    if (before !== undefined) context.before = before ? value(before) : null
                    if (!handler.accepts || handler.accepts.call(app, target, targetValue, context, event) === true) {
                        return { target, targetValue, handler, context, before }
                    }
                }
            }
            target = target.parentElement?.closest(targetSelector)
        }
    }

    function insertion(target, source, event) {
        const axis = target.dataset.simplySort
        if (axis !== 'vertical' && axis !== 'horizontal') return
        const horizontal = axis === 'horizontal'
        for (const card of target.children) {
            if (card === source || !card.matches(sourceSelector) || value(card) == null) continue
            const rect = card.getBoundingClientRect()
            const midpoint = horizontal ? rect.left + rect.width / 2 : rect.top + rect.height / 2
            if ((horizontal ? event.clientX : event.clientY) < midpoint) return card
        }
        return null
    }

    function show(next) {
        if (preview?.target === next?.target && preview?.before === next?.before) return
        preview?.target.removeAttribute('data-simply-drag-over')
        preview?.target.removeAttribute('data-simply-drop-end')
        preview?.before?.removeAttribute('data-simply-drop-before')
        preview = next
        next?.target.setAttribute('data-simply-drag-over', '')
        if (next?.before === null) next.target.setAttribute('data-simply-drop-end', '')
        next?.before?.setAttribute('data-simply-drop-before', '')
    }

    function report(error, event) {
        if (app.onError) app.onError.call(app, error, event)
        else console.error(error)
    }

    function commit(match, data, event) {
        const { target, targetValue, handler, context } = match
        try {
            const result = handler.drop.call(app, target, targetValue, { ...context, data }, event)
            Promise.resolve(result).catch(error => report(error, event))
        } catch (error) {
            report(error, event)
        }
    }

    function nativeTarget(event) {
        const dt = event.dataTransfer
        if (!dt) return
        const drag = readDrag(Array.from(dt.types), dt.effectAllowed)
        const preferred = event.ctrlKey ? 'copy' : event.shiftKey ? 'move' : dt.dropEffect
        return destination(event.target, drag, event, nativeSource, preferred)
    }

    function nativeHover(event) {
        const match = nativeTarget(event)
        show(match)
        if (!match) return
        event.preventDefault()
        event.dataTransfer.dropEffect = match.context.effect
    }

    function cancel() {
        const previous = touch
        touch = undefined
        nativeSource = undefined
        show()
        if (previous?.handle.hasPointerCapture(previous.id)) {
            previous.handle.releasePointerCapture(previous.id)
        }
    }

    listen('dragstart', event => {
        const source = event.target.closest?.(sourceSelector)
        if (!source || !container.contains(source) || !event.dataTransfer) return
        cancel()
        try {
            const description = describe(source, event)
            if (!description) {
                event.preventDefault()
                return
            }
            const dt = event.dataTransfer
            dt.clearData()
            for (const [type, payload] of Object.entries(description.formats)) dt.setData(type, payload)
            dt.effectAllowed = description.allowed
            nativeSource = source
        } catch (error) {
            event.preventDefault()
            report(error, event)
        }
    })
    listen('dragenter', nativeHover)
    listen('dragover', nativeHover)
    listen('dragleave', event => {
        if (!preview?.target.contains(event.relatedTarget)) show()
    })
    listen('drop', event => {
        const match = nativeTarget(event)
        cancel()
        if (!match) return
        event.preventDefault()
        event.dataTransfer.dropEffect = match.context.effect
        const data = Object.fromEntries(match.context.types
            .filter(type => type !== 'Files')
            .map(type => [type, event.dataTransfer.getData(type)]))
        commit(match, data, event)
    })
    // A source may be removed from the app while a native drag is active.
    document.addEventListener('dragend', cancel, { signal: listeners.signal })

    listen('pointerdown', event => {
        if (event.pointerType !== 'touch' || !event.isPrimary || touch) return
        const handle = event.target.closest?.(handleSelector)
        const source = handle?.closest(sourceSelector)
        if (!source || !container.contains(source)) return
        handle.setPointerCapture(event.pointerId)
        touch = { handle, source, id: event.pointerId, x: event.clientX, y: event.clientY }
    })

    function touchTarget(event) {
        const node = document.elementFromPoint(event.clientX, event.clientY)
        return destination(node, touch.drag, event, touch.source, 'move')
    }

    listen('pointermove', event => {
        if (touch?.id !== event.pointerId) return
        if (!touch.drag) {
            if (Math.hypot(event.clientX - touch.x, event.clientY - touch.y) < 6) return
            try {
                const description = describe(touch.source, event)
                if (!description) return cancel()
                touch.drag = readDrag(Object.keys(description.formats), description.allowed)
                touch.data = Object.fromEntries(touch.drag.types.map(type => [type, description.formats[type]]))
            } catch (error) {
                cancel()
                report(error, event)
                return
            }
        }
        event.preventDefault()
        show(touchTarget(event))
    })

    listen('pointerup', event => {
        if (touch?.id !== event.pointerId) return
        const match = touch.drag && touchTarget(event)
        const data = touch.data
        cancel()
        if (match) commit(match, data, event)
    })
    for (const type of ['pointercancel', 'lostpointercapture']) {
        listen(type, event => {
            if (touch?.id === event.pointerId) cancel()
        })
    }
    listen('keydown', event => {
        if (event.key === 'Escape') cancel()
    })

    return {
        cancel,
        destroy() {
            listeners.abort()
            cancel()
        }
    }
}
