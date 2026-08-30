//go:build windows

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// These entries are deliberately registered under HKCU.  Pico can therefore
// add its Explorer integration without requiring an administrator prompt or
// changing the machine-wide default application for any image format.
var picoImageExtensions = []string{
	".jpg", ".jpeg", ".jfif", ".png", ".gif", ".webp", ".avif", ".bmp", ".ico", ".svg",
	".psd", ".psb", ".ai", ".dwg",
}

var picoShellNotify = windows.NewLazySystemDLL("shell32.dll").NewProc("SHChangeNotify")

const (
	picoShellAssociationChanged = 0x08000000
	picoShellNotifyIDList       = 0x0000
)

func picoSetRegistryString(root registry.Key, path, name, value string) error {
	key, _, err := registry.CreateKey(root, path, registry.SET_VALUE|registry.CREATE_SUB_KEY)
	if err != nil {
		return err
	}
	defer key.Close()
	return key.SetStringValue(name, value)
}

func picoRegisterShellContextMenu() error {
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("读取 Pico.exe 路径失败：%w", err)
	}
	exe, err = filepath.Abs(filepath.Clean(exe))
	if err != nil {
		return fmt.Errorf("规范化 Pico.exe 路径失败：%w", err)
	}
	exe = filepath.Clean(exe)
	appName := filepath.Base(exe)
	if strings.TrimSpace(appName) == "" {
		return fmt.Errorf("Pico.exe 文件名为空")
	}

	// Keep the command quoted so paths such as “D:\\My Apps\\Pico.exe” and
	// image paths containing spaces are passed to the native argument parser
	// intact.  picoReadNativeFiles then imports the actual file from %1.
	command := `"` + exe + `" "%1"`
	icon := `"` + exe + `",0`

	appRoot := `Software\Classes\Applications\` + appName
	if err := picoSetRegistryString(registry.CURRENT_USER, appRoot, "FriendlyAppName", "Pico 图片查看器"); err != nil {
		return fmt.Errorf("注册 Pico 应用名称失败：%w", err)
	}
	if err := picoSetRegistryString(registry.CURRENT_USER, appRoot+`\DefaultIcon`, "", icon); err != nil {
		return fmt.Errorf("注册 Pico 应用图标失败：%w", err)
	}
	if err := picoSetRegistryString(registry.CURRENT_USER, appRoot+`\shell\open\command`, "", command); err != nil {
		return fmt.Errorf("注册 Pico 打开命令失败：%w", err)
	}

	// SupportedTypes makes Pico appear in Windows “Open with / 选择其他应用”
	// for the formats below without taking over the user's existing defaults.
	supportedTypes, _, err := registry.CreateKey(registry.CURRENT_USER, appRoot+`\SupportedTypes`, registry.SET_VALUE|registry.CREATE_SUB_KEY)
	if err != nil {
		return fmt.Errorf("注册 Pico 支持的图片格式失败：%w", err)
	}
	for _, ext := range picoImageExtensions {
		if err := supportedTypes.SetStringValue(ext, ""); err != nil {
			supportedTypes.Close()
			return fmt.Errorf("注册 Pico 支持格式 %s 失败：%w", ext, err)
		}
	}
	_ = supportedTypes.Close()

	for _, ext := range picoImageExtensions {
		// A visible per-file context-menu command is more discoverable than
		// requiring the user to open the secondary “Open with” submenu.
		menuRoot := `Software\Classes\SystemFileAssociations\` + ext + `\shell\PicoOpen`
		if err := picoSetRegistryString(registry.CURRENT_USER, menuRoot, "MUIVerb", "使用 Pico 预览文件"); err != nil {
			return fmt.Errorf("注册 %s 右键菜单失败：%w", ext, err)
		}
		if err := picoSetRegistryString(registry.CURRENT_USER, menuRoot, "Icon", icon); err != nil {
			return fmt.Errorf("注册 %s 右键菜单图标失败：%w", ext, err)
		}
		if err := picoSetRegistryString(registry.CURRENT_USER, menuRoot+`\command`, "", command); err != nil {
			return fmt.Errorf("注册 %s 右键菜单命令失败：%w", ext, err)
		}

		// Also add the executable to the standard OpenWithList.  This covers
		// Windows builds whose modern context menu hides custom shell verbs.
		openWith := `Software\Classes\` + ext + `\OpenWithList`
		if err := picoSetRegistryString(registry.CURRENT_USER, openWith, appName, ""); err != nil {
			return fmt.Errorf("注册 %s OpenWith 列表失败：%w", ext, err)
		}
	}

	// Tell Explorer to invalidate associations and cached menu/icon data now;
	// otherwise an already-running Explorer can keep showing the old entry.
	picoShellNotify.Call(picoShellAssociationChanged, picoShellNotifyIDList, 0, 0)
	return nil
}
