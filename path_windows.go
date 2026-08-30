//go:build windows

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Windows Explorer 的 /select 命令行在不同的 Explorer 启动方式下并不
// 总是可靠，尤其是路径包含空格、非 ASCII 字符或应用从资源管理器启动
// 时。这里直接使用 Shell 的 PIDL 接口，让 Explorer 根据真实文件对象
// 打开父目录并选中原文件。
var (
	picoPathShell32            = windows.NewLazySystemDLL("shell32.dll")
	picoPathOle32              = windows.NewLazySystemDLL("ole32.dll")
	picoPathSHParseDisplayName = picoPathShell32.NewProc("SHParseDisplayName")
	picoPathSHOpenFolderSelect = picoPathShell32.NewProc("SHOpenFolderAndSelectItems")
	picoPathShellExecute       = picoPathShell32.NewProc("ShellExecuteW")
	picoPathCoInitializeEx     = picoPathOle32.NewProc("CoInitializeEx")
	picoPathCoUninitialize     = picoPathOle32.NewProc("CoUninitialize")
)

const (
	picoPathCoInitApartmentThreaded = 0x2
	picoPathSFalse                  = 1
	picoPathRPCChangedMode          = 0x80010106
	picoPathShowNormal              = 1
)

func picoPathHRESULTFailed(value uintptr) bool {
	return int32(value) < 0
}

func picoNormalizeExistingPath(path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", os.ErrNotExist
	}
	clean, err := filepath.Abs(filepath.Clean(path))
	if err != nil {
		return "", err
	}
	_, err = os.Stat(clean)
	if err != nil {
		return "", err
	}
	return clean, nil
}

// nativeResolveExistingPath 供 WebView 在打开目录前重新规范化路径。
// 这会把旧版本偶尔留下的相对路径转成绝对路径，并把真实值回写到
// IndexedDB；后续打开不再依赖 Chromium 的 File 对象是否暴露 path。
func nativeResolveExistingPath(path string) (string, error) {
	clean, err := picoNormalizeExistingPath(path)
	return clean, err
}

func picoShellExecuteOpen(path string) error {
	explorer, err := windows.UTF16PtrFromString("explorer.exe")
	if err != nil {
		return err
	}
	quoted, err := windows.UTF16PtrFromString(`"` + path + `"`)
	if err != nil {
		return err
	}
	result, _, _ := picoPathShellExecute.Call(
		0,
		0,
		uintptr(unsafe.Pointer(explorer)),
		uintptr(unsafe.Pointer(quoted)),
		0,
		picoPathShowNormal,
	)
	if result <= 32 {
		return fmt.Errorf("ShellExecuteW 打开 Explorer 失败：返回码 %d", result)
	}
	return nil
}

func nativeOpenPath(path string) error {
	clean, err := picoNormalizeExistingPath(path)
	if err != nil {
		return err
	}

	// SHParseDisplayName 需要 COM。若当前宿主线程已经处于其他 COM
	// apartment，RPC_E_CHANGED_MODE 可以安全忽略，Shell 仍可继续工作。
	comResult, _, _ := picoPathCoInitializeEx.Call(0, picoPathCoInitApartmentThreaded)
	if comResult == 0 || comResult == picoPathSFalse {
		defer picoPathCoUninitialize.Call()
	} else if comResult != picoPathRPCChangedMode {
		// COM 初始化失败时仍尝试 Explorer 命令行，给用户保留可用路径。
		return picoShellExecuteOpen(clean)
	}

	windowsPath, err := windows.UTF16PtrFromString(clean)
	if err != nil {
		return err
	}
	var pidl uintptr
	parseResult, _, _ := picoPathSHParseDisplayName.Call(
		uintptr(unsafe.Pointer(windowsPath)),
		0,
		uintptr(unsafe.Pointer(&pidl)),
		0,
		0,
	)
	if !picoPathHRESULTFailed(parseResult) && pidl != 0 {
		defer picoCoTaskMemFree.Call(pidl)
		openResult, _, _ := picoPathSHOpenFolderSelect.Call(pidl, 0, 0, 0)
		if !picoPathHRESULTFailed(openResult) {
			return nil
		}
	}

	// PIDL 调用失败时再走同一套 Explorer 进程，但仍使用 ShellExecute，
	// 不经过 cmd.exe，不会把文件路径当成命令解释。
	return picoShellExecuteOpen(clean)
}
