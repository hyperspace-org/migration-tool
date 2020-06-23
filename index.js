const os = require('os')
const p = require('path')
const fs = require('fs').promises

const level = require('level')
const sub = require('subleveldown')
const collectStream = require('stream-collector')
const { Client: HyperspaceClient, Server: HyperspaceServer } = require('hyperspace')

const HYPERSPACE_ROOT = p.join(os.homedir(), '.hyperspace')
const HYPERSPACE_STORAGE_DIR = p.join(HYPERSPACE_ROOT, 'storage')

const DAEMON_ROOT = p.join(os.homedir(), '.hyperdrive')
const DAEMON_STORAGE_DIR = p.join(DAEMON_ROOT, 'storage')
const DAEMON_DB_PATH = p.join(DAEMON_STORAGE_DIR, 'db')
const DAEMON_CORES_PATH = p.join(DAEMON_STORAGE_DIR, 'cores')

const MIGRATION_DIR = p.join(DAEMON_STORAGE_DIR, '.migration')

module.exports = async function migrate () {
  // If the hyperdrive-daemon was never installed, abort.
  if (!(await exists(DAEMON_STORAGE_DIR))) return

  // If the hyperspace storage directory has already been created, abort.
  if (await exists(HYPERSPACE_STORAGE_DIR)) return

  const rootDb = level(DAEMON_DB_PATH)
  const drivesDb = sub(rootDb, 'drives')
  const networkDb = sub(drivesDb, 'seeding', { valueEncoding: 'json' })
  await networkDb.open()

  // Move the old storage directory into the migration directory.
  if (!(await exists(MIGRATION_DIR))) {
    await migrateCores()
  }

  // Start the Hyperspace server on the migration directory.
  const server = new HyperspaceServer({
    storage: MIGRATION_DIR
  })
  await server.open()
  const client = new HyperspaceClient()
  await client.ready()

  // Migrate the network configurations in the old database into the Hyperspace storage trie.
  await migrateDatabase(client, networkDb)
  console.log('Done migrating database')

  // Atomically rename the migration directory to .hyperspace.
  await fs.mkdir(HYPERSPACE_ROOT, { recursive: true })
  await fs.rename(MIGRATION_DIR, HYPERSPACE_STORAGE_DIR)

  console.log('Done with migration. Shutting down Hyperspace server...')

  // Shut down the Hyperspace server.
  await server.close()
  console.log('Server closed.')
}

async function migrateDatabase (client, db) {
  const allNetworkConfigs = await dbCollect(db)
  for (const { key: discoveryKey, value: networkOpts } of allNetworkConfigs) {
    if (!networkOpts) continue
    const opts = networkOpts.opts
    console.log('Migrating discovery key:', discoveryKey)
    await client.network.configure(Buffer.from(discoveryKey, 'hex'), {
      announce: !!opts.announce,
      lookup: !!opts.lookup,
      remember: true
    })
  }
}

async function migrateCores () {
  return fs.rename(DAEMON_CORES_PATH, MIGRATION_DIR)
}

async function exists (path) {
  try {
    await fs.access(path)
    return true
  } catch (err) {
    return false
  }
}

function dbCollect (index, opts) {
  return new Promise((resolve, reject) => {
    collectStream(index.createReadStream(opts), (err, list) => {
      if (err) return reject(err)
      return resolve(list)
    })
  })
}
