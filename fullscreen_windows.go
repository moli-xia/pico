//go:build windows

package main

import (
	"fmt"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Pico 的查看器已经有网页级全屏兜底；独立 Windows 版还需要同步移除
// 原生窗口边框，才能真正覆盖标题栏和任务栏区域。
var picoUser32 = windows.NewLazySystemDLL("user32.dll")

var (
	picoGetWindowLongPtr  = picoUser32.NewProc("GetWindowLongPtrW")
	picoSetWindowLongPtr  = picoUser32.NewProc("SetWindowLongPtrW")
	picoGetWindowRect     = picoUser32.NewProc("GetWindowRect")
	picoMonitorFromWindow = picoUser32.NewProc("MonitorFromWindow")
	picoGetMonitorInfo    = picoUser32.NewProc("GetMonitorInfoW")
	picoSetWindowPos      = picoUser32.NewProc("SetWindowPos")
)

const (
	picoGWLStyle = -16

	picoWSCaption     = 0x00C00000
	picoWSSysMenu     = 0x00080000
	picoWSThickFrame  = 0x00040000
	picoWSMinimizeBox = 0x00020000
	picoWSMaximizeBox = 0x00010000
	picoWSPopup       = 0x80000000

	picoMonitorDefaultToNearest = 2

	picoSWPNoZOrder     = 0x0004
	picoSWPFrameChanged = 0x0020
	picoSWPShowWindow   = 0x0040
)

type picoNativeRect struct {
	Left   int32
	Top    int32
	Right  int32
	Bottom int32
}

type picoMonitorInfo struct {
	CbSize    uint32
	RcMonitor picoNativeRect
	RcWork    picoNativeRect
	DwFlags   uint32
}

var picoFullscreenState struct {
	sync.Mutex
	hwnd   uintptr
	style  uintptr
	rect   picoNativeRect
	active bool
}

func picoSignedParam(value int32) uintptr {
	return uintptr(int64(value))
}

func picoStyleIndex() uintptr {
	index := int64(picoGWLStyle)
	return uintptr(index)
}

func picoSetWindowStyle(hwnd, style uintptr) error {
	previous, _, _ := picoSetWindowLongPtr.Call(hwnd, picoStyleIndex(), style)
	if previous == 0 {
		return fmt.Errorf("SetWindowLongPtrW 失败")
	}
	return nil
}

func picoMoveWindow(hwnd uintptr, rect picoNativeRect) error {
	width := rect.Right - rect.Left
	height := rect.Bottom - rect.Top
	if width <= 0 || height <= 0 {
		return fmt.Errorf("窗口尺寸无效：%d×%d", width, height)
	}
	flags := uintptr(picoSWPNoZOrder | picoSWPFrameChanged | picoSWPShowWindow)
	result, _, _ := picoSetWindowPos.Call(
		hwnd,
		0,
		picoSignedParam(rect.Left),
		picoSignedParam(rect.Top),
		picoSignedParam(width),
		picoSignedParam(height),
		flags,
	)
	if result == 0 {
		return fmt.Errorf("SetWindowPos 失败")
	}
	return nil
}

func nativeSetFullscreen(window unsafe.Pointer, on bool) error {
	hwnd := uintptr(window)
	if hwnd == 0 {
		return fmt.Errorf("窗口句柄为空")
	}

	picoFullscreenState.Lock()
	defer picoFullscreenState.Unlock()

	if on {
		if picoFullscreenState.active && picoFullscreenState.hwnd == hwnd {
			return nil
		}

		var original picoNativeRect
		result, _, _ := picoGetWindowRect.Call(hwnd, uintptr(unsafe.Pointer(&original)))
		if result == 0 {
			return fmt.Errorf("GetWindowRect 失败")
		}
		style, _, _ := picoGetWindowLongPtr.Call(hwnd, picoStyleIndex())
		monitor, _, _ := picoMonitorFromWindow.Call(hwnd, picoMonitorDefaultToNearest)
		if monitor == 0 {
			return fmt.Errorf("MonitorFromWindow 失败")
		}
		info := picoMonitorInfo{CbSize: uint32(unsafe.Sizeof(picoMonitorInfo{}))}
		result, _, _ = picoGetMonitorInfo.Call(monitor, uintptr(unsafe.Pointer(&info)))
		if result == 0 {
			return fmt.Errorf("GetMonitorInfoW 失败")
		}

		oldStyle := style
		newStyle := (style &^ (picoWSCaption | picoWSSysMenu | picoWSThickFrame | picoWSMinimizeBox | picoWSMaximizeBox)) | picoWSPopup
		if err := picoSetWindowStyle(hwnd, newStyle); err != nil {
			return err
		}
		if err := picoMoveWindow(hwnd, info.RcMonitor); err != nil {
			_ = picoSetWindowStyle(hwnd, oldStyle)
			_ = picoMoveWindow(hwnd, original)
			return err
		}

		picoFullscreenState.hwnd = hwnd
		picoFullscreenState.style = oldStyle
		picoFullscreenState.rect = original
		picoFullscreenState.active = true
		return nil
	}

	if !picoFullscreenState.active || picoFullscreenState.hwnd != hwnd {
		return nil
	}
	if err := picoSetWindowStyle(hwnd, picoFullscreenState.style); err != nil {
		return err
	}
	if err := picoMoveWindow(hwnd, picoFullscreenState.rect); err != nil {
		return err
	}
	picoFullscreenState.active = false
	picoFullscreenState.hwnd = 0
	picoFullscreenState.style = 0
	picoFullscreenState.rect = picoNativeRect{}
	return nil
}
