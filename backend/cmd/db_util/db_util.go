package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path"
	"reflect"
	"strconv"
	"strings"

	"github.com/google/subcommands"
	"github.com/simmonmt/xmaslist/backend/database"
)

var (
	dbFile = flag.String("db_file", "", "path to database")
)

func subcommanderName(components ...string) string {
	return path.Base(os.Args[0]) + " " + strings.Join(components, " ")
}

func requiredStringArgs(num int, args []interface{}) ([]string, error) {
	if len(args) < num {
		return nil, fmt.Errorf("missing arg(s)")
	}
	if len(args) != num {
		return nil, fmt.Errorf("too many args")
	}

	strs := []string{}
	for i := 0; i < num; i++ {
		arg := args[i]
		str, ok := arg.(string)
		if !ok {
			return nil, fmt.Errorf("bad arg %v", arg)
		}
		strs = append(strs, str)
	}

	return strs, nil
}

type userCommand struct{}

func (c *userCommand) Name() string             { return "user" }
func (c *userCommand) Synopsis() string         { return "User commands" }
func (c *userCommand) Usage() string            { return `user subcommand` }
func (c *userCommand) SetFlags(f *flag.FlagSet) {}

func (c *userCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	cdr := subcommands.NewCommander(f, subcommanderName("user"))
	cdr.Register(cdr.HelpCommand(), "")
	cdr.Register(&userLookupCommand{}, "")
	return cdr.Execute(ctx, args[1:]...)
}

type userLookupCommand struct{}

func (c *userLookupCommand) Name() string     { return "lookup" }
func (c *userLookupCommand) Synopsis() string { return "Lookup a single user" }
func (c *userLookupCommand) Usage() string {
	return `user lookup db_path userid
`
}
func (c *userLookupCommand) SetFlags(f *flag.FlagSet) {}

func (c *userLookupCommand) usageReturn(msg string, args ...interface{}) subcommands.ExitStatus {
	fmt.Printf("Error: "+msg+"\n", args...)
	c.Usage()
	return subcommands.ExitUsageError
}

func (c *userLookupCommand) failureReturn(msg string, args ...interface{}) subcommands.ExitStatus {
	fmt.Printf(msg+"\n", args...)
	c.Usage()
	return subcommands.ExitFailure
}

func (c *userLookupCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	strs, err := requiredStringArgs(2, args[1:])
	if err != nil {
		return c.usageReturn("%v", err)
	}
	dbPath, userArg := strs[0], strs[1]

	userID, err := strconv.Atoi(userArg)
	if err != nil {
		return c.usageReturn("invalid userid: %v", err)
	}

	db, err := database.Open(dbPath)
	if err != nil {
		return c.failureReturn("failed to open database: %v", err)
	}

	user, err := db.LookupUser(ctx, userID)
	if err != nil {
		return c.failureReturn("failed to lookup user: %v", err)
	}

	if user == nil {
		fmt.Printf("no user found with ID %v\n", userID)
		return subcommands.ExitSuccess
	}

	userVal := reflect.ValueOf(*user)
	userType := reflect.TypeOf(*user)
	for i := 0; i < userVal.NumField(); i++ {
		field := userVal.Field(i)
		fmt.Printf("%v: %v\n", userType.Field(i).Name, field.Interface())
	}

	return subcommands.ExitSuccess
}

func main() {
	flag.Parse()

	subcommands.Register(subcommands.HelpCommand(), "")
	subcommands.Register(subcommands.FlagsCommand(), "")
	subcommands.Register(subcommands.CommandsCommand(), "")
	subcommands.Register(&userCommand{}, "")

	cdrArgs := []interface{}{}
	for _, arg := range flag.Args() {
		cdrArgs = append(cdrArgs, arg)
	}

	ctx := context.Background()
	os.Exit(int(subcommands.Execute(ctx, cdrArgs...)))
}
