// Comment placeholders participate in the same row ordering as elements,
// but only elements can carry a key attribute.
const commentKeys = new WeakMap()

export function getItemKey(node, attribute)
{
    return node.getAttribute?.(attribute) ?? commentKeys.get(node)
}

export function setItemKey(node, attribute, key)
{
    if (node.nodeType === Node.COMMENT_NODE) {
        commentKeys.set(node, String(key))
    } else {
        node.setAttribute(attribute, key)
    }
}


// Dynamic :key command values use the row path to distinguish nested rows.
export const commandKeyPaths = new WeakMap()
