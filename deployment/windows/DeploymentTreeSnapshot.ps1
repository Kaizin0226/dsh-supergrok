Set-StrictMode -Version Latest

function Get-DeploymentFileSha256 {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $stream = [IO.File]::Open(
        [IO.Path]::GetFullPath($Path),
        [IO.FileMode]::Open,
        [IO.FileAccess]::Read,
        [IO.FileShare]::Read
    )
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '')
    }
    finally {
        $sha.Dispose()
        $stream.Dispose()
    }
}

function Get-DeploymentTreeSnapshot {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
        throw "Tree snapshot root is not a directory: $Root"
    }

    $rootItem = Get-Item -LiteralPath $Root -Force
    if (($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Tree snapshot root cannot be a reparse point: $Root"
    }

    $rootPath = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Root).Path).TrimEnd('\')
    $rootPrefix = $rootPath + '\'
    $entryMap = [Collections.Generic.Dictionary[string, object]]::new([StringComparer]::Ordinal)

    function Visit-DeploymentTreeDirectory {
        param([Parameter(Mandatory = $true)][string]$Directory)

        foreach ($item in @(Get-ChildItem -LiteralPath $Directory -Force)) {
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Tree snapshot rejects reparse points: $($item.FullName)"
            }

            $fullPath = [IO.Path]::GetFullPath($item.FullName)
            if (-not $fullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
                throw "Tree entry escaped the snapshot root: $fullPath"
            }
            $relativePath = $fullPath.Substring($rootPrefix.Length).Replace('\', '/').Normalize([Text.NormalizationForm]::FormC)
            if ([string]::IsNullOrWhiteSpace($relativePath) -or $relativePath.StartsWith('../', [StringComparison]::Ordinal)) {
                throw "Tree entry has an invalid normalized relative path: $fullPath"
            }
            if ($entryMap.ContainsKey($relativePath)) {
                throw "Tree contains duplicate normalized relative path: $relativePath"
            }

            if ($item.PSIsContainer) {
                $entryMap.Add($relativePath, [pscustomobject][ordered]@{
                    kind = 'directory'
                    relativePath = $relativePath
                })
                Visit-DeploymentTreeDirectory -Directory $fullPath
                continue
            }
            if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
                throw "Tree contains a non-file, non-directory entry: $fullPath"
            }
            $entryMap.Add($relativePath, [pscustomobject][ordered]@{
                kind = 'file'
                relativePath = $relativePath
                bytes = [long]$item.Length
                sha256 = Get-DeploymentFileSha256 -Path $fullPath
            })
        }
    }

    Visit-DeploymentTreeDirectory -Directory $rootPath

    [string[]]$paths = @($entryMap.Keys)
    [Array]::Sort($paths, [StringComparer]::Ordinal)
    $entries = [Collections.Generic.List[object]]::new()
    $canonicalStream = [IO.MemoryStream]::new()
    $utf8 = [Text.UTF8Encoding]::new($false)
    [long]$totalBytes = 0
    [int]$fileCount = 0
    [int]$directoryCount = 0

    foreach ($path in $paths) {
        $entry = $entryMap[$path]
        $entries.Add($entry)
        $fields = if ($entry.kind -eq 'file') {
            @([string]$entry.kind, [string]$entry.relativePath, [string]$entry.bytes, [string]$entry.sha256)
        }
        else {
            @([string]$entry.kind, [string]$entry.relativePath)
        }
        foreach ($field in $fields) {
            $fieldBytes = $utf8.GetBytes($field)
            $canonicalStream.Write($fieldBytes, 0, $fieldBytes.Length)
            $canonicalStream.WriteByte(0)
        }
        if ($entry.kind -eq 'file') {
            $fileCount++
            $totalBytes += [long]$entry.bytes
        }
        else {
            $directoryCount++
        }
    }

    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $canonicalStream.Position = 0
        $treeSha256 = ([BitConverter]::ToString($sha.ComputeHash($canonicalStream))).Replace('-', '')
    }
    finally {
        $sha.Dispose()
        $canonicalStream.Dispose()
    }

    return [pscustomobject][ordered]@{
        algorithm = 'dsh-preset-recursive-fields-v1'
        pathNormalization = 'relative slash-separated Unicode NFC; ordinal sort; reparse points rejected'
        fileCount = $fileCount
        directoryCount = $directoryCount
        totalBytes = $totalBytes
        treeSha256 = $treeSha256
        entries = [object[]]$entries.ToArray()
    }
}

function Assert-DeploymentTreeSnapshot {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,

        [Parameter(Mandatory = $true)]
        $Expected,

        [string]$Label = 'tree'
    )

    if ([string]$Expected.algorithm -ne 'dsh-preset-recursive-fields-v1') {
        throw "$Label snapshot uses an unsupported algorithm: $($Expected.algorithm)"
    }

    $actual = Get-DeploymentTreeSnapshot -Root $Root
    foreach ($field in @('algorithm', 'pathNormalization', 'fileCount', 'directoryCount', 'totalBytes', 'treeSha256')) {
        if ([string]$actual.$field -cne [string]$Expected.$field) {
            throw "$Label snapshot drifted at $field; refuse mutation."
        }
    }

    $actualEntries = @($actual.entries)
    $expectedEntries = @($Expected.entries)
    if ($actualEntries.Count -ne $expectedEntries.Count) {
        throw "$Label recursive manifest entry count drifted; refuse mutation."
    }
    for ($index = 0; $index -lt $actualEntries.Count; $index++) {
        $actualEntry = $actualEntries[$index]
        $expectedEntry = $expectedEntries[$index]
        foreach ($field in @('kind', 'relativePath')) {
            if ([string]$actualEntry.$field -cne [string]$expectedEntry.$field) {
                throw "$Label recursive manifest drifted at entry $index field $field; refuse mutation."
            }
        }
        if ($actualEntry.kind -eq 'file') {
            foreach ($field in @('bytes', 'sha256')) {
                if ([string]$actualEntry.$field -cne [string]$expectedEntry.$field) {
                    throw "$Label recursive manifest drifted at entry $index field $field; refuse mutation."
                }
            }
        }
    }
    return $actual
}
