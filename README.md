# hyperspace-migration-tool
A tool for migrating from the [Hyperdrive daemon](https://github.com/hypercore-protocol/hyperdrive-daemon) to [Hyperspace](https://github.com/hyperspace-org/hyperspace).

This tool does a few things:
1. It copies all your stored hypercores from `~/.hyperdrive/storage/cores` to `~/.hyperspace/storage`.
2. It copies all network configurations (the cores you're seeding) from the daemon's Level instance (at `~/.hyperdrive/storage/db`) into Hyperspace's config trie.
3. It copies your FUSE root drive into a separate config file that will be loaded by [`@hyperspace/hyperdrive`](https://github.com/hyperspace-org/hyperspace-hyperdrive-service).

### Installation
```
npm i hyperspace-migration-tool
```

### Usage
This migration tool is currently bundled with Hyperspace. After a few months or so, we'll be removing it. If you'd like to run the tool manually yourself, you can install the module globally and use the included `bin.js` CLI tool.

#### As a module
The tool exports one function, `migrate`. `await migrate()` will perform the migration.

### From the CLI
`./bin.js` will perform the migration. It assumes that your Hyperdrive daemon storage is stored in `~/.hyperdrive` and that your Hyperspace storage directory is going to be `~/.hyperspace`.

### License
MIT
