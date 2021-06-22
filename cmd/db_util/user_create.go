package main

import (
	"context"
	"flag"
	"fmt"

	"github.com/google/subcommands"
	"github.com/simmonmt/xmaslist/backend/database"
)

type userCreateCommand struct {
	baseCommand

	username string
	password string
	fullname string
	specPath string
	isAdmin  bool
}

type UserSpec struct {
	Username string
	Fullname string
	Password string
	Admin    bool
}

func (c *userCreateCommand) Name() string     { return "create" }
func (c *userCreateCommand) Synopsis() string { return "Create a single user" }
func (c *userCreateCommand) Usage() string {
	return `user create --username username --fullname fullname
                 --password password [--admin]
                 db_path

user create --spec spec db_path

With the spec usage, the input file must look like this:

username: "a"
fullname: "bob"
password: "aa"
admin: true
`
}

func (c *userCreateCommand) SetFlags(f *flag.FlagSet) {
	f.BoolVar(&c.isAdmin, "admin", false, "Create admin user")
	f.StringVar(&c.username, "username", "", "Username")
	f.StringVar(&c.fullname, "fullname", "", "Full name")
	f.StringVar(&c.password, "password", "", "Password")
	f.StringVar(&c.specPath, "spec", "", "User spec")
}

func (c *userCreateCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	var spec UserSpec
	if c.specPath != "" {
		if err := readSpecFromFile(c.specPath, &spec); err != nil {
			return c.failure("failed to parse spec: %v", err)
		}
	} else {
		if c.username == "" {
			return c.usage("--username is required")
		}
		if c.fullname == "" {
			return c.usage("--fullname is required")
		}
		if c.password == "" {
			return c.usage("--password is required")
		}

		spec = UserSpec{
			Username: c.username,
			Fullname: c.fullname,
			Password: c.password,
			Admin:    c.isAdmin,
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

	userID, err := createUser(ctx, db, &spec)
	if err != nil {
		return c.failure("failed to create user: %v", err)
	}

	return c.success("Created user %v", userID)
}

func createUser(ctx context.Context, db *database.DB, spec *UserSpec) (int, error) {
	if spec.Username == "" {
		return -1, fmt.Errorf("spec is missing username")
	}
	if spec.Fullname == "" {
		return -1, fmt.Errorf("spec is missing fullname")
	}
	if spec.Password == "" {
		return -1, fmt.Errorf("spec is missing password")
	}

	user := &database.User{
		Username: spec.Username,
		Fullname: spec.Fullname,
		Admin:    spec.Admin,
	}

	userID, err := db.CreateUser(ctx, user, spec.Password)
	if err != nil {
		return -1, err
	}

	return userID, nil
}
