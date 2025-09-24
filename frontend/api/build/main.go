// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/curioswitch/go-build"
	"github.com/curioswitch/go-curiostack/tasks"
	protodocs "github.com/curioswitch/go-docs-handler/plugins/proto"
	"github.com/goyek/goyek/v2"
	"github.com/goyek/x/boot"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"
)

func main() {
	tasks.DefineAPI()

	var generateProto *goyek.DefinedTask
	for _, t := range goyek.Tasks() {
		if t.Name() == "generate-proto" {
			generateProto = t
			break
		}
	}

	build.RegisterGenerateTask(goyek.Define(goyek.Task{
		Name: "generate-jsonschema",
		Deps: []*goyek.DefinedTask{generateProto},
		Action: func(a *goyek.A) {
			dspb, err := os.ReadFile(filepath.Join("descriptors", "descriptorset.pb"))
			if err != nil {
				a.Fatalf("reading descriptor set: %v", err)
			}

			a.Logf("dspb length: %d", len(dspb))

			var ds descriptorpb.FileDescriptorSet
			if err := proto.Unmarshal(dspb, &ds); err != nil {
				a.Fatalf("unmarshalling descriptor set: %v", err)
			}
			files, err := protodesc.NewFiles(&ds)
			if err != nil {
				a.Fatalf("creating file descriptors: %v", err)
			}
			files.RangeFiles(func(fd protoreflect.FileDescriptor) bool {
				if strings.HasPrefix(string(fd.Package()), "google.protobuf") {
					return true
				}
				_ = protoregistry.GlobalFiles.RegisterFile(fd)
				return true
			})

			spec, err := protodocs.NewPlugin("frontendapi.FrontendService", protodocs.WithSerializedDescriptors(dspb)).GenerateSpecification()
			if err != nil {
				a.Fatalf("creating plugin: %v", err)
			}

			schemas := generateJSONSchema(spec)
			schemasMap := map[string]jsonSchema{}
			for _, s := range schemas {
				schemasMap[s.ID] = s
			}
			b, err := json.MarshalIndent(schemasMap, "", "  ")
			if err != nil {
				a.Fatalf("marshaling jsonschema: %v", err)
			}

			if err := os.MkdirAll("jsonschema", 0o755); err != nil { //nolint:gosec // common for build artifacts
				a.Fatalf("creating jsonschema dir: %v", err)
			}

			if err := os.WriteFile(filepath.Join("jsonschema", "jsonschema.json"), b, 0o644); err != nil { //nolint:gosec // common for build artifacts
				a.Fatalf("writing jsonschema.json: %v", err)
			}
		},
	}))

	build.DefineTasks()
	boot.Main()
}
