// Nested components contribute before their parent. A flattened name is a
// convenience for inspection. The hierarchy determines merge order.
function* componentDefinitions(components, names = Object.keys(components))
{
    for (const name of names) {
        if (name === 'app') {
            throw new Error('simplyflow/app: component name "app" is reserved for the top-level app definition')
        }
        const definition = components[name]
        if (!definition) {
            continue
        }
        if (Object.hasOwn(definition, 'data')) {
            throw new TypeError(`simplyflow/app: component "${name}" declares data. Pass data to simply.app() instead.`)
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
const records = new WeakMap()
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
            throw new TypeError(
                `simplyflow/app: cannot compose non-configurable property "${String(key)}" in an editable map`
            )
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
    const descriptors = mapDescriptors(later)
    for (const key of Reflect.ownKeys(descriptors)) {
        const original = Object.getOwnPropertyDescriptor(merged, key)
        Object.defineProperty(merged, key,
            mergeDescriptor(original, descriptors[key], childShape(shape, key), seen))
    }
    return { ...next, value: merged }
}

function dataProperty(value)
{
    return { value, enumerable: true, writable: true, configurable: true }
}

function mergedOption(definitions, key, hasComponents)
{
    if (['components', 'data', '__proto__', 'prototype'].includes(key)) {
        return
    }
    let result
    for (const [name, definition] of definitions) {
        if (name !== 'app' && (key === 'start' || key === 'onError')) {
            continue
        }
        const descriptor = Object.getOwnPropertyDescriptor(definition, key)
        if (!descriptor || (descriptor.value === null && hasComponents)) {
            continue
        }
        result = mergeDescriptor(result, descriptor, childShape('app', key))
    }
    if (key === 'container' && (!result || ('value' in result && !result.value))) {
        return dataProperty(document.body)
    }
    return result
}

// An editable map owns its property descriptors. Nested services stay opaque
// unless the author marks them or a built-in section defines a map there.
function editableRecord(source, original, shape, ancestor)
{
    const target = Object.create(Object.getPrototypeOf(source), mapDescriptors(source))
    const children = new Map()
    const location = { source, ancestor }
    const record = {}

    function updateChild(key, descriptor) {
        const child = children.get(key)
        const value = descriptor?.value
        if (child && child !== value) {
            const next = composes(value, childShape(shape, key)) ? value : {}
            records.get(child).replace(next)
        }
    }

    function apply(key, descriptor) {
        if (descriptor) {
            return Reflect.defineProperty(target, key, descriptor)
        }
        return Reflect.deleteProperty(target, key)
    }

    function write(key, descriptor) {
        const previous = Object.getOwnPropertyDescriptor(target, key)
        if (!apply(key, descriptor)) {
            return false
        }
        try {
            updateChild(key, descriptor)
            record.changed?.([key])
        } catch (error) {
            apply(key, previous)
            throw error
        }
        return true
    }

    const view = new Proxy(target, {
        get(target, key, receiver) {
            const descriptor = Object.getOwnPropertyDescriptor(target, key)
            const nestedShape = childShape(shape, key)
            if (!descriptor || !composes(descriptor.value, nestedShape)) {
                return Reflect.get(target, key, receiver)
            }
            const value = descriptor.value
            for (let parent = location; parent; parent = parent.ancestor) {
                if (parent.source === value || parent.view === value) {
                    return parent.view
                }
            }
            if (!children.has(key)) {
                const child = editableRecord(value, name => {
                    const parent = original(key)?.value
                    if (composes(parent, nestedShape)) {
                        return Object.getOwnPropertyDescriptor(parent, name)
                    }
                }, nestedShape, location)
                children.set(key, child)
            }
            return children.get(key)
        },
        set(target, key, value, receiver) {
            const descriptor = Object.getOwnPropertyDescriptor(target, key)
            if (descriptor && !('value' in descriptor)) {
                if (!descriptor.set) {
                    return false
                }
                descriptor.set.call(receiver, value)
                record.changed?.([key])
                return true
            }
            if (descriptor && !descriptor.writable) {
                return false
            }
            if (children.has(key) && children.get(key) === value) {
                return true
            }
            return write(key, descriptor ? { ...descriptor, value } : dataProperty(value))
        },
        deleteProperty(target, key) {
            return write(key, original(key))
        }
    })

    record.replace = source => {
        const previous = Object.getOwnPropertyDescriptors(target)
        const next = mapDescriptors(source)
        const keys = [...new Set([...Reflect.ownKeys(previous), ...Reflect.ownKeys(next)])]
        function replace(descriptors) {
            for (const key of keys) {
                Reflect.deleteProperty(target, key)
            }
            Object.defineProperties(target, descriptors)
            for (const key of keys) {
                updateChild(key, Object.getOwnPropertyDescriptor(target, key))
            }
        }
        const previousSource = location.source
        try {
            location.source = source
            replace(next)
            record.changed?.(keys)
        } catch (error) {
            location.source = previousSource
            replace(previous)
            throw error
        }
    }
    location.view = view
    records.set(view, record)
    return view
}

export function controllerDefinitions(controller, entries)
{
    if (records.has(entries)) {
        return definitionView(controller, entries, { namedHandlers: true })
    }
    return Object.assign(controller, entries)
}

export function onDefinitionChange(entries, changed)
{
    const record = records.get(entries)
    if (record) {
        record.changed = changed
    }
}

// Preserve the controller's methods and listener state. Named definitions are
// read through the same map the controller's dispatch code uses.
export function definitionView(controller, entries, { controllers, namedHandlers = false } = {})
{
    function controllerOwns(key) {
        // Authored handler names previously became own properties on the
        // controller. They take precedence over helpers such as call().
        if (namedHandlers && Object.hasOwn(entries, key)) {
            return false
        }
        return Reflect.has(controller, key)
    }
    return new Proxy(controller, {
        get(target, key, receiver) {
            if (controllerOwns(key)) {
                return Reflect.get(target, key, receiver)
            }
            const value = Object.hasOwn(entries, key) ? Reflect.get(entries, key, receiver) : undefined
            return controllers?.get(value) ?? value
        },
        set(target, key, value, receiver) {
            const descriptor = Object.getOwnPropertyDescriptor(entries, key)
            if (controllers && value && descriptor && 'value' in descriptor &&
                controllers.get(entries[key]) === value) {
                return true
            }
            if (controllerOwns(key) && (!namedHandlers || Object.hasOwn(target, key))) {
                return Reflect.set(target, key, value)
            }
            return Reflect.set(entries, key, value, receiver)
        },
        deleteProperty(target, key) {
            if (controllerOwns(key)) {
                return Reflect.deleteProperty(target, key)
            }
            return Reflect.deleteProperty(entries, key)
        },
        has(target, key) {
            return Reflect.has(target, key) || Object.hasOwn(entries, key)
        },
        ownKeys(target) {
            return [...new Set([...Reflect.ownKeys(target), ...Reflect.ownKeys(entries)])]
        },
        getOwnPropertyDescriptor(target, key) {
            if (namedHandlers && Object.hasOwn(entries, key)) {
                return Reflect.getOwnPropertyDescriptor(entries, key)
            }
            return Reflect.getOwnPropertyDescriptor(target, key) ||
                Reflect.getOwnPropertyDescriptor(entries, key)
        }
    })
}

export function composeApp(definition)
{
    const { data, components: suppliedComponents } = definition
    const authored = Object.getOwnPropertyDescriptors(definition)
    delete authored.data
    delete authored.components
    const appDefinition = Object.create(Object.getPrototypeOf(definition), authored)
    const components = { ...suppliedComponents }
    const roots = Object.keys(components)
    const definitions = []
    for (const [name, definition] of componentDefinitions(components, roots)) {
        if (!Object.hasOwn(components, name)) {
            Object.defineProperty(components, name, {
                value: definition, writable: true, enumerable: true, configurable: true
            })
        }
        definitions.push([name, definition])
    }

    components.app = appDefinition
    definitions.push(['app', appDefinition])

    function* currentDefinitions() {
        yield* componentDefinitions(components, roots)
        if (components.app) {
            yield ['app', components.app]
        }
    }

    const descriptors = Object.create(null)
    for (const [, definition] of definitions) {
        for (const key of Reflect.ownKeys(definition)) {
            if (!Object.hasOwn(descriptors, key)) {
                const value = mergedOption(definitions, key, suppliedComponents)
                if (value) {
                    descriptors[key] = value
                }
            }
        }
    }
    descriptors.container ??= dataProperty(document.body)
    descriptors.transformers ??= dataProperty(Object.create(null))
    const values = Object.create(null, descriptors)
    const options = editableRecord(values, key =>
        mergedOption(currentDefinitions(), key, suppliedComponents), 'app')
    return { data, options, components }
}
