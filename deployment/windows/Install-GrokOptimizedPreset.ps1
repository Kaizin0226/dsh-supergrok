[CmdletBinding()]
param(
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
        throw "$Label path is outside the fixed deployment boundary: $Actual"
    }
}

function Get-FileHashes {
    param([Parameter(Mandatory = $true)][string]$Root)
    $result = [ordered]@{}
    foreach ($name in $runtimeFiles) {
        $path = Join-Path $Root $name
        if (-not (Test-OrdinaryFile -Path $path)) {
            throw "Required runtime file is missing or is a reparse point: $path"
        }
        $result[$name] = Get-DeploymentFileSha256 -Path $path
    }
    return $result
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
        if ((Get-DeploymentFileSha256 -Path $path) -ne $ExpectedHashes[$name]) {
            return $false
        }
    }
    return $true
}

function Write-InstallRecord {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Record
    )
    $json = $Record | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($Path, $json, [Text.UTF8Encoding]::new($false))
}

Assert-ExactPath -Actual $fixedTarget -Expected $fixedTarget -Label 'Target'
if (-not (Test-OrdinaryDirectory -Path $fixedCandidateRoot)) {
    throw "Candidate root must be an ordinary non-reparse directory: $fixedCandidateRoot"
}

if (-not (Test-OrdinaryDirectory -Path $fixedPresetParent)) {
    throw "Fixed production preset parent does not exist: $fixedPresetParent"
}
Assert-ExactPath -Actual (Resolve-Path -LiteralPath $fixedPresetParent).Path -Expected $fixedPresetParent -Label 'Preset parent'

$node = Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1
& $node.Source (Join-Path $fixedCandidateRoot 'test-preset.mjs')
if ($LASTEXITCODE -ne 0) {
    throw "Candidate/base verification failed with exit code $LASTEXITCODE"
}

$candidateHashes = Get-FileHashes -Root $fixedCandidateRoot
if ((Test-Path -LiteralPath $fixedTarget) -and -not (Test-Path -LiteralPath $fixedTarget -PathType Container)) {
    throw "Fixed target exists but is not a directory: $fixedTarget"
}
if (Test-ExactRuntimePayload -Root $fixedTarget -ExpectedHashes $candidateHashes) {
    Write-Output "Already installed and hash-identical: $fixedTarget"
    exit 0
}

Write-Output "Candidate: $fixedCandidateRoot"
Write-Output "Fixed target: $fixedTarget"
Write-Output "Backup root: $fixedBackupRoot"
Write-Output 'Settings, processes, model routes and existing session data are outside this script.'
if (Test-Path -LiteralPath $fixedTarget -PathType Container) {
    $dryRunSnapshot = Get-DeploymentTreeSnapshot -Root $fixedTarget
    Write-Output "Existing target recursive tree SHA-256: $($dryRunSnapshot.treeSha256)"
    Write-Output "Existing target manifest entries: $(@($dryRunSnapshot.entries).Count)"
}
if (-not $Apply) {
    Write-Output 'DRY RUN PASS. Re-run with -Apply only after the deployment action is authorized.'
    exit 0
}

$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$operationId = [Guid]::NewGuid().ToString('N')
$recordRoot = Join-Path $fixedBackupRoot ("install-$stamp-$operationId")
$recordPath = Join-Path $recordRoot 'install-record.json'
$previousPath = Join-Path $recordRoot 'previous'
$failedCandidatePath = Join-Path $recordRoot 'failed-candidate'
$temporaryTarget = Join-Path $fixedPresetParent (".grok-optimized.install-$operationId")

New-Item -ItemType Directory -Path $recordRoot | Out-Null
New-Item -ItemType Directory -Path $temporaryTarget | Out-Null
foreach ($name in $runtimeFiles) {
    Copy-Item -LiteralPath (Join-Path $fixedCandidateRoot $name) -Destination (Join-Path $temporaryTarget $name)
}
if (-not (Test-ExactRuntimePayload -Root $temporaryTarget -ExpectedHashes $candidateHashes)) {
    throw "Prepared payload failed local hash verification: $temporaryTarget"
}

$hadExisting = Test-Path -LiteralPath $fixedTarget -PathType Container
$previousSnapshot = if ($hadExisting) { Get-DeploymentTreeSnapshot -Root $fixedTarget } else { $null }
$record = [ordered]@{
    schemaVersion = 2
    operationId = $operationId
    status = 'prepared'
    installedAtUtc = $null
    rolledBackAtUtc = $null
    target = $fixedTarget
    candidateRoot = $fixedCandidateRoot
    backupRoot = $recordRoot
    hadExistingTarget = $hadExisting
    previousPath = if ($hadExisting) { $previousPath } else { $null }
    previousSnapshot = $previousSnapshot
    temporaryTarget = $temporaryTarget
    retainedCandidatePath = $null
    interruptedPreparedCandidatePath = $null
    candidateHashes = $candidateHashes
    settingsChanged = $false
    processActionTaken = $false
    sessionDataChanged = $false
    error = $null
    recoveryError = $null
}
Write-InstallRecord -Path $recordPath -Record $record

$previousMoved = $false
$candidateInstalled = $false
try {
    if ($hadExisting) {
        Assert-ExactPath -Actual (Resolve-Path -LiteralPath $fixedTarget).Path -Expected $fixedTarget -Label 'Existing target'
        $record.status = 'previous-backup-pending'
        Write-InstallRecord -Path $recordPath -Record $record
        Move-Item -LiteralPath $fixedTarget -Destination $previousPath
        $previousMoved = $true
        [void](Assert-DeploymentTreeSnapshot -Root $previousPath -Expected $previousSnapshot -Label 'moved previous preset')
        $record.status = 'previous-backed-up'
        Write-InstallRecord -Path $recordPath -Record $record
    }

    Move-Item -LiteralPath $temporaryTarget -Destination $fixedTarget
    $candidateInstalled = $true
    if (-not (Test-ExactRuntimePayload -Root $fixedTarget -ExpectedHashes $candidateHashes)) {
        throw "Installed payload failed hash verification: $fixedTarget"
    }

    $record.status = 'installed'
    $record.installedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    Write-InstallRecord -Path $recordPath -Record $record
    Write-Output "INSTALLED: $fixedTarget"
    Write-Output "ROLLBACK RECORD: $recordPath"
}
catch {
    $originalError = $_
    $recoveryFailure = $null
    try {
        if ($candidateInstalled -and (Test-Path -LiteralPath $fixedTarget -PathType Container)) {
            if (-not (Test-ExactRuntimePayload -Root $fixedTarget -ExpectedHashes $candidateHashes)) {
                throw "Failed installed target no longer matches the candidate; refuse automatic recovery: $fixedTarget"
            }
            Move-Item -LiteralPath $fixedTarget -Destination $failedCandidatePath
        }

        if ($hadExisting) {
            if ($previousMoved) {
                [void](Assert-DeploymentTreeSnapshot -Root $previousPath -Expected $previousSnapshot -Label 'previous preset before install recovery')
                if (Test-Path -LiteralPath $fixedTarget) {
                    throw "Install recovery target is unexpectedly occupied: $fixedTarget"
                }
                Move-Item -LiteralPath $previousPath -Destination $fixedTarget
            }
            [void](Assert-DeploymentTreeSnapshot -Root $fixedTarget -Expected $previousSnapshot -Label 'restored previous preset')
        }
        elseif (Test-Path -LiteralPath $fixedTarget) {
            throw "First-install recovery expected an absent target but found: $fixedTarget"
        }
    }
    catch {
        $recoveryFailure = $_.Exception.Message
    }

    $record.status = if ($null -eq $recoveryFailure) { 'install-failed-restored' } else { 'install-failed-needs-rollback' }
    $record.error = $originalError.Exception.Message
    $record.recoveryError = $recoveryFailure
    Write-InstallRecord -Path $recordPath -Record $record
    if ($null -ne $recoveryFailure) {
        throw "Install failed: $($originalError.Exception.Message); automatic recovery also failed: $recoveryFailure"
    }
    throw $originalError
}
