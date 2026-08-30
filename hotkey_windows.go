//go:build windows

package main

import (
	"fmt"
	"runtime"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

// RegisterHotKey(NULL, ...) 绑定到一个专用线程的消息队列，因此即使 Pico
// 被最小化，Windows 仍会把 Ctrl+Shift+C 投递给这个线程。
var picoGlobalHotkeyUser32 = windows.NewLazySystemDLL("user32.dll")
var picoGlobalHotkeyKernel32 = windows.NewLazySystemDLL("kernel32.dll")

var (
	picoGlobalRegisterHotKey    = picoGlobalHotkeyUser32.NewProc("RegisterHotKey")
	picoGlobalUnregisterHotKey  = picoGlobalHotkeyUser32.NewProc("UnregisterHotKey")
	picoGlobalGetMessage        = picoGlobalHotkeyUser32.NewProc("GetMessageW")
	picoGlobalPeekMessage       = picoGlobalHotkeyUser32.NewProc("PeekMessageW")
	picoGlobalPostThreadMessage = picoGlobalHotkeyUser32.NewProc("PostThreadMessageW")
	picoGlobalShowWindow        = picoGlobalHotkeyUser32.NewProc("ShowWindow")
	picoGlobalBringWindowToTop  = picoGlobalHotkeyUser32.NewProc("BringWindowToTop")
	picoGlobalSetForeground     = picoGlobalHotkeyUser32.NewProc("SetForegroundWindow")
)

var picoGlobalGetCurrentThreadID = picoGlobalHotkeyKernel32.NewProc("GetCurrentThreadId")

const (
	picoGlobalHotkeyID     = 0x504943 // "PIC"
	picoGlobalModControl   = 0x0002
	picoGlobalModShift     = 0x0004
	picoGlobalModNoRepeat  = 0x4000
	picoGlobalVirtualKeyC  = 0x43
	picoGlobalWMHotkey     = 0x0312
	picoGlobalWMQuit       = 0x0012
	picoGlobalShowRestore  = 9
	picoGlobalPeekNoRemove = 0x0000
)

type picoGlobalPoint struct {
	X int32
	Y int32
}

// MSG 的布局在 64 位 Windows 上包含了 message 后的对齐空位和末尾保留字段。
type picoGlobalMessage struct {
	Hwnd    uintptr
	Message uint32
	Padding uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Point   picoGlobalPoint
	Private uint32
}

type picoGlobalHotkeyReady struct {
	ThreadID uint32
	Err      error
}

// picoStartGlobalHotkey 启动一个不会阻塞 WebView2 主消息循环的全局热键线程。
// 返回的 stop 必须在宿主窗口退出后调用，以注销热键并唤醒消息循环。
func picoStartGlobalHotkey(onTriggered func()) (func(), error) {
	ready := make(chan picoGlobalHotkeyReady, 1)
	done := make(chan struct{})

	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()

		threadIDValue, _, _ := picoGlobalGetCurrentThreadID.Call()
		threadID := uint32(threadIDValue)
		var message picoGlobalMessage
		// 触发线程消息队列的创建，再注册 NULL 窗口热键。
		_, _, _ = picoGlobalPeekMessage.Call(
			uintptr(unsafe.Pointer(&message)), 0, 0, 0, picoGlobalPeekNoRemove,
		)
		registered, _, callErr := picoGlobalRegisterHotKey.Call(
			0,
			picoGlobalHotkeyID,
			picoGlobalModControl|picoGlobalModShift|picoGlobalModNoRepeat,
			picoGlobalVirtualKeyC,
		)
		if registered == 0 {
			if callErr == nil {
				callErr = fmt.Errorf("Windows 未返回错误码")
			}
			ready <- picoGlobalHotkeyReady{ThreadID: threadID, Err: fmt.Errorf("RegisterHotKey 失败：%w", callErr)}
			close(done)
			return
		}

		ready <- picoGlobalHotkeyReady{ThreadID: threadID}
		defer func() {
			_, _, _ = picoGlobalUnregisterHotKey.Call(0, picoGlobalHotkeyID)
			close(done)
		}()

		for {
			result, _, _ := picoGlobalGetMessage.Call(uintptr(unsafe.Pointer(&message)), 0, 0, 0)
			if int32(result) <= 0 {
				return
			}
			if message.Message == picoGlobalWMHotkey && message.WParam == picoGlobalHotkeyID && onTriggered != nil {
				onTriggered()
			}
		}
	}()

	status := <-ready
	if status.Err != nil {
		return func() {}, status.Err
	}

	var stopOnce sync.Once
	stop := func() {
		stopOnce.Do(func() {
			posted, _, _ := picoGlobalPostThreadMessage.Call(uintptr(status.ThreadID), picoGlobalWMQuit, 0, 0)
			if posted != 0 {
				<-done
			}
		})
	}
	return stop, nil
}

// 原生截图需要先在窗口仍处于最小化/后台状态时抓屏，再把 Pico 带到前台
// 显示裁剪层；这样不会把裁剪层本身录进截图，也不会让用户误以为快捷键失效。
func nativeRevealWindowForScreenshot(window unsafe.Pointer) {
	hwnd := uintptr(window)
	if hwnd == 0 {
		return
	}
	_, _, _ = picoGlobalShowWindow.Call(hwnd, picoGlobalShowRestore)
	_, _, _ = picoGlobalBringWindowToTop.Call(hwnd)
	_, _, _ = picoGlobalSetForeground.Call(hwnd)
}
