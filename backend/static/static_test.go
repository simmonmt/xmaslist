package static

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

const (
	indexContents = "<html>index</html>"
	assetContents = "console.log('asset');"
	otherContents = "User-agent: *"
	secret        = "outside the root"
)

func writeFile(t *testing.T, path, contents string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(contents), 0644); err != nil {
		t.Fatal(err)
	}
}

// makeHandler makes a handler for a docroot that looks like Vite's output,
// plus a file outside the docroot and symlinks to it from inside.
func makeHandler(t *testing.T) (http.Handler, string) {
	t.Helper()

	top := t.TempDir()
	writeFile(t, filepath.Join(top, "secret.txt"), secret)

	dir := filepath.Join(top, "docroot")
	writeFile(t, filepath.Join(dir, "index.html"), indexContents)
	writeFile(t, filepath.Join(dir, "assets", "index-abc123.js"), assetContents)
	writeFile(t, filepath.Join(dir, "robots.txt"), otherContents)
	if err := os.Mkdir(filepath.Join(dir, "empty"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("../secret.txt", filepath.Join(dir, "link.txt")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("..", filepath.Join(dir, "up")); err != nil {
		t.Fatal(err)
	}

	h, err := NewHandler(dir)
	if err != nil {
		t.Fatalf("NewHandler(%v) = _, %v, want nil", dir, err)
	}
	return h, dir
}

func TestHandler(t *testing.T) {
	h, _ := makeHandler(t)

	const (
		noCache   = "no-cache"
		immutable = "public, max-age=31536000, immutable"
		htmlType  = "text/html; charset=utf-8"
		jsType    = "text/javascript; charset=utf-8"
	)

	type testCase struct {
		method       string
		path         string
		wantCode     int
		wantBody     string // checked only if non-empty
		wantCache    string // checked only if non-empty
		wantType     string // checked only if non-empty
		wantNotFound bool   // body is the standard 404 text
	}

	notFound := func(method, path string) testCase {
		return testCase{method: method, path: path, wantCode: http.StatusNotFound, wantNotFound: true}
	}
	index := func(method, path string) testCase {
		return testCase{method: method, path: path, wantCode: http.StatusOK, wantBody: indexContents, wantCache: noCache, wantType: htmlType}
	}

	testCases := []testCase{
		index("GET", "/"),
		index("GET", "/view/3"),
		index("GET", "/edit/1"),
		index("GET", "/login"),
		index("GET", "/login?next=%2Fview%2F3"),
		index("GET", "/nonexistent.txt"),
		{method: "GET", path: "/index.html", wantCode: http.StatusOK, wantBody: indexContents, wantCache: noCache},
		{method: "HEAD", path: "/view/3", wantCode: http.StatusOK, wantCache: noCache},
		{method: "GET", path: "/assets/index-abc123.js", wantCode: http.StatusOK, wantBody: assetContents, wantCache: immutable, wantType: jsType},
		{method: "HEAD", path: "/assets/index-abc123.js", wantCode: http.StatusOK, wantCache: immutable},
		{method: "GET", path: "/robots.txt", wantCode: http.StatusOK, wantBody: otherContents, wantCache: noCache},

		// Missing assets are 404s, not index.html.
		notFound("GET", "/assets/index-old.js"),

		// No directory listings.
		notFound("GET", "/assets"),
		notFound("GET", "/assets/"),
		index("GET", "/empty/"),

		// Non-GET/HEAD requests for unknown paths (e.g. bogus RPCs)
		// are 404s; for existing files they're 405s.
		notFound("POST", "/xmaslist.Bogus/Nope"),
		notFound("POST", "/view/3"),
		notFound("PUT", "/view/3"),
		{method: "POST", path: "/index.html", wantCode: http.StatusMethodNotAllowed},
		{method: "POST", path: "/assets/index-abc123.js", wantCode: http.StatusMethodNotAllowed},

		// Path traversal stays inside the root, landing on (missing
		// files, so) index.html.
		index("GET", "/../secret.txt"),
		index("GET", "/assets/../../secret.txt"),
		index("GET", "/%2e%2e/secret.txt"),
		index("GET", "/..%2fsecret.txt"),
		index("GET", "/../docroot/../secret.txt"),
		// Symlinks out of the root don't work either.
		index("GET", "/link.txt"),
		index("GET", "/up/secret.txt"),
	}

	for _, tc := range testCases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			resp := rec.Result()
			body := rec.Body.String()
			if resp.StatusCode != tc.wantCode {
				t.Errorf("code = %v, want %v (body %q)",
					resp.StatusCode, tc.wantCode, body)
			}
			if tc.wantBody != "" && body != tc.wantBody {
				t.Errorf("body = %q, want %q", body, tc.wantBody)
			}
			if tc.wantNotFound && body != "404 page not found\n" {
				t.Errorf("body = %q, want 404 page", body)
			}
			if tc.method == "HEAD" && body != "" {
				t.Errorf("HEAD body = %q, want empty", body)
			}
			if got := resp.Header.Get("Cache-Control"); tc.wantCache != "" && got != tc.wantCache {
				t.Errorf("Cache-Control = %q, want %q",
					got, tc.wantCache)
			}
			if got := resp.Header.Get("Content-Type"); tc.wantType != "" && got != tc.wantType {
				t.Errorf("Content-Type = %q, want %q",
					got, tc.wantType)
			}
			if tc.wantCode != http.StatusOK && resp.Header.Get("Cache-Control") != "" {
				t.Errorf("Cache-Control = %q on error, want none",
					resp.Header.Get("Cache-Control"))
			}
		})
	}
}

func TestNewHandlerErrors(t *testing.T) {
	if _, err := NewHandler(filepath.Join(t.TempDir(), "missing")); err == nil {
		t.Errorf("NewHandler(missing dir) = _, nil, want error")
	}

	dir := t.TempDir()
	if _, err := NewHandler(dir); err == nil {
		t.Errorf("NewHandler(dir without index.html) = _, nil, want error")
	}

	if err := os.Mkdir(filepath.Join(dir, "index.html"), 0755); err != nil {
		t.Fatal(err)
	}
	if _, err := NewHandler(dir); err == nil {
		t.Errorf("NewHandler(dir with index.html dir) = _, nil, want error")
	}
}

func TestIndexETag(t *testing.T) {
	h, dir := makeHandler(t)

	get := func(path string, header http.Header) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest("GET", path, nil)
		for k, v := range header {
			req.Header[k] = v
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}

	rec := get("/", nil)
	etag := rec.Result().Header.Get("ETag")
	lastModified := rec.Result().Header.Get("Last-Modified")
	if rec.Code != http.StatusOK || etag == "" || lastModified == "" {
		t.Fatalf("GET / = %v, ETag %q, Last-Modified %q; want 200 with both",
			rec.Code, etag, lastModified)
	}

	// Deep links get the same ETag, and a match is a 304.
	for _, path := range []string{"/", "/index.html", "/view/3"} {
		rec := get(path, http.Header{"If-None-Match": {etag}})
		if rec.Code != http.StatusNotModified {
			t.Errorf("GET %v with matching If-None-Match = %v, want %v",
				path, rec.Code, http.StatusNotModified)
		}
		if got := rec.Result().Header.Get("ETag"); got != etag {
			t.Errorf("GET %v ETag = %q, want %q", path, got, etag)
		}
	}

	// Replace index.html with different contents and an older modification
	// time, as when rolling back to an older image. A browser holding the
	// newer copy sends a now-stale ETag and a later If-Modified-Since; the
	// ETag mismatch has to win.
	const oldContents = "<html>older index</html>"
	path := filepath.Join(dir, "index.html")
	writeFile(t, path, oldContents)
	older := time.Now().Add(-48 * time.Hour)
	if err := os.Chtimes(path, older, older); err != nil {
		t.Fatal(err)
	}

	rec = get("/view/3", http.Header{
		"If-None-Match":     {etag},
		"If-Modified-Since": {lastModified},
	})
	if rec.Code != http.StatusOK || rec.Body.String() != oldContents {
		t.Errorf("GET /view/3 after rollback = %v %q, want 200 %q",
			rec.Code, rec.Body.String(), oldContents)
	}
	newETag := rec.Result().Header.Get("ETag")
	if newETag == "" || newETag == etag {
		t.Errorf("ETag after rollback = %q, want new non-empty ETag (old %q)",
			newETag, etag)
	}

	// The new ETag matches.
	if rec := get("/", http.Header{"If-None-Match": {newETag}}); rec.Code != http.StatusNotModified {
		t.Errorf("GET / with new ETag = %v, want %v",
			rec.Code, http.StatusNotModified)
	}
}
