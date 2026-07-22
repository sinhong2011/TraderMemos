package api

import (
	"net/url"
	"strings"
)

// OriginAllowed reports whether origin may call the API cross-origin.
// Patterns in allow:
//   - exact match (https://app.example.com)
//   - * (any origin — demos only)
//   - https://*.vercel.app / http://*.pages.dev (single subdomain wildcard)
func OriginAllowed(origin string, allow []string) bool {
	if origin == "" || len(allow) == 0 {
		return false
	}
	for _, pattern := range allow {
		if pattern == "*" || pattern == origin {
			return true
		}
		if matchWildcardOrigin(pattern, origin) {
			return true
		}
	}
	return false
}

func matchWildcardOrigin(pattern, origin string) bool {
	// Only https://*.host or http://*.host
	scheme := ""
	rest := ""
	switch {
	case strings.HasPrefix(pattern, "https://*."):
		scheme = "https"
		rest = strings.TrimPrefix(pattern, "https://*.")
	case strings.HasPrefix(pattern, "http://*."):
		scheme = "http"
		rest = strings.TrimPrefix(pattern, "http://*.")
	default:
		return false
	}
	if rest == "" || strings.Contains(rest, "*") || strings.Contains(rest, "/") {
		return false
	}
	u, err := url.Parse(origin)
	if err != nil || u.Scheme != scheme || u.Host == "" {
		return false
	}
	host := u.Hostname()
	// Require a subdomain label: foo.vercel.app matches *.vercel.app; vercel.app alone does not.
	suffix := "." + rest
	return strings.HasSuffix(host, suffix) && len(host) > len(suffix)
}
