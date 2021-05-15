package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/google/subcommands"
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
