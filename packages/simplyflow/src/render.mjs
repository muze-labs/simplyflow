import { DEP } from '@muze-labs/simplyflow-state/symbols'

export class SimplyRender extends HTMLElement 
{
    constructor()
    {
        super()
    }

    connectedCallback()
    {
        let templateId = this.getAttribute("rel")
        let template = document.getElementById(templateId)

        if (template) {
            const content = template.content
            const hasRootText = Array.from(content.childNodes).some(node =>
                node.nodeType === Node.TEXT_NODE && /[^\t\n\f\r ]/.test(node.data)
            )
            if (content.childElementCount !== 1 || hasRootText) {
                throw new Error(
                    `simplyflow/render: template "${templateId}" must contain a single root element`,
                    { cause: template }
                )
            }

            const root = content.firstElementChild.cloneNode(true)
            for (const nested of root.querySelectorAll('template')) {
                nested.setAttribute('simply-render', '')
            }
            for (const attr of this.attributes) {
                if (attr.name !== 'rel') {
                    root.setAttribute(attr.name, attr.value)
                }
            }
            root.setAttribute('data-simply-template', templateId)
            root[DEP.TEMPLATE] = template
            this.replaceWith(root)
        } else {
            const observe = () => {
                const observer = new MutationObserver(() => {
                    template = document.getElementById(templateId)
                    if (template) {
                        observer.disconnect()
                        this.replaceWith(this) // trigger connectedCallback?
                    }
                })
                observer.observe(globalThis.document, {
                    subtree: true,
                    childList: true,
                })
            }

            observe()
        }
    }
}

if (!customElements.get('simply-render')) {
    customElements.define('simply-render', SimplyRender);
}
