package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/tradermemos/api/internal/store"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrPasswordTooShort   = errors.New("password too short")
	ErrRegistrationClosed = errors.New("registration closed")
	ErrSetupComplete      = errors.New("setup already complete")
)

type Service struct {
	q                  *store.Queries
	jwt                *JWT
	allowRegistration  bool
}

func NewService(q *store.Queries, jwt *JWT, allowRegistration bool) *Service {
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
	return u, s.mint(u.ID), nil
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

func (s *Service) Login(ctx context.Context, email, password string) (Tokens, store.User, error) {
	u, err := s.q.GetUserByEmail(ctx, email)
	if err != nil || !VerifyPassword(u.PasswordHash, password) {
		return Tokens{}, store.User{}, ErrInvalidCredentials
	}
	return s.mint(u.ID), u, nil
}

func (s *Service) Refresh(ctx context.Context, refresh string) (Tokens, error) {
	uid, err := s.jwt.Parse(refresh, TokenRefresh)
	if err != nil {
		return Tokens{}, ErrInvalidCredentials
	}
	if _, err := s.q.GetUserByID(ctx, uid); err != nil {
		return Tokens{}, ErrInvalidCredentials
	}
	return s.mint(uid), nil
}

func (s *Service) mint(uid string) Tokens {
	access, _ := s.jwt.Mint(uid, 15*time.Minute, TokenAccess)
	refresh, _ := s.jwt.Mint(uid, 30*24*time.Hour, TokenRefresh)
	return Tokens{Access: access, Refresh: refresh}
}
