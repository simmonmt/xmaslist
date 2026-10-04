// Package static serves the client (the Vite build output) as a single-page
// app.
package static

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"
)

const (
	indexFile = "index.html"

	// Vite puts content-hashed files in assets/, so they never change.
	assetsPrefix = "assets/"

	assetsCacheControl = "public, max-age=31536000, immutable"
	otherCacheControl  = "no-cache"
)

type handler struct {
	fsys fs.FS
}

// NewHandler returns a handler that serves the files in dir. GET and HEAD
// requests for existing files serve them. Other GET and HEAD requests serve
// index.html so the client's router can handle deep links (e.g. /view/3),
// except under /assets/, where missing files are 404s. Requests with other
// methods get a 404 (405 for existing files). Directories are never listed,
// and files are opened through an os.Root, so neither ".." nor symlinks can
// escape dir.
func NewHandler(dir string) (http.Handler, error) {
	root, err := os.OpenRoot(dir)
	if err != nil {
		return nil, err
	}
	fsys := root.FS()

	if fi, err := fs.Stat(fsys, indexFile); err != nil {
		return nil, fmt.Errorf("%s: %w", dir, err)
	} else if !fi.Mode().IsRegular() {
		return nil, fmt.Errorf("%s/%s is not a regular file", dir, indexFile)
	}

	return &handler{fsys: fsys}, nil
}

// contentETag returns a strong ETag for rs's contents, leaving rs at the
// start.
func contentETag(rs io.ReadSeeker) (string, error) {
	hash := sha256.New()
	if _, err := io.Copy(hash, rs); err != nil {
		return "", err
	}
	if _, err := rs.Seek(0, io.SeekStart); err != nil {
		return "", err
	}
	return `"` + hex.EncodeToString(hash.Sum(nil)[:16]) + `"`, nil
}

// open opens name if it's a regular file.
func (h *handler) open(name string) (fs.File, fs.FileInfo, error) {
	f, err := h.fsys.Open(name)
	if err != nil {
		return nil, nil, err
	}

	fi, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, nil, err
	}
	if !fi.Mode().IsRegular() {
		f.Close()
		return nil, nil, fs.ErrNotExist
	}

	return f, fi, nil
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// path.Clean resolves any ".." against the root. The leading "/" is
	// then dropped to make an fs.FS name ("" for the root).
	name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
	if name == "" {
		name = indexFile
	}

	f, fi, err := h.open(name)
	if err == nil {
		defer f.Close()
	}

	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		if err == nil {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "405 method not allowed",
				http.StatusMethodNotAllowed)
			return
		}
		http.NotFound(w, r)
		return
	}

	if err != nil {
		// Treat any failure (missing file, directory, symlink out of
		// the root, ...) as a missing file.
		//
		// Hashed assets referenced by a stale index.html shouldn't
		// get index.html (as text/html) back.
		if strings.HasPrefix(name+"/", assetsPrefix) {
			http.NotFound(w, r)
			return
		}

		name = indexFile
		f, fi, err = h.open(name)
		if err != nil {
			http.Error(w, "500 internal server error",
				http.StatusInternalServerError)
			return
		}
		defer f.Close()
	}

	rs, ok := f.(io.ReadSeeker)
	if !ok {
		http.Error(w, "500 internal server error",
			http.StatusInternalServerError)
		return
	}

	// Revalidate index.html by content rather than just modification time,
	// which can go backwards (e.g. when rolling back to an older image).
	// ServeContent prefers If-None-Match to If-Modified-Since.
	if name == indexFile {
		etag, err := contentETag(rs)
		if err != nil {
			http.Error(w, "500 internal server error",
				http.StatusInternalServerError)
			return
		}
		w.Header().Set("ETag", etag)
	}

	if strings.HasPrefix(name, assetsPrefix) {
		w.Header().Set("Cache-Control", assetsCacheControl)
	} else {
		w.Header().Set("Cache-Control", otherCacheControl)
	}

	http.ServeContent(w, r, name, fi.ModTime(), rs)
}
