# Regenerates PWA PNG sizes and favicon from assets/icon.png (or -Source path).
param(
  [string]$Source = (Join-Path $PSScriptRoot '..\assets\icon.png')
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$iconsDir = Join-Path $root 'src\public\icons'
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile((Resolve-Path $Source))

foreach ($size in @(72, 96, 128, 144, 152, 192, 384, 512)) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($image, 0, 0, $size, $size)
  $out = Join-Path $iconsDir "icon-${size}x${size}.png"
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Host "Wrote $out"
}

$bmp32 = New-Object System.Drawing.Bitmap 32, 32
$g32 = [System.Drawing.Graphics]::FromImage($bmp32)
$g32.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g32.DrawImage($image, 0, 0, 32, 32)
$hIcon = $bmp32.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
foreach ($icoPath in @('src\favicon.ico', 'src\assets\favicon.ico')) {
  $fs = [System.IO.File]::Create((Join-Path $root $icoPath))
  $icon.Save($fs)
  $fs.Close()
  Write-Host "Wrote $icoPath"
}
$g32.Dispose()
$bmp32.Dispose()
$image.Dispose()

Write-Host 'Done. Rebuild with: npm run build:pwa'
