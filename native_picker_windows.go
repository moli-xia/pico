//go:build windows

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf16"
	"unsafe"

	"golang.org/x/sys/windows"
)

// picoNativeFile is the small bridge between the Windows picker and the
// WebView. The bytes are JSON encoded as base64 by encoding/json, while path
// remains available for "打开图片目录" after the app is restarted.
type picoNativeFile struct {
	Name         string `json:"name"`
	Path         string `json:"path"`
	Dir          string `json:"dir"`
	Type         string `json:"type"`
	LastModified int64  `json:"lastModified"`
	Data         []byte `json:"data"`
}

var (
	picoComdlg32             = windows.NewLazySystemDLL("comdlg32.dll")
	picoGetOpenFileName      = picoComdlg32.NewProc("GetOpenFileNameW")
	picoCommDlgExtendedError = picoComdlg32.NewProc("CommDlgExtendedError")
	picoShell32              = windows.NewLazySystemDLL("shell32.dll")
	picoSHBrowseForFolder    = picoShell32.NewProc("SHBrowseForFolderW")
	picoSHGetPathFromIDList  = picoShell32.NewProc("SHGetPathFromIDListW")
	picoOle32                = windows.NewLazySystemDLL("ole32.dll")
	picoCoTaskMemFree        = picoOle32.NewProc("CoTaskMemFree")
)

// OPENFILENAMEW. Keep the complete structure, including the reserved tail,
// so its size and pointer alignment stay correct on 64-bit Windows.
type picoOpenFileName struct {
	StructSize    uint32
	Owner         uintptr
	Instance      uintptr
	Filter        *uint16
	CustomFilter  *uint16
	MaxCustFilter uint32
	FilterIndex   uint32
	File          *uint16
	MaxFile       uint32
	FileTitle     *uint16
	MaxFileTitle  uint32
	InitialDir    *uint16
	Title         *uint16
	Flags         uint32
	FileOffset    uint16
	FileExtension uint16
	DefExt        *uint16
	CustData      uintptr
	Hook          uintptr
	TemplateName  *uint16
	Reserved      uintptr
	Reserved2     uint32
	FlagsEx       uint32
}

const (
	picoOFNHideReadOnly  = 0x00000004
	picoOFNNoChangeDir   = 0x00000008
	picoOFNAllowMulti    = 0x00000200
	picoOFNPathMustExist = 0x00000800
	picoOFNFileMustExist = 0x00001000
	picoOFNExplorer      = 0x00080000

	picoBIFReturnOnlyFSDirs = 0x0001
	picoBIFEditBox          = 0x0010
	picoBIFNewDialogStyle   = 0x0040
)

type picoBrowseInfo struct {
	Owner        uintptr
	Root         uintptr
	DisplayName  *uint16
	Title        *uint16
	Flags        uint32
	Callback     uintptr
	CallbackData uintptr
	Image        int32
}

func picoUTF16Z(value string) []uint16 {
	result := utf16.Encode([]rune(value))
	return append(result, 0)
}

func picoPickerFilter() []uint16 {
	return picoUTF16Z("可预览文件 (*.jpg;*.jpeg;*.jfif;*.png;*.gif;*.webp;*.avif;*.bmp;*.ico;*.svg;*.psd;*.psb;*.ai;*.dwg)\x00*.jpg;*.jpeg;*.jfif;*.png;*.gif;*.webp;*.avif;*.bmp;*.ico;*.svg;*.psd;*.psb;*.ai;*.dwg\x00所有文件 (*.*)\x00*.*\x00")
}

func picoUTF16Parts(buffer []uint16) []string {
	parts := make([]string, 0, 4)
	start := 0
	for i, value := range buffer {
		if value != 0 {
			continue
		}
		if i == start {
			break
		}
		parts = append(parts, windows.UTF16ToString(buffer[start:i]))
		start = i + 1
	}
	return parts
}

func picoPickOpenPaths(hwnd uintptr, allowMulti bool, title string) ([]string, error) {
	buffer := make([]uint16, 32768)
	filter := picoPickerFilter()
	title16 := picoUTF16Z(title)
	flags := uint32(picoOFNExplorer | picoOFNFileMustExist | picoOFNPathMustExist | picoOFNHideReadOnly | picoOFNNoChangeDir)
	if allowMulti {
		flags |= picoOFNAllowMulti
	}
	request := picoOpenFileName{
		StructSize: uint32(unsafe.Sizeof(picoOpenFileName{})),
		Owner:      hwnd,
		Filter:     &filter[0],
		File:       &buffer[0],
		MaxFile:    uint32(len(buffer)),
		Title:      &title16[0],
		Flags:      flags,
	}
	result, _, _ := picoGetOpenFileName.Call(uintptr(unsafe.Pointer(&request)))
	if result == 0 {
		// A user cancellation is a normal result. Report actual dialog errors
		// so the JS side can show a useful message instead of silently doing nothing.
		extended, _, _ := picoCommDlgExtendedError.Call()
		if extended != 0 {
			return nil, fmt.Errorf("Windows 文件选择器失败：错误码 0x%X", extended)
		}
		return nil, nil
	}

	parts := picoUTF16Parts(buffer)
	if len(parts) == 0 {
		return nil, nil
	}
	if len(parts) == 1 {
		return []string{filepath.Clean(parts[0])}, nil
	}
	base := parts[0]
	paths := make([]string, 0, len(parts)-1)
	for _, name := range parts[1:] {
		if filepath.IsAbs(name) {
			paths = append(paths, filepath.Clean(name))
		} else {
			paths = append(paths, filepath.Clean(filepath.Join(base, name)))
		}
	}
	return paths, nil
}

func picoPickSinglePath(hwnd uintptr) (string, error) {
	paths, err := picoPickOpenPaths(hwnd, false, "选择图片文件")
	if err != nil || len(paths) == 0 {
		return "", err
	}
	return paths[0], nil
}

func picoPickFolderPath(hwnd uintptr) (string, error) {
	display := make([]uint16, windows.MAX_PATH)
	title := picoUTF16Z("请选择要导入的图片文件夹")
	request := picoBrowseInfo{
		Owner:       hwnd,
		DisplayName: &display[0],
		Title:       &title[0],
		Flags:       picoBIFReturnOnlyFSDirs | picoBIFEditBox | picoBIFNewDialogStyle,
	}
	pidl, _, _ := picoSHBrowseForFolder.Call(uintptr(unsafe.Pointer(&request)))
	if pidl == 0 {
		return "", nil
	}
	defer picoCoTaskMemFree.Call(pidl)
	pathBuffer := make([]uint16, windows.MAX_PATH)
	result, _, _ := picoSHGetPathFromIDList.Call(pidl, uintptr(unsafe.Pointer(&pathBuffer[0])))
	if result == 0 {
		return "", fmt.Errorf("无法读取所选文件夹路径")
	}
	return filepath.Clean(windows.UTF16ToString(pathBuffer)), nil
}

func picoMimeForPath(path string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".jpg", ".jpeg", ".jfif":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".avif":
		return "image/avif"
	case ".bmp":
		return "image/bmp"
	case ".ico":
		return "image/x-icon"
	case ".svg":
		return "image/svg+xml"
	case ".psd", ".psb":
		return "image/vnd.adobe.photoshop"
	case ".ai":
		return "application/postscript"
	case ".dwg":
		return "image/vnd.dwg"
	default:
		return "application/octet-stream"
	}
}

func picoIsImagePath(path string) bool {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".jpg", ".jpeg", ".jfif", ".png", ".gif", ".webp", ".avif", ".bmp", ".ico", ".svg", ".psd", ".psb", ".ai", ".dwg":
		return true
	default:
		return false
	}
}

func picoNativeFileFromPath(path, root, dirOverride string) (picoNativeFile, error) {
	cleanPath, err := filepath.Abs(filepath.Clean(path))
	if err != nil {
		return picoNativeFile{}, err
	}
	info, err := os.Stat(cleanPath)
	if err != nil {
		return picoNativeFile{}, err
	}
	if info.IsDir() || !picoIsImagePath(cleanPath) {
		return picoNativeFile{}, fmt.Errorf("不是图片文件")
	}
	data, err := os.ReadFile(cleanPath)
	if err != nil {
		return picoNativeFile{}, err
	}
	dir := dirOverride
	if root != "" {
		rel, relErr := filepath.Rel(root, cleanPath)
		if relErr == nil {
			dir = filepath.ToSlash(filepath.Dir(rel))
			if dir == "." {
				dir = ""
			}
		}
	}
	return picoNativeFile{
		Name:         filepath.Base(cleanPath),
		Path:         cleanPath,
		Dir:          dir,
		Type:         picoMimeForPath(cleanPath),
		LastModified: info.ModTime().UnixNano() / int64(time.Millisecond),
		Data:         data,
	}, nil
}

func picoReadNativeFiles(paths []string, root string) []picoNativeFile {
	files := make([]picoNativeFile, 0, len(paths))
	for _, path := range paths {
		entry, err := picoNativeFileFromPath(path, root, "")
		if err == nil {
			files = append(files, entry)
		}
	}
	return files
}

func picoReadNativeFolder(root string) []picoNativeFile {
	files := make([]picoNativeFile, 0, 128)
	_ = filepath.WalkDir(root, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil || entry == nil {
			return nil
		}
		if entry.IsDir() {
			return nil
		}
		if len(files) >= 20000 || !picoIsImagePath(path) {
			return nil
		}
		if file, err := picoNativeFileFromPath(path, root, ""); err == nil {
			files = append(files, file)
		}
		return nil
	})
	return files
}

func nativePickImages(hwnd unsafe.Pointer) ([]picoNativeFile, error) {
	paths, err := picoPickOpenPaths(uintptr(hwnd), true, "打开图片（可多选）")
	if err != nil {
		return nil, err
	}
	return picoReadNativeFiles(paths, ""), nil
}

func nativePickFolder(hwnd unsafe.Pointer) ([]picoNativeFile, error) {
	root, err := picoPickFolderPath(uintptr(hwnd))
	if err != nil || root == "" {
		return nil, err
	}
	return picoReadNativeFolder(root), nil
}
