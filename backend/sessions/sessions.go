package sessions

import (
	"log"
	"os"
)

var (
	logger = log.New(os.Stderr, "[sessions] ", log.LstdFlags)
)
