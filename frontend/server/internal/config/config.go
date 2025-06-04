// Copyright (c) Choko (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package config

import (
	"github.com/curioswitch/go-curiostack/config"
)

// Authorization contains the configuration for authorizing access to the application.
type Authorization struct {
	// EmailsCSV is a comma-separated list of email addresses that are authorized to access the application.
	EmailsCSV string `koanf:"emails"`
}

type Search struct {
	// Engine is the name of the search engine to use, e.g. projects/408496405753/locations/global/collections/default_collection/engines/cookchat-recipes.
	Engine string `koanf:"engine"`
}

type Config struct {
	config.Common

	// Authorization is the configuration for authorizing access to the application.
	Authorization Authorization `koanf:"authorization"`

	// Search is the configuration for search.
	Search Search `koanf:"search"`
}
