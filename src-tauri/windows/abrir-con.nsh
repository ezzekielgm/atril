; Atril en «Abrir con» de los .docx (instalador .exe, sin permisos de administrador).
; No cambia el programa que abre los Word con doble clic: siguen abriéndose con Word.

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\Atril.docx" "" "Documento de Word (Atril)"
  WriteRegStr SHCTX "Software\Classes\Atril.docx" "FriendlyTypeName" "Documento de Word"
  WriteRegStr SHCTX "Software\Classes\Atril.docx\DefaultIcon" "" "$INSTDIR\Atril.exe,0"
  WriteRegStr SHCTX "Software\Classes\Atril.docx\shell\open\command" "" '"$INSTDIR\Atril.exe" "%1"'
  WriteRegStr SHCTX "Software\Classes\.docx\OpenWithProgids" "Atril.docx" ""
  WriteRegStr SHCTX "Software\Classes\Applications\Atril.exe" "FriendlyAppName" "Atril"
  WriteRegStr SHCTX "Software\Classes\Applications\Atril.exe\SupportedTypes" ".docx" ""
  WriteRegStr SHCTX "Software\Classes\Applications\Atril.exe\shell\open\command" "" '"$INSTDIR\Atril.exe" "%1"'
  ; Que el Explorador vea el cambio sin reiniciar
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegValue SHCTX "Software\Classes\.docx\OpenWithProgids" "Atril.docx"
  DeleteRegKey SHCTX "Software\Classes\Atril.docx"
  DeleteRegKey SHCTX "Software\Classes\Applications\Atril.exe"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
