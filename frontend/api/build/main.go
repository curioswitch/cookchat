// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package main

import (
	"github.com/curioswitch/go-build"
	"github.com/curioswitch/go-curiostack/tasks"
	"github.com/goyek/x/boot"
)

func main() {
	tasks.DefineAPI()
	build.DefineTasks()
	boot.Main()
}
