package store

import (
	"context"
	"database/sql"
	"strings"

	"github.com/google/uuid"
)

// DefaultSetupNames are playbook presets seeded for every user.
var DefaultSetupNames = []string{
	"Pullback",
	"Breakout",
	"Reversal",
	"Gap Fill",
	"Momentum",
	"Mean Reversion",
	"Scalp",
	"Swing",
	"Other",
}

// SeedDefaultSetups creates any missing default setups for userID (skips existing names, case-insensitive).
func SeedDefaultSetups(ctx context.Context, q *Queries, userID string) error {
	existing, err := q.ListSetups(ctx, userID)
	if err != nil {
		return err
	}
	seen := make(map[string]struct{}, len(existing))
	for _, s := range existing {
		seen[strings.ToLower(s.Name)] = struct{}{}
	}
	for _, name := range DefaultSetupNames {
		if _, ok := seen[strings.ToLower(name)]; ok {
			continue
		}
		_, err := q.CreateSetup(ctx, CreateSetupParams{
			ID: uuid.NewString(), UserID: userID, Name: name,
			Description: "", Thesis: "", Symbol: "", Direction: "",
			TargetPrice: sql.NullFloat64{}, StopPrice: sql.NullFloat64{}, Checklist: "[]",
		})
		if err != nil {
			return err
		}
	}
	return nil
}
