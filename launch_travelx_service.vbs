Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\admin\Documents\travelx-special-fare-manager"
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\admin\Documents\travelx-special-fare-manager\travelx_daemon.ps1""", 0, False
