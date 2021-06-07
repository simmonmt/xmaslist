package main

import (
	"context"
	"flag"

	"github.com/google/subcommands"
	"github.com/simmonmt/xmaslist/backend/database"
)

type userCreateCommand struct {
	baseCommand

	isAdmin bool
}

func (c *userCreateCommand) Name() string     { return "create" }
func (c *userCreateCommand) Synopsis() string { return "Create a single user" }
func (c *userCreateCommand) Usage() string {
	return `user create db_path [--admin] username fullname password
`
}

func (c *userCreateCommand) SetFlags(f *flag.FlagSet) {
	f.BoolVar(&c.isAdmin, "admin", false, "Create admin user")
}

func (c *userCreateCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	user := &database.User{}
	var dbPath, password string
	if err := c.unpackArgs(f, &dbPath, &user.Username, &user.Fullname, &password); err != nil {
		return c.usage("Error: %v\n%s", err, c.Usage())
	}
	user.Admin = c.isAdmin

	db, err := database.Open(dbPath)
	if err != nil {
		return c.failure("failed to open database: %v", err)
	}

	userID, err := db.CreateUser(ctx, user, password)
	if err != nil {
		return c.failure("failed to create user: %v", err)
	}

	return c.success("Created user %v", userID)
}
