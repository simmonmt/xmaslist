package main

import (
	"context"
	"flag"
	"io"
	"os"
	"strconv"
	"time"

	"github.com/google/subcommands"
	"github.com/simmonmt/xmaslist/backend/database"
	yaml "gopkg.in/yaml.v2"
)

type listCreateCommand struct {
	baseCommand

	active      bool
	owner       string
	spec        string
	name        string
	beneficiary string
	eventDate   string
}

type ListSpec struct {
	Data  *database.ListData
	Items []*database.ListItemData

	Active bool
	Owner  string
}

func readListSpecFromFile(path string) (*ListSpec, error) {
	if path == "-" {
		return readListSpec(os.Stdin)
	}

	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	return readListSpec(f)
}

func readListSpec(r io.Reader) (*ListSpec, error) {
	spec := &ListSpec{}

	d := yaml.NewDecoder(r)
	if err := d.Decode(&spec); err != nil {
		return nil, err
	}

	return spec, nil
}

func (c *listCreateCommand) Name() string     { return "create" }
func (c *listCreateCommand) Synopsis() string { return "Create a single list" }
func (c *listCreateCommand) Usage() string {
	return `list create [--active] --owner owner_id
                 --beneficiary beneficiary --event_date date --name name
                 db_path

list create --spec spec db_path

With the spec usage, the input file must look like this:

	active: true
	owner: "bob"
	data:
	  name: "a name"
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
	f.StringVar(&c.spec, "spec", "", "List spec")
}

func (c *listCreateCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	var listData *database.ListData
	listItemDatas := []*database.ListItemData{}

	var ownerStr string

	if c.spec != "" {
		s, err := readListSpecFromFile(c.spec)
		if err != nil {
			return c.failure("failed to parse spec: %v", err)
		}

		listData = s.Data
		listItemDatas = s.Items
		ownerStr = s.Owner
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

		listData = &database.ListData{
			Name:        c.name,
			Beneficiary: c.beneficiary,
			EventDate:   eventDate,
			Active:      c.active,
		}

		ownerStr = c.owner
	}

	var dbPath string
	if err := c.unpackArgs(f, &dbPath); err != nil {
		return c.usage("Error: %v\n%s", err, c.Usage())
	}

	db, err := database.Open(dbPath)
	if err != nil {
		return c.failure("failed to open database: %v", err)
	}

	owner, err := strconv.Atoi(ownerStr)
	if err != nil {
		user, err := db.LookupUserByUsername(ctx, ownerStr)
		if err != nil {
			return c.failure("failed to lookup user %v: %v",
				ownerStr, err)
		}
		if user == nil {
			return c.failure("no such user %v", ownerStr)
		}
		owner = user.ID
	}

	list, err := db.CreateList(ctx, owner, listData, time.Now())
	if err != nil {
		return c.failure("failed to create list: %v", err)
	}

	for i, itemData := range listItemDatas {
		_, err := db.CreateListItem(
			ctx, list.ID, itemData, time.Now())
		if err != nil {
			return c.failure("failed to create item %d: %v",
				i, err)
		}
	}

	return c.success("Created list %v", list.ID)
}
