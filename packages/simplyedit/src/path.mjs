export function getValueByPath(root, path)
{
    if (!path) {
        return root
    }
    let current = root
    for (const part of path.split('.')) {
        if (!part || part === ':value') {
            continue
        }
        if (part === ':root') {
            current = root
            continue
        }
        if (current == null) {
            return undefined
        }
        current = current[decodeURIComponent(part)]
    }
    return current
}

export function setValueByPath(root, path, value)
{
    if (!path) {
        throw new Error('simplyedit: cannot set an empty data path')
    }
    const parts = path.split('.').filter(Boolean).map(decodeURIComponent)
    const last = parts.pop()
    let current = root
    for (const part of parts) {
        if (current[part] == null || typeof current[part] !== 'object') {
            current[part] = {}
        }
        current = current[part]
    }
    current[last] = value
}

export function getFieldPath(element, attribute='data-simply')
{
    return element.getAttribute(attribute+'-field') || element.getAttribute(attribute+'-edit')
}
