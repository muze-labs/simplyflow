import JSDOMEnvironment from '@jest/environment-jsdom-abstract'
import * as jsdom from 'jsdom'

export default class SimplyFlowTestEnvironment extends JSDOMEnvironment {
    constructor(config, context) {
        super(config, context, jsdom)
    }
}
