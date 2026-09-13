package main

import (
	"embed"
	"net"
	"net/http"
	"path"
	"strings"
)

// 将整个前端应用嵌入可执行文件，最终 Pico.exe 不需要旁边再放网页资源。
//
//go:embed index.html css js assets
var picoAssets embed.FS

var version = "1.8.2"

// 模块类资源必须带上正确的 MIME 类型，否则 WebView2 会以
// “Failed to fetch dynamically imported module” 拒绝动态 import。
var picoAssetTypes = map[string]string{
	".html": "text/html; charset=utf-8",
	".js":   "text/javascript; charset=utf-8",
	".mjs":  "text/javascript; charset=utf-8",
	".css":  "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg":  "image/svg+xml",
	".wasm": "application/wasm",
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".ico":  "image/x-icon",
}

// WebView2 的用户数据目录会在应用多次升级之间保留。禁止缓存静态资源，
// 避免旧版本遗留的过期响应或失败响应在升级后继续命中。
func picoAssetHandler() http.Handler {
	fileServer := http.FileServer(http.FS(picoAssets))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if contentType, ok := picoAssetTypes[strings.ToLower(path.Ext(r.URL.Path))]; ok {
			w.Header().Set("Content-Type", contentType)
		}
		w.Header().Set("Cache-Control", "no-store, must-revalidate")
		fileServer.ServeHTTP(w, r)
	})
}

func startAssetServer() (string, func(), error) {
	return startAssetServerAt("127.0.0.1:0")
}

func startAssetServerAt(address string) (string, func(), error) {
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return "", func() {}, err
	}

	mux := http.NewServeMux()
	mux.Handle("/", picoAssetHandler())
	server := &http.Server{Handler: mux}
	go func() { _ = server.Serve(listener) }()

	return "http://" + listener.Addr().String() + "/", func() {
		_ = server.Close()
	}, nil
}
