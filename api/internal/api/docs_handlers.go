package api

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/openapi"
)

const scalarDocsHTML = `<!doctype html>
<html lang="en">
  <head>
    <title>TraderMemos API</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #16161c; }
      :root {
        --scalar-font: system-ui, sans-serif;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script
      src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.63.0/dist/browser/standalone.js"
      integrity="sha384-PlviHlK3uCjxgh67enSuQJvyxdVZbaKHnN/6op5juN6/V2IPKFGbZ91TH/FZtSkU"
      crossorigin="anonymous"
    ></script>
    <script>
      Scalar.createApiReference("#app", {
        url: "/openapi.yaml",
        theme: "kepler",
        darkMode: true,
        hideModels: false,
        defaultOpenAllTags: false,
      });
    </script>
  </body>
</html>
`

func (s *Server) docsRoutes() {
	s.Echo.GET("/openapi.yaml", func(c echo.Context) error {
		return c.Blob(http.StatusOK, "application/yaml; charset=utf-8", openapi.Spec)
	})
	s.Echo.GET("/docs", func(c echo.Context) error {
		return c.HTML(http.StatusOK, scalarDocsHTML)
	})
	s.Echo.GET("/docs/", func(c echo.Context) error {
		return c.Redirect(http.StatusMovedPermanently, "/docs")
	})
}
