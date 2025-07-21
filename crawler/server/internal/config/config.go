// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package config

import (
	"github.com/curioswitch/go-curiostack/config"
)

// Services are URLs to access other services.
type Services struct {
	// Crawler is the URL to access the crawler service.
	Crawler string `koanf:"crawler"`
}

type Config struct {
	Services Services `koanf:"services"`

	config.Common
}
