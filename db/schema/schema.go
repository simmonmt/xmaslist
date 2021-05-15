package schema

import (
	_ "embed"
)

//go:embed schema.txt
var schema string

func Get() string {
	return schema
}
