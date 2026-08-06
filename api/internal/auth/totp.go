package auth

import (
	"context"
	"database/sql"
	"errors"

	"github.com/pquerna/otp/totp"
	"github.com/tradermemos/api/internal/store"
)

var (
	ErrTotpRequired    = errors.New("totp required")
	ErrTotpInvalid     = errors.New("totp code invalid")
	ErrTotpNotEnrolled = errors.New("totp not enrolled")
	ErrTotpAlreadyOn   = errors.New("totp already enabled")
)

// TotpIssuer labels the entry in the authenticator app. Self-hosted servers
// all share it, so the account name carries the email to keep them apart.
const TotpIssuer = "TraderMemos"

// TotpEnabled reports whether the user has confirmed an authenticator.
func TotpEnabled(u store.User) bool {
	return u.TotpSecret.Valid && u.TotpSecret.String != ""
}

// StartTotp mints a candidate secret and its otpauth:// URL.
//
// Deliberately stateless: nothing is written until Confirm proves the user can
// read a code from it. The alternative — parking a pending secret on the user
// row — needs a column to distinguish pending from active, and `users` is the
// one table this schema cannot safely rebuild on SQLite (it is the parent of
// cascading foreign keys). The client holds the candidate between the two
// calls and hands it back; it is already authenticated as this user, so it
// gains nothing it did not have.
func (s *Service) StartTotp(ctx context.Context, uid string) (secret, url string, err error) {
	u, err := s.q.GetUserByID(ctx, uid)
	if err != nil {
		return "", "", ErrInvalidCredentials
	}
	if TotpEnabled(u) {
		return "", "", ErrTotpAlreadyOn
	}
	key, err := totp.Generate(totp.GenerateOpts{Issuer: TotpIssuer, AccountName: u.Email})
	if err != nil {
		return "", "", err
	}
	return key.Secret(), key.URL(), nil
}

// ConfirmTotp stores the candidate secret once a code proves it was scanned.
func (s *Service) ConfirmTotp(ctx context.Context, uid, secret, code string) error {
	u, err := s.q.GetUserByID(ctx, uid)
	if err != nil {
		return ErrInvalidCredentials
	}
	if TotpEnabled(u) {
		return ErrTotpAlreadyOn
	}
	if secret == "" || !totp.Validate(code, secret) {
		return ErrTotpInvalid
	}
	_, err = s.q.UpdateUserTotpSecret(ctx, store.UpdateUserTotpSecretParams{
		TotpSecret: sql.NullString{String: secret, Valid: true},
		ID:         uid,
	})
	return err
}

// DisableTotp turns the second factor off. The password is re-checked because
// a borrowed unlocked session should not be able to strip a factor.
func (s *Service) DisableTotp(ctx context.Context, uid, password, code string) error {
	u, err := s.q.GetUserByID(ctx, uid)
	if err != nil {
		return ErrInvalidCredentials
	}
	if !TotpEnabled(u) {
		return ErrTotpNotEnrolled
	}
	if !VerifyPassword(u.PasswordHash, password) {
		return ErrInvalidCredentials
	}
	if !totp.Validate(code, u.TotpSecret.String) {
		return ErrTotpInvalid
	}
	return s.clearTotp(ctx, uid)
}

// ClearTotpCLI is the break-glass path: on a self-hosted box, shell access is
// the recovery route when an authenticator is lost, which is why there are no
// recovery codes to store, print or lose.
func (s *Service) ClearTotpCLI(ctx context.Context, uid string) error {
	return s.clearTotp(ctx, uid)
}

func (s *Service) clearTotp(ctx context.Context, uid string) error {
	_, err := s.q.UpdateUserTotpSecret(ctx, store.UpdateUserTotpSecretParams{
		TotpSecret: sql.NullString{Valid: false},
		ID:         uid,
	})
	return err
}
