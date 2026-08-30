[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$env:XAI_API_KEY = $null
$env:OPENAI_API_KEY = $null
$env:ANTHROPIC_API_KEY = $null

. (Join-Path $PSScriptRoot 'DeploymentTreeSnapshot.ps1')

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$sourceCandidate = Join-Path $repositoryRoot 'presets\grok-optimized'
$runtimeFiles = @('preset.yml', 'agent.cordis.yml')
$runtimeManifest = Get-Content -Raw -LiteralPath (Join-Path $sourceCandidate 'runtime-manifest.example.json') | ConvertFrom-Json
$fixtureRoots = [Collections.Generic.List[string]]::new()

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Text
    )
    [IO.File]::WriteAllText($Path, $Text, [Text.UTF8Encoding]::new($false))
}

function New-TransactionFixture {
    param([Parameter(Mandatory = $true)][string]$Name)

    $root = Join-Path ([IO.Path]::GetTempPath()) ("dsh-grok-preset-transaction-$Name-$([Guid]::NewGuid().ToString('N'))")
    $candidate = Join-Path $root 'candidate'
    $presetParent = Join-Path $root 'production\.agent-presets'
    $target = Join-Path $presetParent 'grok-optimized'
    $backupRoot = Join-Path $root 'backups'
    New-Item -ItemType Directory -Path $candidate | Out-Null
    New-Item -ItemType Directory -Path $presetParent | Out-Null
    $fixtureRoots.Add($root)

    foreach ($name in $runtimeFiles) {
        Copy-Item -LiteralPath (Join-Path $sourceCandidate $name) -Destination (Join-Path $candidate $name)
    }
    Write-Utf8NoBom -Path (Join-Path $candidate 'test-preset.mjs') -Text "console.log('PASS fixture candidate gate');`n"

    return [pscustomobject]@{
        Root = $root
        Candidate = $candidate
        PresetParent = $presetParent
        Target = $target
        BackupRoot = $backupRoot
        Install = Join-Path $PSScriptRoot 'Install-GrokOptimizedPreset.ps1'
        Rollback = Join-Path $PSScriptRoot 'Rollback-GrokOptimizedPreset.ps1'
    }
}

function Invoke-FixtureInstall {
    param([Parameter(Mandatory = $true)]$Fixture)
    & $Fixture.Install -CandidateRoot $Fixture.Candidate -PresetParent $Fixture.PresetParent -BackupRoot $Fixture.BackupRoot -Apply | Out-Null
}

function Invoke-FixtureRollback {
    param(
        [Parameter(Mandatory = $true)]$Fixture,
        [Parameter(Mandatory = $true)][string]$RecordPath
    )
    & $Fixture.Rollback -RecordPath $RecordPath -CandidateRoot $Fixture.Candidate -PresetParent $Fixture.PresetParent -BackupRoot $Fixture.BackupRoot -Apply | Out-Null
}

function Get-OnlyInstallRecord {
    param([Parameter(Mandatory = $true)]$Fixture)
    $records = @(Get-ChildItem -LiteralPath $Fixture.BackupRoot -Filter 'install-record.json' -File -Recurse)
    if ($records.Count -ne 1) {
        throw "Expected exactly one fixture install record, found $($records.Count)."
    }
    return $records[0].FullName
}

function Read-Record {
    param([Parameter(Mandatory = $true)][string]$Path)
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
}

function Write-Record {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Record
    )
    Write-Utf8NoBom -Path $Path -Text ($Record | ConvertTo-Json -Depth 20)
}

function Assert-CandidatePayload {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [switch]$ReadOnly
    )
    $entries = @(Get-ChildItem -LiteralPath $Root -Force)
    if ($entries.Count -ne 2) {
        throw "Candidate fixture payload file count drifted at $Root"
    }
    foreach ($entry in @($runtimeManifest.files)) {
        $path = Join-Path $Root ([string]$entry.name)
        if ((Get-DeploymentFileSha256 -Path $path) -ne [string]$entry.sha256) {
            throw "Candidate fixture hash drifted: $path"
        }
        if ($ReadOnly -and -not (Get-Item -LiteralPath $path).IsReadOnly) {
            throw "Candidate fixture was not retained read-only: $path"
        }
    }
}

function Add-PreviousPresetFixture {
    param([Parameter(Mandatory = $true)]$Fixture)
    New-Item -ItemType Directory -Path (Join-Path $Fixture.Target 'nested\deeper') | Out-Null
    Write-Utf8NoBom -Path (Join-Path $Fixture.Target 'root.txt') -Text "previous-root`n"
    Write-Utf8NoBom -Path (Join-Path $Fixture.Target 'nested\deeper\state.txt') -Text "previous-nested`n"
    return Get-DeploymentTreeSnapshot -Root $Fixture.Target
}

function Remove-TransactionFixture {
    param([Parameter(Mandatory = $true)][string]$Root)
    $full = [IO.Path]::GetFullPath($Root).TrimEnd('\')
    $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    $leaf = Split-Path -Leaf $full
    if (-not $full.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -or -not $leaf.StartsWith('dsh-grok-preset-transaction-', [StringComparison]::Ordinal)) {
        throw "Refuse fixture cleanup outside the exact temporary boundary: $full"
    }
    if (Test-Path -LiteralPath $full) {
        Remove-Item -LiteralPath $full -Recurse -Force
    }
}

try {
    # P1: first install rollback retains both the production target and a recovery
    # copy, marks both runtime payloads read-only, then re-verifies hashes.
    $first = New-TransactionFixture -Name 'first-install'
    Invoke-FixtureInstall -Fixture $first
    $firstRecordPath = Get-OnlyInstallRecord -Fixture $first
    Invoke-FixtureRollback -Fixture $first -RecordPath $firstRecordPath
    $firstRecord = Read-Record -Path $firstRecordPath
    if ($firstRecord.status -ne 'rollback-retained-for-session-compatibility') {
        throw "First-install rollback ended in unexpected state: $($firstRecord.status)"
    }
    Assert-CandidatePayload -Root $first.Target -ReadOnly
    Assert-CandidatePayload -Root ([string]$firstRecord.retainedCandidatePath) -ReadOnly
    Write-Output 'PASS first-install rollback retains and rehashes read-only production runtime files'

    # Normal existing-target install/rollback records and restores the complete
    # nested recursive tree, not only the two candidate filenames.
    $normal = New-TransactionFixture -Name 'existing-normal'
    $normalPrevious = Add-PreviousPresetFixture -Fixture $normal
    Invoke-FixtureInstall -Fixture $normal
    $normalRecordPath = Get-OnlyInstallRecord -Fixture $normal
    $normalRecord = Read-Record -Path $normalRecordPath
    if ([string]$normalRecord.previousSnapshot.treeSha256 -ne [string]$normalPrevious.treeSha256) {
        throw 'Install record did not freeze the previous recursive tree SHA-256.'
    }
    Invoke-FixtureRollback -Fixture $normal -RecordPath $normalRecordPath
    [void](Assert-DeploymentTreeSnapshot -Root $normal.Target -Expected $normalPrevious -Label 'normal restored fixture')
    $normalRecord = Read-Record -Path $normalRecordPath
    Assert-CandidatePayload -Root ([string]$normalRecord.retainedCandidatePath) -ReadOnly
    Write-Output 'PASS existing-target rollback verifies and restores complete recursive snapshot'

    # P2: previous backup content drift is rejected before the production target
    # is moved, leaving the installed candidate untouched.
    $drift = New-TransactionFixture -Name 'previous-drift'
    [void](Add-PreviousPresetFixture -Fixture $drift)
    Invoke-FixtureInstall -Fixture $drift
    $driftRecordPath = Get-OnlyInstallRecord -Fixture $drift
    $driftRecord = Read-Record -Path $driftRecordPath
    Write-Utf8NoBom -Path (Join-Path ([string]$driftRecord.previousPath) 'root.txt') -Text "tampered-previous`n"
    $driftRejected = $false
    try {
        Invoke-FixtureRollback -Fixture $drift -RecordPath $driftRecordPath
    }
    catch {
        if ($_.Exception.Message -notmatch '(?:snapshot|manifest).*drifted') {
            throw
        }
        $driftRejected = $true
    }
    if (-not $driftRejected) {
        throw 'Tampered previous backup was not rejected.'
    }
    Assert-CandidatePayload -Root $drift.Target
    Write-Output 'PASS previous backup drift rejected before production mutation'

    # A rollback record is data, not authority. A forged operation identity must
    # fail before any recorded path is used for a move.
    $forged = New-TransactionFixture -Name 'forged-record'
    [void](Add-PreviousPresetFixture -Fixture $forged)
    Invoke-FixtureInstall -Fixture $forged
    $forgedRecordPath = Get-OnlyInstallRecord -Fixture $forged
    $forgedRecord = Read-Record -Path $forgedRecordPath
    $forgedRecord.operationId = '..\escaped-operation'
    Write-Record -Path $forgedRecordPath -Record $forgedRecord
    $forgedRejected = $false
    try {
        Invoke-FixtureRollback -Fixture $forged -RecordPath $forgedRecordPath
    }
    catch {
        if ($_.Exception.Message -notmatch 'operationId is invalid') {
            throw
        }
        $forgedRejected = $true
    }
    if (-not $forgedRejected) {
        throw 'Forged rollback operation identity was not rejected.'
    }
    Assert-CandidatePayload -Root $forged.Target
    Write-Output 'PASS forged rollback operation identity rejected before mutation'

    # P2: simulate a process interruption after the previous target was backed up
    # but before the prepared candidate was promoted. Rollback must preserve the
    # prepared candidate and restore the verified old tree.
    $interrupted = New-TransactionFixture -Name 'previous-backed-up'
    $interruptedPrevious = Add-PreviousPresetFixture -Fixture $interrupted
    Invoke-FixtureInstall -Fixture $interrupted
    $interruptedRecordPath = Get-OnlyInstallRecord -Fixture $interrupted
    $interruptedRecord = Read-Record -Path $interruptedRecordPath
    Move-Item -LiteralPath $interrupted.Target -Destination ([string]$interruptedRecord.temporaryTarget)
    $interruptedRecord.status = 'previous-backed-up'
    Write-Record -Path $interruptedRecordPath -Record $interruptedRecord
    Invoke-FixtureRollback -Fixture $interrupted -RecordPath $interruptedRecordPath
    [void](Assert-DeploymentTreeSnapshot -Root $interrupted.Target -Expected $interruptedPrevious -Label 'interrupted restored fixture')
    $interruptedRecord = Read-Record -Path $interruptedRecordPath
    if ($interruptedRecord.status -ne 'rolled-back') {
        throw "Interrupted rollback ended in unexpected state: $($interruptedRecord.status)"
    }
    Assert-CandidatePayload -Root ([string]$interruptedRecord.interruptedPreparedCandidatePath) -ReadOnly
    Write-Output 'PASS previous-backed-up interruption restores old target and preserves prepared candidate'
}
finally {
    foreach ($root in $fixtureRoots) {
        Remove-TransactionFixture -Root $root
    }
}
