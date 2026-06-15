package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/tradermemos/api/internal/api"
	"github.com/tradermemos/api/internal/config"
	"github.com/tradermemos/api/internal/db"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(cfg.DBPath), 0o755); err != nil {
		log.Fatal(err)
	}
	conn, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatal(err)
	}
	if err := db.Migrate(conn); err != nil {
		log.Fatal(err)
	}
	s := api.New(api.Deps{JWTSecret: cfg.JWTSecret})
	log.Fatal(s.Echo.Start(":" + cfg.HTTPPort))
}
