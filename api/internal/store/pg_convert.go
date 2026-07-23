package store

import (
	"database/sql"
	"time"
)

func ifaceToNullString(v any) sql.NullString {
	if v == nil {
		return sql.NullString{}
	}
	switch x := v.(type) {
	case string:
		return sql.NullString{String: x, Valid: true}
	case sql.NullString:
		return x
	case *string:
		if x == nil {
			return sql.NullString{}
		}
		return sql.NullString{String: *x, Valid: true}
	default:
		return sql.NullString{}
	}
}

func ifaceToNullTime(v any) sql.NullTime {
	if v == nil {
		return sql.NullTime{}
	}
	switch x := v.(type) {
	case time.Time:
		return sql.NullTime{Time: x, Valid: true}
	case sql.NullTime:
		return x
	case *time.Time:
		if x == nil {
			return sql.NullTime{}
		}
		return sql.NullTime{Time: *x, Valid: true}
	default:
		return sql.NullTime{}
	}
}
