// Nested components contribute before their parent. A flattened name is a
// convenience for inspection. The hierarchy determines merge order.
function* componentDefinitions(components, names = Object.keys(components))
{
    for (const name of names) {
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

function appTransformers(definitions, currentDefinitions)
{
    const entries = Object.create(null)
    for (const definition of definitions) {
        for (const [name, entry] of Object.entries(definition.transformers || {})) {
            entries[name] = mergeTransformer(entries[name], entry)
        }
    }

    // Assignments are ordinary writes to the app's own map. Deleting an
    // entry recomposes just that name from the current source definitions.
    return new Proxy(entries, {
        deleteProperty(target, name) {
            let found = false
            let restored
            for (const [, definition] of currentDefinitions()) {
                const source = definition.transformers
                if (source && Object.hasOwn(source, name)) {
                    restored = mergeTransformer(restored, source[name])
                    found = true
                }
            }
            if (found) {
                return Reflect.set(target, name, restored)
            }
            return Reflect.deleteProperty(target, name)
        }
    })
}

export function composeApp({ components: suppliedComponents, ...appDefinition })
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
        definitions.push(definition)
    }

    let appKey = 'app'
    for (let suffix = 2; Object.hasOwn(components, appKey); suffix++) {
        appKey = 'app' + suffix
    }
    components[appKey] = appDefinition
    definitions.push(appDefinition)
    roots.push(appKey)
    const currentDefinitions = () => componentDefinitions(components, roots)

    const options = Object.create(null)
    for (const definition of definitions) {
        for (const [key, value] of Object.entries(definition)) {
            if (key === 'components' || key === 'transformers') {
                continue
            }
            if (definition !== appDefinition && (key === 'start' || key === 'onError')) {
                continue
            }
            if (value === null && suppliedComponents) {
                continue
            }
            const previous = options[key]
            if (previous === undefined && definition !== appDefinition && isRecord(value)) {
                options[key] = { ...value }
            } else {
                options[key] = mergeValue(previous, value)
            }
        }
    }
    return { options, components, transformers: appTransformers(definitions, currentDefinitions) }
}
