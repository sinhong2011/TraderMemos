package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	TokenAccess  = "access"
	TokenRefresh = "refresh"
)

type JWT struct{ secret []byte }

func NewJWT(secret string) *JWT { return &JWT{secret: []byte(secret)} }

type claims struct {
	Typ string `json:"typ"`
	// Pv fingerprints the password hash the token was minted against, so a
	// password change can invalidate tokens issued before it. Empty on tokens
	// minted before this claim existed — Refresh treats that as "unknown", not
	// "mismatched", so nobody is signed out by the upgrade itself.
	Pv string `json:"pv,omitempty"`
	jwt.RegisteredClaims
}

// PasswordFingerprint derives the `pv` claim from a stored password hash.
//
// A digest of the hash, never the hash itself: the token is handed to the
// client, and a bcrypt hash in a decodable JWT payload is an offline cracking
// target. Truncated to 8 bytes — this only has to change when the password
// does, and it is compared against a freshly derived value, never inverted.
func PasswordFingerprint(passwordHash string) string {
	sum := sha256.Sum256([]byte(passwordHash))
	return hex.EncodeToString(sum[:8])
}

func (j *JWT) Mint(userID string, ttl time.Duration, typ, passwordVersion string) (string, error) {
	c := claims{
		Typ: typ,
		Pv:  passwordVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(j.secret)
}

// ParseWithVersion returns the subject and the `pv` claim.
func (j *JWT) ParseWithVersion(tok string, wantTyp string) (string, string, error) {
	parsed, err := jwt.ParseWithClaims(tok, &claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("bad signing method")
		}
		return j.secret, nil
	})
	if err != nil {
		return "", "", err
	}
	c, ok := parsed.Claims.(*claims)
	if !ok || !parsed.Valid {
		return "", "", errors.New("invalid token")
	}
	if wantTyp != "" && c.Typ != wantTyp {
		return "", "", errors.New("wrong token type")
	}
	return c.Subject, c.Pv, nil
}

func (j *JWT) Parse(tok string, wantTyp string) (string, error) {
	parsed, err := jwt.ParseWithClaims(tok, &claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("bad signing method")
		}
		return j.secret, nil
	})
	if err != nil {
		return "", err
	}
	c, ok := parsed.Claims.(*claims)
	if !ok || !parsed.Valid {
		return "", errors.New("invalid token")
	}
	if wantTyp != "" && c.Typ != wantTyp {
		return "", errors.New("wrong token type")
	}
	return c.Subject, nil
}
