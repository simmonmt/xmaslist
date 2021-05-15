package main

import (
	"context"
	"flag"
	"fmt"
	"reflect"
	"strconv"

	"github.com/google/subcommands"
	"github.com/simmonmt/xmaslist/backend/database"
)

type userLookupCommand struct {
	baseCommand
}

func (c *userLookupCommand) Name() string     { return "lookup" }
func (c *userLookupCommand) Synopsis() string { return "Lookup a single user" }
func (c *userLookupCommand) Usage() string {
	return `user lookup db_path userid
`
}
func (c *userLookupCommand) SetFlags(f *flag.FlagSet) {}

func (c *userLookupCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	strs, err := requiredStringArgs(2, args[1:])
	if err != nil {
		return c.usage("%v", err)
	}
	dbPath, userArg := strs[0], strs[1]

	userID, err := strconv.Atoi(userArg)
	if err != nil {
		return c.usage("invalid userid: %v", err)
	}

	db, err := database.Open(dbPath)
	if err != nil {
		return c.failure("failed to open database: %v", err)
	}

	user, err := db.LookupUser(ctx, userID)
	if err != nil {
		return c.failure("failed to lookup user: %v", err)
	}

	if user == nil {
		return c.success("no user found with ID %v\n", userID)
	}

	userVal := reflect.ValueOf(*user)
	userType := reflect.TypeOf(*user)
	for i := 0; i < userVal.NumField(); i++ {
		field := userVal.Field(i)
		fmt.Printf("%v: %v\n", userType.Field(i).Name, field.Interface())
	}

	return subcommands.ExitSuccess
}
