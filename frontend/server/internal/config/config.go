// Copyright (c) CurioSwitch (choko@curioswitch.org)
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

// Tasks contains the configuration for Cloud Tasks.
type Tasks struct {
	// Invoker is the service account email to use as the identity of the task when it is executed.
	Invoker string `koanf:"invoker"`
	// Queue is the name of the Cloud Tasks queue to use.
	Queue string `koanf:"queue"`
	// URL is the URL to send the task to.
	URL string `koanf:"url"`
}

type Config struct {
	config.Common

	// Authorization is the configuration for authorizing access to the application.
	Authorization Authorization `koanf:"authorization"`

	// Search is the configuration for search.
	Search Search `koanf:"search"`

	// Tasks is the configuration for Cloud Tasks.
	Tasks Tasks `koanf:"tasks"`
}
