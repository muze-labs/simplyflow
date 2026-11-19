// Nested components contribute before their parent. A flattened name is a
// convenience for inspection. The hierarchy determines merge order.
function* componentDefinitions(components)
{
    for (const name of Object.keys(components)) {
        if (name === 'app') {
            throw new Error('simplyflow/app: component name "app" is reserved for the top-level app definition')
        }
        const definition = components[name]
        if (!definition) {
            continue
        }
        if (definition.components) {
            yield* componentDefinitions(definition.components)
        }
        yield [name, definition]
    }
}

function isRecord(value)
{
    if (!value || typeof value !== 'object') {
        return false
    }
    const prototype = Object.getPrototypeOf(value)
    return prototype === null || prototype === Object.prototype
}

// A component and its host may load separate copies of SimplyFlow in one page.
// Share only the opt-in identities. Each app still owns its realized maps.
const registryKey = Symbol.for('@muze-labs/simplyflow.mergeableMaps')
const markedMaps = globalThis[registryKey] ??= new WeakSet()
const sections = new Set([
    'actions', 'behaviors', 'commands', 'drags', 'drops', 'routes',
    'shortcuts', 'styles', 'templates', 'transformers'
])
const groupedSections = new Set(['drops', 'shortcuts', 'transformers'])

export function mergeable(object)
{
    if (!isRecord(object)) {
        throw new TypeError('simplyflow/app: mergeable() expects an object literal or a null-prototype map')
    }
    mapDescriptors(object)
    markedMaps.add(object)
    return object
}

function childShape(shape, key)
{
    if (shape === 'app' && sections.has(key)) {
        return groupedSections.has(key) ? 'groups' : 'map'
    }
    if (shape === 'groups') {
        return 'map'
    }
}

function composes(value, shape)
{
    return markedMaps.has(value) || (shape && isRecord(value))
}

function mapDescriptors(source)
{
    const descriptors = Object.getOwnPropertyDescriptors(source)
    for (const key of Reflect.ownKeys(descriptors)) {
        if (!descriptors[key].configurable) {
            throw new TypeError(`simplyflow/app: cannot compose non-configurable property "${String(key)}" in an editable map`)
        }
    }
    return descriptors
}

// Merge data properties only where both values opt in. Accessors and opaque
// values are contributed intact by the last definition that supplies them.
function mergeDescriptor(previous, next, shape, seen = new WeakMap())
{
    if (!composes(previous?.value, shape) || !composes(next.value, shape) ||
        previous.value === next.value) {
        return next
    }
    const earlier = previous.value
    const later = next.value
    let pairs = seen.get(earlier)
    if (!pairs) {
        pairs = new WeakMap()
        seen.set(earlier, pairs)
    }
    if (pairs.has(later)) {
        return { ...next, value: pairs.get(later) }
    }

    const merged = Object.create(Object.getPrototypeOf(later), mapDescriptors(earlier))
    pairs.set(later, merged)
    markedMaps.add(merged)
    const entries = mapDescriptors(later)
    for (const key of Reflect.ownKeys(entries)) {
        const previous = Object.getOwnPropertyDescriptor(merged, key)
        Object.defineProperty(merged, key,
            mergeDescriptor(previous, entries[key], childShape(shape, key), seen))
    }
    return { ...next, value: merged }
}

function dataProperty(value)
{
    return { value, enumerable: true, writable: true, configurable: true }
}

// structuredClone preserves references inside the data graph. Carry over the
// mergeable markers too, since the registry identifies maps by object identity.
function cloneComponentData(source)
{
    const copy = structuredClone(source)
    function markDataMap(original, cloned) {
        if (markedMaps.has(cloned)) {
            return
        }
        markedMaps.add(cloned)
        for (const key of Object.keys(cloned)) {
            const child = Object.getOwnPropertyDescriptor(original, key)?.value
            if (markedMaps.has(child)) {
                markDataMap(child, cloned[key])
            }
        }
    }
    if (isRecord(source)) {
        markDataMap(source, copy)
    }
    return copy
}

// Give each app its own built-in and opted-in maps, including cyclic ones.
function copyMap(source, shape, seen = new WeakMap())
{
    if (seen.has(source)) {
        return seen.get(source)
    }
    const copy = Object.create(Object.getPrototypeOf(source))
    seen.set(source, copy)
    const descriptors = mapDescriptors(source)
    for (const key of Reflect.ownKeys(descriptors)) {
        const descriptor = descriptors[key]
        const nestedShape = childShape(shape, key)
        if (composes(descriptor.value, nestedShape)) {
            descriptor.value = copyMap(descriptor.value, nestedShape, seen)
        }
    }
    seen.delete(source)
    return Object.defineProperties(copy, descriptors)
}

export function composeApp(definition)
{
    const { data, components: suppliedComponents } = definition
    const authored = Object.getOwnPropertyDescriptors(definition)
    delete authored.data
    delete authored.components
    const appDefinition = Object.create(Object.getPrototypeOf(definition), authored)
    const components = { ...suppliedComponents }
    const definitions = [...componentDefinitions(components), ['app', appDefinition]]
    const descriptors = Object.create(null)
    let initialData

    for (const [name, source] of definitions) {
        if (!Object.hasOwn(components, name)) {
            Object.defineProperty(components, name, dataProperty(source))
        }
        if (Object.hasOwn(source, 'data')) {
            const defaults = source.data
            if (defaults != null) {
                initialData = mergeDescriptor(initialData,
                    dataProperty(cloneComponentData(defaults)), 'map')
            }
        }
        for (const key of Reflect.ownKeys(source)) {
            if (['components', 'data', '__proto__', 'prototype'].includes(key) ||
                (name !== 'app' && (key === 'start' || key === 'onError'))) {
                continue
            }
            const entry = Object.getOwnPropertyDescriptor(source, key)
            if ((entry.value === null && suppliedComponents) ||
                (sections.has(key) && 'value' in entry && entry.value == null)) {
                continue
            }
            descriptors[key] = mergeDescriptor(descriptors[key], entry, childShape('app', key))
        }
    }

    for (const section of sections) {
        descriptors[section] ??= dataProperty(Object.create(null))
    }
    const container = descriptors.container
    if (!container || ('value' in container && !container.value)) {
        descriptors.container = dataProperty(document.body)
    }
    if (data != null) {
        initialData = mergeDescriptor(initialData, dataProperty(data), 'map')
    }
    const options = copyMap(Object.create(null, descriptors), 'app')
    return { data: initialData?.value, options, components }
}
