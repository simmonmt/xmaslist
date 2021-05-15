package main

import (
	"context"
	"flag"
	"os"
	"path"
	"strings"

	"github.com/google/subcommands"
)

func subcommanderName(components ...string) string {
	return path.Base(os.Args[0]) + " " + strings.Join(components, " ")
}

type userCommand struct{}

func (c *userCommand) Name() string             { return "user" }
func (c *userCommand) Synopsis() string         { return "User commands" }
func (c *userCommand) Usage() string            { return `user subcommand` }
func (c *userCommand) SetFlags(f *flag.FlagSet) {}

func (c *userCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	cdr := subcommands.NewCommander(f, subcommanderName("user"))
	cdr.Register(cdr.HelpCommand(), "")
	cdr.Register(&userAddCommand{}, "")
	cdr.Register(&userLookupCommand{}, "")
	return cdr.Execute(ctx)
}

func main() {
	subcommands.Register(subcommands.HelpCommand(), "")
	subcommands.Register(subcommands.FlagsCommand(), "")
	subcommands.Register(subcommands.CommandsCommand(), "")
	subcommands.Register(&userCommand{}, "")

	flag.Parse()

	ctx := context.Background()
	os.Exit(int(subcommands.Execute(ctx)))
}
