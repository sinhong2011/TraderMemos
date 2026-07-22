package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/tradermemos/api/internal/store"
)

var ErrInvalidCredentials = errors.New("invalid credentials")

type Service struct {
	q   *store.Queries
	jwt *JWT
}

func NewService(q *store.Queries, jwt *JWT) *Service { return &Service{q: q, jwt: jwt} }

type Tokens struct {
	Access  string `json:"access_token"`
	Refresh string `json:"refresh_token"`
}

func (s *Service) Register(ctx context.Context, email, password string) (store.User, error) {
	h, err := HashPassword(password)
	if err != nil {
		return store.User{}, err
	}
	u, err := s.q.CreateUser(ctx, store.CreateUserParams{ID: uuid.NewString(), Email: email, PasswordHash: h})
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

func (s *Service) Refresh(refresh string) (Tokens, error) {
	uid, err := s.jwt.Parse(refresh)
	if err != nil {
		return Tokens{}, ErrInvalidCredentials
	}
	return s.mint(uid), nil
}

func (s *Service) mint(uid string) Tokens {
	access, _ := s.jwt.Mint(uid, 15*time.Minute)
	refresh, _ := s.jwt.Mint(uid, 30*24*time.Hour)
	return Tokens{Access: access, Refresh: refresh}
}
