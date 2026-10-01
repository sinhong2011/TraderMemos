package importer

import (
	"crypto/sha256"
	"fmt"
	"strconv"
	"time"
)

// OccurrenceDetailsKey is the executions.details key recording which repeat of
// an otherwise identical fill a row is (absent on the first occurrence).
const OccurrenceDetailsKey = "occ"

func DedupHash(symbol, side string, qty, price float64, at time.Time) string {
	return DedupHashOccurrence(symbol, side, qty, price, at, 0)
}

// DedupHashOccurrence keys the n-th (0-based) repeat of the same symbol, side,
// quantity, price and second within one statement. Brokers routinely split one
// order into identical fills in the same second; hashing economics alone kept
// only the first. Occurrence 0 reproduces DedupHash exactly, so rows stored
// before occurrences existed still dedup against a re-import.
func DedupHashOccurrence(symbol, side string, qty, price float64, at time.Time, occurrence int) string {
	raw := fmt.Sprintf("%s|%s|%.4f|%.6f|%d", symbol, side, qty, price, at.UTC().Unix())
	if occurrence > 0 {
		raw += "|#" + strconv.Itoa(occurrence)
	}
	sum := sha256.Sum256([]byte(raw))
	return fmt.Sprintf("%x", sum[:16])
}

// OccurrenceFromDetails reads the occurrence recorded by Commit; 0 when absent.
func OccurrenceFromDetails(details map[string]string) int {
	n, err := strconv.Atoi(details[OccurrenceDetailsKey])
	if err != nil || n < 0 {
		return 0
	}
	return n
}
