package db

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// The Postgres schema stores instants in TIMESTAMP (without time zone)
// columns, and pgx encodes a time.Time into one by keeping its wall clock and
// dropping the offset: 09:59-04:00 lands as 09:59, four hours early, with no
// error. utcTimestampCodec converts to UTC first so the column always holds
// the UTC wall clock — the same convention the SQLite DSN enforces with
// _timezone=UTC.
type utcTimestampCodec struct {
	pgtype.TimestampCodec
}

func (c *utcTimestampCodec) PlanEncode(m *pgtype.Map, oid uint32, format int16, value any) pgtype.EncodePlan {
	if _, ok := value.(pgtype.TimestampValuer); !ok {
		return nil
	}
	next := c.TimestampCodec.PlanEncode(m, oid, format, pgtype.Timestamp{})
	if next == nil {
		return nil
	}
	return utcTimestampEncodePlan{next: next}
}

type utcTimestampEncodePlan struct {
	next pgtype.EncodePlan
}

func (p utcTimestampEncodePlan) Encode(value any, buf []byte) ([]byte, error) {
	ts, err := value.(pgtype.TimestampValuer).TimestampValue()
	if err != nil {
		return nil, err
	}
	if ts.Valid && ts.InfinityModifier == pgtype.Finite {
		ts.Time = ts.Time.UTC()
	}
	return p.next.Encode(ts, buf)
}

// registerUTCTimestamp swaps the connection's timestamp codec for the
// UTC-normalizing one. Run as a stdlib AfterConnect hook.
func registerUTCTimestamp(_ context.Context, conn *pgx.Conn) error {
	conn.TypeMap().RegisterType(&pgtype.Type{
		Name:  "timestamp",
		OID:   pgtype.TimestampOID,
		Codec: &utcTimestampCodec{},
	})
	return nil
}
