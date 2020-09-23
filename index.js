const os = require('os')
const p = require('path')
const fs = require('fs').promises

const level = require('level')
const sub = require('subleveldown')
const bjson = require('buffer-json-encoding')
const collectStream = require('stream-collector')
const { Client: HyperspaceClient, Server: HyperspaceServer } = require('hyperspace')

const HYPERSPACE_ROOT = p.join(os.homedir(), '.hyperspace')
const HYPERSPACE_STORAGE_DIR = p.join(HYPERSPACE_ROOT, 'storage')
const HYPERSPACE_CONFIG_DIR = p.join(HYPERSPACE_ROOT, 'config')

const FUSE_CONFIG_PATH = p.join(HYPERSPACE_CONFIG_DIR, 'fuse.json')

const DAEMON_ROOT = p.join(os.homedir(), '.hyperdrive')
const DAEMON_STORAGE_DIR = p.join(DAEMON_ROOT, 'storage')
const DAEMON_DB_PATH = p.join(DAEMON_STORAGE_DIR, 'db')
const DAEMON_CORES_PATH = p.join(DAEMON_STORAGE_DIR, 'cores')

const MIGRATION_DIR = p.join(DAEMON_STORAGE_DIR, '.migration')

async function migrate (opts = {}) {
  if (await isMigrated()) return

  const rootDb = level(DAEMON_DB_PATH)
  const fuseDb = sub(rootDb, 'fuse', { valueEncoding: bjson })
  const drivesDb = sub(rootDb, 'drives')
  const networkDb = sub(drivesDb, 'seeding', { valueEncoding: 'json' })
  await networkDb.open()
  await fuseDb.open()

  // Move the old storage directory into the migration directory.
  if (!opts.noMove && !(await exists(MIGRATION_DIR))) {
    await migrateCores()
  }

  // Start the Hyperspace server on the migration directory.
  const server = new HyperspaceServer({
    storage: opts.noMove ? DAEMON_CORES_PATH : MIGRATION_DIR,
    noAnnounce: true
  })
  await server.open()
  const client = new HyperspaceClient()
  await client.ready()

  // Migrate the network configurations in the old database into the Hyperspace storage trie.
  await migrateNetworkConfigs(client, networkDb)

  // Migrate the root FUSE drives into a @hyperspace/hyperdrive config file.
  await migrateRootDrive(fuseDb)

  // Shut down the Hyperspace server.
  await server.close()

  // Atomically rename the migration directory to .hyperspace.
  if (!opts.noMove) {
    await fs.mkdir(HYPERSPACE_ROOT, { recursive: true })
    await fs.rename(MIGRATION_DIR, HYPERSPACE_STORAGE_DIR)
  }
}

async function isMigrated (opts = {}) {
  // If the hyperdrive-daemon was never installed, abort.
  if (!(await exists(DAEMON_STORAGE_DIR))) return true
  // If the hyperspace storage directory has already been created, abort.
  if (await exists(HYPERSPACE_STORAGE_DIR)) return true
  // If the hyperspace config directory has been created, and noMove is true, abort.
  if (opts.noMove && (await exists(HYPERSPACE_CONFIG_DIR))) return true
  return false
}

async function migrateNetworkConfigs (client, db) {
  const allNetworkConfigs = await dbCollect(db)
  for (const { key: discoveryKey, value: networkOpts } of allNetworkConfigs) {
    if (!networkOpts || !networkOpts.opts) continue
    const opts = networkOpts.opts
    await client.network.configure(Buffer.from(discoveryKey, 'hex'), {
      announce: !!opts.announce,
      lookup: !!opts.lookup,
      remember: true
    })
  }
}

async function migrateRootDrive (db) {
  const rootDriveMetadata = await dbGet(db, 'root-drive')
  if (!rootDriveMetadata) return null
  var key = rootDriveMetadata.opts && rootDriveMetadata.opts.key
  if (Buffer.isBuffer(key)) key = key.toString('hex')
  await fs.mkdir(HYPERSPACE_CONFIG_DIR, { recursive: true })
  return fs.writeFile(FUSE_CONFIG_PATH, JSON.stringify({
    rootDriveKey: key,
    mnt: p.join(os.homedir(), 'Hyperdrive')
  }, null, 2))
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

async function dbGet (db, idx) {
  try {
    return await db.get(idx)
  } catch (err) {
    if (err && !err.notFound) throw err
    return null
  }
}

module.exports = {
  migrate,
  isMigrated
}
