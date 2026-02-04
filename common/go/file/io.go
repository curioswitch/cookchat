// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package file

import (
	"context"
	"fmt"

	"cloud.google.com/go/storage"
)

type IO struct {
	storage *storage.Client
	bucket  string
}

func NewIO(storage *storage.Client, bucket string) *IO {
	return &IO{
		storage: storage,
		bucket:  bucket,
	}
}

func (io *IO) WriteFile(ctx context.Context, path string, contentType string, data []byte) (string, error) {
	wc := io.storage.Bucket(io.bucket).Object(path).NewWriter(ctx)
	defer func() {
		_ = wc.Close()
	}()
	wc.ContentType = contentType
	if _, err := wc.Write(data); err != nil {
		return "", fmt.Errorf("file: writing file: %w", err)
	}
	url := fmt.Sprintf("https://storage.googleapis.com/%s/%s", io.bucket, path)
	return url, nil
}
