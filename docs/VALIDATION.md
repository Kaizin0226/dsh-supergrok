# Validation and public-release checklist

The supported development and test runtime is Node.js 24 on Windows.

| Check | Scope and result |
| --- | --- |
| Clean pinned DSH source build | Exact upstream tag commit exported, checked-in patch applied; host/client/web build passed |
| Core regression tests | 613 tests passed across 33 files, including newly imported input preparation coverage |
| Provider and scanner unit tests | 117 passed; mocked transport only |
| Historical-image extensions | 39 passed, including real Cordis Loader composition |
| Work-state extension | 16 passed against independently installed packages |
| Installed web/headless | Actual profiles load the new provider; synthetic inference only |
| Preset isolation | Default standard; recall once in each local mode; work-state once in Grok mode only |
| Installer | Clean locked installation, no-op dry run, new-data guard, replacement and exact-receipt rollback passed |
| Historical contract/deployment checks | 11 legacy contract tests and the PowerShell deployment regressions passed |

The complete tests cover missing/stale usage, missing or invalid proxies, shared
dispatcher ownership, failed dynamic catalog refresh, input-preparation notice
replay, cancellation, repeated images, full request budgets and zero inference
requests on rejection. Test runners remove inherited API credentials and use
synthetic data. Provider tests block socket/fetch access; installed profile
tests allow only their own local HTTP listener. They never log in or send a
real model request. Build and npm dependency downloads are separate from tests.

Registry dependency resolutions are checked into `build-locks/`. Locally built
tarball integrity values are regenerated from the resulting bytes without
changing registry versions. The portable bundle checks all package, lock and
preset inputs before candidate installation and before replacement. Package
checks are local; this project does not publish to npm.

CI pins Actions to full commit SHAs, checks full reachable Git history, builds
from the fixed public upstream source and verifies the installed combination.
Use the workflow run for the exact submitted commit as the hosted-CI result;
local success alone does not establish that result.

## Separate acceptance levels

1. **Offline acceptance:** builds, contracts, simulated provider behavior and
   isolated installed-profile loading described above.
2. **Production loading:** must be checked separately against the user's
   explicitly chosen local installation. This update does not modify it.
3. **Online model/UI acceptance:** requires separate account authorization and
   real service checks. No such requests or production screenshots are part of
   this release. In particular, real image inference and production usage-panel
   visual acceptance are not claimed by the offline tests.

## Before changing repository visibility

- Confirm source, docs, commit messages, author/committer identities and link
  targets contain no private data. Repository and history scans cover both
  Windows separators, common private POSIX paths and image metadata. Current
  documentation contains no account screenshots.
- Preserve upstream authors and copyrights. Maintainer commits use
  `38362307+Kaizin0226@users.noreply.github.com`.
- Inspect GitHub-side old commit links, pull-request refs, Actions logs and
  artifacts, releases, attachments and other cached content. Rewriting branch
  history does **not** erase all GitHub copies or old Actions logs. Resolve
  relevant remnants before making the repository public.
- Recheck the exact branch heads before any leased history update. If the
  remote has changed, stop instead of overwriting another update.
- Review current service access/terms and third-party notices. Source licensing
  does not confer subscription entitlement or service authorization.
- Make the visibility decision separately. This update keeps the repository
  private and leaves optional Bridge trust configuration to a separate action.
