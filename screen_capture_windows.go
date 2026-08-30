//go:build windows

package main

import (
	"bytes"
	"fmt"
	"image"
	"image/png"
	"unsafe"

	"golang.org/x/sys/windows"
)

// picoNativeScreen contains a PNG snapshot of the Windows virtual screen.
// The snapshot is generated before the crop layer is populated, so Pico never
// captures its own selection UI.
type picoNativeScreen struct {
	Width  int    `json:"width"`
	Height int    `json:"height"`
	Data   []byte `json:"data"`
}

var (
	picoScreenUser32 = windows.NewLazySystemDLL("user32.dll")
	picoScreenGDI32  = windows.NewLazySystemDLL("gdi32.dll")

	picoGetSystemMetrics       = picoScreenUser32.NewProc("GetSystemMetrics")
	picoGetDC                  = picoScreenUser32.NewProc("GetDC")
	picoReleaseDC              = picoScreenUser32.NewProc("ReleaseDC")
	picoCreateCompatibleDC     = picoScreenGDI32.NewProc("CreateCompatibleDC")
	picoCreateCompatibleBitmap = picoScreenGDI32.NewProc("CreateCompatibleBitmap")
	picoSelectObject           = picoScreenGDI32.NewProc("SelectObject")
	picoDeleteObject           = picoScreenGDI32.NewProc("DeleteObject")
	picoDeleteDC               = picoScreenGDI32.NewProc("DeleteDC")
	picoBitBlt                 = picoScreenGDI32.NewProc("BitBlt")
	picoGetDIBits              = picoScreenGDI32.NewProc("GetDIBits")
)

const (
	picoSMXVirtualScreen  = 76
	picoSMYVirtualScreen  = 77
	picoSMCXVirtualScreen = 78
	picoSMCYVirtualScreen = 79
	picoSRCCopy           = 0x00CC0020
	picoCaptureBLT        = 0x40000000
	picoDIBRGBColors      = 0
	picoBIRGB             = 0
)

type picoBitmapInfoHeader struct {
	Size          uint32
	Width         int32
	Height        int32
	Planes        uint16
	BitCount      uint16
	Compression   uint32
	SizeImage     uint32
	XPelsPerMeter int32
	YPelsPerMeter int32
	ClrUsed       uint32
	ClrImportant  uint32
}

type picoRGBQuad struct {
	Blue     byte
	Green    byte
	Red      byte
	Reserved byte
}

type picoBitmapInfo struct {
	Header picoBitmapInfoHeader
	Colors [1]picoRGBQuad
}

func picoScreenMetric(index int) int {
	value, _, _ := picoGetSystemMetrics.Call(uintptr(index))
	return int(int32(value))
}

func nativeCaptureScreen() (picoNativeScreen, error) {
	x := picoScreenMetric(picoSMXVirtualScreen)
	y := picoScreenMetric(picoSMYVirtualScreen)
	width := picoScreenMetric(picoSMCXVirtualScreen)
	height := picoScreenMetric(picoSMCYVirtualScreen)
	if width <= 0 || height <= 0 {
		return picoNativeScreen{}, fmt.Errorf("无法读取 Windows 虚拟屏幕尺寸")
	}
	if int64(width)*int64(height) > 250000000 {
		return picoNativeScreen{}, fmt.Errorf("屏幕尺寸过大，无法截图")
	}

	screenDC, _, _ := picoGetDC.Call(0)
	if screenDC == 0 {
		return picoNativeScreen{}, fmt.Errorf("无法获取屏幕设备上下文")
	}
	defer picoReleaseDC.Call(0, screenDC)

	memoryDC, _, _ := picoCreateCompatibleDC.Call(screenDC)
	if memoryDC == 0 {
		return picoNativeScreen{}, fmt.Errorf("无法创建屏幕截图缓冲区")
	}
	defer picoDeleteDC.Call(memoryDC)

	bitmap, _, _ := picoCreateCompatibleBitmap.Call(screenDC, uintptr(width), uintptr(height))
	if bitmap == 0 {
		return picoNativeScreen{}, fmt.Errorf("无法创建屏幕位图")
	}
	defer picoDeleteObject.Call(bitmap)

	oldObject, _, _ := picoSelectObject.Call(memoryDC, bitmap)
	if oldObject == 0 {
		return picoNativeScreen{}, fmt.Errorf("无法选择屏幕位图")
	}
	defer picoSelectObject.Call(memoryDC, oldObject)

	result, _, _ := picoBitBlt.Call(
		memoryDC, 0, 0, uintptr(width), uintptr(height), screenDC,
		uintptr(int64(x)), uintptr(int64(y)), uintptr(picoSRCCopy|picoCaptureBLT),
	)
	if result == 0 {
		return picoNativeScreen{}, fmt.Errorf("读取屏幕画面失败")
	}

	stride := width * 4
	pixels := make([]byte, stride*height)
	info := picoBitmapInfo{Header: picoBitmapInfoHeader{
		Size:        uint32(unsafe.Sizeof(picoBitmapInfoHeader{})),
		Width:       int32(width),
		Height:      -int32(height), // top-down，避免之后再上下翻转
		Planes:      1,
		BitCount:    32,
		Compression: picoBIRGB,
	}}
	result, _, _ = picoGetDIBits.Call(
		memoryDC,
		bitmap,
		0,
		uintptr(height),
		uintptr(unsafe.Pointer(&pixels[0])),
		uintptr(unsafe.Pointer(&info)),
		picoDIBRGBColors,
	)
	if result == 0 {
		return picoNativeScreen{}, fmt.Errorf("屏幕位图转换失败")
	}

	rgba := image.NewRGBA(image.Rect(0, 0, width, height))
	for i := 0; i < len(pixels); i += 4 {
		rgba.Pix[i] = pixels[i+2]
		rgba.Pix[i+1] = pixels[i+1]
		rgba.Pix[i+2] = pixels[i]
		rgba.Pix[i+3] = 255
	}
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, rgba); err != nil {
		return picoNativeScreen{}, fmt.Errorf("PNG 编码失败：%w", err)
	}
	return picoNativeScreen{Width: width, Height: height, Data: encoded.Bytes()}, nil
}
