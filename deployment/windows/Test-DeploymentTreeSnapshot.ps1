[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'DeploymentTreeSnapshot.ps1')

$snapshot = Get-DeploymentTreeSnapshot -Root $PSScriptRoot
[void](Assert-DeploymentTreeSnapshot -Root $PSScriptRoot -Expected $snapshot -Label 'candidate self-test')

$paths = @($snapshot.entries | ForEach-Object { [string]$_.relativePath })
foreach ($expectedPath in @(
    'tests',
    'tests/recursive-tree',
    'tests/recursive-tree/level-a',
    'tests/recursive-tree/level-a/sample.txt'
)) {
    if ($expectedPath -notin $paths) {
        throw "Recursive snapshot omitted fixture entry: $expectedPath"
    }
}

$drifted = $snapshot | ConvertTo-Json -Depth 20 | ConvertFrom-Json
$drifted.treeSha256 = '0' * 64
$rejected = $false
try {
    [void](Assert-DeploymentTreeSnapshot -Root $PSScriptRoot -Expected $drifted -Label 'synthetic drift')
}
catch {
    if ($_.Exception.Message -notmatch 'snapshot drifted') {
        throw
    }
    $rejected = $true
}
if (-not $rejected) {
    throw 'Synthetic recursive tree drift was not rejected.'
}

Write-Output 'PASS normalized complete recursive manifest'
Write-Output 'PASS recursive tree snapshot self-verification'
Write-Output 'PASS synthetic previous-tree drift rejected fail-closed'
