//go:build !windows

// Pico 图片查看器 · 非 Windows 本地服务器
//
// Windows 请使用 desktop_windows.go 构建的独立桌面版。
// 非 Windows 可在本目录执行：
//
//	go run .
//
// 启动后会自动打开默认浏览器。
package main

import (
	"fmt"
	"log"
	"os/exec"
	"runtime"
	"time"
)

func main() {
	url, stop, err := startAssetServer()
	if err != nil {
		log.Fatal(err)
	}
	defer stop()
	fmt.Println("Pico 图片查看器已启动:", url)
	go func() {
		time.Sleep(300 * time.Millisecond)
		openBrowser(url)
	}()
	select {}
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		fmt.Println("请手动在浏览器打开:", url)
	}
}
