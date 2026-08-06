package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/pquerna/otp/totp"
	"github.com/tradermemos/api/internal/store"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrPasswordTooShort   = errors.New("password too short")
	ErrRegistrationClosed = errors.New("registration closed")
	ErrSetupComplete      = errors.New("setup already complete")
)

type Service struct {
	q                 store.Querier
	jwt               *JWT
	allowRegistration bool
}

func NewService(q store.Querier, jwt *JWT, allowRegistration bool) *Service {
	return &Service{q: q, jwt: jwt, allowRegistration: allowRegistration}
}

type Tokens struct {
	Access  string `json:"access_token"`
	Refresh string `json:"refresh_token"`
}

func (s *Service) CountUsers(ctx context.Context) (int64, error) {
	return s.q.CountUsers(ctx)
}

func (s *Service) NeedsSetup(ctx context.Context) (bool, error) {
	n, err := s.CountUsers(ctx)
	if err != nil {
		return false, err
	}
	return n == 0, nil
}

func (s *Service) RegistrationOpen(ctx context.Context) (bool, error) {
	n, err := s.CountUsers(ctx)
	if err != nil {
		return false, err
	}
	if n == 0 {
		return false, nil // first user must use /setup
	}
	return s.allowRegistration, nil
}

func (s *Service) Register(ctx context.Context, email, password string) (store.User, error) {
	open, err := s.RegistrationOpen(ctx)
	if err != nil {
		return store.User{}, err
	}
	if !open {
		return store.User{}, ErrRegistrationClosed
	}
	return s.createUser(ctx, email, password, false)
}

// CreateUserCLI creates a user bypassing the registration-open gate (ops / CLI).
// The first user is always created as admin.
func (s *Service) CreateUserCLI(ctx context.Context, email, password string) (store.User, error) {
	n, err := s.CountUsers(ctx)
	if err != nil {
		return store.User{}, err
	}
	return s.createUser(ctx, email, password, n == 0)
}

// CompleteSetup creates the first owner account. Only succeeds when no users exist.
func (s *Service) CompleteSetup(ctx context.Context, email, password string) (store.User, Tokens, error) {
	needs, err := s.NeedsSetup(ctx)
	if err != nil {
		return store.User{}, Tokens{}, err
	}
	if !needs {
		return store.User{}, Tokens{}, ErrSetupComplete
	}
	u, err := s.createUser(ctx, email, password, true)
	if err != nil {
		return store.User{}, Tokens{}, err
	}
	return u, s.mint(u.ID, u.PasswordHash), nil
}

func (s *Service) createUser(ctx context.Context, email, password string, isAdmin bool) (store.User, error) {
	if err := ValidatePassword(password); err != nil {
		return store.User{}, err
	}
	h, err := HashPassword(password)
	if err != nil {
		return store.User{}, err
	}
	admin := int64(0)
	if isAdmin {
		admin = 1
	}
	u, err := s.q.CreateUser(ctx, store.CreateUserParams{
		ID:           uuid.NewString(),
		Email:        email,
		PasswordHash: h,
		IsAdmin:      admin,
	})
	if err != nil {
		return store.User{}, err
	}
	if err := store.SeedDefaultSetups(ctx, s.q, u.ID); err != nil {
		return store.User{}, err
	}
	return u, nil
}

// Login checks the password and, when the account has an authenticator, the
// code. `totpCode` is empty on the first leg of a two-step sign-in: the caller
// gets ErrTotpRequired and asks for it.
//
// The password is verified *before* the code so a wrong password never reveals
// whether an account has a second factor.
func (s *Service) Login(ctx context.Context, email, password, totpCode string) (Tokens, store.User, error) {
	u, err := s.q.GetUserByEmail(ctx, email)
	if err != nil || !VerifyPassword(u.PasswordHash, password) {
		return Tokens{}, store.User{}, ErrInvalidCredentials
	}
	if TotpEnabled(u) {
		if totpCode == "" {
			return Tokens{}, store.User{}, ErrTotpRequired
		}
		if !totp.Validate(totpCode, u.TotpSecret.String) {
			return Tokens{}, store.User{}, ErrTotpInvalid
		}
	}
	return s.mint(u.ID, u.PasswordHash), u, nil
}

func (s *Service) Refresh(ctx context.Context, refresh string) (Tokens, error) {
	uid, pv, err := s.jwt.ParseWithVersion(refresh, TokenRefresh)
	if err != nil {
		return Tokens{}, ErrInvalidCredentials
	}
	u, err := s.q.GetUserByID(ctx, uid)
	if err != nil {
		return Tokens{}, ErrInvalidCredentials
	}
	// A changed password changes the hash, so a token minted against the old
	// one no longer matches — that is what signs other devices out. Tokens
	// predating the claim carry an empty `pv` and are grandfathered rather
	// than rejected, so deploying this does not log everyone out.
	if pv != "" && pv != PasswordFingerprint(u.PasswordHash) {
		return Tokens{}, ErrInvalidCredentials
	}
	return s.mint(uid, u.PasswordHash), nil
}

// ChangePassword re-hashes after checking the current one. The new hash gives
// every existing refresh token a stale fingerprint, so other sessions die at
// their next refresh; the access token already in flight survives its 15
// minutes, which is the usual bearer-token tradeoff.
func (s *Service) ChangePassword(ctx context.Context, uid, current, next string) (Tokens, error) {
	u, err := s.q.GetUserByID(ctx, uid)
	if err != nil {
		return Tokens{}, ErrInvalidCredentials
	}
	if !VerifyPassword(u.PasswordHash, current) {
		return Tokens{}, ErrInvalidCredentials
	}
	if err := ValidatePassword(next); err != nil {
		return Tokens{}, err
	}
	h, err := HashPassword(next)
	if err != nil {
		return Tokens{}, err
	}
	updated, err := s.q.UpdateUserPassword(ctx, store.UpdateUserPasswordParams{
		PasswordHash: h,
		ID:           uid,
	})
	if err != nil {
		return Tokens{}, err
	}
	// Hand back a fresh pair so the caller who changed the password is not
	// signed out along with everyone else.
	return s.mint(updated.ID, updated.PasswordHash), nil
}

// Me returns the signed-in user for the profile endpoint.
func (s *Service) Me(ctx context.Context, uid string) (store.User, error) {
	return s.q.GetUserByID(ctx, uid)
}

func (s *Service) mint(uid, passwordHash string) Tokens {
	pv := PasswordFingerprint(passwordHash)
	access, _ := s.jwt.Mint(uid, 15*time.Minute, TokenAccess, pv)
	refresh, _ := s.jwt.Mint(uid, 30*24*time.Hour, TokenRefresh, pv)
	return Tokens{Access: access, Refresh: refresh}
}
