import { bind } from '@muze-labs/simplyflow-bind'
import { signal } from '@muze-labs/simplyflow-state'
import { routes } from './route.mjs'
import { commands, destroyCommands } from './command.mjs'
import { actions } from './action.mjs'
import { shortcuts, destroyShortcuts, accesskeys, destroyAccesskeys } from './shortcut.mjs'
import { dragdrop } from './dragdrop.mjs'
import { behaviors } from './behavior.mjs'
import { includes } from './include.mjs'
import { composeApp, definitionView, onDefinitionChange } from './composition.mjs'
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

class SimplyApp
{
    constructor(definition={})
    {
        const { data, options, components } = composeApp(definition)
        const controllers = new WeakMap()
        const mounted = {}
        const app = definitionView(this, options, controllers)
        const container = options.container
        this.destroyed = false
        this.data = signal(data || {})
        this.components = components

        installMarkup(container, options.templates, 'template')
        installMarkup(container, options.styles, 'style')

        // The public app exposes the controller while its definition map is active.
        const mount = (key, controller) => {
            mounted[key] = controller
            controllers.set(options[key], controller)
        }

        for (const key of Object.keys(options)) {
            if (options[key] == null) {
                continue
            }
            switch(key) {
                case 'container':
                case 'data':
                case 'attribute':
                case 'drags':
                case 'drops':
                case 'templates':
                case 'styles':
                case 'start':
                case 'onError':
                case 'components':
                case 'baseURL':
                case 'transformers':
                    break
                case 'commands':
                    mount(key, commands({ app, container, commands: options.commands }))
                    break
                case 'shortcuts':
                    mount(key, shortcuts({ app, shortcuts: options.shortcuts }))
                    break
                case 'behaviors':
                    mount(key, definitionView(behaviors({
                        app, container, behaviors: options.behaviors
                    }), options.behaviors || {}))
                    break
                case 'routes':
                    mount(key, definitionView(
                        routes({ app, routes: options.routes }), options.routes || {}
                    ))
                    break
                case 'actions':
                    mount(key, actions({ app, actions: options.actions }))
                    break
                case 'prototype':
                case '__proto__':
                    // ignore this to avoid prototype pollution
                    break
                default:
                    // Unknown options become app properties. Warn only when the
                    // name is close to a built-in option, which usually means a typo.
                    warnLikelyOptionTypo(key)
                    break
            }
        }

        this.binding = bind({
            root: this.data,
            container,
            attribute: options.attribute || 'data-simply',
            app
        })

        if (options.drags || options.drops) {
            this.dragdrop = dragdrop({ app, drags: options.drags, drops: options.drops })
        }

        onDefinitionChange(options, keys => {
            if (keys.includes('baseURL') && mounted.routes) {
                mounted.routes.init({ baseURL: options.baseURL || '/' })
            }
        })
        this.includes = includes({ container })

        this.accesskeys = accesskeys({ app, container })
        // Dispose the controllers created at startup even if an app edit
        // has since removed or replaced their definitions.
        this.destroy = this.destroy.bind(this, mounted, options.templates, options.styles)
        return app
    }

    get app()
    {
        return this
    }

    destroy(mounted, templates, styles)
    {
        this.destroyed = true
        onDefinitionChange(templates, undefined)
        onDefinitionChange(styles, undefined)
        if (this.dragdrop) {
            this.dragdrop.destroy()
        }
        if (this.binding) {
            this.binding.destroy()
            this.binding = undefined
        }
        if (mounted.commands) {
            destroyCommands(mounted.commands)
        }
        if (mounted.shortcuts) {
            destroyShortcuts(mounted.shortcuts)
        }
        if (this.accesskeys) {
            destroyAccesskeys(this.accesskeys)
            this.accesskeys = undefined
        }
        if (mounted.routes) {
            mounted.routes.destroy()
            this.routes = undefined
        }
        if (mounted.behaviors) {
            mounted.behaviors.destroy()
            this.behaviors = undefined
        }
        if (this.includes) {
            this.includes.destroy()
            this.includes = undefined
        }
    }
}

function installMarkup(container, definitions, tag)
{
    if (!definitions) return
    function update(name) {
        const id = tag === 'style' ? name + '.css' : name
        let node = Array.from(container.querySelectorAll(tag)).find(node => node.id === id)
        if (!Object.hasOwn(definitions, name)) {
            node?.remove()
            return
        }
        if (!node) {
            node = document.createElement(tag)
            node.id = id
            container.appendChild(node)
        }
        if (tag === 'template') {
            const element = document.createElement('div')
            element.innerHTML = definitions[name]
            node.content.replaceChildren(...element.children)
        } else {
            node.textContent = definitions[name]
        }
    }
    Object.keys(definitions).forEach(update)
    onDefinitionChange(definitions, names => names.forEach(update))
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
