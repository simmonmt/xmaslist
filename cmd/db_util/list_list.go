package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strconv"
	"text/tabwriter"
	"time"

	"github.com/google/subcommands"
	"github.com/simmonmt/xmaslist/backend/database"
)

type listListCommand struct {
	baseCommand
}

func (c *listListCommand) Name() string     { return "list" }
func (c *listListCommand) Synopsis() string { return "List users" }
func (c *listListCommand) Usage() string {
	return `user list db_path
`
}
func (c *listListCommand) SetFlags(f *flag.FlagSet) {}

func (c *listListCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	var dbPath string
	if err := c.unpackArgs(f, &dbPath); err != nil {
		return c.usage("Error: %v\n%s", err, c.Usage())
	}

	db, err := database.Open(dbPath)
	if err != nil {
		return c.failure("failed to open database: %v", err)
	}

	lists, err := db.ListLists(ctx, database.IncludeInactiveLists(true))
	if err != nil {
		return c.failure("failed to list lists: %v", err)
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 1, ' ', 0)
	fmt.Fprintln(w, "ID\tA?\tOwner\tBeneficiary\tEvent Date\tName")
	fmt.Fprintln(w, "--\t--\t-----\t-----------\t----------\t----")

	for _, list := range lists {
		active := "y"
		if !list.Active {
			active = "n"
		}

		owner := strconv.Itoa(list.OwnerID)

		fmt.Fprintf(w, "%v\t%v\t%v\t%v\t%v\t%v\n",
			list.ID, active, owner, list.Beneficiary,
			list.EventDate.Format(time.RFC3339), list.Name)
	}

	w.Flush()

	return subcommands.ExitSuccess
}
