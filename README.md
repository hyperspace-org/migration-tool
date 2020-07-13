# `@hyperspace/migration-tool`
A tool for migrating from the [Hyperdrive daemon](https://github.com/hypercore-protocol/hyperdrive-daemon) to [Hyperspace](https://github.com/hyperspace-org/hyperspace).

This tool does a few things:
1. It moves all your stored hypercores from `~/.hyperdrive/storage/cores` to `~/.hyperspace/storage`.
2. It copies all network configurations (the cores you're seeding) from the daemon's Level instance (at `~/.hyperdrive/storage/db`) into Hyperspace's config trie.
3. It copies your FUSE root drive key into a separate config file that will be loaded by [`@hyperspace/hyperdrive`](https://github.com/hyperspace-org/hyperspace-hyperdrive-service).

### Installation
```
npm i @hyperspace/migration-tool -g
```

### Usage
This migration tool is currently bundled with Hyperspace -- it's run by default when Hyperspace is first started, so you shouldn't have to run this manually. After a few months or so, we'll be removing it. 

If you'd like to do the migration manually anyway, you can install this module globally (`npm i @hyperspace/migration-tool -g`) and use the included `bin.js` CLI tool.

#### As a module
The tool exports two functions, `migrate` and `isMigrated`. `await migrate()` will perform the migration.

### From the CLI
`./bin.js` will perform the migration. It assumes that your Hyperdrive daemon storage is stored in `~/.hyperdrive` and that your Hyperspace storage directory is going to be `~/.hyperspace`.

### License
MIT
