# End-to-end: two buyer accounts on the same device must each increase
# visitors, sessions, and conversions independently.
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:5219'
$key = 'sc_live_sgFNnMn0Ot6nrMIhz0CKg876ss5qbZK9'
$siteId = '7dc12f9f-2b70-4e67-80ae-82fddcb529c2'
$clientId = 'c_e2e_' + [guid]::NewGuid().ToString('N').Substring(0, 10)

function Post-Collect($body) {
  $json = $body | ConvertTo-Json -Depth 8 -Compress
  $tmp = New-TemporaryFile
  [System.IO.File]::WriteAllText($tmp.FullName, $json)
  try {
    $res = curl.exe -s -w "`n%{http_code}" -X POST "$base/api/collect" -H "Content-Type: application/json" --data-binary "@$($tmp.FullName)"
    $lines = $res -split "`n"
    $code = $lines[-1]
    $bodyText = ($lines[0..($lines.Length - 2)] -join "`n")
    if ($code -ne '200' -and $code -ne '201' -and $code -ne '202' -and $code -ne '204') {
      throw "collect failed HTTP $code : $bodyText"
    }
    return $bodyText
  } finally {
    Remove-Item $tmp.FullName -ErrorAction SilentlyContinue
  }
}

function Get-Overview([string]$token) {
  $raw = curl.exe -s "$base/api/traffic/overview?siteId=$siteId&days=30" -H "Authorization: Bearer $token"
  return $raw | ConvertFrom-Json
}

function Login() {
  $body = '{"email":"azghanduplicate786@gmail.com","password":"aszdxfcgv"}'
  $tmp = New-TemporaryFile
  [System.IO.File]::WriteAllText($tmp.FullName, $body)
  try {
    $raw = curl.exe -s -X POST "$base/api/Auth/login" -H "Content-Type: application/json" --data-binary "@$($tmp.FullName)"
    $obj = $raw | ConvertFrom-Json
    if (-not $obj.accessToken) { throw "login failed: $raw" }
    return $obj.accessToken
  } finally {
    Remove-Item $tmp.FullName -ErrorAction SilentlyContinue
  }
}

Write-Host "Logging in for baseline overview..."
$token = Login
$before = Get-Overview $token
Write-Host ("BEFORE visitors={0} sessions={1} conversions={2} engagement={3}" -f $before.visitors, $before.sessions, $before.conversions, $before.engagementRate)

$userA = 'e2e_user_a_' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$userB = 'e2e_user_b_' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$orderA = 'ord_a_' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$orderB = 'ord_b_' + [guid]::NewGuid().ToString('N').Substring(0, 8)

Write-Host "Simulating account A ($userA) browse + purchase..."
Post-Collect @{
  trackingKey = $key
  eventType = 1
  pageUrl = 'https://price-hub-one.vercel.app/'
  metadata = @{ eventName = 'page_view'; clientId = $clientId; userId = $userA }
} | Out-Null
Post-Collect @{
  trackingKey = $key
  eventType = 2
  pageUrl = 'https://price-hub-one.vercel.app/cart'
  metadata = @{ eventName = 'click'; clientId = $clientId; userId = $userA; x = 10; y = 20 }
} | Out-Null
Post-Collect @{
  trackingKey = $key
  eventType = 1
  pageUrl = "https://price-hub-one.vercel.app/order/$orderA"
  metadata = @{ eventName = 'page_view'; clientId = $clientId; userId = $userA }
} | Out-Null
Post-Collect @{
  trackingKey = $key
  eventType = 4
  pageUrl = "https://price-hub-one.vercel.app/order/$orderA"
  metadata = @{
    eventName = 'order_completed'
    clientId = $clientId
    userId = $userA
    orderId = $orderA
    type = 'Purchase'
    value = 99
  }
} | Out-Null

Start-Sleep -Seconds 1
$mid = Get-Overview $token
Write-Host ("AFTER A visitors={0} sessions={1} conversions={2}" -f $mid.visitors, $mid.sessions, $mid.conversions)

$dv = $mid.visitors - $before.visitors
$ds = $mid.sessions - $before.sessions
$dc = $mid.conversions - $before.conversions
if ($dv -lt 1) { throw "Account A did not increase visitors (delta=$dv)" }
if ($ds -lt 1) { throw "Account A did not increase sessions (delta=$ds)" }
if ($dc -lt 1) { throw "Account A did not increase conversions (delta=$dc)" }

Write-Host "Simulating account B ($userB) on SAME clientId + purchase..."
Post-Collect @{
  trackingKey = $key
  eventType = 1
  pageUrl = 'https://price-hub-one.vercel.app/'
  metadata = @{ eventName = 'page_view'; clientId = $clientId; userId = $userB }
} | Out-Null
Post-Collect @{
  trackingKey = $key
  eventType = 3
  pageUrl = 'https://price-hub-one.vercel.app/catalog'
  metadata = @{ eventName = 'scroll_depth'; clientId = $clientId; userId = $userB; scrollDepth = 50 }
} | Out-Null
Post-Collect @{
  trackingKey = $key
  eventType = 4
  pageUrl = "https://price-hub-one.vercel.app/order/$orderB"
  metadata = @{
    eventName = 'order_completed'
    clientId = $clientId
    userId = $userB
    orderId = $orderB
    type = 'Purchase'
    value = 149
  }
} | Out-Null

Start-Sleep -Seconds 1
$after = Get-Overview $token
Write-Host ("AFTER B visitors={0} sessions={1} conversions={2} engagement={3}" -f $after.visitors, $after.sessions, $after.conversions, $after.engagementRate)

$dv2 = $after.visitors - $mid.visitors
$ds2 = $after.sessions - $mid.sessions
$dc2 = $after.conversions - $mid.conversions
if ($dv2 -lt 1) { throw "Account B did not increase visitors (delta=$dv2) - identity not splitting" }
if ($ds2 -lt 1) { throw "Account B did not increase sessions (delta=$ds2)" }
if ($dc2 -lt 1) { throw "Account B did not increase conversions (delta=$dc2)" }

Write-Host ""
Write-Host "PASS: new accounts each increase visitors, sessions, and conversions."
Write-Host ("Totals delta from baseline: visitors+{0} sessions+{1} conversions+{2}" -f ($after.visitors - $before.visitors), ($after.sessions - $before.sessions), ($after.conversions - $before.conversions))
