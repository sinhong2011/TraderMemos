package main

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

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

func openConn() (*sql.DB, error) {
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
	return conn, nil
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
			if err := auth.ValidatePassword(password); err != nil {
				return fmt.Errorf("password must be at least %d characters", auth.MinPasswordLen)
			}
			svc := auth.NewService(q, auth.NewJWT(cfg.JWTSecret), true)
			u, err := svc.CreateUserCLI(context.Background(), email, password)
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

	seedSetups := &cobra.Command{
		Use: "seed-setups", Short: "ensure default playbook setups exist for a user",
		RunE: func(*cobra.Command, []string) error {
			if email == "" {
				return fmt.Errorf("--email is required")
			}
			q, err := openStore()
			if err != nil {
				return err
			}
			ctx := context.Background()
			u, err := q.GetUserByEmail(ctx, email)
			if err != nil {
				return fmt.Errorf("user not found: %w", err)
			}
			if err := store.SeedDefaultSetups(ctx, q, u.ID); err != nil {
				return err
			}
			fmt.Println("default setups ensured for", u.Email)
			return nil
		},
	}
	seedSetups.Flags().StringVar(&email, "email", "", "user email")
	root.AddCommand(seedSetups)

	seedSetupsAll := &cobra.Command{
		Use:   "seed-setups-all",
		Short: "ensure default playbook setups exist for all users",
		RunE: func(*cobra.Command, []string) error {
			ctx := context.Background()
			conn, err := openConn()
			if err != nil {
				return err
			}
			defer conn.Close()

			q := store.New(conn)
			rows, err := conn.QueryContext(ctx, `SELECT id, email FROM users`)
			if err != nil {
				return err
			}
			var users []struct {
				id    string
				email string
			}
			for rows.Next() {
				var userID, userEmail string
				if err := rows.Scan(&userID, &userEmail); err != nil {
					_ = rows.Close()
					return err
				}
				users = append(users, struct {
					id    string
					email string
				}{id: userID, email: userEmail})
			}
			if err := rows.Err(); err != nil {
				_ = rows.Close()
				return err
			}
			if err := rows.Close(); err != nil {
				return err
			}

			var seeded int
			for _, u := range users {
				if err := store.SeedDefaultSetups(ctx, q, u.id); err != nil {
					return err
				}
				seeded++
				fmt.Println("seeded setups for", u.email)
			}

			fmt.Println("default setups ensured for", seeded, "users")
			return nil
		},
	}
	root.AddCommand(seedSetupsAll)

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

	var impAcct, impFile, impMapping string
	var impReplace bool
	imp := &cobra.Command{
		Use: "import", Short: "import a CSV of executions or journal trades into an account",
		RunE: func(*cobra.Command, []string) error {
			if impAcct == "" || impFile == "" {
				return fmt.Errorf("--account and --file are required")
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
			if impReplace {
				if err := q.DeleteExecutionsForAccount(ctx, store.DeleteExecutionsForAccountParams{
					AccountID: acc.ID, UserID: acc.UserID,
				}); err != nil {
					return err
				}
				if err := trades.NewService(q).Regroup(ctx, acc.UserID, acc.ID); err != nil {
					return err
				}
				fmt.Println("cleared existing executions for account")
			}
			headers, rows, err := readCSVFile(impFile)
			if err != nil {
				return err
			}
			var parsed importer.ParseResult
			format := importer.DetectFormat(headers)
			if format == "journal_trades" {
				parsed = importer.NewJournal().ParseRows(rows)
			} else {
				mapping := importer.SuggestMapping(headers)
				if impMapping != "" {
					if err := json.Unmarshal([]byte(impMapping), &mapping); err != nil {
						return fmt.Errorf("invalid --mapping JSON: %w", err)
					}
				}
				parsed = importer.NewGeneric(mapping).ParseRows(rows)
				parsed.Format = "executions"
			}
			res, err := importer.Commit(ctx, q, acc.UserID, acc.ID, sql.NullString{}, parsed)
			if err != nil {
				return err
			}
			fmt.Printf("imported %d executions (%d skipped, %d annotated, %d row errors, format=%s)\n",
				res.Inserted, res.Skipped, res.Annotated, len(res.Errors), res.Format)
			return nil
		},
	}
	imp.Flags().StringVar(&impAcct, "account", "", "account id")
	imp.Flags().StringVar(&impFile, "file", "", "CSV file path")
	imp.Flags().StringVar(&impMapping, "mapping", "", "column mapping JSON (optional; auto-detected if omitted)")
	imp.Flags().BoolVar(&impReplace, "replace", false, "delete existing executions for the account before import")
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
	headers = make([]string, len(records[0]))
	for i, h := range records[0] {
		headers[i] = strings.TrimPrefix(strings.TrimSpace(h), "\ufeff")
	}
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
