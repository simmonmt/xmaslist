package main

import (
	"context"
	"flag"
	"fmt"
	"time"

	"github.com/google/subcommands"
	"github.com/simmonmt/xmaslist/backend/database"
)

type listCreateCommand struct {
	baseCommand

	active      bool
	owner       string
	specPath    string
	name        string
	beneficiary string
	eventDate   string
}

type ListSpec struct {
	Data  *database.ListData
	Items []*database.ListItemData

	Owner string
}

func (c *listCreateCommand) Name() string     { return "create" }
func (c *listCreateCommand) Synopsis() string { return "Create a single list" }
func (c *listCreateCommand) Usage() string {
	return `list create [--active] --owner owner_id
                 --beneficiary beneficiary --event_date date --name name
                 db_path

list create --spec spec db_path

With the spec usage, the input file must look like this:

	owner: "bob"
	data:
	  name: "a name"
	  active: true
	  beneficiary: "sue"
	  eventdate: "2021-07-15T00:00:00-04:00"
	items:
	  - name: "item1"
	    desc: "desc1"
	    url: "url1"
`
}

func (c *listCreateCommand) SetFlags(f *flag.FlagSet) {
	f.BoolVar(&c.active, "active", true, "Whether list is active")
	f.StringVar(&c.owner, "owner", "", "Owner")
	f.StringVar(&c.beneficiary, "beneficiary", "", "Beneficiary")
	f.StringVar(&c.eventDate, "event_date", "", "Event Date")
	f.StringVar(&c.name, "name", "", "Event name")
	f.StringVar(&c.specPath, "spec", "", "List spec")
}

func (c *listCreateCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	var spec ListSpec
	if c.specPath != "" {
		if err := readSpecFromFile(c.specPath, &spec); err != nil {
			return c.failure("failed to parse spec: %v", err)
		}
	} else {
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

		spec = ListSpec{
			Data: &database.ListData{
				Name:        c.name,
				Beneficiary: c.beneficiary,
				EventDate:   eventDate,
				Active:      c.active,
			},
			Owner: c.owner,
		}
	}

	var dbPath string
	if err := c.unpackArgs(f, &dbPath); err != nil {
		return c.usage("Error: %v\n%s", err, c.Usage())
	}

	db, err := database.Open(dbPath)
	if err != nil {
		return c.failure("failed to open database: %v", err)
	}

	listID, err := createList(ctx, db, &spec)
	if err != nil {
		return c.failure("failed to create list: %v", err)
	}

	return c.success("Created list %v", listID)
}

func createList(ctx context.Context, db *database.DB, spec *ListSpec) (int, error) {
	if spec.Owner == "" {
		return -1, fmt.Errorf("spec is missing owner")
	}

	owner, err := parseUserNameOrID(ctx, db, spec.Owner)
	if err != nil {
		return -1, err
	}

	if spec.Data.Name == "" {
		return -1, fmt.Errorf("spec is missing list name")
	}

	list, err := db.CreateList(ctx, owner, spec.Data, time.Now())
	if err != nil {
		return -1, err
	}

	for itemIdx, itemData := range spec.Items {
		_, err := db.CreateListItem(
			ctx, list.ID, itemData, time.Now())
		if err != nil {
			return -1, fmt.Errorf("failed to create item %d: %v",
				itemIdx+1, err)
		}
	}

	return list.ID, nil
}
