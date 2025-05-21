package util

import (
	"encoding/base64"
)

// ImageBytesToURL converts image bytes to a data URL (JPEG base64).
func ImageBytesToURL(b []byte) string {
	if len(b) > 0 {
		return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(b)
	}
	return ""
}
