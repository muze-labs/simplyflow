import { trackDomField } from './dom.mjs'

export function escape_html(context, next) {
    let content = context.value?.innerHTML
    if (typeof context.value == 'string') {
        content = context.value
        context.value = { innerHTML: content }
    }
    if (content) {
        content = content.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        context.value.innerHTML = content
    }
    next(context)
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
