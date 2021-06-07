package main

import (
	"context"
	"flag"
	"strconv"
	"time"

	"github.com/google/subcommands"
	"github.com/simmonmt/xmaslist/backend/database"
)

type listCreateCommand struct {
	baseCommand

	active      bool
	owner       string
	name        string
	beneficiary string
	eventDate   string
}

func (c *listCreateCommand) Name() string     { return "create" }
func (c *listCreateCommand) Synopsis() string { return "Create a single list" }
func (c *listCreateCommand) Usage() string {
	return `list create [--active] --owner owner_id
                 --beneficiary beneficiary --event_date date --name name
                 db_path
`
}

func (c *listCreateCommand) SetFlags(f *flag.FlagSet) {
	f.BoolVar(&c.active, "active", true, "Whether list is active")
	f.StringVar(&c.owner, "owner", "", "Owner")
	f.StringVar(&c.beneficiary, "beneficiary", "", "Beneficiary")
	f.StringVar(&c.eventDate, "event_date", "", "Event Date")
	f.StringVar(&c.name, "name", "", "Event name")
}

func (c *listCreateCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	if c.owner == "" {
		return c.usage("--owner is required")
	}
	if c.beneficiary == "" {
		return c.usage("--beneficiary is required")
	}
	if c.name == "" {
		return c.usage("--name is required")
	}

	eventDate, err := parseDate(c.eventDate)
	if err != nil {
		return c.usage("invalid event date: %v", err)
	}

	listData := &database.ListData{
		Name:        c.name,
		Beneficiary: c.beneficiary,
		EventDate:   eventDate,
		Active:      c.active,
	}

	var dbPath string
	if err := c.unpackArgs(f, &dbPath); err != nil {
		return c.usage("Error: %v\n%s", err, c.Usage())
	}

	db, err := database.Open(dbPath)
	if err != nil {
		return c.failure("failed to open database: %v", err)
	}

	owner, err := strconv.Atoi(c.owner)
	if err != nil {
		user, err := db.LookupUserByUsername(ctx, c.owner)
		if err != nil {
			return c.failure("failed to lookup user %v: %v", c.owner, err)
		}
		if user == nil {
			return c.failure("no such user %v", c.owner)
		}
		owner = user.ID
	}

	list, err := db.CreateList(ctx, owner, listData, time.Now())
	if err != nil {
		return c.failure("failed to create list: %v", err)
	}

	return c.success("Created list %v", list.ID)
}
