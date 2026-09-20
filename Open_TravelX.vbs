Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\admin\Documents\travelx-special-fare-manager"
WshShell.Run "wscript.exe ""C:\Users\admin\Documents\travelx-special-fare-manager\launch_travelx_service.vbs""", 0, False
WScript.Sleep 1000
WshShell.Run "http://localhost:5173", 1, False
