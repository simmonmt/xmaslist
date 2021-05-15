package main

import (
	"context"
	"flag"

	"github.com/google/subcommands"
	"github.com/simmonmt/xmaslist/backend/database"
)

type userAddCommand struct {
	baseCommand

	isAdmin bool
}

func (c *userAddCommand) Name() string     { return "add" }
func (c *userAddCommand) Synopsis() string { return "Add a single user" }
func (c *userAddCommand) Usage() string {
	return `user add db_path [--admin] username fullname password
`
}

func (c *userAddCommand) SetFlags(f *flag.FlagSet) {
	f.BoolVar(&c.isAdmin, "admin", false, "Add admin user")
}

func (c *userAddCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
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

	userID, err := db.AddUser(ctx, user, password)
	if err != nil {
		return c.failure("failed to add user: %v", err)
	}

	return c.success("Added user %v", userID)
}
