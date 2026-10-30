package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/google/subcommands"
	"github.com/simmonmt/xmaslist/backend/database"
	"golang.org/x/term"
)

type userPasswdCommand struct {
	baseCommand

	username     string
	passwordFile string
}

func (c *userPasswdCommand) Name() string { return "passwd" }
func (c *userPasswdCommand) Synopsis() string {
	return "Set a user's password and log them out"
}
func (c *userPasswdCommand) Usage() string {
	return `user passwd --username username [--password_file path] db_path

Sets the user's password and deletes their sessions, logging them out
everywhere. The password is read from --password_file if given, otherwise
from stdin. If stdin is a terminal, it prompts for the password (twice)
without echoing it. One trailing newline is removed from the password.
`
}

func (c *userPasswdCommand) SetFlags(f *flag.FlagSet) {
	f.StringVar(&c.username, "username", "", "Username")
	f.StringVar(&c.passwordFile, "password_file", "",
		"File containing the new password (default: read stdin)")
}

func (c *userPasswdCommand) Execute(ctx context.Context, f *flag.FlagSet, args ...interface{}) subcommands.ExitStatus {
	if c.username == "" {
		return c.usage("--username is required")
	}

	var dbPath string
	if err := c.unpackArgs(f, &dbPath); err != nil {
		return c.usage("Error: %v\n%s", err, c.Usage())
	}

	password, err := c.readPassword()
	if err != nil {
		return c.failure("failed to read password: %v", err)
	}
	if password == "" {
		return c.failure("password is empty")
	}

	db, err := database.Open(dbPath)
	if err != nil {
		return c.failure("failed to open database: %v", err)
	}

	numSessions, err := db.SetPassword(ctx, c.username, password)
	if err != nil {
		return c.failure("failed to set password: %v", err)
	}

	return c.success("Set password for user %v; deleted %d session(s)",
		c.username, numSessions)
}

func (c *userPasswdCommand) readPassword() (string, error) {
	if c.passwordFile != "" {
		b, err := os.ReadFile(c.passwordFile)
		if err != nil {
			return "", err
		}
		return trimNewline(string(b)), nil
	}

	fd := int(os.Stdin.Fd())
	if !term.IsTerminal(fd) {
		b, err := io.ReadAll(os.Stdin)
		if err != nil {
			return "", err
		}
		return trimNewline(string(b)), nil
	}

	password, err := promptPassword(fd, "New password: ")
	if err != nil {
		return "", err
	}
	again, err := promptPassword(fd, "Retype new password: ")
	if err != nil {
		return "", err
	}
	if password != again {
		return "", errors.New("passwords don't match")
	}
	return password, nil
}

func promptPassword(fd int, prompt string) (string, error) {
	fmt.Fprint(os.Stderr, prompt)
	b, err := term.ReadPassword(fd)
	fmt.Fprintln(os.Stderr) // the user's newline wasn't echoed
	return string(b), err
}

// trimNewline removes one trailing newline (\n or \r\n), as left by e.g.
// `echo password > file`.
func trimNewline(s string) string {
	if t, ok := strings.CutSuffix(s, "\n"); ok {
		return strings.TrimSuffix(t, "\r")
	}
	return s
}
