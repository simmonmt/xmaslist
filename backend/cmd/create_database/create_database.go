package main

import (
	"context"
	"flag"
	"log"

	"github.com/simmonmt/xmaslist/backend/database"
)

var (
	dbFile       = flag.String("db_file", "", "path to database")
	loadTestData = flag.Bool("load_test_data", false, "load test data?")
)

func genPassword(user *database.User) string {
	return user.Username + user.Username
}

func main() {
	flag.Parse()

	if *dbFile == "" {
		log.Fatalf("--db_file is required")
	}

	ctx := context.Background()

	db, err := database.Open(*dbFile)
	if err != nil {
		log.Fatalf("open fail: %v", err)
	}
	defer db.Close()

	if err = db.CreateTables(ctx); err != nil {
		log.Fatalf("create fail: %v", err)
	}

	if *loadTestData {
		users := []*database.User{
			&database.User{
				Username: "a",
				Fullname: "User A",
				Admin:    true,
			},
			&database.User{
				Username: "b",
				Fullname: "User B",
				Admin:    false,
			},
		}

		for _, user := range users {
			if _, err = db.AddUser(ctx, user, genPassword(user)); err != nil {
				log.Fatalf("failed to add %v: %v", user.Username, err)
			}
		}
	}
}
