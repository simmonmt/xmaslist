package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/google/subcommands"
)

type baseCommand struct{}

func (c *baseCommand) SetFlags(f *flag.FlagSet) {}

func (c *baseCommand) unpackArgs(f *flag.FlagSet, dst ...*string) error {
	if len(dst) != len(f.Args()) {
		return fmt.Errorf("expected %d args, got %d",
			len(dst), len(f.Args()))
	}

	for i, ptr := range dst {
		*ptr = f.Args()[i]
	}

	return nil
}

func (c *baseCommand) usage(msg string, args ...interface{}) subcommands.ExitStatus {
	fmt.Fprintf(os.Stderr, msg+"\n", args...)
	return subcommands.ExitUsageError
}

func (c *baseCommand) failure(msg string, args ...interface{}) subcommands.ExitStatus {
	fmt.Fprintf(os.Stderr, msg+"\n", args...)
	return subcommands.ExitFailure
}

func (c *baseCommand) success(msg string, args ...interface{}) subcommands.ExitStatus {
	fmt.Printf(msg+"\n", args...)
	return subcommands.ExitSuccess
}
