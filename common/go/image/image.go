// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package image

import (
	"bytes"
	"context"
	"fmt"
	"image/jpeg"
	"image/png"

	"google.golang.org/genai"

	"github.com/curioswitch/cookchat/common/file"
)

type Writer struct {
	io *file.IO
}

func NewWriter(io *file.IO) *Writer {
	return &Writer{
		io: io,
	}
}

func (w *Writer) WriteGenAIImage(ctx context.Context, path string, blob *genai.Blob) (string, error) {
	var image []byte
	if blob.MIMEType == "image/png" {
		img, err := png.Decode(bytes.NewReader(blob.Data))
		if err != nil {
			return "", fmt.Errorf("image: decoding png image: %w", err)
		}
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, img, nil); err != nil {
			return "", fmt.Errorf("image: encoding png to jpeg: %w", err)
		}
		image = buf.Bytes()
	} else if blob.MIMEType != "image/jpeg" {
		return "", fmt.Errorf("image: unsupported mime type %s", blob.MIMEType)
	} else {
		image = blob.Data
	}

	url, err := w.io.WriteFile(ctx, path, "image/jpeg", image)
	if err != nil {
		return "", fmt.Errorf("image: writing image to file io: %w", err)
	}
	return url, nil
}
