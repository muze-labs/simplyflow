import { trackDomField } from './dom.mjs'

export const escape_html = {
    render(context, next) {
        if (typeof context.value !== 'string') {
            return next(context)
        }
        if (usesValueProperty(context.element)) {
            context.value = { value: context.value }
        } else {
            context.value = { innerHTML: escapeHTML(context.value) }
        }
        return next(context)
    },

    extract(context, next) {
        if (typeof context.value === 'string') {
            context.value = unescapeHTML(context.value)
        } else if (context.value && typeof context.value === 'object') {
            if (typeof context.value.innerHTML === 'string') {
                context.value = unescapeHTML(context.value.innerHTML)
            } else if (typeof context.value.value === 'string') {
                context.value = context.value.value
            }
        }
        return next(context)
    }
}

function usesValueProperty(element)
{
    return element?.tagName === 'INPUT' || element?.tagName === 'TEXTAREA'
}

function escapeHTML(value)
{
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function unescapeHTML(value)
{
    const textarea = document.createElement('textarea')
    textarea.innerHTML = value
    return textarea.value
}

export function fixed_content(context, next) {
    if (typeof context.value == 'string') {
        context.value = {}
    } else {
        delete context.value?.innerHTML
    }
    next(context)
}

export const attributes = {
    render(context) {
        const names = getAttributeNames.call(this, context)
        setAttributes(context.element, context.value, names)
        if (context.edit) {
            trackDomField.call(
                this,
                context.element,
                names,
                false,
                'innerHTML',
                () => readAttributes(context.element, names),
                context
            )
        }
        return context
    },

    extract(context, next) {
        const names = getAttributeNames.call(this, context)
        context.value = readAttributes(context.element, names)
        context.replaceValue = true
        return next ? next(context) : context
    }
}

function getAttributeNames(context)
{
    const attribute = this.options.attribute+'-attributes'
    const configured = context.element.getAttribute(attribute)
    if (configured) {
        return configured.split(/[\s,]+/).filter(Boolean)
    }
    if (context.value && typeof context.value === 'object' && !Array.isArray(context.value)) {
        return Object.keys(context.value)
    }
    if (context.currentValue && typeof context.currentValue === 'object' && !Array.isArray(context.currentValue)) {
        return Object.keys(context.currentValue)
    }
    return []
}

function setAttributes(element, data, names)
{
    if (!names.length || !data || typeof data !== 'object' || Array.isArray(data)) {
        return
    }
    for (const name of names) {
        const value = data[name]
        if (typeof value === 'undefined' || value === null) {
            element.removeAttribute(name)
        } else if (element.getAttribute(name) !== ''+value) {
            element.setAttribute(name, ''+value)
        }
    }
}

function readAttributes(element, names)
{
    const data = {}
    for (const name of names) {
        if (element.hasAttribute(name)) {
            data[name] = element.getAttribute(name)
        }
    }
    return data
}
