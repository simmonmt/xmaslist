package main

import (
	"context"
	"flag"

	"github.com/google/subcommands"
	"github.com/simmonmt/xmaslist/backend/database"
)

type loadCommand struct {
	baseCommand

	spec string
}

type LoadSpec struct {
	Lists []*ListSpec
	Users []*UserSpec
}

func (c *loadCommand) Name() string     { return "load" }
func (c *loadCommand) Synopsis() string { return "Load database with data" }
func (c *loadCommand) Usage() string {
	return `load --spec spec db_path

The input file must look like this:

	users:
	  - # contents like in 'user create' subcommand
	lists:
	  - # contents like in 'list create' subcommand
`
}

func (c *loadCommand) SetFlags(f *flag.FlagSet) {
	f.StringVar(&c.spec, "spec", "", "List spec")
}

func (c *loadCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	if c.spec == "" {
		return c.usage("--spec is required")
	}

	var dbPath string
	if err := c.unpackArgs(f, &dbPath); err != nil {
		return c.usage("Error: %v\n%s", err, c.Usage())
	}

	var spec LoadSpec
	if err := readSpecFromFile(c.spec, &spec); err != nil {
		return c.failure("failed to parse spec: %v", err)
	}

	db, err := database.Open(dbPath)
	if err != nil {
		return c.failure("failed to open database: %v", err)
	}

	for userIdx, user := range spec.Users {
		if _, err := createUser(ctx, db, user); err != nil {
			return c.failure("failed to create user %d: %v",
				userIdx+1, err)
		}
	}

	for listIdx, list := range spec.Lists {
		if _, err := createList(ctx, db, list); err != nil {
			return c.failure("failed to create list %d: %v",
				listIdx+1, err)
		}
	}

	return c.success("Loaded database")
}
