import { getSelectionRect } from '../selection-anchor.mjs'

const COMMANDS = {
    bold: 'bold',
    italic: 'italic',
    underline: 'underline',
    link: 'createLink',
    unlink: 'unlink'
}

export function createHtmlDomEngine(options={})
{
    return {
        name: 'html-dom',
        mount({ element, html='', onChange, onSelectionChange }={}) {
            return mountHtmlSession({ element, html, onChange, onSelectionChange, options })
        }
    }
}

function mountHtmlSession({ element, html='', onChange, onSelectionChange, options })
{
    if (!element) {
        throw new Error('simplyedit/html-dom-engine: mount() needs an element')
    }

    let destroyed = false
    const previousContentEditable = element.getAttribute('contenteditable')
    const previousSpellcheck = element.getAttribute('spellcheck')

    element.innerHTML = html ?? ''
    element.setAttribute('contenteditable', 'true')
    if (options.spellcheck !== undefined) {
        element.setAttribute('spellcheck', options.spellcheck ? 'true' : 'false')
    }

    const emitChange = () => {
        if (!destroyed) {
            onChange?.(element.innerHTML)
        }
    }
    const emitSelection = () => {
        if (!destroyed) {
            onSelectionChange?.(session)
        }
    }
    const handleKeydown = event => {
        if (!event.ctrlKey && !event.metaKey) {
            return
        }
        switch(event.key.toLowerCase()) {
            case 'b':
                event.preventDefault()
                session.execute('bold')
                break
            case 'i':
                event.preventDefault()
                session.execute('italic')
                break
            case 'u':
                event.preventDefault()
                session.execute('underline')
                break
            case 'k':
                event.preventDefault()
                session.execute('link')
                break
        }
    }

    element.addEventListener('input', emitChange)
    element.addEventListener('keyup', emitSelection)
    element.addEventListener('mouseup', emitSelection)
    element.addEventListener('keydown', handleKeydown)
    document.addEventListener('selectionchange', emitSelection)

    const session = {
        element,

        getHTML() {
            return element.innerHTML
        },

        setHTML(html='') {
            if (element.innerHTML !== html) {
                element.innerHTML = html
            }
        },

        focus() {
            element.focus()
        },

        blur() {
            element.blur()
        },

        getSelection() {
            const selection = globalThis.getSelection?.()
            if (!selection || !selection.rangeCount || !element.contains(selection.anchorNode)) {
                return null
            }
            return selection
        },

        getSelectionRect() {
            return getSelectionRect(element)
        },

        execute(command, value) {
            if (command === 'link' && !value) {
                value = globalThis.prompt?.('Link URL')
                if (!value) {
                    return false
                }
            }
            const domCommand = COMMANDS[command]
            if (!domCommand) {
                return false
            }
            const result = execCommand(domCommand, value)
            emitChange()
            emitSelection()
            return result
        },

        query(command) {
            const domCommand = COMMANDS[command]
            if (!domCommand || !document.queryCommandState) {
                return false
            }
            try {
                return document.queryCommandState(domCommand)
            } catch (error) {
                return false
            }
        },

        destroy() {
            if (destroyed) {
                return
            }
            destroyed = true
            element.removeEventListener('input', emitChange)
            element.removeEventListener('keyup', emitSelection)
            element.removeEventListener('mouseup', emitSelection)
            element.removeEventListener('keydown', handleKeydown)
            document.removeEventListener('selectionchange', emitSelection)
            if (previousContentEditable === null) {
                element.removeAttribute('contenteditable')
            } else {
                element.setAttribute('contenteditable', previousContentEditable)
            }
            if (previousSpellcheck === null) {
                element.removeAttribute('spellcheck')
            } else {
                element.setAttribute('spellcheck', previousSpellcheck)
            }
        }
    }

    return session
}

function execCommand(command, value)
{
    if (!document.execCommand) {
        return false
    }
    try {
        return document.execCommand(command, false, value)
    } catch (error) {
        return false
    }
}
