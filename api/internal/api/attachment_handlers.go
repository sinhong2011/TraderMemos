package api

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

var allowedImageTypes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/webp": true,
}

func (s *Server) attachmentRoutes(g *echo.Group) {
	g.POST("/trades/:id/attachments", s.handleUploadAttachment)
	g.GET("/trades/:id/attachments", s.handleListAttachments)
	g.GET("/attachments/:id/file", s.handleGetAttachmentFile)
	g.DELETE("/attachments/:id", s.handleDeleteAttachment)

	g.POST("/media", s.handleUploadMedia)
	g.GET("/media/:id/file", s.handleGetMediaFile)
	g.DELETE("/media/:id", s.handleDeleteMedia)
}

// ownsTrade returns nil only if the trade exists and belongs to userID.
func (s *Server) ownsTrade(c *echo.Context, userID, tradeID string) error {
	_, err := s.deps.Store.GetTrade(c.Request().Context(), store.GetTradeParams{ID: tradeID, UserID: userID})
	return err
}

// sniffImageContentType peeks at the stream and returns a validated image type.
// The returned reader re-includes the peeked bytes.
func sniffImageContentType(r io.Reader, declared string) (contentType string, body io.Reader, err error) {
	buf := make([]byte, 512)
	n, readErr := io.ReadFull(r, buf)
	if readErr != nil && !errors.Is(readErr, io.EOF) && !errors.Is(readErr, io.ErrUnexpectedEOF) {
		return "", nil, readErr
	}
	if n == 0 {
		return "", nil, errors.New("empty file")
	}
	detected := http.DetectContentType(buf[:n])
	// DetectContentType returns image/jpeg for JPEG; normalize declared aliases.
	declared = strings.TrimSpace(strings.ToLower(declared))
	if declared == "image/jpg" {
		declared = "image/jpeg"
	}
	ct := detected
	if !allowedImageTypes[ct] {
		// Some clients send accurate types while DetectContentType is conservative.
		if allowedImageTypes[declared] && (ct == "application/octet-stream" || ct == "application/zip") {
			ct = declared
		} else {
			return "", nil, errors.New("only png/jpeg/webp images are allowed")
		}
	}
	return ct, io.MultiReader(bytes.NewReader(buf[:n]), r), nil
}

func (s *Server) purgeAttachmentRows(ctx context.Context, rows []store.TradeAttachment) {
	for _, att := range rows {
		_ = s.deps.Storage.Delete(att.StorageKey)
	}
}

func (s *Server) purgeAttachmentsForTrade(ctx context.Context, userID, tradeID string) {
	rows, err := s.deps.Store.ListAttachmentsForTrade(ctx, store.ListAttachmentsForTradeParams{
		TradeID: tradeID, UserID: userID,
	})
	if err != nil {
		return
	}
	s.purgeAttachmentRows(ctx, rows)
}

func (s *Server) purgeAttachmentsForAccount(ctx context.Context, userID, accountID string) {
	rows, err := s.deps.Store.ListAttachmentsForAccount(ctx, store.ListAttachmentsForAccountParams{
		UserID: userID, AccountID: accountID,
	})
	if err != nil {
		return
	}
	s.purgeAttachmentRows(ctx, rows)
}

func (s *Server) handleUploadAttachment(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	tradeID := c.Param("id")
	if err := s.ownsTrade(c, uid, tradeID); err != nil {
		return Fail(http.StatusNotFound, "not_found", "trade not found", nil)
	}
	fh, err := c.FormFile("file")
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "file is required", nil)
	}
	if s.deps.AttachMaxBytes > 0 && fh.Size > s.deps.AttachMaxBytes {
		return Fail(http.StatusRequestEntityTooLarge, "too_large", "attachment exceeds size limit", nil)
	}
	src, err := fh.Open()
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "could not read file", nil)
	}
	defer src.Close()

	ct, body, err := sniffImageContentType(src, fh.Header.Get("Content-Type"))
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}

	id := uuid.NewString()
	key := uid + "/" + id
	if err := s.deps.Storage.Put(key, body); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not store attachment", nil)
	}
	att, err := s.deps.Store.InsertAttachment(ctx, store.InsertAttachmentParams{
		ID: id, UserID: uid, TradeID: tradeID, Filename: fh.Filename,
		ContentType: ct, SizeBytes: fh.Size, StorageKey: key,
	})
	if err != nil {
		_ = s.deps.Storage.Delete(key)
		return Fail(http.StatusInternalServerError, "internal", "could not record attachment", nil)
	}
	return c.JSON(http.StatusCreated, att)
}

func (s *Server) handleListAttachments(c *echo.Context) error {
	uid := auth.UserID(c)
	tradeID := c.Param("id")
	if err := s.ownsTrade(c, uid, tradeID); err != nil {
		return Fail(http.StatusNotFound, "not_found", "trade not found", nil)
	}
	rows, err := s.deps.Store.ListAttachmentsForTrade(c.Request().Context(), store.ListAttachmentsForTradeParams{
		TradeID: tradeID, UserID: uid,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list attachments", nil)
	}
	if rows == nil {
		rows = []store.TradeAttachment{}
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) handleGetAttachmentFile(c *echo.Context) error {
	att, err := s.deps.Store.GetAttachment(c.Request().Context(), store.GetAttachmentParams{
		ID: c.Param("id"), UserID: auth.UserID(c),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "attachment not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load attachment", nil)
	}
	r, err := s.deps.Storage.Get(att.StorageKey)
	if err != nil {
		return Fail(http.StatusNotFound, "not_found", "file missing", nil)
	}
	defer r.Close()
	return c.Stream(http.StatusOK, att.ContentType, r)
}

func (s *Server) handleDeleteAttachment(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	att, err := s.deps.Store.GetAttachment(ctx, store.GetAttachmentParams{ID: c.Param("id"), UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "attachment not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load attachment", nil)
	}
	_ = s.deps.Storage.Delete(att.StorageKey)
	if _, err := s.deps.Store.DeleteAttachment(ctx, store.DeleteAttachmentParams{ID: att.ID, UserID: uid}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete attachment", nil)
	}
	return c.NoContent(http.StatusNoContent)
}

type mediaDTO struct {
	ID          string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
	CreatedAt   any    `json:"created_at"`
}

func toMediaDTO(m store.MediaFile) mediaDTO {
	return mediaDTO{
		ID: m.ID, Filename: m.Filename, ContentType: m.ContentType,
		SizeBytes: m.SizeBytes, CreatedAt: m.CreatedAt,
	}
}

func (s *Server) handleUploadMedia(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	fh, err := c.FormFile("file")
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "file is required", nil)
	}
	if s.deps.AttachMaxBytes > 0 && fh.Size > s.deps.AttachMaxBytes {
		return Fail(http.StatusRequestEntityTooLarge, "too_large", "file exceeds size limit", nil)
	}
	src, err := fh.Open()
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "could not read file", nil)
	}
	defer src.Close()

	ct, body, err := sniffImageContentType(src, fh.Header.Get("Content-Type"))
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}

	id := uuid.NewString()
	key := uid + "/media/" + id
	if err := s.deps.Storage.Put(key, body); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not store media", nil)
	}
	row, err := s.deps.Store.InsertMediaFile(ctx, store.InsertMediaFileParams{
		ID: id, UserID: uid, Filename: fh.Filename,
		ContentType: ct, SizeBytes: fh.Size, StorageKey: key,
	})
	if err != nil {
		_ = s.deps.Storage.Delete(key)
		return Fail(http.StatusInternalServerError, "internal", "could not record media", nil)
	}
	return c.JSON(http.StatusCreated, toMediaDTO(row))
}

func (s *Server) handleGetMediaFile(c *echo.Context) error {
	row, err := s.deps.Store.GetMediaFile(c.Request().Context(), store.GetMediaFileParams{
		ID: c.Param("id"), UserID: auth.UserID(c),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "media not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load media", nil)
	}
	r, err := s.deps.Storage.Get(row.StorageKey)
	if err != nil {
		return Fail(http.StatusNotFound, "not_found", "file missing", nil)
	}
	defer r.Close()
	return c.Stream(http.StatusOK, row.ContentType, r)
}

func (s *Server) handleDeleteMedia(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	row, err := s.deps.Store.GetMediaFile(ctx, store.GetMediaFileParams{ID: c.Param("id"), UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "media not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load media", nil)
	}
	_ = s.deps.Storage.Delete(row.StorageKey)
	if _, err := s.deps.Store.DeleteMediaFile(ctx, store.DeleteMediaFileParams{ID: row.ID, UserID: uid}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete media", nil)
	}
	return c.NoContent(http.StatusNoContent)
}
