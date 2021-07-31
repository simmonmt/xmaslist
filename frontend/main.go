package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"

	spa "github.com/roberthodgen/spa-server"
)

var (
	indexFile = flag.String("index_file", "", "index file")
	port      = flag.Int("port", -1, "port")
	serveDir  = flag.String("serve_dir", "", "serve dir")
)

func main() {
	flag.Parse()

	if *port == -1 {
		log.Fatalf("--port is required")
	}
	if *indexFile == "" {
		log.Fatalf("--index_file is required")
	}
	if *serveDir == "" {
		log.Fatalf("--serve_dir is required")
	}

	http.ListenAndServe(fmt.Sprintf(":%d", *port),
		spa.SpaHandler(*serveDir, *indexFile))
}
