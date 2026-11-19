import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { checkPackedVersions, registry } from './check-release-versions.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const releaseOrder = [
    '@muze-labs/simplyflow-state',
    '@muze-labs/simplyflow-bind',
    '@muze-labs/simplyflow-model',
    '@muze-labs/simplyflow-app',
    '@muze-labs/simplyflow',
    '@muze-labs/simplyedit',
    '@muze-labs/simplyflow-edit'
]

export async function release({
    dryRun = false,
    run = execFileSync,
    fetchRegistry = globalThis.fetch,
    report = console.log
} = {}) {
    const npm = (args, options) => run('npm', args, { cwd: root, ...options })
    npm(['test'], { stdio: 'inherit' })
    npm(['run', 'build'], { stdio: 'inherit' })

    const directory = await mkdtemp(join(tmpdir(), 'simplyflow-release-'))
    try {
        // Publish these archives so the registry check covers the exact bytes sent.
        const packed = JSON.parse(npm([
            'pack', '--json', '--workspaces', '--ignore-scripts',
            '--pack-destination', directory
        ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }))
        const archives = new Map(packed.map(pkg => [pkg.name, pkg]))
        if (packed.length !== releaseOrder.length || releaseOrder.some(name => !archives.has(name))) {
            throw new Error('simplyflow/release: workspace packages differ from the release order')
        }

        const results = await checkPackedVersions(
            releaseOrder.map(name => archives.get(name)), { fetchRegistry, report }
        )
        for (const { pkg, state } of results) {
            if (state !== 'publish') {
                continue
            }
            report(`${dryRun ? 'Would publish' : 'Publishing'} ${pkg.name}@${pkg.version}`)
            if (!dryRun) {
                npm([
                    'publish', join(directory, pkg.filename), '--access', 'public',
                    '--registry', registry, '--ignore-scripts'
                ], { stdio: 'inherit' })
            }
        }
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    try {
        const args = process.argv.slice(2)
        if (args.some(arg => arg !== '--dry-run')) {
            throw new Error('Usage: npm run release -- [--dry-run]')
        }
        await release({ dryRun: args.includes('--dry-run') || process.env.npm_config_dry_run === 'true' })
    } catch (error) {
        console.error(error.message)
        process.exitCode = 1
    }
}
