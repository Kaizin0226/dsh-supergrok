[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RecordPath,

    [Parameter(Mandatory = $true)]
    [string]$CandidateRoot,

    [Parameter(Mandatory = $true)]
    [string]$PresetParent,

    [Parameter(Mandatory = $true)]
    [string]$BackupRoot,

    [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$fixedCandidateRoot = [IO.Path]::GetFullPath($CandidateRoot)
$fixedPresetParent = [IO.Path]::GetFullPath($PresetParent)
$fixedTarget = Join-Path $fixedPresetParent 'grok-optimized'
$fixedBackupRoot = [IO.Path]::GetFullPath($BackupRoot)
$runtimeFiles = @('preset.yml', 'agent.cordis.yml')

. (Join-Path $PSScriptRoot 'DeploymentTreeSnapshot.ps1')

function Get-NormalizedFullPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    return [IO.Path]::GetFullPath($Path).TrimEnd('\')
}

function Assert-ExactPath {
    param(
        [Parameter(Mandatory = $true)][string]$Actual,
        [Parameter(Mandatory = $true)][string]$Expected,
        [Parameter(Mandatory = $true)][string]$Label
    )
    if (-not [string]::Equals(
        (Get-NormalizedFullPath $Actual),
        (Get-NormalizedFullPath $Expected),
        [StringComparison]::OrdinalIgnoreCase
    )) {
        throw "$Label path is outside the fixed rollback boundary: $Actual"
    }
}

function Assert-PathUnderRoot {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Label
    )
    $fullPath = Get-NormalizedFullPath $Path
    $fullRoot = Get-NormalizedFullPath $Root
    $prefix = $fullRoot + '\'
    if (-not $fullPath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label path is outside the fixed backup root: $Path"
    }
}

function Test-OrdinaryDirectory {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        return $false
    }
    $item = Get-Item -LiteralPath $Path -Force
    return (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0)
}

function Test-OrdinaryFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $false
    }
    $item = Get-Item -LiteralPath $Path -Force
    return (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0)
}

function Test-ExactRuntimePayload {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)]$ExpectedHashes
    )
    if (-not (Test-OrdinaryDirectory -Path $Root)) {
        return $false
    }
    $entries = @(Get-ChildItem -LiteralPath $Root -Force)
    if ($entries.Count -ne $runtimeFiles.Count) {
        return $false
    }
    foreach ($name in $runtimeFiles) {
        $path = Join-Path $Root $name
        if (-not (Test-OrdinaryFile -Path $path)) {
            return $false
        }
        $expected = [string]$ExpectedHashes.$name
        if ((Get-DeploymentFileSha256 -Path $path) -ne $expected) {
            return $false
        }
    }
    return $true
}

function Assert-InstalledHashes {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)]$ExpectedHashes
    )
    if (-not (Test-ExactRuntimePayload -Root $Root -ExpectedHashes $ExpectedHashes)) {
        throw "Installed candidate payload drifted; refuse rollback: $Root"
    }
}

function Set-RuntimeFilesReadOnly {
    param([Parameter(Mandatory = $true)][string]$Root)
    foreach ($name in $runtimeFiles) {
        $item = Get-Item -LiteralPath (Join-Path $Root $name)
        $item.IsReadOnly = $true
    }
}

function Set-RuntimeFilesWritable {
    param([Parameter(Mandatory = $true)][string]$Root)
    foreach ($name in $runtimeFiles) {
        $item = Get-Item -LiteralPath (Join-Path $Root $name)
        $item.IsReadOnly = $false
    }
}

function Assert-RuntimeFilesReadOnly {
    param([Parameter(Mandatory = $true)][string]$Root)
    foreach ($name in $runtimeFiles) {
        $item = Get-Item -LiteralPath (Join-Path $Root $name)
        if (-not $item.IsReadOnly) {
            throw "Retained runtime file is not read-only: $($item.FullName)"
        }
    }
}

function Test-TreeMatchesSnapshot {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)]$Expected
    )
    try {
        [void](Assert-DeploymentTreeSnapshot -Root $Root -Expected $Expected -Label 'state probe')
        return $true
    }
    catch {
        if ($_.Exception.Message -match '(?:snapshot|manifest).*drifted') {
            return $false
        }
        throw
    }
}

function Write-Record {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Record
    )
    $json = $Record | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($Path, $json, [Text.UTF8Encoding]::new($false))
}

if (-not (Test-OrdinaryFile -Path $RecordPath)) {
    throw "Rollback record does not exist: $RecordPath"
}
$resolvedRecord = (Resolve-Path -LiteralPath $RecordPath).Path
Assert-PathUnderRoot -Path $resolvedRecord -Root $fixedBackupRoot -Label 'Rollback record'
if (-not (Test-OrdinaryDirectory -Path $fixedPresetParent)) {
    throw "Fixed production preset parent must be an ordinary non-reparse directory: $fixedPresetParent"
}
if (-not (Test-OrdinaryDirectory -Path $fixedBackupRoot)) {
    throw "Fixed backup root must be an ordinary non-reparse directory: $fixedBackupRoot"
}

$record = Get-Content -Raw -LiteralPath $resolvedRecord | ConvertFrom-Json
if ($record.schemaVersion -ne 2) {
    throw "Unsupported rollback record schema: $($record.schemaVersion)"
}
Assert-ExactPath -Actual ([string]$record.target) -Expected $fixedTarget -Label 'Recorded target'
Assert-ExactPath -Actual ([string]$record.candidateRoot) -Expected $fixedCandidateRoot -Label 'Recorded candidate root'
Assert-PathUnderRoot -Path ([string]$record.backupRoot) -Root $fixedBackupRoot -Label 'Recorded backup root'
$recordRoot = [string]$record.backupRoot
Assert-ExactPath -Actual (Split-Path -Parent $resolvedRecord) -Expected $recordRoot -Label 'Record directory'
if (-not (Test-OrdinaryDirectory -Path $recordRoot)) {
    throw "Record root must be an ordinary non-reparse directory: $recordRoot"
}
$operationId = [string]$record.operationId
if ($operationId -cnotmatch '^[0-9a-f]{32}$') {
    throw "Rollback record operationId is invalid: $operationId"
}
$recordLeaf = Split-Path -Leaf $recordRoot
if ($recordLeaf -cnotmatch "^install-[0-9]{8}T[0-9]{6}Z-$operationId$") {
    throw "Rollback record directory does not match its operation identity: $recordLeaf"
}
if ($record.hadExistingTarget -isnot [bool]) {
    throw 'Rollback record hadExistingTarget must be a boolean.'
}
$hashProperties = @($record.candidateHashes.PSObject.Properties)
if ($hashProperties.Count -ne $runtimeFiles.Count) {
    throw 'Rollback record candidateHashes has an unexpected file set.'
}
foreach ($name in $runtimeFiles) {
    $property = $record.candidateHashes.PSObject.Properties[$name]
    if ($null -eq $property -or [string]$property.Value -cnotmatch '^[A-F0-9]{64}$') {
        throw "Rollback record candidate hash is invalid: $name"
    }
}

if ($record.status -eq 'rollback-retained-for-session-compatibility') {
    Assert-InstalledHashes -Root $fixedTarget -ExpectedHashes $record.candidateHashes
    Assert-RuntimeFilesReadOnly -Root $fixedTarget
    $terminalRetained = [string]$record.retainedCandidatePath
    Assert-ExactPath -Actual $terminalRetained -Expected (Join-Path $recordRoot 'retained-candidate') -Label 'Retained candidate'
    Assert-InstalledHashes -Root $terminalRetained -ExpectedHashes $record.candidateHashes
    Assert-RuntimeFilesReadOnly -Root $terminalRetained
    Write-Output "Rollback record is already terminal and verified: $($record.status)"
    exit 0
}
if ($record.status -eq 'rolled-back') {
    if (-not [bool]$record.hadExistingTarget) {
        throw 'A rolled-back record without a previous target is invalid.'
    }
    [void](Assert-DeploymentTreeSnapshot -Root $fixedTarget -Expected $record.previousSnapshot -Label 'terminal restored preset')
    foreach ($path in @([string]$record.retainedCandidatePath, [string]$record.interruptedPreparedCandidatePath)) {
        if (-not [string]::IsNullOrWhiteSpace($path)) {
            Assert-PathUnderRoot -Path $path -Root $recordRoot -Label 'Terminal candidate copy'
            Assert-InstalledHashes -Root $path -ExpectedHashes $record.candidateHashes
            Assert-RuntimeFilesReadOnly -Root $path
        }
    }
    Write-Output "Rollback record is already terminal and verified: $($record.status)"
    exit 0
}

$recoverableStatuses = @('installed', 'prepared', 'previous-backup-pending', 'previous-backed-up')
if ($record.status -notin $recoverableStatuses) {
    throw "Rollback record is not safely recoverable; current status is $($record.status)"
}

Write-Output "Fixed target: $fixedTarget"
Write-Output "Rollback record: $resolvedRecord"
Write-Output "Recorded state: $($record.status)"
Write-Output 'Settings, processes, model routes and existing session data are outside this script.'

if (-not [bool]$record.hadExistingTarget) {
    if ($record.status -ne 'installed') {
        throw "A first-install rollback requires installed state; current status is $($record.status)"
    }
    Assert-ExactPath -Actual (Resolve-Path -LiteralPath $fixedTarget).Path -Expected $fixedTarget -Label 'Installed target'
    Assert-InstalledHashes -Root $fixedTarget -ExpectedHashes $record.candidateHashes

    $retainedPath = Join-Path $recordRoot 'retained-candidate'
    Write-Output 'No previous preset existed. The installed preset will remain available so existing sessions keep resolving it.'
    Write-Output "The production runtime files and recovery copy will both be read-only: $retainedPath"
    if (-not $Apply) {
        Write-Output 'DRY RUN PASS. Re-run with -Apply only after the rollback action is authorized.'
        exit 0
    }

    if (Test-Path -LiteralPath $retainedPath) {
        Assert-InstalledHashes -Root $retainedPath -ExpectedHashes $record.candidateHashes
    }
    else {
        New-Item -ItemType Directory -Path $retainedPath | Out-Null
        foreach ($name in $runtimeFiles) {
            Copy-Item -LiteralPath (Join-Path $fixedTarget $name) -Destination (Join-Path $retainedPath $name)
        }
    }

    Set-RuntimeFilesReadOnly -Root $fixedTarget
    Set-RuntimeFilesReadOnly -Root $retainedPath
    Assert-InstalledHashes -Root $fixedTarget -ExpectedHashes $record.candidateHashes
    Assert-RuntimeFilesReadOnly -Root $fixedTarget
    Assert-InstalledHashes -Root $retainedPath -ExpectedHashes $record.candidateHashes
    Assert-RuntimeFilesReadOnly -Root $retainedPath

    $record.status = 'rollback-retained-for-session-compatibility'
    $record.rolledBackAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    $record.retainedCandidatePath = $retainedPath
    Write-Record -Path $resolvedRecord -Record $record
    Write-Output "RETAINED READ-ONLY: $fixedTarget"
    Write-Output "READ-ONLY COPY: $retainedPath"
    exit 0
}

$previousSnapshot = $record.previousSnapshot
if ($null -eq $previousSnapshot) {
    throw 'Existing-target rollback record has no recursive previousSnapshot.'
}
$previousPath = [string]$record.previousPath
$expectedPrevious = Join-Path $recordRoot 'previous'
Assert-ExactPath -Actual $previousPath -Expected $expectedPrevious -Label 'Previous preset'

$expectedTemporary = Join-Path $fixedPresetParent (".grok-optimized.install-$($record.operationId)")
$temporaryTarget = [string]$record.temporaryTarget
Assert-ExactPath -Actual $temporaryTarget -Expected $expectedTemporary -Label 'Prepared candidate'

$previousExists = Test-Path -LiteralPath $previousPath -PathType Container
$targetExists = Test-Path -LiteralPath $fixedTarget -PathType Container
$temporaryExists = Test-Path -LiteralPath $temporaryTarget -PathType Container
foreach ($path in @($previousPath, $fixedTarget, $temporaryTarget)) {
    if ((Test-Path -LiteralPath $path) -and -not (Test-Path -LiteralPath $path -PathType Container)) {
        throw "Rollback state path exists but is not a directory: $path"
    }
}

if ($previousExists) {
    [void](Assert-DeploymentTreeSnapshot -Root $previousPath -Expected $previousSnapshot -Label 'previous preset before rollback')
}
if ($temporaryExists) {
    Assert-InstalledHashes -Root $temporaryTarget -ExpectedHashes $record.candidateHashes
}

$targetState = 'absent'
if ($targetExists) {
    if (Test-ExactRuntimePayload -Root $fixedTarget -ExpectedHashes $record.candidateHashes) {
        $targetState = 'candidate'
    }
    elseif (Test-TreeMatchesSnapshot -Root $fixedTarget -Expected $previousSnapshot) {
        $targetState = 'previous'
    }
    else {
        throw "Production target matches neither the candidate nor the recorded previous tree: $fixedTarget"
    }
}

if ($record.status -eq 'installed' -and (-not $previousExists -or $targetState -ne 'candidate')) {
    throw 'Installed rollback record topology is incomplete or drifted.'
}
if (-not $previousExists -and $targetState -ne 'previous') {
    throw 'Interrupted install has neither a verified previous backup nor the verified previous target in place.'
}

$rolledBackCandidate = Join-Path $recordRoot 'rolled-back-candidate'
$interruptedPreparedCandidate = Join-Path $recordRoot 'interrupted-prepared-candidate'
if ($targetState -eq 'candidate' -and (Test-Path -LiteralPath $rolledBackCandidate)) {
    throw "Rollback candidate destination already exists: $rolledBackCandidate"
}
if ($temporaryExists -and (Test-Path -LiteralPath $interruptedPreparedCandidate)) {
    throw "Interrupted prepared candidate destination already exists: $interruptedPreparedCandidate"
}

Write-Output "Previous preset backup present: $previousExists"
Write-Output "Production target state: $targetState"
Write-Output "Prepared candidate still present: $temporaryExists"
if (-not $Apply) {
    Write-Output 'DRY RUN PASS. Re-run with -Apply only after the rollback action is authorized.'
    exit 0
}

try {
    if ($targetState -eq 'candidate') {
        Move-Item -LiteralPath $fixedTarget -Destination $rolledBackCandidate
        Assert-InstalledHashes -Root $rolledBackCandidate -ExpectedHashes $record.candidateHashes
    }
    if ($temporaryExists) {
        Move-Item -LiteralPath $temporaryTarget -Destination $interruptedPreparedCandidate
        Assert-InstalledHashes -Root $interruptedPreparedCandidate -ExpectedHashes $record.candidateHashes
    }

    if (-not (Test-Path -LiteralPath $fixedTarget)) {
        [void](Assert-DeploymentTreeSnapshot -Root $previousPath -Expected $previousSnapshot -Label 'previous preset immediately before restore')
        Move-Item -LiteralPath $previousPath -Destination $fixedTarget
    }
    [void](Assert-DeploymentTreeSnapshot -Root $fixedTarget -Expected $previousSnapshot -Label 'restored previous preset')

    foreach ($path in @($rolledBackCandidate, $interruptedPreparedCandidate)) {
        if (Test-Path -LiteralPath $path -PathType Container) {
            Set-RuntimeFilesReadOnly -Root $path
            Assert-InstalledHashes -Root $path -ExpectedHashes $record.candidateHashes
            Assert-RuntimeFilesReadOnly -Root $path
        }
    }

    $record.status = 'rolled-back'
    $record.rolledBackAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    $record.retainedCandidatePath = if (Test-Path -LiteralPath $rolledBackCandidate) { $rolledBackCandidate } else { $null }
    $record.interruptedPreparedCandidatePath = if (Test-Path -LiteralPath $interruptedPreparedCandidate) { $interruptedPreparedCandidate } else { $null }
    Write-Record -Path $resolvedRecord -Record $record
    Write-Output "RESTORED AND VERIFIED: $fixedTarget"
    if ($null -ne $record.retainedCandidatePath) {
        Write-Output "READ-ONLY CANDIDATE COPY: $($record.retainedCandidatePath)"
    }
    if ($null -ne $record.interruptedPreparedCandidatePath) {
        Write-Output "READ-ONLY PREPARED COPY: $($record.interruptedPreparedCandidatePath)"
    }
}
catch {
    if (-not (Test-Path -LiteralPath $fixedTarget)) {
        if (Test-Path -LiteralPath $previousPath -PathType Container) {
            [void](Assert-DeploymentTreeSnapshot -Root $previousPath -Expected $previousSnapshot -Label 'previous preset during rollback recovery')
            Move-Item -LiteralPath $previousPath -Destination $fixedTarget
        }
        elseif (Test-Path -LiteralPath $rolledBackCandidate -PathType Container) {
            Set-RuntimeFilesWritable -Root $rolledBackCandidate
            Assert-InstalledHashes -Root $rolledBackCandidate -ExpectedHashes $record.candidateHashes
            Move-Item -LiteralPath $rolledBackCandidate -Destination $fixedTarget
        }
    }
    throw
}
