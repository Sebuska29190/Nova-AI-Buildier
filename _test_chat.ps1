$body = @{
    model = "deepseek/deepseek-chat"
    messages = @(@{ role = "user"; content = "Hello, say hi" })
    stream = $false
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri 'http://localhost:4123/v1/chat/completions' -Method Post -Body $body -ContentType 'application/json' -ErrorAction Stop
    $res | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host "Response: $($reader.ReadToEnd())"
}
