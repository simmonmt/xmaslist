package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/google/subcommands"
)

type baseCommand struct{}

func (c *baseCommand) Usage() string {
	panic("unimplemented")
}

func (c *baseCommand) SetFlags(f *flag.FlagSet) {}

func (c *baseCommand) usage(msg string, args ...interface{}) subcommands.ExitStatus {
	fmt.Fprintf(os.Stderr, "Error: "+msg+"\n", args...)
	c.Usage()
	return subcommands.ExitUsageError
}

func (c *baseCommand) failure(msg string, args ...interface{}) subcommands.ExitStatus {
	fmt.Fprintf(os.Stderr, msg+"\n", args...)
	fmt.Fprintf(os.Stderr, c.Usage())
	return subcommands.ExitFailure
}

func (c *baseCommand) success(msg string, args ...interface{}) subcommands.ExitStatus {
	fmt.Printf(msg+"\n", args...)
	c.Usage()
	return subcommands.ExitSuccess
}
