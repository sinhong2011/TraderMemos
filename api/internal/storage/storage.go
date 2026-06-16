package storage

import (
	"io"
	"os"
	"path/filepath"
)

// Storage is a pluggable backend for storing attachment blobs by key.
type Storage interface {
	Put(key string, r io.Reader) error
	Get(key string) (io.ReadCloser, error)
	Delete(key string) error
}

// LocalDisk stores blobs under a root directory on the local filesystem.
type LocalDisk struct{ root string }

// NewLocalDisk creates a LocalDisk store rooted at root.
func NewLocalDisk(root string) *LocalDisk { return &LocalDisk{root: root} }

// path resolves key to a filesystem path, neutralizing ".." traversal by
// cleaning the key as if it were an absolute path before joining to root.
func (l *LocalDisk) path(key string) string { return filepath.Join(l.root, filepath.Clean("/"+key)) }

func (l *LocalDisk) Put(key string, r io.Reader) error {
	p := l.path(key)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	f, err := os.Create(p)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, r)
	return err
}

func (l *LocalDisk) Get(key string) (io.ReadCloser, error) { return os.Open(l.path(key)) }
func (l *LocalDisk) Delete(key string) error               { return os.Remove(l.path(key)) }
