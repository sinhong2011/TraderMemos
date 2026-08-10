// tm-sync watches local MetaTrader statement exports and syncs their fills to
// a TraderMemos server — the self-hosted answer to broker auto-sync. No broker
// credential is involved: it reads files the terminal already wrote and talks
// only to your own server with a personal access token.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"
)

// version is stamped by the release build (-ldflags "-X main.version=…").
var version = "dev"

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	configPath := ""

	root := &cobra.Command{
		Use:           "tm-sync",
		Short:         "Sync MetaTrader statement exports to TraderMemos",
		Version:       version,
		SilenceUsage:  true,
		SilenceErrors: true,
	}
	root.PersistentFlags().StringVar(&configPath, "config", defaultConfigPath(), "path to tm-sync config file")

	load := func() (Config, *Client, error) {
		cfg, err := loadConfig(configPath)
		if err != nil {
			return cfg, nil, fmt.Errorf("load %s: %w", configPath, err)
		}
		return cfg, newClient(cfg.APIURL, cfg.Token), nil
	}

	root.AddCommand(&cobra.Command{
		Use:   "init",
		Short: "Write an annotated sample config",
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := writeSampleConfig(configPath); err != nil {
				return err
			}
			fmt.Printf("wrote %s — fill in api_url, token, account_id, and watch dirs\n", configPath)
			return nil
		},
	})

	root.AddCommand(&cobra.Command{
		Use:   "check",
		Short: "Verify config, server connectivity, token, and account",
		RunE: func(cmd *cobra.Command, _ []string) error {
			cfg, client, err := load()
			if err != nil {
				return err
			}
			if err := client.CheckAccount(cmd.Context(), cfg.AccountID); err != nil {
				return err
			}
			fmt.Printf("ok — %s reachable, token valid, account %s found, %d watch dir(s)\n",
				cfg.APIURL, cfg.AccountID, len(cfg.Watch))
			return nil
		},
	})

	root.AddCommand(&cobra.Command{
		Use:   "scan",
		Short: "Sync all statements in the watch dirs once and exit",
		RunE: func(cmd *cobra.Command, _ []string) error {
			cfg, client, err := load()
			if err != nil {
				return err
			}
			if err := client.CheckAccount(cmd.Context(), cfg.AccountID); err != nil {
				return err
			}
			return newSyncer(cfg, client, logger).ScanOnce(cmd.Context())
		},
	})

	root.AddCommand(&cobra.Command{
		Use:   "run",
		Short: "Watch the configured dirs and sync statements as they appear",
		RunE: func(cmd *cobra.Command, _ []string) error {
			cfg, client, err := load()
			if err != nil {
				return err
			}
			if err := client.CheckAccount(cmd.Context(), cfg.AccountID); err != nil {
				return err
			}
			ctx, stop := signal.NotifyContext(cmd.Context(), os.Interrupt, syscall.SIGTERM)
			defer stop()
			err = newSyncer(cfg, client, logger).Watch(ctx)
			if ctx.Err() != nil {
				logger.Info("shutting down")
				return nil
			}
			return err
		},
	})

	if err := root.ExecuteContext(context.Background()); err != nil {
		logger.Error("tm-sync failed", "err", err)
		os.Exit(1)
	}
}
