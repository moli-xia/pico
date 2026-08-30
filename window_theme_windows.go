//go:build windows

package main

import (
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
)

// WebView2 使用宿主窗口的原生标题栏。同步设置 DWM 标题栏颜色后，网页暗色模式与
// Windows 窗口 chrome 不会再出现一条突兀的浅色标题栏。
var picoDwmapi = windows.NewLazySystemDLL("dwmapi.dll")

var picoDwmSetWindowAttribute = picoDwmapi.NewProc("DwmSetWindowAttribute")

const (
	picoDwmUseImmersiveDarkMode   = 20
	picoDwmUseImmersiveDarkMode10 = 19
	picoDwmBorderColor            = 34
	picoDwmCaptionColor           = 35
	picoDwmTextColor              = 36
)

func picoColorRef(red, green, blue byte) uint32 {
	// Win32 COLORREF 采用 0x00BBGGRR 顺序。
	return uint32(red) | uint32(green)<<8 | uint32(blue)<<16
}

func picoSetDwmUint32(hwnd uintptr, attribute uint32, value uint32) error {
	result, _, _ := picoDwmSetWindowAttribute.Call(
		hwnd,
		uintptr(attribute),
		uintptr(unsafe.Pointer(&value)),
		unsafe.Sizeof(value),
	)
	if result != 0 {
		return fmt.Errorf("DwmSetWindowAttribute(%d) 失败: HRESULT 0x%X", attribute, result)
	}
	return nil
}

func nativeSetWindowTheme(window unsafe.Pointer, dark bool) error {
	hwnd := uintptr(window)
	if hwnd == 0 {
		return fmt.Errorf("窗口句柄为空")
	}

	var darkMode uint32
	caption := picoColorRef(238, 240, 246) // #eef0f6
	border := caption
	text := picoColorRef(23, 28, 38) // #171c26
	if dark {
		darkMode = 1
		caption = picoColorRef(11, 13, 18) // #0b0d12
		border = caption
		text = picoColorRef(233, 236, 243) // #e9ecf3
	}

	// Windows 11/新版本使用 20；Windows 10 1809 的兼容值是 19。
	if err := picoSetDwmUint32(hwnd, picoDwmUseImmersiveDarkMode, darkMode); err != nil {
		_ = picoSetDwmUint32(hwnd, picoDwmUseImmersiveDarkMode10, darkMode)
	}
	if err := picoSetDwmUint32(hwnd, picoDwmCaptionColor, caption); err != nil {
		return err
	}
	if err := picoSetDwmUint32(hwnd, picoDwmBorderColor, border); err != nil {
		return err
	}
	return picoSetDwmUint32(hwnd, picoDwmTextColor, text)
}
