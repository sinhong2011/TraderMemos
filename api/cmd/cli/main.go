package main

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/google/uuid"
	"github.com/spf13/cobra"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/config"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/importer"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

func openStore() (*store.Queries, error) {
	cfg, _ := config.Load()
	if err := os.MkdirAll(dir(cfg.DBPath), 0o755); err != nil {
		return nil, err
	}
	conn, err := db.Open(cfg.DBPath)
	if err != nil {
		return nil, err
	}
	if err := db.Migrate(conn); err != nil {
		return nil, err
	}
	return store.New(conn), nil
}

func dir(p string) string {
	for i := len(p) - 1; i >= 0; i-- {
		if p[i] == '/' {
			return p[:i]
		}
	}
	return "."
}

func main() {
	root := &cobra.Command{Use: "tradermemos", Short: "TraderMemos admin CLI"}

	root.AddCommand(&cobra.Command{
		Use: "migrate", Short: "run migrations + seed instrument specs",
		RunE: func(*cobra.Command, []string) error {
			q, err := openStore()
			if err != nil {
				return err
			}
			if err := store.SeedInstrumentSpecs(context.Background(), q); err != nil {
				return err
			}
			fmt.Println("migrated + seeded")
			return nil
		},
	})

	var email, password string
	cu := &cobra.Command{
		Use: "create-user", Short: "create a user",
		RunE: func(*cobra.Command, []string) error {
			if email == "" || password == "" {
				return fmt.Errorf("--email and --password are required")
			}
			q, err := openStore()
			if err != nil {
				return err
			}
			cfg, _ := config.Load()
			svc := auth.NewService(q, auth.NewJWT(cfg.JWTSecret))
			u, err := svc.Register(context.Background(), email, password)
			if err != nil {
				return err
			}
			fmt.Println("created", u.ID)
			return nil
		},
	}
	cu.Flags().StringVar(&email, "email", "", "email")
	cu.Flags().StringVar(&password, "password", "", "password")
	root.AddCommand(cu)

	var acct string
	rg := &cobra.Command{
		Use: "regroup", Short: "regroup an account's trades",
		RunE: func(*cobra.Command, []string) error {
			if acct == "" {
				return fmt.Errorf("--account is required")
			}
			q, err := openStore()
			if err != nil {
				return err
			}
			acc, err := q.GetAccountByIDAny(context.Background(), acct)
			if err != nil {
				return err
			}
			return trades.NewService(q).Regroup(context.Background(), acc.UserID, acc.ID)
		},
	}
	rg.Flags().StringVar(&acct, "account", "", "account id")
	root.AddCommand(rg)

	var impAcct, impFile, impInstrument, impMapping string
	imp := &cobra.Command{
		Use: "import", Short: "import a CSV of executions into an account",
		RunE: func(*cobra.Command, []string) error {
			if impAcct == "" || impFile == "" {
				return fmt.Errorf("--account and --file are required")
			}
			if impInstrument == "" {
				impInstrument = "stock"
			}
			q, err := openStore()
			if err != nil {
				return err
			}
			ctx := context.Background()
			acc, err := q.GetAccountByIDAny(ctx, impAcct)
			if err != nil {
				return err
			}
			headers, rows, err := readCSVFile(impFile)
			if err != nil {
				return err
			}
			mapping := importer.SuggestMapping(headers)
			if impMapping != "" {
				if err := json.Unmarshal([]byte(impMapping), &mapping); err != nil {
					return fmt.Errorf("invalid --mapping JSON: %w", err)
				}
			}
			res := importer.NewGeneric(mapping, impInstrument).ParseRows(rows)
			inserted := 0
			for _, pe := range res.Executions {
				hash := importer.DedupHash(pe.Symbol, pe.Side, pe.Quantity, pe.Price, pe.ExecutedAt)
				exists, err := q.ExecutionExists(ctx, store.ExecutionExistsParams{AccountID: acc.ID, DedupHash: hash})
				if err != nil {
					return err
				}
				if exists == 1 {
					continue
				}
				if _, err := q.InsertExecution(ctx, store.InsertExecutionParams{
					ID: uuid.NewString(), UserID: acc.UserID, AccountID: acc.ID,
					Symbol: pe.Symbol, InstrumentType: pe.InstrumentType, Side: pe.Side,
					Quantity: pe.Quantity, Price: pe.Price, Fees: pe.Fees, Commission: pe.Commission,
					ExecutedAt: pe.ExecutedAt, Multiplier: 1, DedupHash: hash,
					ExternalID: sql.NullString{}, ImportBatchID: sql.NullString{},
				}); err != nil {
					return err
				}
				inserted++
			}
			if err := trades.NewService(q).Regroup(ctx, acc.UserID, acc.ID); err != nil {
				return err
			}
			fmt.Printf("imported %d executions (%d row errors)\n", inserted, len(res.Errors))
			return nil
		},
	}
	imp.Flags().StringVar(&impAcct, "account", "", "account id")
	imp.Flags().StringVar(&impFile, "file", "", "CSV file path")
	imp.Flags().StringVar(&impInstrument, "instrument", "stock", "instrument type")
	imp.Flags().StringVar(&impMapping, "mapping", "", "column mapping JSON (optional; auto-detected if omitted)")
	root.AddCommand(imp)

	if err := root.Execute(); err != nil {
		log.Fatal(err)
	}
}

func readCSVFile(path string) (headers []string, rows []map[string]string, err error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}
	defer f.Close()
	r := csv.NewReader(f)
	r.FieldsPerRecord = -1
	records, err := r.ReadAll()
	if err != nil {
		return nil, nil, err
	}
	if len(records) == 0 {
		return nil, nil, fmt.Errorf("empty CSV")
	}
	headers = records[0]
	for _, rec := range records[1:] {
		m := map[string]string{}
		for i, h := range headers {
			if i < len(rec) {
				m[h] = rec[i]
			}
		}
		rows = append(rows, m)
	}
	return headers, rows, nil
}
