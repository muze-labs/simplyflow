/** @jest-environment node */
import { join } from 'node:path'
import { publishedPackage, releaseStatus } from '../scripts/check-release-versions.mjs'
import { release } from '../scripts/release.mjs'

const packed = { name: '@muze-labs/example', version: '0.10.3', shasum: 'local-archive' }
const manifest = (version, shasum) => ({
    'dist-tags': { latest: version },
    versions: { [version]: { dist: { shasum } } }
})

test('an unpublished package or unused version can be published', () => {
    expect(releaseStatus(packed, null)).toEqual({ state: 'publish', latest: null })
    expect(releaseStatus(packed, manifest('0.10.2', 'old'))).toEqual({ state: 'publish', latest: '0.10.2' })
})

test('an identical published archive is skipped when resuming a release', () => {
    expect(releaseStatus(packed, manifest('0.10.3', 'local-archive')).state).toBe('skip')
})

test('a published version with different contents is a collision', () => {
    expect(releaseStatus(packed, manifest('0.10.3', 'old-archive')).state).toBe('collision')
})

test('every published version is checked, even when it is not latest', () => {
    const published = manifest('0.10.4', 'newer')
    published.versions['0.10.3'] = { dist: { shasum: 'old-archive' } }
    expect(releaseStatus(packed, published)).toEqual({ state: 'collision', latest: '0.10.4' })
})

test('missing checksums do not establish that a published package is identical', () => {
    expect(releaseStatus({ ...packed, shasum: undefined }, manifest('0.10.3', undefined)).state).toBe('collision')
})

test('only HTTP 404 means that a package has not been published', async () => {
    const result = await publishedPackage(packed.name, async url => {
        expect(url).toBe('https://registry.npmjs.org/%40muze-labs%2Fexample')
        return { status: 404 }
    })
    expect(result).toBeNull()
    for (const status of [401, 403, 429, 500]) {
        await expect(publishedPackage(packed.name, async () => ({ status, ok: false }))).rejects.toThrow(`HTTP ${status}`)
    }
})

test('network failures and malformed registry replies fail verification', async () => {
    await expect(publishedPackage(packed.name, async () => { throw new Error('offline') })).rejects.toThrow('offline')
    await expect(publishedPackage(packed.name, async () => ({ status: 200, ok: true, json: async () => ({}) }))).rejects.toThrow('invalid package manifest')
})

const releasePackages = [
    'simplyflow-state', 'simplyflow-bind', 'simplyflow-model', 'simplyflow-app',
    'simplyflow', 'simplyedit', 'simplyflow-edit'
].map(name => ({
    name: '@muze-labs/' + name, version: '1.0.0',
    shasum: name, filename: name + '.tgz'
}))

function mockRelease({ skip, collision } = {}) {
    const commands = []
    return {
        commands,
        run(command, args) {
            expect(command).toBe('npm')
            commands.push(args)
            if (args[0] === 'pack') {
                return JSON.stringify(releasePackages.toReversed())
            }
        },
        async fetchRegistry(url) {
            const name = decodeURIComponent(new URL(url).pathname.slice(1))
            const pkg = releasePackages.find(entry => entry.name === name)
            expect(pkg).toBeDefined()
            if (pkg === skip || pkg === collision) {
                const shasum = pkg === skip ? pkg.shasum : 'different-archive'
                return { ok: true, json: async () => manifest(pkg.version, shasum) }
            }
            return { status: 404 }
        },
        report() {}
    }
}

test('publishes the checked archives in dependency order and skips identical versions', async () => {
    const skipped = releasePackages[0]
    const options = mockRelease({ skip: skipped })
    await release(options)
    const [testCommand, buildCommand, packCommand, ...publishCommands] = options.commands
    expect(testCommand).toEqual(['test'])
    expect(buildCommand).toEqual(['run', 'build'])
    expect(packCommand[0]).toBe('pack')
    expect(publishCommands.map(args => args[0])).toEqual(releasePackages.slice(1).map(() => 'publish'))
    const destination = packCommand[packCommand.indexOf('--pack-destination') + 1]
    expect(publishCommands.map(args => args[1]))
        .toEqual(releasePackages.slice(1).map(pkg => join(destination, pkg.filename)))
})

test('a dry run and a version collision both leave npm untouched', async () => {
    const dryRun = mockRelease()
    await release({ ...dryRun, dryRun: true })
    expect(dryRun.commands.map(args => args[0])).toEqual(['test', 'run', 'pack'])

    const colliding = mockRelease({ collision: releasePackages.at(-1) })
    await expect(release(colliding)).rejects.toThrow('Release version check failed')
    expect(colliding.commands.map(args => args[0])).toEqual(['test', 'run', 'pack'])
})
