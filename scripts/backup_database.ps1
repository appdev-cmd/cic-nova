$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$envPath = Join-Path $repoRoot 'backend\.env'
$backupDir = Join-Path $repoRoot 'backups'

if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Không tìm thấy backend\.env."
}

$config = @{}
foreach ($line in [System.IO.File]::ReadAllLines($envPath)) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#') -or -not $trimmed.Contains('=')) { continue }
    $key, $value = $trimmed.Split('=', 2)
    $config[$key.Trim()] = $value.Trim().Trim('"').Trim("'")
}

foreach ($required in 'SUPABASE_DB_HOST', 'SUPABASE_DB_USER', 'SUPABASE_DB_PASSWORD') {
    if (-not $config[$required]) { throw "Thiếu cấu hình $required trong backend\.env." }
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) { throw 'Không tìm thấy pg_dump trong PATH.' }

[System.IO.Directory]::CreateDirectory($backupDir) | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupPath = Join-Path $backupDir "cic_nova_$timestamp.dump"
$dbPort = if ($config['SUPABASE_DB_PORT']) { $config['SUPABASE_DB_PORT'] } else { '6543' }
$dbName = if ($config['SUPABASE_DB_NAME']) { $config['SUPABASE_DB_NAME'] } else { 'postgres' }
$env:PGPASSWORD = $config['SUPABASE_DB_PASSWORD']

try {
    & $pgDump.Source `
        --host $config['SUPABASE_DB_HOST'] `
        --port $dbPort `
        --username $config['SUPABASE_DB_USER'] `
        --dbname $dbName `
        --format custom `
        --no-owner `
        --file $backupPath
    if ($LASTEXITCODE -ne 0) { throw "pg_dump thất bại với mã $LASTEXITCODE." }
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Output "Đã tạo backup: $backupPath"
