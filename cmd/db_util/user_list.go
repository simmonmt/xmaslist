package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/google/subcommands"
	"github.com/simmonmt/xmaslist/backend/database"
)

type userListCommand struct {
	baseCommand
}

func (c *userListCommand) Name() string     { return "list" }
func (c *userListCommand) Synopsis() string { return "List users" }
func (c *userListCommand) Usage() string {
	return `user list db_path
`
}
func (c *userListCommand) SetFlags(f *flag.FlagSet) {}

func (c *userListCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	var dbPath string
	if err := c.unpackArgs(f, &dbPath); err != nil {
		return c.usage("Error: %v\n%s", err, c.Usage())
	}

	db, err := database.Open(dbPath)
	if err != nil {
		return c.failure("failed to open database: %v", err)
	}

	users, err := db.ListUsers(ctx)
	if err != nil {
		return c.failure("failed to list users: %v", err)
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 1, ' ', 0)
	fmt.Fprintln(w, "ID\tUsername\tFullname\tAdmin")
	fmt.Fprintln(w, "--\t--------\t--------\t-----")

	for _, user := range users {
		admin := ""
		if user.Admin {
			admin = "yes"
		}

		fmt.Fprintf(w, "%v\t%s\t%s\t%s\n",
			user.ID, user.Username, user.Fullname, admin)
	}

	w.Flush()

	return subcommands.ExitSuccess
}
