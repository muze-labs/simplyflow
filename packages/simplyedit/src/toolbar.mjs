import { app as createApp } from '@muze-labs/simplyflow-app'
import { createSelectionAnchor, positionNearAnchor } from './selection-anchor.mjs'

const DEFAULT_BUTTONS = [
    { label: 'Bold', command: 'bold', icon: 'B' },
    { label: 'Italic', command: 'italic', icon: 'I' },
    { label: 'Underline', command: 'underline', icon: 'U' },
    { label: 'Link', command: 'expand', value: 'link', icon: '↗', expands: true }
]

const DEFAULT_TOOLBARS = {
    link: {
        label: 'Link',
        buttons: [
            { label: 'Set link', command: 'link', icon: '↗' },
            { label: 'Remove', command: 'unlink', icon: '×' }
        ]
    }
}

export function createToolbar({ container=document.body, buttons=DEFAULT_BUTTONS, toolbars=DEFAULT_TOOLBARS, onCommand }={})
{
    const anchor = createSelectionAnchor({ container })
    const host = document.createElement('div')
    host.className = 'simply-edit-toolbar-host'
    host.hidden = true
    container.appendChild(host)

    const shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
<style>
:host {
    --simply-edit-primary: #ea5922;
    --simply-edit-border: #d0d0d0;
    --simply-edit-shadow: 0 1px 1px rgba(0,0,0,.11), 0 2px 2px rgba(0,0,0,.09), 0 4px 4px rgba(0,0,0,.07);
    --simply-edit-sub-background: #eee;
    color: #333;
    font-family: Arial, Helvetica, sans-serif;
}
.simply-edit-toolbar-frame {
    background: white;
    box-shadow: var(--simply-edit-shadow);
    display: inline-block;
    white-space: nowrap;
}
.simply-edit-toolbar {
    align-items: stretch;
    display: flex;
    min-height: 50px;
    min-width: 100px;
    position: relative;
    white-space: nowrap;
}
.simply-edit-toolbar-main {
    background: linear-gradient(180deg, white 0, white 95%, #ccc 100%);
    border-top: 2px solid var(--simply-edit-primary);
}
.simply-edit-toolbar-sub {
    background: var(--simply-edit-sub-background);
}
.simply-edit-toolbar-sub[hidden] {
    display: none;
}
.simply-edit-toolbar-subbar {
    background: var(--simply-edit-sub-background);
    min-height: 40px;
}
.simply-edit-button {
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    min-height: 50px;
    min-width: 50px;
    padding: 0 4px;
    position: relative;
    text-align: center;
    user-select: none;
}
.simply-edit-toolbar-subbar .simply-edit-button {
    min-height: 40px;
    min-width: 40px;
}
.simply-edit-button:hover,
.simply-edit-button[aria-pressed="true"] {
    border-bottom-color: var(--simply-edit-primary);
}
.simply-edit-button-expanded {
    background: var(--simply-edit-sub-background);
}
.simply-edit-button-expands:not(.simply-edit-button-expanded)::after {
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    border-top: 3px solid #888;
    bottom: 2px;
    content: "";
    display: block;
    left: 50%;
    margin-left: -3px;
    position: absolute;
    width: 0;
}
.simply-edit-icon {
    display: block;
    font-size: 22px;
    font-weight: bold;
    line-height: 26px;
    margin: -2px auto -2px;
}
.simply-edit-toolbar-subbar .simply-edit-icon {
    font-size: 18px;
    line-height: 22px;
}
.simply-edit-label {
    display: block;
    font-size: 11px;
}
</style>
<div class="simply-edit-toolbar-frame">
    <nav class="simply-edit-toolbar simply-edit-toolbar-main" aria-label="Text formatting" data-simply-list="buttons">
        <template>
            <button type="button" class="simply-edit-button" data-simply-field=":value" data-simply-transform="toolbarButton">
                <span class="simply-edit-icon" data-simply-field="icon"></span>
                <span class="simply-edit-label" data-simply-field="label"></span>
            </button>
        </template>
    </nav>
    <div class="simply-edit-toolbar-sub" data-simply-map="toolbars" hidden>
        <template>
            <nav class="simply-edit-toolbar simply-edit-toolbar-subbar" data-simply-field=":key" data-simply-transform="toolbarPanel">
                <div data-simply-list="buttons">
                    <template>
                        <button type="button" class="simply-edit-button" data-simply-field=":value" data-simply-transform="toolbarButton">
                            <span class="simply-edit-icon" data-simply-field="icon"></span>
                            <span class="simply-edit-label" data-simply-field="label"></span>
                        </button>
                    </template>
                </div>
            </nav>
        </template>
    </div>
</div>`

    let expanded = null

    const app = createApp({
        container: shadow,
        data: { buttons, toolbars },
        transformers: {
            toolbarButton(context) {
                const button = normalizeButton(context.value)
                const el = context.element
                el.value = button.value ?? button.command ?? ''
                el.dataset.toolbarCommand = button.command || ''
                if (button.value != null) {
                    el.dataset.toolbarValue = ''+button.value
                } else {
                    delete el.dataset.toolbarValue
                }
                el.dataset.simplyCommand = 'toolbarCommand'
                el.classList.toggle('simply-edit-button-expands', button.expands || button.command === 'expand')
                el.title = button.title || button.label || button.command || ''
                // The nested icon/label bindings render the visible contents.
                return context
            },
            toolbarPanel(context) {
                context.element.dataset.toolbarPanel = context.value
                context.element.hidden = context.value !== expanded
                return context
            }
        },
        commands: {
            toolbarCommand(button) {
                const command = button.dataset.toolbarCommand || button.value
                const value = button.dataset.toolbarValue || button.value
                if (command === 'expand') {
                    setExpanded(expanded === value ? null : value)
                    return
                }
                onCommand?.(command, value, button)
            }
        }
    })

    Object.assign(host.style, {
        marginTop: '-4px',
        position: 'fixed',
        zIndex: '10000'
    })

    function setExpanded(name)
    {
        expanded = name
        const subHost = shadow.querySelector('.simply-edit-toolbar-sub')
        if (subHost) {
            subHost.hidden = !expanded
        }
        for (const panel of shadow.querySelectorAll('[data-toolbar-panel]')) {
            panel.hidden = panel.dataset.toolbarPanel !== expanded
        }
        for (const button of shadow.querySelectorAll('[data-toolbar-command="expand"]')) {
            button.classList.toggle('simply-edit-button-expanded', button.dataset.toolbarValue === expanded)
        }
    }

    function updatePosition(session, referenceElement, allowCollapsed)
    {
        const position = anchor.update({
            referenceElement: referenceElement || session?.element,
            allowCollapsed
        })
        if (position) {
            positionNearAnchor(host, anchor.element, position)
        }
        return position
    }

    return {
        element: host,
        app,
        anchor,

        show({ session, referenceElement, allowCollapsed=false }={}) {
            const position = updatePosition(session, referenceElement, allowCollapsed)
            if (!position) {
                this.hide()
                return false
            }
            host.hidden = false
            updatePressedState(shadow, session)
            return true
        },

        hide() {
            host.hidden = true
            setExpanded(null)
            anchor.hide()
        },

        update({ session, referenceElement, allowCollapsed=false }={}) {
            if (host.hidden) {
                return false
            }
            const position = updatePosition(session, referenceElement, allowCollapsed)
            if (!position) {
                this.hide()
                return false
            }
            updatePressedState(shadow, session)
            return true
        },

        expand(name) {
            setExpanded(name)
        },

        destroy() {
            app.destroy()
            anchor.destroy()
            host.remove()
        }
    }
}

function normalizeButton(button)
{
    if (!button || typeof button !== 'object') {
        return { label: ''+button, command: ''+button, icon: ''+button }
    }
    return button
}

function updatePressedState(root, session)
{
    for (const button of root.querySelectorAll('[data-toolbar-command]')) {
        const command = button.dataset.toolbarCommand
        const pressed = command && command !== 'expand' && session?.query?.(command) ? 'true' : 'false'
        button.setAttribute('aria-pressed', pressed)
    }
}
