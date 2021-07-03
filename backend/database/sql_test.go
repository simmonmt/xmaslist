package database

import (
	"database/sql"
	"testing"
	"time"
)

func TestAsSeconds(t *testing.T) {
	tm := time.Time{}
	var s sql.Scanner = asSeconds{&tm}
	if err := s.Scan(int64(1000)); err != nil {
		t.Errorf("s.Scan(1000) = %v, want nil", err)
		return
	}

	if got := tm.Unix(); got != 1000 {
		t.Errorf("tm.Unix() = %v, want 1000", tm.Unix())
	}
}

func TestNullSeconds(t *testing.T) {
	ns := &nullSeconds{}
	if err := sql.Scanner(ns).Scan(int64(1000)); err != nil {
		t.Errorf("s.Scan(1000) = %v, want nil", err)
		return
	}

	if !ns.Valid || ns.Time.Unix() != 1000 {
		t.Errorf("s.Scan(1000); %v, want %v",
			ns, nullSeconds{time.Unix(1000, 0), true})
	}

	if err := sql.Scanner(ns).Scan(nil); err != nil {
		t.Errorf("s.Scan(1000) = %v, want nil", err)
		return
	}

	if ns.Valid {
		t.Errorf("s.Scan(1000); %v, want %v",
			ns, nullSeconds{Valid: false})
	}

	if err := sql.Scanner(ns).Scan("bob"); err == nil {
		t.Errorf("s.Scan(1000) = non-nil, got nil")
		return
	}
}
