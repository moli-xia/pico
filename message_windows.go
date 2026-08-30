//go:build windows

package main

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

var picoMessageBox = windows.NewLazySystemDLL("user32.dll").NewProc("MessageBoxW")

const picoMessageBoxIconError = 0x00000010

func nativeShowStartupError(title, message string) {
	title16, err := windows.UTF16PtrFromString(title)
	if err != nil {
		return
	}
	message16, err := windows.UTF16PtrFromString(message)
	if err != nil {
		return
	}
	picoMessageBox.Call(
		0,
		uintptr(unsafe.Pointer(message16)),
		uintptr(unsafe.Pointer(title16)),
		picoMessageBoxIconError,
	)
}
