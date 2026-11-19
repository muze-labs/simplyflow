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

// Only copy the paths where two definitions actually merge. Values such as
// a DOM container or an application service keep their own identity.
function mergeValue(previous, value)
{
    let merged
    if (Array.isArray(previous) && Array.isArray(value)) {
        merged = previous.slice()
    } else if (isRecord(previous) && isRecord(value)) {
        merged = { ...previous }
    } else {
        return value
    }
    for (const key of Object.keys(value)) {
        if (key !== '__proto__' && value[key] !== null) {
            const earlier = Object.hasOwn(merged, key) ? merged[key] : undefined
            merged[key] = mergeValue(earlier, value[key])
        }
    }
    return merged
}

function mergeTransformer(previous, entry)
{
    if (!entry || typeof entry !== 'object') {
        return entry
    }
    const result = Object.create(Object.getPrototypeOf(entry))
    if (previous && typeof previous === 'object') {
        Object.assign(result, previous)
        // Hooks can also be methods on a transformer's prototype.
        for (const phase of ['render', 'extract']) {
            if (phase in entry) {
                result[phase] = entry[phase]
            } else if (phase in previous) {
                result[phase] = previous[phase]
            }
        }
    }
    return Object.assign(result, entry)
}

const missing = Symbol('missing definition')
const records = new WeakMap()

// Resolve one top-level option using the same precedence at startup and on
// deletion. Transformers additionally support merging individual hook methods.
function mergedOption(definitions, key, hasComponents)
{
    if (['components', 'data', '__proto__', 'prototype'].includes(key)) {
        return missing
    }
    let result = missing
    for (const [name, definition] of definitions) {
        if (!Object.hasOwn(definition, key)) {
            continue
        }
        if (name !== 'app' && (key === 'start' || key === 'onError')) {
            continue
        }
        const value = definition[key]
        if (value === null && hasComponents) {
            continue
        }
        if (key === 'transformers') {
            if (result === missing) {
                result = Object.create(null)
            }
            for (const [entry, hooks] of Object.entries(value || {})) {
                result[entry] = mergeTransformer(result[entry], hooks)
            }
        } else {
            result = mergeValue(result === missing ? undefined : result, value)
        }
    }
    if (key === 'container' && (result === missing || !result)) {
        return document.body
    }
    return result
}

// A realized record owns its edits. Nested records are materialized on first
// use, so composing an app does not walk through every service at startup.
function editableRecord(source, original, ancestor)
{
    const array = Array.isArray(source)
    const target = array ? source.slice() : { ...source }
    const children = new Map()
    const arrays = new Map()
    const location = { source, ancestor }
    const record = {}

    function change(key, value) {
        if (value === missing) {
            return Reflect.deleteProperty(target, key)
        }
        if (array && key === 'length') {
            return Reflect.set(target, key, value)
        }
        return Reflect.defineProperty(target, key, {
            value, enumerable: true, writable: true, configurable: true
        })
    }

    function updateChild(key, value) {
        arrays.delete(key)
        const child = children.get(key)
        if (child && child !== value) {
            // A captured view follows this property across whole-map edits.
            // Empty it while the property is absent or holds another type.
            records.get(child).replace(isRecord(value) ? value : {})
        }
    }

    function write(key, value) {
        const previous = Object.getOwnPropertyDescriptor(target, key)
        if (children.has(key) && children.get(key) === value) {
            return true
        }
        if (!change(key, value)) {
            return false
        }
        try {
            updateChild(key, value)
            record.changed?.([key])
        } catch (error) {
            if (previous) {
                Object.defineProperty(target, key, previous)
            } else {
                Reflect.deleteProperty(target, key)
            }
            throw error
        }
        return true
    }

    const view = new Proxy(target, {
        get(target, key, receiver) {
            const value = Reflect.get(target, key, receiver)
            if (!Object.hasOwn(target, key) || !(isRecord(value) || Array.isArray(value))) {
                return value
            }
            // A service can refer back to itself or a parent service.
            for (let parent = location; parent; parent = parent.ancestor) {
                if (parent.source === value || parent.view === value) {
                    return parent.view
                }
            }
            const cache = Array.isArray(value) ? arrays : children
            if (!cache.has(key)) {
                const child = editableRecord(value, name => {
                    const parent = original(key)
                    return parent && Object.hasOwn(parent, name) ? parent[name] : missing
                }, location)
                cache.set(key, child)
            }
            return cache.get(key)
        },
        set(target, key, value) {
            return write(key, value)
        },
        deleteProperty(target, key) {
            return write(key, array ? missing : original(key))
        }
    })

    // Replace the contents in declaration order and notify observers once.
    record.replace = source => {
        const previous = { ...target }
        const values = { ...source }
        const keys = [...new Set([...Reflect.ownKeys(target), ...Reflect.ownKeys(values)])]
        function replace(values) {
            for (const key of keys) {
                Reflect.deleteProperty(target, key)
            }
            for (const key of Reflect.ownKeys(values)) {
                change(key, values[key])
            }
        }
        const previousSource = location.source
        replace(values)
        location.source = source
        try {
            for (const key of keys) {
                updateChild(key, Object.hasOwn(values, key) ? values[key] : missing)
            }
            record.changed?.(keys)
        } catch (error) {
            replace(previous)
            location.source = previousSource
            for (const key of keys) {
                updateChild(key, Object.hasOwn(previous, key) ? previous[key] : missing)
            }
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
        return definitionView(controller, entries)
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
export function definitionView(controller, entries, controllers)
{
    return new Proxy(controller, {
        get(target, key, receiver) {
            if (Reflect.has(target, key)) {
                return Reflect.get(target, key, receiver)
            }
            const value = Object.hasOwn(entries, key) ? entries[key] : undefined
            return controllers?.get(value) ?? value
        },
        set(target, key, value) {
            if (value && controllers?.get(entries[key]) === value) {
                return true
            }
            if (Reflect.has(target, key)) {
                return Reflect.set(target, key, value)
            }
            return Reflect.set(entries, key, value)
        },
        deleteProperty(target, key) {
            if (Reflect.has(target, key)) {
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
            return Reflect.getOwnPropertyDescriptor(target, key) ||
                Reflect.getOwnPropertyDescriptor(entries, key)
        }
    })
}

export function composeApp({ data, components: suppliedComponents, ...appDefinition })
{
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

    const values = Object.create(null)
    for (const [, definition] of definitions) {
        for (const key of Object.keys(definition)) {
            if (!Object.hasOwn(values, key)) {
                const value = mergedOption(definitions, key, suppliedComponents)
                if (value !== missing) {
                    values[key] = value
                }
            }
        }
    }
    values.container ||= document.body
    values.transformers ??= Object.create(null)
    const options = editableRecord(values, key =>
        mergedOption(currentDefinitions(), key, suppliedComponents)
    )
    return { data, options, components }
}
