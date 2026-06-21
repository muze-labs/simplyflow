import { app as createApp } from '@muze-labs/simplyflow-app'
import { createHtmlDomEngine } from './engines/html-dom-engine.mjs'
import { createToolbar } from './toolbar.mjs'
import { getFieldPath, getValueByPath, setValueByPath } from './path.mjs'
import { hasCaretOrSelection, hasVisibleSelection } from './selection-anchor.mjs'
import { createSortableLists } from './sortable-list.mjs'

const DEFAULT_SELECTOR = '[data-simply-editable]'

export class SimplyEdit
{
    constructor(options={})
    {
        this.container = options.container || document.body
        this.attribute = options.attribute || 'data-simply'
        this.selector = options.selector || DEFAULT_SELECTOR
        this.engine = options.engine || createHtmlDomEngine(options.engineOptions)
        this.toolbar = options.toolbar === false ? null : (options.toolbar || createToolbar({
            container: this.container,
            buttons: options.buttons,
            toolbars: options.toolbars,
            onCommand: (command, value) => this.execute(command, value)
        }))
        this.app = options.app || createApp({
            container: this.container,
            data: options.data || {},
            transformers: options.transformers
        })
        this.sortable = options.sortable === false ? null : createSortableLists({
            container: this.container,
            app: this.app,
            attribute: this.attribute
        })
        this.activeElement = null
        this.activeSession = null
        this.toolbarRequested = false
        this._listeners = []
        this.start()
    }

    start()
    {
        this.listen(this.container, 'focusin', event => this.activateFromEvent(event))
        this.listen(this.container, 'click', event => this.activateFromEvent(event))
        this.listen(document, 'selectionchange', () => this.updateToolbar())
        this.listen(document, 'keydown', event => this.handleKeydown(event))
        return this
    }

    listen(target, event, handler)
    {
        target.addEventListener(event, handler)
        this._listeners.push(() => target.removeEventListener(event, handler))
    }

    activateFromEvent(event)
    {
        const element = event.target?.closest?.(this.selector)
        if (!element || !this.container.contains(element)) {
            return
        }
        if (event.type === 'click') {
            this.toolbarRequested = false
        }
        this.activate(element)
    }

    activate(element)
    {
        if (this.activeElement === element && this.activeSession) {
            this.updateToolbar()
            return this.activeSession
        }

        this.deactivate()

        const path = getFieldPath(element, this.attribute)
        if (!path) {
            throw new Error('simplyedit: editable elements need data-simply-field or data-simply-edit')
        }

        this.activeElement = element
        element.classList.add('simply-edit-active')

        const html = getValueByPath(this.app.data, path) ?? element.innerHTML
        this.activeSession = this.engine.mount({
            element,
            html,
            onChange: value => {
                setValueByPath(this.app.data, path, value)
            },
            onSelectionChange: () => this.updateToolbar()
        })
        this.activeSession.focus()
        this.updateToolbar()
        return this.activeSession
    }

    deactivate()
    {
        if (this.activeSession) {
            this.activeSession.destroy?.()
        }
        if (this.activeElement) {
            this.activeElement.classList.remove('simply-edit-active')
        }
        this.activeSession = null
        this.activeElement = null
        this.toolbarRequested = false
        this.toolbar?.hide()
    }

    execute(command, value)
    {
        if (!this.activeSession) {
            return false
        }
        return this.activeSession.execute(command, value)
    }

    handleKeydown(event)
    {
        if (event.key === 'Escape' && this.toolbar && !this.toolbar.element.hidden) {
            event.preventDefault()
            this.hideToolbar()
            return
        }

        if (!isControlSpace(event)) {
            return
        }

        const element = event.target?.closest?.(this.selector) || this.activeElement
        if (!element || !this.container.contains(element)) {
            return
        }

        event.preventDefault()
        if (this.activeElement !== element || !this.activeSession) {
            this.activate(element)
        }
        this.showToolbar({ allowCollapsed: true })
    }

    showToolbar({ allowCollapsed=false }={})
    {
        if (!this.activeSession) {
            return false
        }
        this.toolbarRequested = allowCollapsed
        return this.toolbar?.show({
            session: this.activeSession,
            referenceElement: this.activeElement,
            allowCollapsed
        }) ?? false
    }

    hideToolbar()
    {
        this.toolbarRequested = false
        this.toolbar?.hide()
    }

    updateToolbar()
    {
        if (!this.activeSession) {
            this.toolbar?.hide()
            return
        }

        if (hasVisibleSelection(this.container, { referenceElement: this.activeElement })) {
            this.toolbarRequested = false
            this.toolbar?.show({
                session: this.activeSession,
                referenceElement: this.activeElement,
                allowCollapsed: false
            })
            return
        }

        if (this.toolbarRequested && hasCaretOrSelection(this.container, { referenceElement: this.activeElement })) {
            this.toolbar?.show({
                session: this.activeSession,
                referenceElement: this.activeElement,
                allowCollapsed: true
            })
            return
        }

        this.toolbar?.hide()
    }

    destroy()
    {
        this.deactivate()
        for (const remove of this._listeners.splice(0)) {
            remove()
        }
        this.toolbar?.destroy?.()
        this.sortable?.destroy?.()
        this.app?.destroy?.()
    }
}

export function edit(options={})
{
    return new SimplyEdit(options)
}

function isControlSpace(event)
{
    return event.ctrlKey && !event.altKey && !event.metaKey && (event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space')
}
