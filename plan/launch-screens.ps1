# launch-screens.ps1
# Script to launch multiple Chrome windows in Kiosk mode for the multi-screen grid.

param(
    [string]$LectureId = "",
    [int]$TotalStudents = 60,
    [int]$NumScreens = 15,
    [string]$BaseUrl = "https://wall.60sec.shop"
)

if (-not $LectureId) {
    $LectureId = Read-Host "Please enter the Lecture ID"
}

Write-Host "Launching $NumScreens screens for Lecture: $LectureId (Total Students: $TotalStudents)"

$StudentsPerScreen = [math]::Ceiling($TotalStudents / $NumScreens)
$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

if (-not (Test-Path $ChromePath)) {
    $ChromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

if (-not (Test-Path $ChromePath)) {
    Write-Error "Chrome not found! Please ensure Google Chrome is installed."
    exit
}

for ($i = 0; $i -lt $NumScreens; $i++) {
    $Start = $i * $StudentsPerScreen
    $Count = $StudentsPerScreen
    
    $Url = "$BaseUrl/grid?lecture=$LectureId&start=$Start&count=$Count&screen=$i"
    
    Write-Host "Starting Screen $($i + 1) -> $Url"
    
    # We use --new-window and --app to launch without UI. 
    # To truly force fullscreen on a specific display, you might need a tool or specific Chrome flags.
    # --kiosk forces fullscreen. --window-position allows moving it, but requires multiple displays attached.
    $Args = @(
        "--new-window",
        "--app=$Url",
        "--window-position=$($i * 100),0" # Simplistic offset, replace with actual display coordinates in production
        # "--kiosk" # Uncomment to force fullscreen (hard to close without Alt+F4)
    )
    
    Start-Process -FilePath $ChromePath -ArgumentList $Args
    Start-Sleep -Seconds 1 # Wait a bit before launching the next one
}

Write-Host "All screens launched successfully."
