package testutil

import (
	"github.com/simmonmt/xmaslist/backend/database"
)

type Foo struct{ A int }

func MakeDB() *database.DB {
	return &database.DB{}
}
