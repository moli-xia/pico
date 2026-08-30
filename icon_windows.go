//go:build windows

package main

import (
	_ "embed"
	"encoding/binary"
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
)

//go:embed assets/pico-icon.ico
var picoWindowIconData []byte

var picoIconUser32 = windows.NewLazySystemDLL("user32.dll")

var (
	picoCreateIconFromResourceEx = picoIconUser32.NewProc("CreateIconFromResourceEx")
	picoSendMessage              = picoIconUser32.NewProc("SendMessageW")
	picoDestroyIcon              = picoIconUser32.NewProc("DestroyIcon")
)

const (
	picoIconResourceVersion  = 0x00030000
	picoIconDefaultSize      = 0x00000040
	picoWindowMessageSetIcon = 0x0080
	picoIconSmall            = 0
	picoIconBig              = 1
)

var picoWindowIcon uintptr

func picoICOImage(data []byte) ([]byte, error) {
	if len(data) < 6 || binary.LittleEndian.Uint16(data[0:2]) != 0 || binary.LittleEndian.Uint16(data[2:4]) != 1 {
		return nil, fmt.Errorf("Pico 图标文件头无效")
	}
	count := int(binary.LittleEndian.Uint16(data[4:6]))
	if count < 1 || len(data) < 6+count*16 {
		return nil, fmt.Errorf("Pico 图标没有可用图像")
	}

	best := -1
	bestScore := int(^uint(0) >> 1)
	for i := 0; i < count; i++ {
		entry := data[6+i*16 : 6+(i+1)*16]
		width := int(entry[0])
		height := int(entry[1])
		if width == 0 {
			width = 256
		}
		if height == 0 {
			height = 256
		}
		// 标题栏优先使用 32px 附近的图像；如果没有则选更大的清晰版本。
		score := absInt(width-32) + absInt(height-32)
		if width < 32 || height < 32 {
			score += 1000
		}
		if score < bestScore {
			best = i
			bestScore = score
		}
	}
	if best < 0 {
		return nil, fmt.Errorf("Pico 图标没有匹配尺寸")
	}
	entry := data[6+best*16 : 6+(best+1)*16]
	size := int(binary.LittleEndian.Uint32(entry[8:12]))
	offset := int(binary.LittleEndian.Uint32(entry[12:16]))
	if size <= 0 || offset < 0 || offset > len(data) || size > len(data)-offset {
		return nil, fmt.Errorf("Pico 图标数据范围无效")
	}
	return data[offset : offset+size], nil
}

func absInt(value int) int {
	if value < 0 {
		return -value
	}
	return value
}

func nativeSetWindowIcon(window unsafe.Pointer) error {
	hwnd := uintptr(window)
	if hwnd == 0 {
		return fmt.Errorf("窗口句柄为空")
	}
	resource, err := picoICOImage(picoWindowIconData)
	if err != nil {
		return err
	}
	hicon, _, callErr := picoCreateIconFromResourceEx.Call(
		uintptr(unsafe.Pointer(&resource[0])),
		uintptr(len(resource)),
		1,
		picoIconResourceVersion,
		0,
		0,
		picoIconDefaultSize,
	)
	if hicon == 0 {
		if callErr != nil {
			return fmt.Errorf("创建窗口图标失败：%w", callErr)
		}
		return fmt.Errorf("创建窗口图标失败")
	}
	picoWindowIcon = hicon
	picoSendMessage.Call(hwnd, picoWindowMessageSetIcon, picoIconBig, hicon)
	picoSendMessage.Call(hwnd, picoWindowMessageSetIcon, picoIconSmall, hicon)
	return nil
}

func nativeDestroyWindowIcon() {
	if picoWindowIcon == 0 {
		return
	}
	picoDestroyIcon.Call(picoWindowIcon)
	picoWindowIcon = 0
}
