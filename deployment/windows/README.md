# Windows build, installation and rollback

[简体中文](README.zh.md)

Developer preview: read the [service-access limitations](../../docs/SERVICE-ACCESS.md)
before any real login. The release validates offline installation/composition;
the sign-in and launch commands below are manual user operations, not CI steps.

Requires Node.js 24, Git, PowerShell, and the Windows `tar` command. Run these
commands from the checkout. All example paths are derived from the current
checkout; choose separate destinations appropriate to your machine. No command
below selects an existing DSH installation.

```powershell
$work = [IO.Path]::GetFullPath((Join-Path (Get-Location) '../dsh-supergrok-build'))
$runtime = [IO.Path]::GetFullPath((Join-Path (Get-Location) '../dsh-supergrok-runtime'))
$data = [IO.Path]::GetFullPath((Join-Path (Get-Location) '../dsh-supergrok-data'))
$backups = [IO.Path]::GetFullPath((Join-Path (Get-Location) '../dsh-supergrok-backups'))
npm ci --ignore-scripts
npm run verify
npm run build:dsh -- --work-dir $work
npm run build:dsh -- --work-dir $work --phase test
npm run build:suite -- --work-dir $work
```

The DSH builder verifies tag `dsh-v0.1.2-rc.1` resolves to the source-lock commit,
exports a clean source archive, applies the checked-in patch, installs the
frozen upstream dependencies and builds host/client/web source. An optional
`--upstream-source <local-git-checkout>` exports the same fixed commit without
requiring the remote clone; it never reads that checkout's uncommitted files.
The suite builder compiles extensions and packs the provider and all changed
core packages, then creates a runtime bundle with a complete dependency lock.
A fresh directory is required for preparation; `--phase` can resume later
build/test/pack stages. Build and package downloads use public registries.

## Install a separate runtime

```powershell
node scripts/install-suite.mjs install --bundle "$work/bundle" --runtime $runtime --backups $backups
# Review the exact resolved paths above, then apply explicitly:
node scripts/install-suite.mjs install --bundle "$work/bundle" --runtime $runtime --backups $backups --apply
```

The default dry run performs validation only. Application verifies every bundle
input, installs a complete candidate with `npm ci --ignore-scripts`, and then
renames directories on the same drive. An existing target must carry this
installer's marker; unknown installations are refused. Failed candidates and
rollback receipts stay under the explicit backup directory, outside Git.
Do not manually remove an old runtime until its users have stopped using it.
The helper itself does not start, stop or inspect DSH processes.

## Initialize new data and sign in

Choose the proxy endpoint you actually run; the address below is only an
example. Credentials in proxy URLs, non-loopback hosts, HTTPS/SOCKS proxies,
paths, query strings and fragments are rejected. `localhost` is deliberately
excluded to avoid DNS-dependent routing.

```powershell
$proxy = 'http://127.0.0.1:8080'
node scripts/install-suite.mjs init --runtime $runtime --data $data --proxy-url $proxy
node scripts/install-suite.mjs init --runtime $runtime --data $data --proxy-url $proxy --apply
$env:DSH_HOME = $data
node "$runtime/node_modules/@deepseek-ai/dsh/lib/bin.js" --profile web
```

Initialization requires an absent data directory. It creates provider config
for web/headless, a profile node_modules junction to the same runtime dependency
tree, and the complete Grok preset payload. It does not copy old settings,
credentials or conversations. DSH's global default remains standard. Complete
the SuperGrok OAuth login in DSH, select from the live catalog, then choose
Grok optimized when desired. Launching and logging in are user operations;
the installer performs neither. For manual headless use, select the headless
profile and supply the arguments supported by the pinned DSH CLI.

## Offline installed-composition verification

```powershell
npm run test:installed -- --work-dir $work
```

This command creates its own fresh runtime and data below the build directory,
then checks real web/headless loading with a synthetic adapter. It never uses
the runtime/data variables above or a production installation. It also verifies
dry-run behavior, malformed proxies and recoverable replacement/rollback.

## Rollback

Use the exact receipt printed by the install command. Stop using the target
runtime before applying a rollback; the tool does not manage processes.

```powershell
node scripts/install-suite.mjs rollback --runtime $runtime --receipt <absolute-receipt-path>
node scripts/install-suite.mjs rollback --runtime $runtime --receipt <absolute-receipt-path> --apply
```

The runtime marker must match that receipt. The displaced installation is
preserved as `rolled-back` under its transaction; an earlier managed runtime
is restored when one existed. Rolling back a first installation leaves the
runtime target absent. User data is never reverted, deleted or rewritten.

The older `Install-GrokOptimizedPreset.ps1` / `Rollback-GrokOptimizedPreset.ps1`
helpers remain tested for their original two-YAML-file update contract. New
suite installations use the complete preset payload above. Historical xAI API
rollout tooling is not part of this procedure.
