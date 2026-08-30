package main

import (
	"embed"
	"net"
	"net/http"
)

// 将整个前端应用嵌入可执行文件，最终 Pico.exe 不需要旁边再放网页资源。
//
//go:embed index.html css js assets
var picoAssets embed.FS

var version = "1.7.2"

func startAssetServer() (string, func(), error) {
	return startAssetServerAt("127.0.0.1:0")
}

func startAssetServerAt(address string) (string, func(), error) {
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return "", func() {}, err
	}

	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.FS(picoAssets)))
	server := &http.Server{Handler: mux}
	go func() { _ = server.Serve(listener) }()

	return "http://" + listener.Addr().String() + "/", func() {
		_ = server.Close()
	}, nil
}
