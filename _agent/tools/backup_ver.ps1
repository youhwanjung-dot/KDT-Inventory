param([string]$TargetVer = "Ver1.0.0")

$src = "D:\M_PROJECT\KDT-Inventory_3500"
$backupRoot = Join-Path $src "backup"
$dst = Join-Path $backupRoot $TargetVer
$exclude = @("backup","node_modules",".git","dist","functions\lib",".firebase","functions\node_modules")
$retainCount = 5

function Get-VersionTuple {
    param([string]$FolderName)

    if ($FolderName -match '^Ver(\d+)\.(\d+)\.(\d+)$') {
        return [PSCustomObject]@{
            Major = [int]$Matches[1]
            Minor = [int]$Matches[2]
            Patch = [int]$Matches[3]
        }
    }

    return [PSCustomObject]@{
        Major = -1
        Minor = -1
        Patch = -1
    }
}

New-Item -ItemType Directory -Force -Path $dst | Out-Null

Get-ChildItem -Path $src -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length + 1)
    $skip = $false
    foreach ($ex in $exclude) {
        if ($rel.StartsWith($ex)) { $skip = $true; break }
    }
    if (-not $skip) {
        $target = Join-Path $dst $rel
        $dir = Split-Path $target -Parent
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        Copy-Item $_.FullName -Destination $target -Force
    }
}

Get-ChildItem -Path $backupRoot -Directory |
    Sort-Object `
        @{ Expression = { (Get-VersionTuple $_.Name).Major }; Descending = $true }, `
        @{ Expression = { (Get-VersionTuple $_.Name).Minor }; Descending = $true }, `
        @{ Expression = { (Get-VersionTuple $_.Name).Patch }; Descending = $true } |
    Select-Object -Skip $retainCount |
    ForEach-Object {
        Remove-Item $_.FullName -Recurse -Force
        Write-Host "Pruned old backup -> $($_.FullName)"
    }

Write-Host "Backup $TargetVer complete -> $dst"
