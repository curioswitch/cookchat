// Copyright (c) Choko (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package config

import (
	"github.com/curioswitch/go-curiostack/config"
)

type Search struct {
	// Engine is the name of the search engine to use, e.g. projects/408496405753/locations/global/collections/default_collection/engines/cookchat-recipes.
	Engine string `koanf:"engine"`
}

type Config struct {
	config.Common

	// Search is the configuration for search.
	Search Search `koanf:"search"`
}
