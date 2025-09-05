// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package main

import (
	"github.com/curioswitch/go-build"
	"github.com/goyek/x/boot"
)

func main() {
	build.DefineTasks()
	boot.Main()
}
