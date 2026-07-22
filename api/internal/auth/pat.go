package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strings"
)

// PATPrefix is the fixed prefix for personal access tokens so middleware can
// distinguish them from JWT session access tokens without parsing JWT first.
const PATPrefix = "tm_pat_"

// PATPrefixLen is how many characters of the secret are stored/shown as a hint.
const PATPrefixLen = 12

// GeneratePAT returns a new opaque personal access token secret.
func GeneratePAT() (string, error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return PATPrefix + base64.RawURLEncoding.EncodeToString(b[:]), nil
}

// HashPAT returns the SHA-256 hex digest of a PAT secret for storage/lookup.
func HashPAT(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

// IsPAT reports whether the bearer token looks like a personal access token.
func IsPAT(token string) bool {
	return strings.HasPrefix(token, PATPrefix)
}

// DisplayPrefix returns a short prefix suitable for UI display.
func DisplayPrefix(secret string) string {
	if len(secret) <= PATPrefixLen {
		return secret
	}
	return secret[:PATPrefixLen]
}
