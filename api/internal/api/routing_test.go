package api

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"
)

// Echo v5 ships a new router. This walks the entire registered route table and
// asserts each pattern still matches a request built from itself, so a change
// in matching precedence — a static segment losing to a parameter, say — fails
// here rather than as a mystery 404 in production.
func TestRouterMatchesEveryRegisteredRoute(t *testing.T) {
	s := New(Deps{Logger: discardLogger()})

	var matched string
	s.Echo.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			matched = c.Path()
			return next(c)
		}
	})

	routes := s.Echo.Router().Routes()
	require.NotEmpty(t, routes)

	tested := 0
	for _, ri := range routes {
		// Catch-alls match anything by definition, so they prove nothing here.
		if ri.Method == echo.RouteNotFound || strings.Contains(ri.Path, "*") {
			continue
		}

		matched = ""
		rec := httptest.NewRecorder()
		s.Echo.ServeHTTP(rec, httptest.NewRequest(ri.Method, concretePath(ri.Path), nil))

		require.Equal(t, ri.Path, matched,
			"%s %s requested as %s matched route %q", ri.Method, ri.Path, concretePath(ri.Path), matched)
		tested++
	}
	// Guard against the table silently emptying and this passing vacuously.
	require.Greater(t, tested, 100, "expected the full API surface to be exercised")
}

// concretePath fills every :param in a route pattern with a literal value.
func concretePath(pattern string) string {
	segments := strings.Split(pattern, "/")
	for i, seg := range segments {
		if strings.HasPrefix(seg, ":") {
			segments[i] = "test-" + seg[1:]
		}
	}
	return strings.Join(segments, "/")
}

// The one place this API puts a static segment where a parameter also lives:
// /trades/regroup sits beside /trades/:id/*. It is covered by the sweep above,
// but named here because it is the case a router swap would break first.
func TestRouterKeepsStaticTradeRouteAheadOfParam(t *testing.T) {
	s := New(Deps{Logger: discardLogger()})

	var matched string
	s.Echo.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			matched = c.Path()
			return next(c)
		}
	})

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/trades/regroup", nil))
	require.Equal(t, "/api/v1/trades/regroup", matched)

	matched = ""
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/trades/abc-123", nil))
	require.Equal(t, "/api/v1/trades/:id", matched)
}

// The framework middlewares report failures through our error handler too, so
// their responses must carry the same envelope the SPA parses everywhere else.
func TestBodyLimitRejectionUsesEnvelope(t *testing.T) {
	s := New(Deps{AttachMaxBytes: 1 << 10, Logger: discardLogger()})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(strings.Repeat("x", 4<<10)))
	req.Header.Set("Content-Type", "application/json")
	s.Echo.ServeHTTP(rec, req)

	require.Equal(t, http.StatusRequestEntityTooLarge, rec.Code)
	got := decodeEnvelope(t, rec)
	require.Equal(t, "error", got.Code)
	require.NotEmpty(t, got.Message)
}

func TestRateLimitRejectionUsesEnvelope(t *testing.T) {
	s := New(Deps{AuthRateLimit: 1, Logger: discardLogger()})

	var last *httptest.ResponseRecorder
	for range 40 {
		last = httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(`{}`))
		req.Header.Set("Content-Type", "application/json")
		s.Echo.ServeHTTP(last, req)
		if last.Code == http.StatusTooManyRequests {
			break
		}
	}

	require.Equal(t, http.StatusTooManyRequests, last.Code, "rate limiter never tripped")
	got := decodeEnvelope(t, last)
	require.Equal(t, "error", got.Code)
	require.NotEmpty(t, got.Message)
}

// discardLogger keeps the expected handler panics (New(Deps{}) has no store)
// out of the test output — these tests assert on routing, not on behaviour.
func discardLogger() *slog.Logger { return slog.New(slog.DiscardHandler) }
