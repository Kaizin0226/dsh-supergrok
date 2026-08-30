[CmdletBinding()]
param(
  [ValidateSet('DryRun', 'Apply', 'Verify', 'Rollback')]
  [string]$Action = 'DryRun',
  [Parameter(Mandatory = $true)]
  [string]$DshRoot,
  [Parameter(Mandatory = $true)]
  [string]$RollbackRoot,
  [Parameter(Mandatory = $true)]
  [string]$LocalManifest,
  [string]$BackupDirectory,
  [string]$ConfirmApply
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$CandidateRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ProductionRoot = [System.IO.Path]::GetFullPath($DshRoot)
$BackupRoot = [System.IO.Path]::GetFullPath($RollbackRoot)
$ManifestPath = [System.IO.Path]::GetFullPath($LocalManifest)
$SettingsTool = Join-Path $CandidateRoot 'scripts\settings-candidate.mjs'
$LauncherVerifier = Join-Path $CandidateRoot 'scripts\verify-launcher.mjs'
$PatchSource = Join-Path $CandidateRoot 'overlay\patches\@earendil-works__pi-ai@0.82.1-xai-contract.patch'
$PatchRelative = 'patches/@earendil-works__pi-ai@0.82.1-xai-contract.patch'
$PatchTarget = Join-Path $ProductionRoot 'patches\@earendil-works__pi-ai@0.82.1-xai-contract.patch'
$SnapshotSource = Join-Path $CandidateRoot 'catalog\official-xai-language-models.snapshot.json'
$SnapshotTarget = Join-Path $ProductionRoot 'data\trust\official-xai-language-models.snapshot.json'
$SnapshotTool = Join-Path $CandidateRoot 'scripts\catalog-snapshot.mjs'
$SettingsPath = Join-Path $ProductionRoot 'data\settings.yaml'
$LauncherPath = Join-Path $ProductionRoot 'Start-DeepSeek-Harness.cmd'
$PackagePath = Join-Path $ProductionRoot 'package.json'
$WorkspacePath = Join-Path $ProductionRoot 'pnpm-workspace.yaml'
$LockPath = Join-Path $ProductionRoot 'pnpm-lock.yaml'
$PinnedPnpmPath = Join-Path $ProductionRoot '.corepack\v1\pnpm\11.7.0\bin\pnpm.cjs'
$PinnedPnpmModulePath = Join-Path $ProductionRoot '.corepack\v1\pnpm\11.7.0\bin\pnpm.mjs'
$PinnedPnpmDistPath = Join-Path $ProductionRoot '.corepack\v1\pnpm\11.7.0\dist\pnpm.mjs'
$WorkspaceEntry = "patchedDependencies:`r`n  '@earendil-works/pi-ai@0.82.1': $PatchRelative`r`n"
$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json

function Get-Sha256([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "missing file: $Path" }
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}

function Assert-OrdinaryFile([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "$Label missing: $Path" }
  $Item = Get-Item -LiteralPath $Path -Force
  if (($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "$Label must be an ordinary non-link file: $Path"
  }
}

function Assert-Hash([string]$Path, [string]$Expected, [string]$Label) {
  $Actual = Get-Sha256 $Path
  if ($Actual -ne $Expected) { throw "$Label hash drift: expected $Expected; actual $Actual; path $Path" }
}

function Get-PiAiRoot {
  $PnpmRoot = Join-Path $ProductionRoot 'node_modules\.pnpm'
  $Matches = @(Get-ChildItem -LiteralPath $PnpmRoot -Directory | Where-Object {
    $_.Name.StartsWith('@earendil-works+pi-ai@0.82.')
  } | ForEach-Object {
    $Candidate = Join-Path $_.FullName 'node_modules\@earendil-works\pi-ai'
    if (Test-Path -LiteralPath (Join-Path $Candidate 'package.json')) { $Candidate }
  })
  if ($Matches.Count -ne 1) { throw "expected exactly one installed pi-ai 0.82 package, found $($Matches.Count)" }
  $Package = Get-Content -LiteralPath (Join-Path $Matches[0] 'package.json') -Raw | ConvertFrom-Json
  if ($Package.version -ne '0.82.1') { throw "pi-ai version drift: $($Package.version)" }
  return [System.IO.Path]::GetFullPath($Matches[0])
}

function Assert-Baseline {
  if (-not (Test-Path -LiteralPath $ProductionRoot -PathType Container)) {
    throw "DSH root is not an existing directory: $ProductionRoot"
  }
  Assert-Hash $SettingsPath $Manifest.baseline.settingsYaml 'settings.yaml'
  Assert-Hash $LauncherPath $Manifest.baseline.launcher 'launcher'
  Assert-Hash $PackagePath $Manifest.baseline.packageJson 'package.json'
  Assert-Hash $WorkspacePath $Manifest.baseline.pnpmWorkspaceYaml 'pnpm-workspace.yaml'
  Assert-Hash $LockPath $Manifest.baseline.pnpmLockYaml 'pnpm-lock.yaml'
  Assert-Hash $PinnedPnpmPath $Manifest.baseline.pinnedPnpmShim 'pinned pnpm.cjs'
  Assert-Hash $PinnedPnpmModulePath $Manifest.baseline.pinnedPnpmModule 'pinned bin/pnpm.mjs'
  Assert-Hash $PinnedPnpmDistPath $Manifest.baseline.pinnedPnpmDist 'pinned dist/pnpm.mjs'
  Assert-Hash $PatchSource $Manifest.overlay.patchSha256 'overlay patch'
  Assert-Hash $SnapshotSource $Manifest.catalog.sha256 'official xAI language-model snapshot candidate'
  $PiRoot = Get-PiAiRoot
  Assert-Hash (Join-Path $PiRoot 'dist\api\openai-responses.js') $Manifest.baseline.piAiOpenaiResponses 'pi-ai openai-responses.js'
  Assert-Hash (Join-Path $PiRoot 'dist\api\openai-responses-shared.js') $Manifest.baseline.piAiOpenaiResponsesShared 'pi-ai openai-responses-shared.js'
  $Workspace = Get-Content -LiteralPath $WorkspacePath -Raw
  if ($Workspace -match '(?m)^patchedDependencies\s*:') { throw 'production workspace already has patchedDependencies; refuse implicit merge' }
  $Launcher = Get-Content -LiteralPath $LauncherPath -Raw
  $Clears = [regex]::Matches($Launcher, '(?im)^[ \t]*set[ \t]+"XAI_API_KEY="[ \t]*\r?\n')
  if ($Clears.Count -ne 1) { throw "expected exactly one launcher XAI_API_KEY clearing line, found $($Clears.Count)" }
  Push-Location $PiRoot
  try {
    & git apply --check $PatchSource
    if ($LASTEXITCODE -ne 0) { throw 'pi-ai overlay does not apply cleanly' }
  } finally { Pop-Location }
}

function Assert-CatalogSnapshot([bool]$RequireVerified) {
  $Arguments = @($SnapshotTool, 'verify', '--snapshot', $SnapshotSource)
  if ($RequireVerified) { $Arguments += '--require-verified' }
  & node @Arguments
  if ($LASTEXITCODE -ne 0) {
    if ($RequireVerified) { throw 'official xAI language-model snapshot is not Canary-verified' }
    throw 'official xAI language-model snapshot structure is invalid'
  }
}

function Assert-DshStopped {
  $Listeners = @([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object {
    $_.Port -eq 3080
  })
  if ($Listeners.Count -ne 0) {
    throw 'TCP port 3080 is listening. Stop DSH before changing production state; this script will not stop or restart any process.'
  }
  $ProductionPrefix = [System.IO.Path]::GetFullPath($ProductionRoot).TrimEnd('\') + '\'
  $ProcessEvidence = @()
  foreach ($Process in @(Get-Process -ErrorAction SilentlyContinue)) {
    try {
      if ($Process.Path -and [System.IO.Path]::GetFullPath($Process.Path).StartsWith($ProductionPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        $ProcessEvidence += "pid=$($Process.Id) path=$($Process.Path)"
      }
    } catch {
      # Protected process metadata is not treated as evidence either way.
    }
  }
  try {
    foreach ($Process in @(Get-CimInstance Win32_Process -ErrorAction Stop)) {
      $CommandLine = [string]$Process.CommandLine
      if ($CommandLine -and
          ($CommandLine.IndexOf($ProductionRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or
           $CommandLine -match '(?i)DeepSeekHarness|deepseek-harness')) {
        $ProcessEvidence += "pid=$($Process.ProcessId) commandLine references DSH production"
      }
    }
  } catch {
    throw "cannot complete DSH command-line process audit; run with sufficient read permission or stop: $($_.Exception.Message)"
  }
  if ($ProcessEvidence.Count -ne 0) {
    throw "DSH-related process evidence remains. Stop DSH before changing production state: $($ProcessEvidence -join '; ')"
  }
}

function New-SettingsCandidate([string]$Baseline, [string]$Output) {
  & node $SettingsTool prepare --source $Baseline --output $Output
  if ($LASTEXITCODE -ne 0) { throw 'settings candidate generation failed' }
  & node $SettingsTool verify --baseline $Baseline --candidate $Output
  if ($LASTEXITCODE -ne 0) { throw 'settings candidate verification failed' }
  Assert-Hash $Output $Manifest.expected.settingsYaml 'generated settings candidate'
}

function Invoke-DryRun {
  Assert-CatalogSnapshot $false
  Assert-Baseline
  New-Item -ItemType Directory -Path (Join-Path $CandidateRoot 'rollout') -Force | Out-Null
  $Scratch = Join-Path $CandidateRoot 'rollout\settings.dry-run.yaml'
  if (Test-Path -LiteralPath $Scratch) { throw "unexpected pre-existing dry-run file: $Scratch" }
  try {
    New-SettingsCandidate $SettingsPath $Scratch
    $Launcher = [System.IO.File]::ReadAllText($LauncherPath)
    $ExpectedLauncher = [regex]::Replace($Launcher, '(?im)^[ \t]*set[ \t]+"XAI_API_KEY="[ \t]*\r?\n', '', 1)
    $Hasher = [System.Security.Cryptography.SHA256]::Create()
    try {
      $ExpectedHash = [Convert]::ToHexString($Hasher.ComputeHash([System.Text.UTF8Encoding]::new($false).GetBytes($ExpectedLauncher)))
    } finally { $Hasher.Dispose() }
    if ($ExpectedHash -ne $Manifest.expected.launcher) { throw "launcher transform hash drift: $ExpectedHash" }
  } finally {
    if (Test-Path -LiteralPath $Scratch) {
      $Resolved = [System.IO.Path]::GetFullPath($Scratch)
      if ($Resolved -ne [System.IO.Path]::GetFullPath((Join-Path $CandidateRoot 'rollout\settings.dry-run.yaml'))) {
        throw 'refusing unexpected dry-run cleanup target'
      }
      Remove-Item -LiteralPath $Resolved -Force
    }
  }
  if ($Manifest.catalog.promotionStatus -eq 'verified') {
    Write-Output 'READY: verified catalog snapshot, baseline, settings transform, launcher patch, and pi-ai overlay are exact. No production file changed.'
  } else {
    Write-Output 'STAGED: offline candidate is exact, but Apply remains blocked until one-request official xAI language-model Canary promotion. No production file changed.'
  }
}

function Write-BackupManifest([string]$Directory, [bool]$PatchPreexisting) {
  $ResolvedDirectory = [System.IO.Path]::GetFullPath($Directory)
  $PiRoot = Get-PiAiRoot
  $Before = [ordered]@{
    schemaVersion = 1
    productionRoot = $ProductionRoot
    backupDirectory = $ResolvedDirectory
    createdUtc = [DateTime]::UtcNow.ToString('o')
    patchPreexisting = $PatchPreexisting
    hashes = [ordered]@{
      settingsYaml = Get-Sha256 $SettingsPath
      launcher = Get-Sha256 $LauncherPath
      packageJson = Get-Sha256 $PackagePath
      pnpmWorkspaceYaml = Get-Sha256 $WorkspacePath
      pnpmLockYaml = Get-Sha256 $LockPath
      patch = if ($PatchPreexisting) { Get-Sha256 $PatchTarget } else { $null }
      piAiOpenaiResponses = Get-Sha256 (Join-Path $PiRoot 'dist\api\openai-responses.js')
      piAiOpenaiResponsesShared = Get-Sha256 (Join-Path $PiRoot 'dist\api\openai-responses-shared.js')
      pinnedPnpmShim = Get-Sha256 $PinnedPnpmPath
      pinnedPnpmModule = Get-Sha256 $PinnedPnpmModulePath
      pinnedPnpmDist = Get-Sha256 $PinnedPnpmDistPath
    }
  }
  [System.IO.File]::WriteAllText(
    (Join-Path $Directory 'before.json'),
    ($Before | ConvertTo-Json -Depth 8),
    [System.Text.UTF8Encoding]::new($false)
  )
}

function New-Backup {
  New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
  $Name = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
  $Directory = Join-Path $BackupRoot $Name
  New-Item -ItemType Directory -Path $Directory | Out-Null
  Copy-Item -LiteralPath $SettingsPath -Destination (Join-Path $Directory 'settings.yaml')
  Copy-Item -LiteralPath $LauncherPath -Destination (Join-Path $Directory 'Start-DeepSeek-Harness.cmd')
  Copy-Item -LiteralPath $PackagePath -Destination (Join-Path $Directory 'package.json')
  Copy-Item -LiteralPath $WorkspacePath -Destination (Join-Path $Directory 'pnpm-workspace.yaml')
  Copy-Item -LiteralPath $LockPath -Destination (Join-Path $Directory 'pnpm-lock.yaml')
  $PatchPreexisting = Test-Path -LiteralPath $PatchTarget -PathType Leaf
  if ($PatchPreexisting) { Copy-Item -LiteralPath $PatchTarget -Destination (Join-Path $Directory 'preexisting-pi-ai.patch') }
  $PiRoot = Get-PiAiRoot
  Copy-Item -LiteralPath (Join-Path $PiRoot 'dist\api\openai-responses.js') -Destination (Join-Path $Directory 'openai-responses.js')
  Copy-Item -LiteralPath (Join-Path $PiRoot 'dist\api\openai-responses-shared.js') -Destination (Join-Path $Directory 'openai-responses-shared.js')
  Write-BackupManifest $Directory $PatchPreexisting
  return $Directory
}

function Invoke-PnpmOffline {
  Assert-OrdinaryFile $PinnedPnpmPath 'pinned pnpm 11.7.0 entrypoint'
  Assert-OrdinaryFile $PinnedPnpmModulePath 'pinned pnpm 11.7.0 bin module'
  Assert-OrdinaryFile $PinnedPnpmDistPath 'pinned pnpm 11.7.0 dist module'
  Assert-Hash $PinnedPnpmPath $Manifest.baseline.pinnedPnpmShim 'pinned pnpm.cjs'
  Assert-Hash $PinnedPnpmModulePath $Manifest.baseline.pinnedPnpmModule 'pinned bin/pnpm.mjs'
  Assert-Hash $PinnedPnpmDistPath $Manifest.baseline.pinnedPnpmDist 'pinned dist/pnpm.mjs'
  $PnpmVersion = (& node $PinnedPnpmPath --version | Select-Object -Last 1).Trim()
  if ($LASTEXITCODE -ne 0 -or $PnpmVersion -ne '11.7.0') {
    throw "pinned pnpm version drift: expected 11.7.0; actual $PnpmVersion"
  }
  Push-Location $ProductionRoot
  try {
    & node $PinnedPnpmPath install --offline --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw "pnpm offline install failed with exit $LASTEXITCODE; no retry was attempted" }
  } finally { Pop-Location }
}

function Assert-Installed([string]$BaselineForSettings) {
  $InstalledFiles = @(
    [pscustomobject]@{ Path = $SettingsPath; Label = 'installed settings.yaml' }
    [pscustomobject]@{ Path = $LauncherPath; Label = 'installed launcher' }
    [pscustomobject]@{ Path = $PackagePath; Label = 'installed package.json' }
    [pscustomobject]@{ Path = $WorkspacePath; Label = 'installed pnpm-workspace.yaml' }
    [pscustomobject]@{ Path = $LockPath; Label = 'installed pnpm-lock.yaml' }
    [pscustomobject]@{ Path = $PatchTarget; Label = 'installed pnpm patch' }
  )
  foreach ($Entry in $InstalledFiles) {
    Assert-OrdinaryFile $Entry.Path $Entry.Label
  }
  Assert-Hash $SettingsPath $Manifest.expected.settingsYaml 'installed settings.yaml'
  Assert-Hash $LauncherPath $Manifest.expected.launcher 'installed launcher'
  Assert-Hash $PackagePath $Manifest.expected.packageJsonUnchanged 'package.json (must remain unchanged)'
  Assert-Hash $PatchTarget $Manifest.overlay.patchSha256 'installed patch'
  & node $SettingsTool verify --baseline $BaselineForSettings --candidate $SettingsPath
  if ($LASTEXITCODE -ne 0) { throw 'installed settings verification failed' }
  & node $LauncherVerifier $LauncherPath
  if ($LASTEXITCODE -ne 0) { throw 'installed launcher verification failed' }
  $Workspace = Get-Content -LiteralPath $WorkspacePath -Raw
  if ($Workspace -notmatch "(?m)^patchedDependencies:\r?\n\s+'@earendil-works/pi-ai@0\.82\.1':\s+patches/@earendil-works__pi-ai@0\.82\.1-xai-contract\.patch\s*$" ) {
    throw 'workspace patchedDependencies attestation missing or drifted'
  }
  $Lock = Get-Content -LiteralPath $LockPath -Raw
  if (-not $Lock.Contains('@earendil-works__pi-ai@0.82.1-xai-contract.patch')) {
    throw 'pnpm lockfile does not attest the xAI contract patch'
  }
  $PiRoot = Get-PiAiRoot
  Assert-OrdinaryFile (Join-Path $PiRoot 'dist\api\openai-responses.js') 'installed pi-ai openai-responses.js'
  Assert-OrdinaryFile (Join-Path $PiRoot 'dist\api\openai-responses-shared.js') 'installed pi-ai openai-responses-shared.js'
  Assert-Hash (Join-Path $PiRoot 'dist\api\openai-responses.js') $Manifest.overlay.expectedPatchedFiles.'openai-responses.js' 'patched openai-responses.js'
  Assert-Hash (Join-Path $PiRoot 'dist\api\openai-responses-shared.js') $Manifest.overlay.expectedPatchedFiles.'openai-responses-shared.js' 'patched openai-responses-shared.js'
}

function Restore-BackupState([string]$Backup) {
  $Backup = [System.IO.Path]::GetFullPath($Backup)
  $Before = Get-Content -LiteralPath (Join-Path $Backup 'before.json') -Raw | ConvertFrom-Json
  if ($Before.productionRoot -ne $ProductionRoot) { throw 'backup production root mismatch' }
  if ([System.IO.Path]::GetFullPath([string]$Before.backupDirectory) -ne $Backup) { throw 'backup directory identity mismatch' }
  Assert-Hash (Join-Path $Backup 'settings.yaml') $Before.hashes.settingsYaml 'backup settings.yaml'
  Assert-Hash (Join-Path $Backup 'Start-DeepSeek-Harness.cmd') $Before.hashes.launcher 'backup launcher'
  Assert-Hash (Join-Path $Backup 'package.json') $Before.hashes.packageJson 'backup package.json'
  Assert-Hash (Join-Path $Backup 'pnpm-workspace.yaml') $Before.hashes.pnpmWorkspaceYaml 'backup pnpm-workspace.yaml'
  Assert-Hash (Join-Path $Backup 'pnpm-lock.yaml') $Before.hashes.pnpmLockYaml 'backup pnpm-lock.yaml'
  Assert-Hash (Join-Path $Backup 'openai-responses.js') $Before.hashes.piAiOpenaiResponses 'backup openai-responses.js'
  Assert-Hash (Join-Path $Backup 'openai-responses-shared.js') $Before.hashes.piAiOpenaiResponsesShared 'backup openai-responses-shared.js'
  if ($Before.patchPreexisting) {
    Assert-Hash (Join-Path $Backup 'preexisting-pi-ai.patch') $Before.hashes.patch 'backup preexisting patch'
  }
  Copy-Item -LiteralPath (Join-Path $Backup 'settings.yaml') -Destination $SettingsPath -Force
  Copy-Item -LiteralPath (Join-Path $Backup 'Start-DeepSeek-Harness.cmd') -Destination $LauncherPath -Force
  Copy-Item -LiteralPath (Join-Path $Backup 'package.json') -Destination $PackagePath -Force
  Copy-Item -LiteralPath (Join-Path $Backup 'pnpm-workspace.yaml') -Destination $WorkspacePath -Force
  Copy-Item -LiteralPath (Join-Path $Backup 'pnpm-lock.yaml') -Destination $LockPath -Force
  if ($Before.patchPreexisting) {
    Copy-Item -LiteralPath (Join-Path $Backup 'preexisting-pi-ai.patch') -Destination $PatchTarget -Force
  } elseif (Test-Path -LiteralPath $PatchTarget -PathType Leaf) {
    $ResolvedPatch = [System.IO.Path]::GetFullPath($PatchTarget)
    if ($ResolvedPatch -ne [System.IO.Path]::GetFullPath((Join-Path $ProductionRoot 'patches\@earendil-works__pi-ai@0.82.1-xai-contract.patch'))) {
      throw 'refusing unexpected patch removal target'
    }
    Remove-Item -LiteralPath $ResolvedPatch -Force
  }
  Invoke-PnpmOffline
  Assert-Hash $SettingsPath $Before.hashes.settingsYaml 'restored settings.yaml'
  Assert-Hash $LauncherPath $Before.hashes.launcher 'restored launcher'
  Assert-Hash $PackagePath $Before.hashes.packageJson 'restored package.json'
  Assert-Hash $WorkspacePath $Before.hashes.pnpmWorkspaceYaml 'restored pnpm-workspace.yaml'
  Assert-Hash $LockPath $Before.hashes.pnpmLockYaml 'restored pnpm-lock.yaml'
  Assert-Hash $PinnedPnpmPath $Before.hashes.pinnedPnpmShim 'unchanged pinned pnpm.cjs'
  Assert-Hash $PinnedPnpmModulePath $Before.hashes.pinnedPnpmModule 'unchanged pinned bin/pnpm.mjs'
  Assert-Hash $PinnedPnpmDistPath $Before.hashes.pinnedPnpmDist 'unchanged pinned dist/pnpm.mjs'
  if ($Before.patchPreexisting) {
    Assert-Hash $PatchTarget $Before.hashes.patch 'restored preexisting patch'
  } elseif (Test-Path -LiteralPath $PatchTarget) {
    throw 'candidate patch remains after restore'
  }
  $PiRoot = Get-PiAiRoot
  Assert-Hash (Join-Path $PiRoot 'dist\api\openai-responses.js') $Before.hashes.piAiOpenaiResponses 'restored openai-responses.js'
  Assert-Hash (Join-Path $PiRoot 'dist\api\openai-responses-shared.js') $Before.hashes.piAiOpenaiResponsesShared 'restored openai-responses-shared.js'
}

function Invoke-Apply {
  if ($ConfirmApply -ne 'APPLY-OFFICIAL-XAI') { throw 'Apply requires -ConfirmApply APPLY-OFFICIAL-XAI' }
  Assert-CatalogSnapshot $true
  Assert-DshStopped
  Assert-Baseline
  $Backup = New-Backup
  try {
    $CandidateDirectory = Join-Path $Backup 'candidate'
    New-Item -ItemType Directory -Path $CandidateDirectory | Out-Null
    $CandidateSettings = Join-Path $CandidateDirectory 'settings.yaml'
    New-SettingsCandidate (Join-Path $Backup 'settings.yaml') $CandidateSettings
    Copy-Item -LiteralPath $CandidateSettings -Destination $SettingsPath -Force

    $Launcher = [System.IO.File]::ReadAllText($LauncherPath)
    $Clears = [regex]::Matches($Launcher, '(?im)^[ \t]*set[ \t]+"XAI_API_KEY="[ \t]*\r?\n')
    if ($Clears.Count -ne 1) { throw "launcher drift during apply: clearing lines $($Clears.Count)" }
    $Launcher = [regex]::Replace($Launcher, '(?im)^[ \t]*set[ \t]+"XAI_API_KEY="[ \t]*\r?\n', '', 1)
    [System.IO.File]::WriteAllText($LauncherPath, $Launcher, [System.Text.UTF8Encoding]::new($false))

    New-Item -ItemType Directory -Path (Split-Path -Parent $PatchTarget) -Force | Out-Null
    Copy-Item -LiteralPath $PatchSource -Destination $PatchTarget -Force
    $Workspace = [System.IO.File]::ReadAllText($WorkspacePath)
    if ($Workspace -match '(?m)^patchedDependencies\s*:') { throw 'workspace changed during apply' }
    if (-not $Workspace.EndsWith("`n")) { $Workspace += "`r`n" }
    $Workspace += $WorkspaceEntry
    [System.IO.File]::WriteAllText($WorkspacePath, $Workspace, [System.Text.UTF8Encoding]::new($false))

    Invoke-PnpmOffline
    Assert-Installed (Join-Path $Backup 'settings.yaml')
    $PiRoot = Get-PiAiRoot
    $After = [ordered]@{
      schemaVersion = 1
      productionRoot = $ProductionRoot
      verifiedUtc = [DateTime]::UtcNow.ToString('o')
      backupDirectory = $Backup
      patchedDependency = [ordered]@{
        package = '@earendil-works/pi-ai@0.82.1'
        relativePatch = $PatchRelative
      }
      hashes = [ordered]@{
        settingsYaml = Get-Sha256 $SettingsPath
        launcher = Get-Sha256 $LauncherPath
        packageJson = Get-Sha256 $PackagePath
        pnpmWorkspaceYaml = Get-Sha256 $WorkspacePath
        pnpmLockYaml = Get-Sha256 $LockPath
        patch = Get-Sha256 $PatchTarget
        piAiOpenaiResponses = Get-Sha256 (Join-Path $PiRoot 'dist\api\openai-responses.js')
        piAiOpenaiResponsesShared = Get-Sha256 (Join-Path $PiRoot 'dist\api\openai-responses-shared.js')
        pinnedPnpmShim = Get-Sha256 $PinnedPnpmPath
        pinnedPnpmModule = Get-Sha256 $PinnedPnpmModulePath
        pinnedPnpmDist = Get-Sha256 $PinnedPnpmDistPath
      }
    }
    [System.IO.File]::WriteAllText((Join-Path $Backup 'after.json'), ($After | ConvertTo-Json -Depth 8), [System.Text.UTF8Encoding]::new($false))
  } catch {
    $ApplyFailure = $_.Exception.Message
    try {
      Restore-BackupState $Backup
    } catch {
      $RestoreFailure = $_.Exception.Message
      throw "Apply failed: $ApplyFailure; automatic rollback also failed: $RestoreFailure; recovery backup: $Backup"
    }
    throw "Apply failed and automatic rollback was verified: $ApplyFailure; backup: $Backup"
  }
  Write-Output "APPLIED AND VERIFIED. Backup: $Backup"
}

function Resolve-Backup([string]$Directory) {
  if ([string]::IsNullOrWhiteSpace($Directory)) { throw 'this action requires -BackupDirectory' }
  $Resolved = [System.IO.Path]::GetFullPath($Directory)
  $Prefix = $BackupRoot.TrimEnd('\') + '\'
  if (-not $Resolved.StartsWith($Prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "backup must be a child of $BackupRoot"
  }
  $BackupItem = Get-Item -LiteralPath $Resolved -Force
  if (($BackupItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'backup directory must not be a link or reparse point'
  }
  Assert-OrdinaryFile (Join-Path $Resolved 'before.json') 'backup before.json'
  return $Resolved
}

function Assert-CompletedApplyState([string]$Backup, [bool]$RequireStopped) {
  if ($RequireStopped) { Assert-DshStopped }
  $BeforePath = Join-Path $Backup 'before.json'
  $AfterPath = Join-Path $Backup 'after.json'
  Assert-OrdinaryFile $BeforePath 'backup before.json'
  Assert-OrdinaryFile $AfterPath 'backup after.json'
  $Before = Get-Content -LiteralPath $BeforePath -Raw | ConvertFrom-Json
  $After = Get-Content -LiteralPath $AfterPath -Raw | ConvertFrom-Json
  foreach ($State in @($Before, $After)) {
    if ([System.IO.Path]::GetFullPath([string]$State.productionRoot) -ne [System.IO.Path]::GetFullPath($ProductionRoot)) {
      throw 'backup production root identity mismatch'
    }
    if ([System.IO.Path]::GetFullPath([string]$State.backupDirectory) -ne [System.IO.Path]::GetFullPath($Backup)) {
      throw 'backup directory identity mismatch'
    }
  }
  if ($After.patchedDependency.package -ne '@earendil-works/pi-ai@0.82.1' -or
      $After.patchedDependency.relativePatch -ne $PatchRelative) {
    throw 'after.json patched dependency mapping drifted'
  }
  $PiRoot = Get-PiAiRoot
  $CurrentFiles = @(
    [pscustomobject]@{ Path = $SettingsPath; Expected = $After.hashes.settingsYaml; Label = 'current settings.yaml after-state' }
    [pscustomobject]@{ Path = $LauncherPath; Expected = $After.hashes.launcher; Label = 'current launcher after-state' }
    [pscustomobject]@{ Path = $PackagePath; Expected = $After.hashes.packageJson; Label = 'current package.json after-state' }
    [pscustomobject]@{ Path = $WorkspacePath; Expected = $After.hashes.pnpmWorkspaceYaml; Label = 'current pnpm-workspace.yaml after-state' }
    [pscustomobject]@{ Path = $LockPath; Expected = $After.hashes.pnpmLockYaml; Label = 'current pnpm-lock.yaml after-state' }
    [pscustomobject]@{ Path = $PatchTarget; Expected = $After.hashes.patch; Label = 'current pnpm patch after-state' }
    [pscustomobject]@{ Path = (Join-Path $PiRoot 'dist\api\openai-responses.js'); Expected = $After.hashes.piAiOpenaiResponses; Label = 'current openai-responses.js after-state' }
    [pscustomobject]@{ Path = (Join-Path $PiRoot 'dist\api\openai-responses-shared.js'); Expected = $After.hashes.piAiOpenaiResponsesShared; Label = 'current openai-responses-shared.js after-state' }
    [pscustomobject]@{ Path = $PinnedPnpmPath; Expected = $After.hashes.pinnedPnpmShim; Label = 'current pinned pnpm.cjs after-state' }
    [pscustomobject]@{ Path = $PinnedPnpmModulePath; Expected = $After.hashes.pinnedPnpmModule; Label = 'current pinned bin/pnpm.mjs after-state' }
    [pscustomobject]@{ Path = $PinnedPnpmDistPath; Expected = $After.hashes.pinnedPnpmDist; Label = 'current pinned dist/pnpm.mjs after-state' }
  )
  foreach ($Entry in $CurrentFiles) {
    Assert-OrdinaryFile $Entry.Path $Entry.Label
    Assert-Hash $Entry.Path $Entry.Expected $Entry.Label
  }
  $Workspace = Get-Content -LiteralPath $WorkspacePath -Raw
  if ($Workspace -notmatch "(?m)^patchedDependencies:\r?\n\s+'@earendil-works/pi-ai@0\.82\.1':\s+patches/@earendil-works__pi-ai@0\.82\.1-xai-contract\.patch\s*$") {
    throw 'current workspace no longer matches the after-state patched dependency mapping'
  }
}

function Invoke-Verify {
  $Backup = Resolve-Backup $BackupDirectory
  Assert-CompletedApplyState $Backup $false
  Assert-Installed (Join-Path $Backup 'settings.yaml')
  Write-Output 'PASS installed official xAI settings, launcher, lock, patch, and package bytes are attested.'
}

function Invoke-Rollback {
  $Backup = Resolve-Backup $BackupDirectory
  Assert-CompletedApplyState $Backup $true
  Restore-BackupState $Backup
  Write-Output 'ROLLED BACK AND VERIFIED. No DSH process was started.'
}

switch ($Action) {
  'DryRun' { Invoke-DryRun }
  'Apply' { Invoke-Apply }
  'Verify' { Invoke-Verify }
  'Rollback' { Invoke-Rollback }
}
