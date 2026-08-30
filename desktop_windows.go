//go:build windows

package main

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	webview2 "github.com/jchv/go-webview2"
)

func main() {
	// IndexedDB 的 origin 包含端口；Windows 版使用固定回环端口，确保关闭后
	// 再次启动仍能访问同一个本地图库，而不是每次启动都产生新的空图库。
	url, stop, err := startAssetServerAt("127.0.0.1:47831")
	if err != nil {
		log.Printf("固定本地端口不可用，改用临时端口：%v", err)
		url, stop, err = startAssetServer()
	}
	if err != nil {
		log.Fatal(err)
	}
	defer stop()
	if err := picoRegisterShellContextMenu(); err != nil {
		// The menu is a convenience integration.  A locked-down Windows
		// profile should not prevent Pico itself from starting.
		log.Printf("无法注册 Windows 图片右键菜单：%v", err)
	}

	dataPath := strings.TrimSpace(os.Getenv("PICO_DATA_PATH"))
	if dataPath == "" {
		cacheRoot, cacheErr := os.UserCacheDir()
		if cacheErr != nil {
			cacheRoot = os.TempDir()
		}
		dataPath = filepath.Join(cacheRoot, "Pico", "WebView2")
	} else if absolute, pathErr := filepath.Abs(filepath.Clean(dataPath)); pathErr == nil {
		// 可选的任务专用数据目录便于便携测试或多套图库并存；默认仍使用
		// 当前 Windows 用户的 Pico 数据目录。
		dataPath = absolute
	}
	if err := os.MkdirAll(dataPath, 0o700); err != nil {
		log.Printf("无法创建 WebView2 数据目录：%v", err)
	}

	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     false,
		AutoFocus: true,
		DataPath:  dataPath,
		WindowOptions: webview2.WindowOptions{
			Title:  "Pico 图片查看器",
			Width:  1280,
			Height: 800,
			Center: true,
		},
	})
	if w == nil {
		log.Println("无法启动 Windows WebView2，请安装 Microsoft Edge WebView2 Runtime。")
		nativeShowStartupError("Pico 无法启动", "Pico 需要 Microsoft Edge WebView2 Runtime 才能运行。\n请安装 WebView2 Runtime 后重新打开 Pico。")
		return
	}
	defer w.Destroy()
	w.SetTitle("Pico 图片查看器")
	w.SetSize(1280, 800, webview2.HintNone)
	if err := nativeSetWindowTheme(w.Window(), true); err != nil {
		log.Printf("无法设置 Pico 原生标题栏主题：%v", err)
	}
	launchFiles := picoReadNativeFiles(os.Args[1:], "")
	if len(launchFiles) > 0 {
		log.Printf("从 Windows 打开 %d 个图片文件", len(launchFiles))
	}
	if err := nativeSetWindowIcon(w.Window()); err != nil {
		log.Printf("无法设置 Pico 窗口图标：%v", err)
	} else {
		defer nativeDestroyWindowIcon()
	}
	if err := w.Bind("picoSetFullscreen", func(full bool) error {
		// WebView2 的回调线程不是窗口线程，借助 Dispatch 修改宿主窗口样式。
		w.Dispatch(func() {
			if err := nativeSetFullscreen(w.Window(), full); err != nil {
				log.Printf("Pico 全屏切换失败：%v", err)
			}
		})
		return nil
	}); err != nil {
		log.Printf("无法绑定原生全屏：%v", err)
	}
	if err := w.Bind("picoSetWindowTheme", func(dark bool) error {
		// DWM 属性必须在窗口线程上更新，避免切换主题时偶发无效。
		w.Dispatch(func() {
			if err := nativeSetWindowTheme(w.Window(), dark); err != nil {
				log.Printf("Pico 标题栏主题切换失败：%v", err)
			}
		})
		return nil
	}); err != nil {
		log.Printf("无法绑定原生标题栏主题：%v", err)
	}
	if err := w.Bind("picoOpenPath", func(path string) error {
		return nativeOpenPath(path)
	}); err != nil {
		log.Printf("无法绑定打开本地路径：%v", err)
	}
	if err := w.Bind("picoResolvePath", func(path string) (string, error) {
		return nativeResolveExistingPath(path)
	}); err != nil {
		log.Printf("无法绑定本地路径校验：%v", err)
	}
	if err := w.Bind("picoPickImages", func() ([]picoNativeFile, error) {
		return nativePickImages(w.Window())
	}); err != nil {
		log.Printf("无法绑定原生图片选择器：%v", err)
	}
	if err := w.Bind("picoPickFolder", func() ([]picoNativeFile, error) {
		return nativePickFolder(w.Window())
	}); err != nil {
		log.Printf("无法绑定原生文件夹选择器：%v", err)
	}
	if err := w.Bind("picoPickSinglePath", func() (string, error) {
		return picoPickSinglePath(uintptr(w.Window()))
	}); err != nil {
		log.Printf("无法绑定路径修复选择器：%v", err)
	}
	if err := w.Bind("picoGetLaunchFiles", func() []picoNativeFile {
		files := launchFiles
		launchFiles = nil
		return files
	}); err != nil {
		log.Printf("无法绑定启动文件：%v", err)
	}
	if err := w.Bind("picoCaptureScreen", func() (picoNativeScreen, error) {
		frame, err := nativeCaptureScreen()
		if err == nil {
			nativeRevealWindowForScreenshot(w.Window())
		}
		return frame, err
	}); err != nil {
		log.Printf("无法绑定 Windows 屏幕截图：%v", err)
	}
	w.Navigate(url)
	stopGlobalHotkey, hotkeyErr := picoStartGlobalHotkey(func() {
		w.Dispatch(func() {
			w.Eval("if (window.picoGlobalScreenshot) window.picoGlobalScreenshot();")
		})
	})
	if hotkeyErr != nil {
		log.Printf("无法注册 Ctrl+Shift+C 全局热键：%v；保留应用窗口内快捷键", hotkeyErr)
	} else {
		defer stopGlobalHotkey()
	}
	w.Run()
}
