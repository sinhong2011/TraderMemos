package store

import (
	"context"
	"database/sql"
)

// TxRunner is implemented by stores that can run fn inside a database
// transaction, with a Querier bound to that transaction.
type TxRunner interface {
	InTx(ctx context.Context, fn func(Querier) error) error
}

// InTx runs fn inside a transaction when q supports it (multi-statement
// writes become atomic), and falls back to running fn directly otherwise.
func InTx(ctx context.Context, q Querier, fn func(Querier) error) error {
	if tr, ok := q.(TxRunner); ok {
		return tr.InTx(ctx, fn)
	}
	return fn(q)
}

type sqliteStore struct {
	*Queries
	conn *sql.DB
}

func (s *sqliteStore) InTx(ctx context.Context, fn func(Querier) error) error {
	tx, err := s.conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(s.Queries.WithTx(tx)); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

type pgStore struct {
	*PG
	conn *sql.DB
}

func (s *pgStore) InTx(ctx context.Context, fn func(Querier) error) error {
	tx, err := s.conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(NewPGFromDBTX(tx)); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}
