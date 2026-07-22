package openapi

import (
	_ "embed"
)

//go:embed openapi.yaml
var Spec []byte
