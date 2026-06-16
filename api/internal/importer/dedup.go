package importer

import (
	"crypto/sha256"
	"fmt"
	"time"
)

func DedupHash(symbol, side string, qty, price float64, at time.Time) string {
	raw := fmt.Sprintf("%s|%s|%.4f|%.6f|%d", symbol, side, qty, price, at.UTC().Unix())
	sum := sha256.Sum256([]byte(raw))
	return fmt.Sprintf("%x", sum[:16])
}
