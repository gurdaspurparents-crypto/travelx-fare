Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "c:\Users\admin\Documents\travelx-special-fare-manager"
WshShell.Run "cmd /c node server/index.js", 0, False
WshShell.Run "cmd /c npm.cmd --prefix client run dev", 0, False
WScript.Sleep 3000
WshShell.Run "http://localhost:5173", 1, False
