package auth

import (
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
	jwt.RegisteredClaims
}

func (j *JWT) Mint(userID string, ttl time.Duration, typ string) (string, error) {
	c := claims{
		Typ: typ,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(j.secret)
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
