import { bind } from '@muze-labs/simplyflow-bind'
import { signal } from '@muze-labs/simplyflow-state'
import { routes } from './route.mjs'
import { commands, destroyCommands } from './command.mjs'
import { actions } from './action.mjs'
import { shortcuts, destroyShortcuts, accesskeys, destroyAccesskeys } from './shortcut.mjs'
import { dragdrop } from './dragdrop.mjs'
import { behaviors } from './behavior.mjs'
import { includes } from './include.mjs'
import { composeApp } from './composition.mjs'
export { mergeable } from './composition.mjs'
import { closest } from './suggest.mjs'

const APP_OPTIONS = [
    'container',
    'data',
    'attribute',
    'templates',
    'styles',
    'start',
    'onError',
    'components',
    'behaviors',
    'baseURL',
    'commands',
    'drags',
    'drops',
    'shortcuts',
    'routes',
    'actions',
    'transformers'
]

const runtimeProperties = new Set([
    'commands', 'actions', 'shortcuts', 'routes', 'behaviors',
    'binding', 'dragdrop', 'includes', 'accesskeys', 'destroy'
])

class SimplyApp
{
    constructor(definition={})
    {
        const { data, options, components } = composeApp(definition)
        const app = this
        const { container } = options
        this.data = signal(data || {})
        this.components = components
        this.destroyed = false

        for (const key of Reflect.ownKeys(options)) {
            if (runtimeProperties.has(key) || key in this) {
                continue
            }
            if (typeof key === 'string' && !APP_OPTIONS.includes(key)) {
                warnLikelyOptionTypo(key)
            }
            Object.defineProperty(this, key, Object.getOwnPropertyDescriptor(options, key))
        }

        installMarkup(container, options.templates, 'template')
        installMarkup(container, options.styles, 'style')
        this.commands = commands({ app, commands: options.commands })
        this.actions = actions({ app, actions: options.actions })
        this.shortcuts = shortcuts({ app, shortcuts: options.shortcuts })
        this.routes = routes({ app, routes: options.routes })
        this.behaviors = behaviors({ app, container, behaviors: options.behaviors })
        this.binding = bind({
            root: this.data, container, attribute: options.attribute || 'data-simply', app
        })
        this.dragdrop = dragdrop({ app, drags: options.drags, drops: options.drops })
        this.includes = includes({ container })
        this.accesskeys = accesskeys({ app, container })

        // Dispose the installed controllers even if app code replaces a property.
        const { binding, commands: commandApi, shortcuts: shortcutApi, accesskeys: keys,
            routes: router, behaviors: behaviorApi, dragdrop: dragApi, includes: includeApi } = this
        this.destroy = () => {
            if (this.destroyed) return
            this.destroyed = true
            dragApi.destroy()
            binding.destroy()
            destroyCommands(commandApi)
            destroyShortcuts(shortcutApi)
            destroyAccesskeys(keys)
            router.destroy()
            behaviorApi.destroy()
            includeApi.destroy()
            this.binding = undefined
            this.routes = undefined
            this.behaviors = undefined
            this.includes = undefined
            this.accesskeys = undefined
        }
    }

    get app()
    {
        return this
    }
}

function installMarkup(container, definitions, tag)
{
    for (const name of Object.keys(definitions)) {
        const id = tag === 'style' ? name + '.css' : name
        let node = Array.from(container.querySelectorAll(tag)).find(node => node.id === id)
        if (!node) {
            node = document.createElement(tag)
            node.id = id
            container.appendChild(node)
        }
        if (tag === 'template') {
            node.innerHTML = definitions[name]
        } else {
            node.textContent = definitions[name]
        }
    }
}

function warnLikelyOptionTypo(key)
{
    const suggestion = closest(key, APP_OPTIONS)
    if (suggestion) {
        console.warn(`simplyflow/app: unknown option "${key}". Did you mean "${suggestion}"? The option was still added to the app as "app.${key}".`)
    }
}

function initRoutes(app) {
    if (app.destroyed) {
        return
    }
    const router = app.routes
    if (typeof router?.handleEvents === 'function') {
        if (app.baseURL) {
            router.init({ baseURL: app.baseURL })
        }
        router.handleEvents()
        globalThis.setTimeout(() => {
            if (app.destroyed || app.routes !== router) {
                return
            }
            if (router.has(globalThis.location?.hash)) {
                router.match(globalThis.location.hash)
            } else {
                router.match(globalThis.location?.pathname+globalThis.location?.hash)
            }
        })
    }
}


function handleAppError(app, error, context)
{
    if (app.onError) {
        return app.onError.call(app, error, context)
    }
    throw error
}

export function app(options={})
{
    const app = new SimplyApp(options)
    if (!app.start) {
        initRoutes(app)
        return app
    }

    try {
        const result = app.start.call(app)
        if (result instanceof Promise) {
            result.then(() => initRoutes(app)).catch(error => handleAppError(app, error, app.start))
        } else {
            initRoutes(app)
        }
    } catch (error) {
        handleAppError(app, error, app.start)
    }
    return app
}
