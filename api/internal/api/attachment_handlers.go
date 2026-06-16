package api

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

var allowedImageTypes = map[string]bool{
	"image/png": true, "image/jpeg": true, "image/webp": true,
}

func (s *Server) attachmentRoutes(g *echo.Group) {
	g.POST("/trades/:id/attachments", s.handleUploadAttachment)
	g.GET("/trades/:id/attachments", s.handleListAttachments)
	g.GET("/attachments/:id/file", s.handleGetAttachmentFile)
	g.DELETE("/attachments/:id", s.handleDeleteAttachment)
}

// ownsTrade returns nil only if the trade exists and belongs to userID.
func (s *Server) ownsTrade(c echo.Context, userID, tradeID string) error {
	_, err := s.deps.Store.GetTrade(c.Request().Context(), store.GetTradeParams{ID: tradeID, UserID: userID})
	return err
}

func (s *Server) handleUploadAttachment(c echo.Context) error {
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
	ct := fh.Header.Get("Content-Type")
	if !allowedImageTypes[ct] {
		return Fail(http.StatusBadRequest, "bad_request", "only png/jpeg/webp images are allowed", nil)
	}
	src, err := fh.Open()
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "could not read file", nil)
	}
	defer src.Close()

	id := uuid.NewString()
	key := uid + "/" + id
	if err := s.deps.Storage.Put(key, src); err != nil {
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

func (s *Server) handleListAttachments(c echo.Context) error {
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

func (s *Server) handleGetAttachmentFile(c echo.Context) error {
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

func (s *Server) handleDeleteAttachment(c echo.Context) error {
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
