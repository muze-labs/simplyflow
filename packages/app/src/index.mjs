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
        const app = definitionView(this, options, [
            'transformers', 'actions', 'commands', 'shortcuts', 'behaviors',
            'routes', 'templates', 'styles', 'drags', 'drops'
        ])
        const container = options.container
        this.destroyed = false
        this.data = signal(data || {})
        this.components = components

        installMarkup(container, options.templates, 'template')
        installMarkup(container, options.styles, 'style')

        for (const key of Object.keys(options)) {
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
                    this.commands = commands({ app, container, commands: options.commands})
                    break
                case 'shortcuts':
                    this.shortcuts = shortcuts({ app, shortcuts: options.shortcuts })
                    break
                case 'behaviors':
                    this.behaviors = definitionView(behaviors({
                        app, container, behaviors: options.behaviors
                    }), options.behaviors || {})
                    break
                case 'routes':
                    this.routes = definitionView(
                        routes({ app, routes: options.routes }), options.routes || {}
                    )
                    break
                case 'actions':
                    this.actions = actions({app, actions: options.actions})
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
            if (keys.includes('baseURL') && this.routes) {
                this.routes.init({ baseURL: options.baseURL || '/' })
            }
        })
        this.includes = includes({ container })

        this.accesskeys = accesskeys({ app, container })
        return app
    }

    get app()
    {
        return this
    }

    destroy()
    {
        this.destroyed = true
        onDefinitionChange(this.templates, undefined)
        onDefinitionChange(this.styles, undefined)
        if (this.dragdrop) {
            this.dragdrop.destroy()
        }
        if (this.binding) {
            this.binding.destroy()
            this.binding = undefined
        }
        if (this.commands) {
            destroyCommands(this.commands)
        }
        if (this.shortcuts) {
            destroyShortcuts(this.shortcuts)
        }
        if (this.accesskeys) {
            destroyAccesskeys(this.accesskeys)
            this.accesskeys = undefined
        }
        if (this.routes) {
            this.routes.destroy()
            this.routes = undefined
        }
        if (this.behaviors) {
            this.behaviors.destroy()
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
    if (app.routes) {
        if (app.baseURL) {
            app.routes.init({ baseURL: app.baseURL })
        }
        app.routes.handleEvents()
        globalThis.setTimeout(() => {
            if (app.destroyed || !app.routes) {
                return
            }
            if (app.routes.has(globalThis.location?.hash)) {
                app.routes.match(globalThis.location.hash)
            } else {
                app.routes.match(globalThis.location?.pathname+globalThis.location?.hash)
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
