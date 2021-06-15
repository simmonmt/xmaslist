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
	cdr.Register(&userCreateCommand{}, "")
	cdr.Register(&userListCommand{}, "")
	cdr.Register(&userLookupCommand{}, "")
	return cdr.Execute(ctx)
}

type listCommand struct{}

func (c *listCommand) Name() string             { return "list" }
func (c *listCommand) Synopsis() string         { return "List commands" }
func (c *listCommand) Usage() string            { return `list subcommand` }
func (c *listCommand) SetFlags(f *flag.FlagSet) {}

func (c *listCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	cdr := subcommands.NewCommander(f, subcommanderName("list"))
	cdr.Register(cdr.HelpCommand(), "")
	cdr.Register(&listCreateCommand{}, "")
	cdr.Register(&listListCommand{}, "")
	//cdr.Register(&listLookupCommand{}, "")
	return cdr.Execute(ctx)
}

type itemCommand struct{}

func (c *itemCommand) Name() string             { return "item" }
func (c *itemCommand) Synopsis() string         { return "List item commands" }
func (c *itemCommand) Usage() string            { return `item subcommand` }
func (c *itemCommand) SetFlags(f *flag.FlagSet) {}

func (c *itemCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	cdr := subcommands.NewCommander(f, subcommanderName("item"))
	cdr.Register(cdr.HelpCommand(), "")
	cdr.Register(&itemCreateCommand{}, "")
	return cdr.Execute(ctx)
}

func main() {
	subcommands.Register(subcommands.HelpCommand(), "")
	subcommands.Register(subcommands.FlagsCommand(), "")
	subcommands.Register(subcommands.CommandsCommand(), "")
	subcommands.Register(&listCommand{}, "")
	subcommands.Register(&itemCommand{}, "")
	subcommands.Register(&userCommand{}, "")

	flag.Parse()

	ctx := context.Background()
	os.Exit(int(subcommands.Execute(ctx)))
}
