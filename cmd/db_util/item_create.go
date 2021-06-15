package main

import (
	"context"
	"flag"
	"time"

	"github.com/google/subcommands"
	"github.com/simmonmt/xmaslist/backend/database"
)

type itemCreateCommand struct {
	baseCommand

	listID int
	name   string
	desc   string
	url    string
}

func (c *itemCreateCommand) Name() string     { return "create" }
func (c *itemCreateCommand) Synopsis() string { return "Create a single item" }
func (c *itemCreateCommand) Usage() string {
	return `item create --list_id list_id
                 --name name [--desc desc] [--url url]
                 db_path
`
}

func (c *itemCreateCommand) SetFlags(f *flag.FlagSet) {
	f.IntVar(&c.listID, "list_id", -1, "List ID")
	f.StringVar(&c.name, "name", "", "Item name")
	f.StringVar(&c.desc, "desc", "", "Description")
	f.StringVar(&c.url, "url", "", "URL")
}

func (c *itemCreateCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	if c.listID == 0 {
		return c.usage("--list_id is required")
	}
	if c.name == "" {
		return c.usage("--name is required")
	}

	itemData := &database.ListItemData{
		Name: c.name,
		Desc: c.desc,
		URL:  c.url,
	}

	var dbPath string
	if err := c.unpackArgs(f, &dbPath); err != nil {
		return c.usage("Error: %v\n%s", err, c.Usage())
	}

	db, err := database.Open(dbPath)
	if err != nil {
		return c.failure("failed to open database: %v", err)
	}

	item, err := db.CreateListItem(ctx, c.listID, itemData, time.Now())
	if err != nil {
		return c.failure("failed to create item: %v", err)
	}

	return c.success("Created item %v", item.ID)
}
