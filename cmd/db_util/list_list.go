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

	listID int
}

func (c *listListCommand) Name() string     { return "list" }
func (c *listListCommand) Synopsis() string { return "List lists" }
func (c *listListCommand) Usage() string {
	return `user list [--list_id=list_id] db_path
`
}
func (c *listListCommand) SetFlags(f *flag.FlagSet) {
	f.IntVar(&c.listID, "list_id", -1, "List ID")
}

func listItems(ctx context.Context, db *database.DB, list *database.List) error {
	items, err := db.ListListItems(ctx, list.ID, database.AllItems())
	if err != nil {
		return err
	}

	fmt.Println()
	if len(items) == 0 {
		fmt.Println("no items")
		return nil
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 1, ' ', 0)
	fmt.Fprintln(w, "ID\tVr\tName\tDesc\tURL")
	fmt.Fprintln(w, "--\t--\t----\t----\t---")

	for _, item := range items {
		fmt.Fprintf(w, "%v\t%v\t%v\t%v\t%v\n",
			item.ID, item.Version, item.Name, item.Desc, item.URL)
	}

	w.Flush()
	return nil
}

func (c *listListCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	var dbPath string
	if err := c.unpackArgs(f, &dbPath); err != nil {
		return c.usage("Error: %v\n%s", err, c.Usage())
	}

	db, err := database.Open(dbPath)
	if err != nil {
		return c.failure("failed to open database: %v", err)
	}

	filter := database.IncludeInactiveLists(true)
	oneList := false
	if c.listID > 0 {
		filter = database.OnlyListWithID(c.listID)
		oneList = true
	}

	lists, err := db.ListLists(ctx, filter)
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

	if oneList && len(lists) > 0 {
		list := lists[0]
		if err := listItems(ctx, db, list); err != nil {
			return c.failure(
				"failed to list items for list %d: %v",
				list.ID, err)
		}
	}

	return subcommands.ExitSuccess
}
